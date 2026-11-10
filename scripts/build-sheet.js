// 部署時抓 Google 試算表公告，存成 js/sheet-snapshot.js（網站抓不到試算表時的備份，也給 calendar.ics 用）
// 用法：node scripts/build-sheet.js            → 抓 data.js 設定的試算表
//       node scripts/build-sheet.js 檔案.csv   → 用本機 CSV 測試
const fs = require("fs");
const path = require("path");
const D = require("../js/data.js");
require("../js/sheet.js");

const OUT = path.join(__dirname, "..", "js", "sheet-snapshot.js");
const write = (csv) => fs.writeFileSync(OUT,
  "// Google 試算表公告的備份（網站抓不到試算表時使用）\n" +
  "// 這個檔案在每次部署時由 scripts/build-sheet.js 自動產生，不需要手動修改\n" +
  `var SHEET_SNAPSHOT = ${JSON.stringify(csv).replace(/</g, "\\u003c")};\n` +
  'if (typeof module !== "undefined") module.exports = SHEET_SNAPSHOT;\n');

async function main() {
  let csv;
  if (process.argv[2]) csv = fs.readFileSync(process.argv[2], "utf8");
  else if (!D.sheetUrl) { console.log("data.js 還沒有設定 sheet.csvUrl，略過試算表公告"); return; }
  else {
    const r = await fetch(D.sheetUrl, { redirect: "follow" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    csv = await r.text();
  }
  const list = D.parseSheet(csv);
  if (!list) throw new Error("讀到的內容沒有「標題」欄，可能不是公告試算表（或沒有發布到網路）");
  write(csv);
  console.log(`試算表公告 ${list.length} 則，已更新 js/sheet-snapshot.js`);
  list.forEach((a) => console.log(`- [${a.tag}] ${a.title}${a.due ? `（截止 ${a.due}）` : ""}${a.pinned ? "（置頂）" : ""}`));
}
main().catch((e) => { console.error("抓不到試算表，保留原本的備份：", e.message); process.exit(0); });
