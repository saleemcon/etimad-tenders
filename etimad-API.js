import fs from "fs-extra";
import puppeteer from "puppeteer";
import { Parser } from "json2csv";
import express from "express"; // Add this
import cors from "cors"; // Add this

const TENDER_URL = "https://tenders.etimad.sa/Tender/AllTendersForVisitor?PageSize=6&IsSearch=true&PublishDateId=5&TenderCategory=2&Sort=SubmitionDate&SortDirection=DESC";

// Start HTTP server to serve the JSON file
const app = express();
app.use(cors());
app.get('/tenders.json', (req, res) => {
  res.sendFile('D:/etimad-tenders/tenders.json');
});
app.listen(3000, () => console.log('📡 JSON server running on http://localhost:3000'));

async function main() {
  console.log("🚀 Etimad Tender Collector Started");
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  });

  const page = await browser.newPage();
  
  console.log("📥 Opening Etimad page...");
  await page.goto(TENDER_URL, { waitUntil: "networkidle2" });

  console.log("⌛ Waiting for tender cards to load...");
  await page.waitForSelector(".tender-card", { timeout: 30000 });

  console.log("📄 Extracting tenders...");

  const tenders = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".tender-card"));
    return cards.map((card) => {
      const ref = card.querySelector(".cont-bar")?.getAttribute("data-bar") || "";
      const title = card.querySelector("h3 a")?.innerText.trim() || "";
      const agencyText = card.querySelector("p.pb-2")?.innerText.trim() || "";
      const agency = agencyText.split("\n")[0].trim();
      const activity = card.querySelector(".col-12.pt-2 span")?.innerText.trim() || "";
      const tenderType = card.querySelector(".badge-primary")?.innerText.trim() || "";
      const publishDate = card.querySelector(".col-6 span")?.innerText.trim() || "";
      const remaining = card.querySelector(".text-chart-indicator")?.innerText.trim() || "";
      const price = card.querySelector(".saudi-riyal-symbol")?.innerText.trim() || "مجانا";
      const url = card.querySelector("h3 a")?.href || "";

      return {
        referenceNumber: ref,
        title,
        agency,
        activity,
        tenderType,
        publishDate,
        remainingDays: remaining,
        price,
        url,
      };
    });
  });

  console.log("📊 Total tenders collected:", tenders.length);

  await fs.writeJSON("D:/etimad-tenders/tenders.json", tenders, { spaces: 2 });
  console.log("💾 Saved tenders.json");

  if (tenders.length > 0) {
    try {
      const parser = new Parser();
      const csv = parser.parse(tenders);
      await fs.writeFile("D:/etimad-tenders/tenders.csv", csv);
      console.log("💾 Saved tenders.csv");
    } catch (err) {
      console.error("❌ Failed to save CSV:", err.message);
    }
  }

  await browser.close();
  console.log("✅ Done - Server still running to serve JSON");
}

main().catch((err) => console.error("❌ Error:", err));