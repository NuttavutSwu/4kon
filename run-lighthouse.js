const fs = require("fs");
const { execSync } = require("child_process");

if (!fs.existsSync("./reports")) {
  fs.mkdirSync("./reports");
}

const csv = fs.readFileSync("urls.csv", "utf-8");
const urls = csv
  .split("\n")
  .slice(1)
  .map(line => {
    const match = line.match(/^"([^"]+)"/);
    return match ? match[1] : null;
  })
  .filter(Boolean);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  for (const url of urls) {
    if (!url.includes("localhost:3000")) continue;

    const safeName = url.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    console.log("🚀 Running:", url);

    try {
      execSync(
        `npx lighthouse ${url} --output html --output-path=./reports/${safeName}.html --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"`,
        { stdio: "inherit" }
      );
    } catch (e) {
      console.log("❌ Error:", url);
    }

    // 🔥 หน่วง 3 วิ ให้ Chrome ปิดตัวเองก่อน
    await sleep(3000);
  }

  console.log("✅ DONE");
})();
