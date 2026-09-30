require("dotenv").config();
console.log("HOST:", process.env.SMTP_HOST);
console.log("USER:", process.env.SMTP_USER);
console.log("PASS set:", !!process.env.SMTP_PASS);

const { sendIdCard } = require("./src/lib/mailer");

sendIdCard({
  to: process.env.SMTP_USER,
  name: "Test User",
  memberNo: "TEST-001",
})
  .then(() => console.log("Mail sent!"))
  .catch(console.error);