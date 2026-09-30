const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const W = 1011;
const H = 638;
const GAP = 40;

const RED = "#a11d24";
const RED_TXT = "#8f0d1a";
const DARK = "#3a0a0f";
const BRIGHT_GOLD = "#ffd633";

const ASSETS = path.join(__dirname, "..", "..", "assets");
const LOGO_PATH = path.join(ASSETS, "logo.png");
const FONT_DIR = path.join(ASSETS, "fonts");

const TRUST = {
  name: "Evr Periyar Peravai",
  sub: "Charitable Trust",
  tamilName: "ஈ.வெ.ரா. பெரியார் பேரவை", // change to the trust's exact Tamil name
  address: [
    "Simmaiya Nagar, Godavari Street,",
    "10-12/126, Virugambakkam,",
    "Chennai - 600092",
  ],
  phone: "04446563667",
  email: "evrperiyartrust@gmail.com",
};

/**
 * Tamil text needs a Tamil font on the server. If
 * assets/fonts/NotoSansTamil-Bold.ttf (or -Regular.ttf) exists, Tamil text
 * is used. Otherwise the card falls back to English only, so it never
 * shows empty boxes.
 */
function loadTamilFont() {
  for (const file of ["NotoSansTamil-Bold.ttf", "NotoSansTamil-Regular.ttf"]) {
    const fontPath = path.join(FONT_DIR, file);
    if (!fs.existsSync(fontPath)) continue;
    try {
      GlobalFonts.registerFromPath(fontPath, "NotoTamil");
      if (typeof GlobalFonts.has !== "function" || GlobalFonts.has("NotoTamil")) return true;
    } catch (err) {
      console.error("TAMIL FONT LOAD ERROR:", err.message);
    }
  }
  return false;
}

const TAMIL = loadTamilFont();
const TAMIL_FONT = "NotoTamil, Arial, sans-serif";

