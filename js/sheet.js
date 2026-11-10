/* =========================================================
 * Google 試算表公告：讀取老師在試算表填寫的公告，加到 data.js 的公告最前面
 *
 * 試算表第一列是欄位名稱（順序可以調換）：
 *   分類｜標題｜內文｜連結｜按鈕文字｜截止日｜截止日名稱｜置頂｜隱藏
 * - 新公告加在最下面一列，網站上會排在最前面（最新的在上）。
 * - 「標題」必填；「分類」填館的 key（例如 培力、活動、經費），沒填算「行政」。
 * - 「置頂」「隱藏」填任何字（例如 v）就生效；隱藏的列不會出現在網站上（可用來先打草稿）。
 * - 「截止日」可寫 2026-11-20 17:00 或 2026/11/20 17:00；只有日期算當天 23:59。
 * - 「連結」只接受 https:// 開頭的網址。
 *
 * 網站開啟時直接讀試算表（抓不到時用 js/sheet-snapshot.js 裡最近一次部署時的備份）。
 * 試算表網址設定在 data.js 的 sheet.csvUrl。
 * ========================================================= */
(function (D, SNAP) {
  "use strict";
  if (!D) return;
  var CFG = D.sheet || {};
  var COLS = {
    "分類": "tag", "標題": "title", "內文": "body", "連結": "link", "按鈕文字": "linkText",
    "截止日": "due", "截止日名稱": "dueTitle", "置頂": "pinned", "隱藏": "hidden",
  };

  // 簡單的 CSV 解析（支援雙引號、欄位內換行）
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false, s = String(text || "").replace(/^﻿/, "");
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) {
        if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && s[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // 試算表可能把日期顯示成 2026/11/20 下午 5:00:00 等格式，統一轉成 "2026-11-20 17:00"
  function normDate(v) {
    var s = String(v || "").trim();
    var m = s.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    if (!m) return s;
    var out = m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
    var t = s.slice(m.index + m[0].length).match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
    if (t) {
      var h = +t[1];
      if (/下午|晚上|PM/i.test(s) && h < 12) h += 12;
      if (/上午|凌晨|AM/i.test(s) && h === 12) h = 0;
      out += " " + ("0" + h).slice(-2) + ":" + t[2];
    }
    return out;
  }

  // 由標題產生固定的編號（用來記錄已讀）
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  var safeUrl = function (u) { u = String(u || "").trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; };

  function toAnns(csv) {
    var rows = parseCSV(csv);
    if (!rows.length) return null;
    var head = rows[0].map(function (h) { return COLS[String(h).trim()] || String(h).trim(); });
    if (head.indexOf("title") < 0) return null; // 沒有「標題」欄，表示讀到的不是公告試算表
    var list = [], seen = {};
    rows.slice(1).forEach(function (r) {
      var x = {};
      head.forEach(function (k, i) { x[k] = String(r[i] == null ? "" : r[i]).trim(); });
      if (!x.title || x.hidden) return;
      var a = { id: "s-" + hash(x.title), tag: x.tag || "行政", title: x.title, fromSheet: true };
      while (seen[a.id]) a.id += "x";
      seen[a.id] = 1;
      if (x.body) a.body = x.body.replace(/\\n/g, "\n");
      var link = safeUrl(x.link);
      if (link) { a.link = link; if (x.linkText) a.linkText = x.linkText; }
      if (x.due) { a.due = normDate(x.due); if (x.dueTitle) a.dueTitle = x.dueTitle; }
      if (x.pinned) a.pinned = true;
      list.push(a);
    });
    return list.reverse(); // 試算表最下面（最新）排最前面
  }

  var base = D.announcements.slice();
  D.applySheet = function (csv) {
    var list = toAnns(csv);
    if (!list) return false;
    D.announcements = list.concat(base);
    D.sheetCount = list.length;
    return true;
  };
  D.sheetUrl = /^https:\/\/docs\.google\.com\/spreadsheets\//.test(CFG.csvUrl || "") ? CFG.csvUrl : "";

  var done = null;
  // 網頁用：先讀試算表（最多等 4 秒），抓不到就用備份
  D.loadSheet = function () {
    if (done) return done;
    var useSnap = function () { if (SNAP) D.applySheet(SNAP); };
    if (!D.sheetUrl || typeof fetch === "undefined") { useSnap(); return (done = Promise.resolve()); }
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    var url = D.sheetUrl + (D.sheetUrl.indexOf("?") < 0 ? "?" : "&") + "t=" + Math.floor(Date.now() / 6e4);
    done = fetch(url, { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { if (!D.applySheet(t)) useSnap(); })
      .catch(useSnap)
      .then(function () { clearTimeout(timer); });
    return done;
  };
  D.parseSheet = toAnns;
})(
  typeof SITE_DATA !== "undefined" ? SITE_DATA : typeof require !== "undefined" ? require("./data.js") : null,
  typeof SHEET_SNAPSHOT !== "undefined" ? SHEET_SNAPSHOT : typeof require !== "undefined" ? (function () { try { return require("./sheet-snapshot.js"); } catch (e) { return ""; } })() : ""
);
