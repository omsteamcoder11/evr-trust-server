const fs = require("fs");
const path = require("path");
const { generateIdCard } = require("../src/lib/idCard");

(async () => {
  const png = await generateIdCard({
    name: "Test Member",
    memberNo: "EVR1001",
    membershipType: "Ordinary Member",
    district: "Chennai",
    state: "Tamil Nadu",
  });

  const out = path.join(__dirname, "..", "test-card.png");
  fs.writeFileSync(out, png);
  console.log("Saved:", out);
})();