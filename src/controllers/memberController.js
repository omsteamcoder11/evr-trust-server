const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  getAllMembers,
  createMember,
  saveOrderId,
  markMemberPaidRazorpay,
  getMemberByToken,
  getMemberById,
  updateMemberStatus,
  deleteMember,
  resetMemberNumbers,
} = require("../models/memberModel");
const { generateIdCard } = require("../lib/idCard");
const { uploadToR2 } = require("../lib/r2");
const { sendIdCardLink, sendAdminNotification } = require("../lib/mailer");

const ALLOWED_STATUS = ["pending", "approved", "rejected"];
const MAX_ID_PHOTO_BYTES = 750 * 1024;

// Membership fee in paise (₹100 -> 10000). Set MEMBERSHIP_FEE in .env
// Read when needed (not at startup) so it never depends on when .env is loaded.
const getFeePaise = () => {
  const rupees = Number(process.env.MEMBERSHIP_FEE);
  return Math.round((rupees > 0 ? rupees : 100) * 100);
};

const uploadsDir = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Parses "YYYY-MM-DD", returns age in years or null if invalid/future
const ageFromDob = (dob) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || "");
  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age--;

  if (age < 0 || y < 1900) return null;
  return age;
};

// Gets the member's photo for the ID card.
// New photos come from R2 (a web address). Old photos may still be in uploads.
const getPhotoForCard = async (photoUrl) => {
  if (!photoUrl) return null;

  try {
    const res = await fetch(photoUrl);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("PHOTO FETCH ERROR:", err.message);
  }

  // Fallback for old photos saved in the local uploads folder
  try {
    const file = path.basename(new URL(photoUrl).pathname);
    const full = path.join(uploadsDir, file);
    return fs.existsSync(full) ? full : null;
  } catch {
    return null;
  }
};

// GET /api/members/fee — public. Lets the form show the real fee on the button.
const getFee = async (request, reply) => {
  return reply.send({ success: true, amount: getFeePaise() / 100 });
};

const getAll = async (request, reply) => {
  try {
    const data = await getAllMembers();
    return reply.send({ success: true, data });
  } catch (err) {
    console.error("GET MEMBERS ERROR:", err);
    return reply.status(500).send({ success: false, error: err.message });
  }
};

