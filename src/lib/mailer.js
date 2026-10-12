const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // port 587 uses STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendIdCard = async ({ to, name, memberNo, attachments = [] }) => {
  return transporter.sendMail({
    from: `"Evr Periyar Peravai Charitable Trust" <${process.env.SMTP_USER}>`,
    to,
    subject: `Your Membership ID Card (No. ${memberNo})`,
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for joining Evr Periyar Peravai Charitable Trust.
      Your payment of ₹100 is received.</p>
      <p><b>Membership No: ${memberNo}</b></p>
      <p>Your ID card is attached to this email.</p>
      <p>Regards,<br/>Evr Periyar Peravai Charitable Trust</p>
    `,
    attachments,
  });
};

// Sends an email with a button that downloads the ID card
exports.sendIdCardLink = async ({ to, name, memberNo, downloadUrl }) => {
  return transporter.sendMail({
    from: `"Evr Periyar Peravai Charitable Trust" <${process.env.SMTP_USER}>`,
    to,
    subject: `Your Membership ID Card (No. ${memberNo})`,
    html: `
      <p>Dear ${name},</p>
      <p>Thank you for joining Evr Periyar Peravai Charitable Trust.
      Your payment of ₹100 is received.</p>
      <p><b>Membership No: ${memberNo}</b></p>
      <p>Click the button below to download your ID card.</p>
      <p>
        <a href="${downloadUrl}"
           style="display:inline-block;padding:12px 24px;background:#741019;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:bold;">
          Download ID Card
        </a>
      </p>
      <p style="font-size:12px;color:#666;">
        If the button doesn't work, copy this link into your browser:<br/>
        ${downloadUrl}
      </p>
      <p>Regards,<br/>Evr Periyar Peravai Charitable Trust</p>
    `,
  });
};

// Tells the admin that a new paid application has arrived
exports.sendAdminNotification = async ({ name, mobile, email, membershipType }) => {
  return transporter.sendMail({
    from: `"Evr Periyar Peravai Charitable Trust" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `New membership application: ${name}`,
    html: `
      <p>A new membership application has been received and paid.</p>
      <p>
        <b>Name:</b> ${name}<br/>
        <b>Mobile:</b> ${mobile}<br/>
        <b>Email:</b> ${email}<br/>
        <b>Membership type:</b> ${membershipType}
      </p>
      <p>Please open the admin panel to review and approve it.</p>
    `,
  });
};