// Shrinks the font until the text fits the given width
function fitFont(ctx, text, maxWidth, startSize, weight, family) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 14) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// Draws an image fully inside the box without stretching it
function drawContain(ctx, img, x, y, w, h) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function paintGold(ctx, oy, glow) {
  const g = ctx.createLinearGradient(0, oy, W, oy + H);
  g.addColorStop(0, "#ffdc3a");
  g.addColorStop(0.55, "#ffc700");
  g.addColorStop(1, "#f3b400");
  ctx.fillStyle = g;
  ctx.fillRect(0, oy, W, H);

  if (glow) {
    const r = ctx.createRadialGradient(W / 2, oy + 218, 0, W / 2, oy + 218, 400);
    r.addColorStop(0, "rgba(255,243,168,0.95)");
    r.addColorStop(1, "rgba(255,243,168,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, oy, W, H);
  }
}

function drawTaglines(ctx, oy) {
  const t = TAMIL ? ["ஒற்றுமை", "சேவை", "முன்னேற்றம்"] : ["UNITY", "SERVICE", "PROGRESS"];
  ctx.fillStyle = RED_TXT;
  ctx.font = TAMIL ? `bold 24px ${TAMIL_FONT}` : "bold 22px Arial, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(t[0], 46, oy + 40);
  ctx.textAlign = "center";
  ctx.fillText(t[1], W / 2, oy + 40);
  ctx.textAlign = "right";
  ctx.fillText(t[2], W - 46, oy + 40);
  ctx.textAlign = "left";
}

function drawLogoBadge(ctx, logo, cx, cy, r) {
  circle(ctx, cx, cy, r + 8, BRIGHT_GOLD);
  circle(ctx, cx, cy, r + 4, RED);
  circle(ctx, cx, cy, r, "#ffffff");
  drawContain(ctx, logo, cx - r * 0.82, cy - r * 0.82, r * 1.64, r * 1.64);
}

function drawFront(ctx, oy, logo, photo, m) {
  ctx.save();
  roundRect(ctx, 0, oy, W, H, 28);
  ctx.clip();
  ctx.textBaseline = "alphabetic";

  paintGold(ctx, oy, false);

  // faint watermark
  ctx.globalAlpha = 0.07;
  drawContain(ctx, logo, W / 2 - 235, oy + 135, 470, 470);
  ctx.globalAlpha = 1;

  drawTaglines(ctx, oy);
  drawLogoBadge(ctx, logo, 100, oy + 106, 50);

  // trust name block
  const cx = 574;
  const maxW = 770;
  ctx.textAlign = "center";
  ctx.fillStyle = RED_TXT;
  const mainText = TAMIL ? TRUST.tamilName : TRUST.name.toUpperCase();
  fitFont(ctx, mainText, maxW, 50, "bold", TAMIL ? TAMIL_FONT : "Georgia, serif");
  ctx.fillText(mainText, cx, oy + 96);

  // pill under the name
  const pillText = TAMIL
    ? `${TRUST.name} ${TRUST.sub}`.toUpperCase()
    : TRUST.sub.toUpperCase();
  ctx.font = "bold 22px Arial, sans-serif";
  const pillW = Math.min(maxW, ctx.measureText(pillText).width + 56);
  roundRect(ctx, cx - pillW / 2, oy + 112, pillW, 34, 17);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = RED;
  ctx.stroke();
  ctx.fillStyle = RED_TXT;
  ctx.fillText(pillText, cx, oy + 136);

  // rule + ribbon
  ctx.fillStyle = "rgba(143,13,26,0.35)";
  ctx.fillRect(0, oy + 188, W, 3);

  const ribbonText = TAMIL ? "உறுப்பினர் அட்டை" : "MEMBERSHIP CARD";
  ctx.font = TAMIL ? `bold 26px ${TAMIL_FONT}` : "bold 26px Arial, sans-serif";
  const rw = ctx.measureText(ribbonText).width + 90;
  roundRect(ctx, W / 2 - rw / 2, oy + 168, rw, 42, 21);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = BRIGHT_GOLD;
  ctx.stroke();
  ctx.fillStyle = "#ffe9a3";
  ctx.fillText(ribbonText, W / 2, oy + 197);
  ctx.textAlign = "left";

  // photo with frame
  const px = 48;
  const py = oy + 244;
  const pw = 250;
  const ph = 316;
  roundRect(ctx, px - 10, py - 10, pw + 20, ph + 20, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = RED;
  ctx.stroke();

  ctx.save();
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.clip();
  if (photo) {
    // cover-fit the photo inside the frame
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const sw = pw / scale;
    const sh = ph / scale;
    const sx = (photo.width - sw) / 2;
    const sy = (photo.height - sh) / 2;
    ctx.drawImage(photo, sx, sy, sw, sh, px, py, pw, ph);
  } else {
    ctx.fillStyle = "#efe6d2";
    ctx.fillRect(px, py, pw, ph);
    circle(ctx, px + pw / 2, py + ph * 0.36, 52, "#c2b393");
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + ph * 0.98, 105, 135, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = "#c2b393";
    ctx.fill();
  }
  ctx.restore();

  // details (no underlines)
  const rows = [
    ["Name", m.name, true],
    ["Member No", m.memberNo, false],
    ["Type", m.membershipType, false],
    ["District", m.district, false],
    ["State", m.state, false],
  ];

  let y = oy + 292;
  const labelX = 336;
  const colonX = 540;
  const valueX = 566;
  for (const [label, value, highlight] of rows) {
    ctx.fillStyle = "#5a0d14";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(label, labelX, y);
    ctx.fillText(":", colonX, y);

    ctx.fillStyle = highlight ? "#c4121f" : DARK;
    fitFont(ctx, String(value || "-"), W - valueX - 48, 30, "bold", "Arial, sans-serif");
    ctx.fillText(String(value || "-"), valueX, y);

    y += 62;
  }

  // bottom band
  ctx.fillStyle = RED;
  ctx.fillRect(0, oy + H - 40, W, 40);
  ctx.fillStyle = BRIGHT_GOLD;
  ctx.fillRect(0, oy + H - 40, W, 4);
  ctx.fillStyle = "#f5e6c8";
  ctx.font = "22px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(TRUST.email, W / 2, oy + H - 12);
  ctx.textAlign = "left";

  ctx.restore();
}

function drawBack(ctx, oy, logo) {
  ctx.save();
  roundRect(ctx, 0, oy, W, H, 28);
  ctx.clip();
  ctx.textBaseline = "alphabetic";

  paintGold(ctx, oy, true);
  drawTaglines(ctx, oy);

  // emblem ring
  const cx = W / 2;
  const cy = oy + 218;
  circle(ctx, cx, cy, 152, RED);
  circle(ctx, cx, cy, 145, BRIGHT_GOLD);
  circle(ctx, cx, cy, 139, RED);
  circle(ctx, cx, cy, 131, "#ffffff");
  drawContain(ctx, logo, cx - 108, cy - 108, 216, 216);

  // trust name on the gold area
  ctx.textAlign = "center";
  ctx.fillStyle = RED_TXT;
  fitFont(ctx, `${TRUST.name} ${TRUST.sub}`.toUpperCase(), 880, 34, "bold", "Georgia, serif");
  ctx.fillText(`${TRUST.name} ${TRUST.sub}`.toUpperCase(), cx, oy + 410);

  // footer block
  const fy = oy + H - 215;
  ctx.fillStyle = RED;
  ctx.fillRect(0, fy, W, 215);
  ctx.fillStyle = BRIGHT_GOLD;
  ctx.fillRect(0, fy, W, 5);

  ctx.fillStyle = "#f5e6c8";
  ctx.font = "26px Arial, sans-serif";
  let y = fy + 54;
  for (const line of TRUST.address) {
    ctx.fillText(line, cx, y);
    y += 34;
  }

  ctx.fillStyle = BRIGHT_GOLD;
  const contact = `Phone: ${TRUST.phone}   |   ${TRUST.email}`;
  fitFont(ctx, contact, 900, 26, "bold", "Arial, sans-serif");
  ctx.fillText(contact, cx, fy + 176);

  ctx.textAlign = "left";
  ctx.restore();
}

/**
 * Makes one PNG image: front of the card on top, back below.
 * photo can be a file path or a Buffer (or omitted).
 */
async function generateIdCard({ name, memberNo, membershipType, district, state, photo }) {
  const logo = await loadImage(LOGO_PATH);

  let photoImg = null;
  if (photo) {
    try {
      photoImg = await loadImage(photo);
    } catch (err) {
      console.error("ID CARD PHOTO LOAD ERROR:", err.message);
    }
  }

  const canvas = createCanvas(W, H * 2 + GAP);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H * 2 + GAP);

  drawFront(ctx, 0, logo, photoImg, { name, memberNo, membershipType, district, state });
  drawBack(ctx, H + GAP, logo);

  return canvas.toBuffer("image/png");
}

module.exports = { generateIdCard };