const create = async (request, reply) => {
  try {
    const b = request.body || {};

    const clean = {
      membership_type: (b.membership_type || "").trim(),
      name: (b.name || "").trim(),
      father_name: (b.father_name || "").trim(),
      date_of_birth: (b.date_of_birth || "").trim(),
      voter_id: (b.voter_id || "").trim().toUpperCase(),
      aadhaar: (b.aadhaar || "").trim(),
      mobile: (b.mobile || "").trim(),
      email: (b.email || "").trim().toLowerCase(),
      address: (b.address || "").trim(),
      pincode: (b.pincode || "").trim(),
      state: (b.state || "").trim(),
      city: (b.city || "").trim(),
      id_photo_url: (b.id_photo_url || "").trim(),
    };

    // These are optional now (the form no longer asks for them)
    const optional = {
      education: (b.education || "").trim(),
      assembly_constituency: (b.assembly_constituency || "").trim(),
      polling_booth: (b.polling_booth || "").trim(),
      whatsapp: (b.whatsapp || "").trim(),
      area: (b.area || "").trim(),
    };

    const missing = Object.keys(clean).filter((k) => !clean[k]);
    if (missing.length) {
      return reply.status(400).send({
        success: false,
        error: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const age = ageFromDob(clean.date_of_birth);
    if (age === null) {
      return reply
        .status(400)
        .send({ success: false, error: "Invalid date of birth" });
    }

    if (!/^\d{10}$/.test(clean.mobile)) {
      return reply.status(400).send({
        success: false,
        error: "Mobile number must be 10 digits",
      });
    }

    if (optional.whatsapp && !/^\d{10}$/.test(optional.whatsapp)) {
      return reply.status(400).send({
        success: false,
        error: "WhatsApp number must be 10 digits",
      });
    }

    if (!/^\d{12}$/.test(clean.aadhaar)) {
      return reply.status(400).send({
        success: false,
        error: "Aadhaar number must be 12 digits",
      });
    }

    if (!/^\d{6}$/.test(clean.pincode)) {
      return reply
        .status(400)
        .send({ success: false, error: "Pincode must be 6 digits" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
      return reply
        .status(400)
        .send({ success: false, error: "Invalid email address" });
    }

    const card_token = crypto.randomBytes(24).toString("hex");

    const data = await createMember({
      ...clean,
      ...optional,
      age,
      card_token,
    });

    // The member's browser needs the token to open the payment screen
    return reply.status(201).send({
      success: true,
      data: { id: data.id, name: data.name, card_token: data.card_token },
    });
  } catch (err) {
    if (err.code === "23505") {
      const field = (err.constraint || "").includes("voter")
        ? "voter ID"
        : "email";
      return reply.status(409).send({
        success: false,
        error: `A membership with this ${field} already exists`,
      });
    }

    console.error("CREATE MEMBER ERROR:", err);
    return reply.status(500).send({ success: false, error: err.message });
  }
};

// POST /api/members/pay/:token/order — public. Creates a Razorpay order.
const createOrder = async (request, reply) => {
  try {
    const razorpay = reply.server.razorpay; // from plugins/razorpay.js

    const member = await getMemberByToken(request.params.token);

    if (!member) {
      return reply.status(404).send({ success: false, error: "Invalid link" });
    }

    if (member.payment_status !== "pending_payment") {
      return reply
        .status(400)
        .send({ success: false, error: "Payment was already submitted" });
    }

    const order = await razorpay.orders.create({
      amount: getFeePaise(),
      currency: "INR",
      receipt: `mem_${member.id}_${Date.now()}`,
      notes: { member_id: String(member.id) },
    });

    await saveOrderId(request.params.token, order.id);

    return reply.send({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        name: member.name,
        email: member.email,
        mobile: member.mobile,
      },
    });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    return reply
      .status(500)
      .send({ success: false, error: "Could not start payment" });
  }
};

// POST /api/members/pay/:token/verify — public. Verifies the Razorpay payment.
// No ID card email is sent here — admin must approve first.
// The admin gets a "new application" email instead.
const verifyPayment = async (request, reply) => {
  try {
    const razorpay = reply.server.razorpay;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      request.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return reply
        .status(400)
        .send({ success: false, error: "Missing payment details" });
    }

    const existing = await getMemberByToken(request.params.token);
    if (!existing) {
      return reply.status(404).send({ success: false, error: "Invalid link" });
    }

    // Double click / retry with the same payment: return the same result
    if (
      existing.payment_status === "paid" &&
      existing.razorpay_payment_id === razorpay_payment_id
    ) {
      return reply.send({
        success: true,
        data: { name: existing.name, email: existing.email },
      });
    }

    // 1. Signature check
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const valid =
      expected.length === String(razorpay_signature).length &&
      crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(String(razorpay_signature))
      );

    if (!valid) {
      return reply
        .status(400)
        .send({ success: false, error: "Payment verification failed" });
    }

    // 2. Confirm amount and status with Razorpay itself
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== getFeePaise() ||
      !["captured", "authorized"].includes(payment.status)
    ) {
      return reply
        .status(400)
        .send({ success: false, error: "Payment is not valid" });
    }

    // 3. Mark paid (member number is created when the admin approves)
    const member = await markMemberPaidRazorpay(
      request.params.token,
      razorpay_order_id,
      razorpay_payment_id,
      payment.amount
    );

    if (!member) {
      return reply.status(400).send({
        success: false,
        error: "Order mismatch, or payment was already submitted",
      });
    }

    // Tell the admin about the new application.
    // No "await": if the email fails, the member's payment still succeeds.
    sendAdminNotification({
      name: member.name,
      mobile: member.mobile,
      email: member.email,
      membershipType: member.membership_type,
    }).catch((err) => console.error("ADMIN NOTIFICATION ERROR:", err));

    return reply.send({
      success: true,
      data: { name: member.name, email: member.email },
    });
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    return reply
      .status(500)
      .send({ success: false, error: "Could not confirm the payment" });
  }
};

// GET /api/members/card/:token — public. Builds the ID card and downloads it.
// Only works after admin has approved the member.
const downloadCard = async (request, reply) => {
  try {
    const member = await getMemberByToken(request.params.token);

    if (
      !member ||
      member.payment_status !== "paid" ||
      member.status !== "approved"
    ) {
      return reply
        .status(404)
        .send({ success: false, error: "ID card not found" });
    }

    const photo = await getPhotoForCard(member.id_photo_url);

    const png = await generateIdCard({
      name: member.name,
      memberNo: member.member_number,
      membershipType: member.membership_type,
      district: member.city,
      state: member.state,
      photo,
    });

    return reply
      .header("Content-Type", "image/png")
      .header(
        "Content-Disposition",
        `attachment; filename="EVR-ID-${member.member_number}.png"`
      )
      .send(png);
  } catch (err) {
    console.error("DOWNLOAD CARD ERROR:", err);
    return reply.status(500).send({ success: false, error: err.message });
  }
};

// PUT /api/members/:id — admin only. Approving sends the ID card email.
const updateStatus = async (request, reply) => {
  try {
    const { status } = request.body || {};

    if (!ALLOWED_STATUS.includes(status)) {
      return reply.status(400).send({
        success: false,
        error: "Status must be pending, approved or rejected",
      });
    }

    const current = await getMemberById(request.params.id);

    if (!current) {
      return reply
        .status(404)
        .send({ success: false, error: "Member not found" });
    }

    // Check payment BEFORE approving, so unpaid members never get a number
    if (status === "approved" && current.payment_status !== "paid") {
      return reply.status(400).send({
        success: false,
        error: "Cannot approve a member who has not paid",
      });
    }

    // Approving also creates the member number (if not already created)
    const data = await updateMemberStatus(request.params.id, status);

    let emailSent = null;

    if (status === "approved") {
      emailSent = true;
      try {
        const base =
          process.env.API_PUBLIC_URL ||
          `${request.protocol}://${request.headers.host}`;

        await sendIdCardLink({
          to: data.email,
          name: data.name,
          memberNo: data.member_number,
          downloadUrl: `${base}/api/members/card/${data.card_token}`,
        });
      } catch (mailErr) {
        emailSent = false;
        console.error("SEND ID CARD EMAIL ERROR:", mailErr);
      }
    }

    return reply.send({ success: true, data, email_sent: emailSent });
  } catch (err) {
    console.error("UPDATE MEMBER ERROR:", err);
    return reply.status(500).send({ success: false, error: err.message });
  }
};

const remove = async (request, reply) => {
  try {
    await deleteMember(request.params.id);
    return reply.send({ success: true, message: "Member deleted successfully" });
  } catch (err) {
    console.error("DELETE MEMBER ERROR:", err);
    return reply.status(500).send({ success: false, error: err.message });
  }
};

// POST /api/members/reset-numbers — admin only.
// Clears all member numbers and restarts the counter at `start`.
const resetNumbers = async (request, reply) => {
  try {
    const { confirm, start } = request.body || {};

    if (confirm !== "RESET") {
      return reply
        .status(400)
        .send({ success: false, error: "Type RESET to confirm" });
    }

    const startAt = Number(start);
    if (!Number.isInteger(startAt) || startAt < 1 || startAt > 999999) {
      return reply.status(400).send({
        success: false,
        error: "Start number must be 1 to 999999",
      });
    }

    const cleared = await resetMemberNumbers(startAt);
    return reply.send({ success: true, cleared });
  } catch (err) {
    console.error("RESET NUMBERS ERROR:", err);
    return reply.status(500).send({ success: false, error: err.message });
  }
};

// POST /api/members/upload — public, ID photo only, max 750KB. Saved in R2.
const uploadIdPhoto = async (request, reply) => {
  try {
    const data = await request.file({
      limits: { fileSize: MAX_ID_PHOTO_BYTES },
    });

    if (!data) {
      return reply
        .status(400)
        .send({ success: false, error: "No file uploaded" });
    }

    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(data.filename || "").toLowerCase();

    if (!allowed.includes(ext)) {
      return reply.status(400).send({
        success: false,
        error: "Only jpg, jpeg, png, webp files are allowed",
      });
    }

    let buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      if (err.code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.status(400).send({
          success: false,
          error: "ID photo must be under 750KB",
        });
      }
      throw err;
    }

    const mimeByExt = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };

    const url = await uploadToR2(
      {
        originalname: data.filename,
        buffer,
        mimetype: data.mimetype || mimeByExt[ext],
      },
      "members"
    );

    return reply.send({ success: true, url });
  } catch (err) {
    console.error("UPLOAD ID PHOTO ERROR:", err);
    return reply.status(500).send({ success: false, error: err.message });
  }
};

module.exports = {
  getAll,
  getFee,
  create,
  createOrder,
  verifyPayment,
  downloadCard,
  updateStatus,
  remove,
  resetNumbers,
  uploadIdPhoto,
};