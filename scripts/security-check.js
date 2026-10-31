// 每日資安檢查：找出網站原始碼裡常見的資安風險
// 由 .github/workflows/security.yml 每天執行；有「錯誤」時工作會失敗，GitHub 會寄信通知
// 用法：node scripts/security-check.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = ["index.html", "list.html", "js/game.js", "js/data.js", "scripts/build-ics.js", "scripts/typhoon.js"]
  .concat(fs.readdirSync(path.join(ROOT, ".github/workflows")).map((f) => ".github/workflows/" + f));
// 允許載入程式或樣式的外部網域（多一個就要人工確認）
const SCRIPT_HOSTS = ["cdn.jsdelivr.net"];
const STYLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
// 網站執行時會 fetch 的資料來源
const FETCH_HOSTS = ["raw.githubusercontent.com"];

const errors = [], warns = [];
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const lineOf = (s, i) => s.slice(0, i).split("\n").length;

for (const f of FILES) {
  const s = read(f);
  // 1. 金鑰、密碼、私鑰不能出現在公開的儲存庫
  [[/gh[pousr]_[A-Za-z0-9]{30,}/g, "GitHub token"], [/AKIA[0-9A-Z]{16}/g, "AWS key"], [/AIza[0-9A-Za-z_\-]{35}/g, "Google API key"],
   [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "私鑰"], [/xox[baprs]-[A-Za-z0-9-]{10,}/g, "Slack token"],
   [/(password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s]{6,}["']/gi, "疑似密碼或金鑰"]]
    .forEach(([re, name]) => { let m; while ((m = re.exec(s))) errors.push(`${f}:${lineOf(s, m.index)} 出現${name}`); });
  if (!/\.(html|js)$/.test(f)) continue;
  // 2. 外部程式只能來自允許的網域，而且要鎖定版本
  for (const m of s.matchAll(/https?:\/\/([^/"'\s]+)\/npm\/([^"'\s]+)/g)) {
    if (!SCRIPT_HOSTS.includes(m[1])) errors.push(`${f}:${lineOf(s, m.index)} 從未允許的網域載入程式：${m[1]}`);
    if (!/@\d+\.\d+\.\d+/.test(m[2])) errors.push(`${f}:${lineOf(s, m.index)} 外部程式沒有鎖定版本：${m[0]}`);
  }
  for (const m of s.matchAll(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/g)) {
    const h = new URL(m[1]).host; if (!SCRIPT_HOSTS.includes(h)) errors.push(`${f}:${lineOf(s, m.index)} <script> 載入未允許的網域：${h}`);
  }
  for (const m of s.matchAll(/<link[^>]+href=["'](https?:\/\/[^"']+)["']/g)) {
    const h = new URL(m[1]).host; if (!STYLE_HOSTS.includes(h)) errors.push(`${f}:${lineOf(s, m.index)} <link> 載入未允許的網域：${h}`);
  }
  for (const m of s.matchAll(/fetch\(\s*[`"'](https?:\/\/[^/`"']+)/g)) {
    const h = new URL(m[1]).host; if (!FETCH_HOSTS.includes(h) && !f.startsWith("scripts/")) errors.push(`${f}:${lineOf(s, m.index)} 網頁從未允許的網域抓資料：${h}`);
  }
  // 3. 另開分頁的連結都要加 rel="noopener"，避免被開啟的頁面反過來控制本站
  for (const m of s.matchAll(/target=\\?["']_blank\\?["'][^>]*/g)) if (!/noopener/.test(m[0])) errors.push(`${f}:${lineOf(s, m.index)} target="_blank" 缺少 rel="noopener"`);
  // 4. 危險寫法
  [[/\beval\s*\(/g, "eval()"], [/new Function\s*\(/g, "new Function()"], [/document\.write\s*\(/g, "document.write()"]]
    .forEach(([re, name]) => { for (const m of s.matchAll(re)) errors.push(`${f}:${lineOf(s, m.index)} 使用了 ${name}`); });
}

// 5. 資料檔裡的連結：不能有 javascript:，非 https 的列為提醒
const data = require(path.join(ROOT, "js/data.js"));
const urls = [];
(function walk(v, at) {
  if (typeof v === "string") { if (/^(https?:|javascript:|data:)/i.test(v.trim())) urls.push([v.trim(), at]); }
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, at ? `${at}.${k}` : k));
})(data, "");
const hosts = new Set();
for (const [u, at] of urls) {
  if (/^(javascript|data):/i.test(u)) { errors.push(`data.js ${at} 連結使用 ${u.split(":")[0]}: 協定`); continue; }
  if (u.startsWith("http://")) warns.push(`data.js ${at} 連結不是 https（傳輸未加密）：${u.slice(0, 80)}`);
  try { hosts.add(new URL(u).host); } catch { errors.push(`data.js ${at} 連結格式錯誤：${u}`); }
}

// 6. 工作流程權限：只有颱風假檢查可以寫入儲存庫
for (const f of FILES.filter((x) => x.startsWith(".github/"))) {
  const s = read(f);
  if (/contents:\s*write/.test(s) && !/typhoon/.test(f)) errors.push(`${f} 要求寫入儲存庫的權限`);
  if (/pull_request_target/.test(s)) errors.push(`${f} 使用 pull_request_target（外部 PR 可取得權限）`);
}

const out = [];
out.push(`## 資安檢查（${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}）`);
out.push(errors.length ? `### ❌ 錯誤 ${errors.length} 項` : "### ✅ 沒有發現錯誤");
errors.forEach((e) => out.push(`- ${e}`));
if (warns.length) { out.push(`### ⚠️ 提醒 ${warns.length} 項`); warns.forEach((w) => out.push(`- ${w}`)); }
out.push(`### 資料檔連到的網域（${hosts.size} 個）`, [...hosts].sort().map((h) => "`" + h + "`").join("、"));
const text = out.join("\n");
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
process.exit(errors.length ? 1 : 0);
