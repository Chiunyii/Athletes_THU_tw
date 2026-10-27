// 抓行政院人事行政總處「天然災害停止上班及上課情形」，找出臺中市的停止上班公告，寫入 typhoon.json
// 由 .github/workflows/typhoon.yml 每 30 分鐘執行；網站開啟時讀這個檔，在課外組辦公時間標示「颱風假」
// 用法：node scripts/typhoon.js（也可以傳入已下載的 HTML 檔路徑做測試：node scripts/typhoon.js page.html）
const fs = require("fs");
const path = require("path");

const CITY = "臺中市";
const SRC = "https://www.dgpa.gov.tw/typh/daily/nds.html";
const OUT = path.join(__dirname, "..", "typhoon.json");
const KEEP_DAYS = 14; // 保留最近兩週的紀錄，本週辦公時間表才看得到

const pad2 = (n) => String(n).padStart(2, "0");
const twDate = (d) => { const t = new Date(d.getTime() + 8 * 3600e3); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const key = (p) => `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;

// 一段公告文字 → { half, note }；沒有停止上班就回傳 null
function judge(s) {
  if (!/停止上班/.test(s)) return null;
  if (/上午[^。，、]*照常上班[^。]*下午[^。，、]*停止上班/.test(s) || /下午停止上班/.test(s) && !/上午停止上班|全天/.test(s)) return { half: "pm", note: "下午停止上班" };
  if (/上午停止上班/.test(s) && /下午[^。，、]*照常上班/.test(s)) return { half: "am", note: "上午停止上班" };
  return { half: "", note: "停止上班" };
}

function parse(html, now = new Date()) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(td|tr|p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ");
  const at = text.indexOf(CITY);
  if (at < 0) return {};
  // 臺中市那一欄的文字：到下一個「○○市／○○縣」為止
  const rest = text.slice(at + CITY.length), stop = rest.search(/\n\s*\S{2}[市縣]\s*\n|\n\s*\S{2}[市縣][：:]/);
  const block = (stop > 0 ? rest.slice(0, stop) : rest.slice(0, 400)).replace(/\s+/g, " ");
  const today = twDate(now), tomorrow = twDate(new Date(now.getTime() + 864e5)), out = {};
  // 每一句各自判斷是哪一天
  block.split(/(?<=。)/).forEach((sent) => {
    const r = judge(sent); if (!r) return;
    let k = null;
    const m = sent.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (m) k = key({ y: today.y + (+m[1] < today.m - 6 ? 1 : 0), m: +m[1], d: +m[2] });
    else if (/明天|明日/.test(sent)) k = key(tomorrow);
    else if (/今天|今日/.test(sent) || !/明/.test(sent)) k = key(today);
    if (k) out[k] = { label: "颱風假", half: r.half, note: r.note, text: sent.trim().slice(0, 120) };
  });
  return out;
}

async function main() {
  const html = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : await (await fetch(SRC, { headers: { "user-agent": "Mozilla/5.0 (THU athletic portal)" } })).text();
  const found = parse(html);
  let old = {};
  try { old = JSON.parse(fs.readFileSync(OUT, "utf8")).days || {}; } catch {}
  const cut = key(twDate(new Date(Date.now() - KEEP_DAYS * 864e5)));
  const days = Object.fromEntries(Object.entries({ ...old, ...found }).filter(([k]) => k >= cut).sort());
  const next = JSON.stringify({ source: SRC, city: CITY, days }, null, 2) + "\n";
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (prev !== next) fs.writeFileSync(OUT, next);
  console.log(`臺中市：${Object.keys(found).length ? JSON.stringify(found) : "目前沒有停止上班公告"}${prev !== next ? "（已更新 typhoon.json）" : ""}`);
}

if (require.main === module) main().catch((e) => { console.error("抓取失敗，保留原本的 typhoon.json：", e.message); process.exit(0); });
module.exports = { parse };
