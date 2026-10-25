// 由 js/data.js 產生可訂閱的 calendar.ics（含截止前 3 天、1 天提醒）
// 用法：node scripts/build-ics.js
const fs = require("fs");
const path = require("path");
const D = require("../js/data.js");

function parse(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || "23"}:${m[5] || "59"}:00+08:00`);
}
const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const e = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");

const lines = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//THU Athletic Clubs//ZH-TW", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  "X-WR-CALNAME:東海體能性社團截止日", "X-WR-TIMEZONE:Asia/Taipei", "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
];
for (const x of D.deadlines) {
  const at = parse(x.due);
  if (!at) { console.warn(`略過日期格式錯誤的項目：${x.title}（${x.due}）`); continue; }
  lines.push(
    "BEGIN:VEVENT", `UID:${x.id}@thuathletic`, `DTSTAMP:${z(new Date())}`,
    `DTSTART:${z(new Date(at.getTime() - 30 * 6e4))}`, `DTEND:${z(at)}`,
    `SUMMARY:${e("【截止】" + x.title)}`, `DESCRIPTION:${e((x.detail || "") + "\n" + (x.link || D.links.schedule))}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e("3 天後截止：" + x.title)}`, "TRIGGER:-P3D", "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e("明天截止：" + x.title)}`, "TRIGGER:-P1D", "END:VALARM",
    "END:VEVENT",
  );
}
lines.push("END:VCALENDAR");
const out = path.join(__dirname, "..", "calendar.ics");
fs.writeFileSync(out, lines.join("\r\n") + "\r\n");
console.log(`已產生 ${out}（${D.deadlines.length} 筆截止日）`);
