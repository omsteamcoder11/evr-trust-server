const fs = require("fs");
const { generateIdCard } = require("./src/lib/idCard");

(async () => {
  const buf = await generateIdCard({
    name: "Sample Member",
    memberNo: "1001",
    membershipType: "Life Member",
    district: "Chennai",
    state: "Tamil Nadu",
  });
  fs.writeFileSync("card-test.png", buf);
  console.log("saved card-test.png");
})();