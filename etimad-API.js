import fs from "fs-extra";
import puppeteer from "puppeteer";
import { Parser } from "json2csv";
import express from "express";
import cors from "cors";
import path from "path";

// URLs
const TENDER_URL = "https://tenders.etimad.sa/Tender/AllTendersForVisitor?PageSize=6&IsSearch=true&PublishDateId=5&TenderCategory=2&Sort=SubmitionDate&SortDirection=DESC";

// Paths
const jsonPath = path.join(process.cwd(), "tenders.json");
const csvPath = path.join(process.cwd(), "tenders.csv");

// Start Express server
const app = express();
app.use(cors());

app.get("/tenders.json", (req, res) => {
  if (fs.existsSync(jsonPath)) {
    res.sendFile(jsonPath);
  } else {
    res.status(404).json({ error: "tenders.json not found yet." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`📡 JSON server running on port ${PORT}`));

// Main Puppeteer function
async function main() {
  console.log("🚀 Etimad Tender Collector Started");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  console.log("📥 Opening Etimad page...");
  await page.goto(TENDER_URL, { waitUntil: "networkidle2" });

  console.log("⌛ Waiting for tender cards to load...");
  await page.waitForSelector(".tender-card", { timeout: 30000 });

  console.log("📄 Extracting tenders...");

  const tenders = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".tender-card")).map((card) => {
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

      return { referenceNumber: ref, title, agency, activity, tenderType, publishDate, remainingDays: remaining, price, url };
    });
  });

  console.log("📊 Total tenders collected:", tenders.length);

  await fs.writeJSON(jsonPath, tenders, { spaces: 2 });
  console.log(`💾 Saved JSON to ${jsonPath}`);

  if (tenders.length > 0) {
    try {
      const parser = new Parser();
      const csv = parser.parse(tenders);
      await fs.writeFile(csvPath, csv);
      console.log(`💾 Saved CSV to ${csvPath}`);
    } catch (err) {
      console.error("❌ Failed to save CSV:", err.message);
    }
  }

  await browser.close();
  console.log("✅ Done - Server still running to serve JSON");
}

main().catch((err) => console.error("❌ Error:", err));
