/* 體能社團行政群島：Three.js
 * 大島中央 = 課外組（辦公室、路思義教堂、公告欄、小秘書啊牛的啊牛提醒、碼頭），外圈道路連到各「館」= 行政分類（由 data.js 的 islands 決定）。
 * 玩家可以（選填）建立角色：身份、職位、外觀；角色會沿著島上的道路走到各館蓋章。
 * 內容全部來自 js/data.js；這個檔案只負責群島、角色與資訊卡。 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const D = window.SITE_DATA;
const V3 = THREE.Vector3;
const TZ = "Asia/Taipei";
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LS = {
  get(k, d) { try { const v = localStorage.getItem("thuarch:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("thuarch:" + k, JSON.stringify(v)); } catch {} },
};
const pad2 = (n) => String(n).padStart(2, "0");

/* ---------------- 時間（一律台灣時間） ---------------- */
function parse(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || "23"}:${m[5] || "59"}:00+08:00`) : null;
}
function tw(d = new Date()) {
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
    .formatToParts(d).forEach((x) => (p[x.type] = x.value));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
const dayKey = (d) => { const p = tw(d); return Date.UTC(p.y, p.m - 1, p.d); };
const daysLeft = (due) => Math.round((dayKey(due) - dayKey(new Date())) / 864e5);
const fmt = (d) => { const p = tw(d); return `${p.m}/${p.d}（${WEEK[p.wd]}）${pad2(p.h)}:${pad2(p.min)}`; };
const toMin = (s) => { const [h, m] = s.split(":"); return +h * 60 + +m; };
/* 辦公日判斷：國定假日、補假、學校停止辦公日不上班；補班日即使是週末也上班 */
const HOLIDAYS = Object.assign({}, D.office.holidays || {}, D.office.closedDates || {});
const WORKDAYS = new Set(D.office.workdays || []);
const ymd = (p) => `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
const dayInfo = (date) => { const p = tw(date), k = ymd(p), name = HOLIDAYS[k];
  const open = WORKDAYS.has(k) || (!name && D.office.hours.days.includes(p.wd));
  return { p, key: k, open, holiday: !WORKDAYS.has(k) && name ? name : "" }; };
// 正式網站上自動抓最新的政府行政機關辦公日曆（當年與下一年）；抓不到就用 data.js 裡的清單
async function loadHolidays() {
  const y = tw().y;
  await Promise.all([y, y + 1].map(async (yr) => {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/ruyut/TaiwanCalendar/master/data/${yr}.json`, { cache: "force-cache" });
      if (!r.ok) return;
      (await r.json()).forEach((x) => {
        const k = `${x.date.slice(0, 4)}-${x.date.slice(4, 6)}-${x.date.slice(6)}`, weekend = x.week === "六" || x.week === "日";
        if (x.isHoliday && !weekend && !HOLIDAYS[k]) HOLIDAYS[k] = x.description || "放假";
        if (!x.isHoliday && weekend) WORKDAYS.add(k);
      });
    } catch {}
  }));
}
function officeStatus() {
  const h = D.office.hours, now = new Date(), today = dayInfo(now), p = today.p, cur = p.h * 60 + p.min;
  if (today.open) for (let i = 0; i < h.slots.length; i++) {
    const s = toMin(h.slots[i][0]), e = toMin(h.slots[i][1]);
    if (cur >= s && cur < e) return { open: true, short: "辦公中", text: `辦公中 · ${h.slots[i][1]} 前都有人` };
    if (cur < s) return { open: false, short: i ? "午休中" : "尚未開門", text: `${i ? "午休中" : "尚未開始"} · ${h.slots[i][0]} 開始辦公` };
  }
  const why = today.holiday ? `今天${today.holiday}不辦公` : today.open ? "下班了" : "今天不辦公";
  for (let k = 1; k <= 14; k++) {
    const nx = dayInfo(new Date(now.getTime() + k * 864e5));
    if (nx.open) return { open: false, short: today.holiday ? "放假中" : "休息中", holiday: today.holiday, text: `${why} · ${k === 1 ? "明天" : `${nx.p.m}/${nx.p.d}（週${WEEK[nx.p.wd]}）`} ${h.slots[0][0]} 開始辦公` };
  }
  return { open: false, short: "休息中", text: "目前休息" };
}

/* ---------------- 資料 ---------------- */
const deadlines = D.allDeadlines().map((x) => ({ ...x, at: parse(x.due) })).filter((x) => x.at).sort((a, b) => a.at - b.at);
const upcoming = () => deadlines.filter((x) => x.at >= new Date());
const passed = () => deadlines.filter((x) => x.at < new Date()).reverse(); // 最近截止的在上
let showPast = false;
const anns = D.announcements.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // 其餘依 data.js 的順序（最新在上）
let read = LS.get("read", []);
let stamps = LS.get("stamps", {});
let tasks = LS.get("tasks", {});
const unread = () => anns.filter((a) => !read.includes(a.id));
const CLUBS = D.clubs || [];
const ROLES = D.roles || ["社長", "幹部", "社員"];
// 每種行政分類主要由哪些職位負責（用來提醒「這是你的事」）
const DUTY = { 會議: ["社長", "副社長", "幹部", "輔導老師"], 行政: ["社長", "副社長", "文書"], 活動: ["社長", "活動", "輔導老師"], 經費: ["社長", "財務", "輔導老師"], 場地: ["社長", "副社長", "活動", "幹部"], 安全: ["社長", "副社長", "活動", "幹部", "輔導老師"], 器材: ["器材", "幹部"], 評鑑: ["社長", "副社長", "文書"], 交接: ["社長", "副社長", "文書", "財務", "器材"], 財產: ["器材", "財務"] };

const ISL = D.islands.map((d, i) => ({ ...d, i, no: pad2(i + 1), guides: D.guides.filter((g) => g.island === d.key) }));
const isleOf = (key) => ISL.find((d) => d.key === key);
const isleDl = (d) => upcoming().filter((x) => x.category === d.key);
const isleNews = (d) => anns.filter((a) => a.tag === d.key);
const lvl = (n) => (n <= 3 ? "hot" : n <= 7 ? "warn" : "ok");
const CENTER_SPOTS = [
  { id: "office", no: "00", name: "課外組峮老師", icon: "🏛" },
  { id: "news", no: "✎", name: "公告欄", icon: "📌" },
  { id: "todo", no: "◷", name: "啊牛提醒", icon: "🐮" },
  { id: "links", no: "↗", name: "出航碼頭", icon: "⛵" },
];
const stampCount = () => STAMPS.filter((s) => stamps[s.id]).length;
const STAMPS = [...CENTER_SPOTS.map((s) => ({ id: s.id, name: s.name, no: s.no })), ...ISL.map((d) => ({ id: "isle:" + d.key, name: d.name, no: d.no }))];

/* 社團行政任務：每學期共同項目 + 該學期項目；共同項目每學期各自打勾 */
const TODO = Object.assign({ common: [], s1: [], s2: [] }, D.todos);
const SEM_NAME = { s1: "第一學期", s2: "第二學期" };
const curSem = () => { const m = tw().m; return m >= 2 && m <= 7 ? "s2" : "s1"; };
const todoKey = "todo:" + ((D.term || "").match(/\d+/) || [""])[0]; // 依學年度分開記錄，新學年自動重來
let todoDone = LS.get(todoKey, {});
const todoList = (sem) => [...TODO.common.map((x) => ({ ...x, sem: "common", key: sem + ":" + x.id })), ...(TODO[sem] || []).map((x) => ({ ...x, sem, key: sem + ":" + x.id }))];
const todoLeft = (sem = curSem()) => todoList(sem).filter((x) => !todoDone[x.key]).length;

/* 角色 */
const SHIRTS = ["#C8623F", "#3E6E9E", "#5F8F5A", "#E8B04B", "#7E5A9B", "#2A211C", "#E9E2D6", "#C97A8F"];
const HAIRS = ["#2B2118", "#5A3B28", "#8A5A3B", "#C9A36A", "#1F2A44"];
const SKINS = ["#F6D7BE", "#E9BC98", "#C98E66", "#8E5B3C"];
let me = Object.assign({ name: "", club: "", role: "社員", shirt: SHIRTS[1], hair: HAIRS[0], skin: SKINS[0] }, LS.get("me", {}));
me.role = ({ 活動長: "活動", 器材長: "器材", 公關: "幹部" })[me.role] || me.role; // 舊版職位名稱
const myDuty = (d) => !!me.club && (DUTY[d.key] || []).includes(me.role);
const myProp = () => (CLUBS.find((c) => c.name === me.club) || {}).prop;

/* ---------------- Three.js 基本 ---------------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $("stage"), antialias: true }); }
catch (e) {
  $("splash").hidden = true;
  document.body.insertAdjacentHTML("beforeend", '<div id="nogl"><div class="card"><b>這台裝置無法顯示 3D 群島</b><p>可以改看文字版，內容完全相同。</p><a class="btn" href="list.html">開啟文字版</a></div></div>');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();

/* 島嶼佈局：一座大島。中央是課外組與圓環，外圈環狀道路連到各行政分類的建築區（正前方留給碼頭） */
const FACE = Math.PI / 4;
const FACE_DIR = new V3(Math.sin(FACE), 0, Math.cos(FACE));
const NI = ISL.length;
const front = Math.atan2(FACE_DIR.z, FACE_DIR.x);
const R_ISLE = 21;           // 大島半徑
const RW = 3.9, RO = 12.3;   // 角色走的路線：中央圓環、外圈環狀道路（車道中心）
const R_LOT = 16.4;          // 各分類建築區的中心
const MAIN = ISL.filter((d) => !d.islet), OFF = ISL.filter((d) => d.islet);
const NM = MAIN.length;
MAIN.forEach((d, i) => {
  d.a = front + Math.PI / NM + (i * 2 * Math.PI) / NM;
  d.dir = new V3(Math.cos(d.a), 0, Math.sin(d.a));
  d.pos = d.dir.clone().multiplyScalar(R_LOT);
});
// 圓環到外圈的連絡道路：建築區少時每館一條，多時每隔一館一條
const SPOKES = MAIN.filter((d, i) => NM <= 3 || i % 2 === 0).map((d) => d.a);
// 獨立小島：data.js 裡 islet 名稱相同的館放在同一座小島，以橋接到本島外圈道路
// 小島方位（相對鏡頭正前方）；沒列在這裡的小島依序往外放
const ISLET_AT = { "場地器材島": -Math.PI / 3, "活動島": (Math.PI * 8) / 9, "行政島": Math.PI / 3 };
const ISLET_MTN = new Set(["活動島"]); // 島中央後方放一座登山的小山
const ISLET_EN = { "場地器材島": "Venue & Equipment Isle", "活動島": "Activity Isle", "行政島": "Administration Isle" };
const ISLETS = [...new Set(OFF.map((d) => d.islet))].map((name, k) => {
  const halls = OFF.filter((d) => d.islet === name), big = halls.length > 2;
  const a = front + (ISLET_AT[name] ?? -Math.PI / 3 + k * 1.2), dir = new V3(Math.cos(a), 0, Math.sin(a)), r = big ? 10.5 : 8;
  const pos = dir.clone().multiplyScalar(R_ISLE + r + 5.5);
  const I = { a, dir, r, pos, name, halls, coast: dir.clone().multiplyScalar(R_ISLE * 0.92), entry: pos.clone().sub(dir.clone().multiplyScalar(r * 0.88)) };
  const perp = new V3(-dir.z, 0, dir.x);
  I.halls.forEach((d, i) => {
    d.isl = I;
    if (big) { // 四館以上：前後兩排、左右排開
      const row = i % 2, col = Math.floor(i / 2), cols = Math.ceil(I.halls.length / 2), side = cols === 1 ? 0 : (col / (cols - 1)) * 2 - 1;
      d.pos = pos.clone().add(perp.clone().multiplyScalar(side * 3.9)).add(dir.clone().multiplyScalar(row ? 4.3 : -1.2));
      d.dir = d.pos.clone().sub(pos).setY(0).normalize();
    } else {
      const side = I.halls.length === 1 ? 0 : (i / (I.halls.length - 1)) * 2 - 1; // 小島上左右排開
      d.dir = perp.clone().multiplyScalar(side || 1).add(dir.clone().multiplyScalar(0.35)).normalize();
      d.pos = pos.clone().add(perp.clone().multiplyScalar(side * 3.6)).add(dir.clone().multiplyScalar(1.2));
    }
    d.a = Math.atan2(d.dir.z, d.dir.x);
  });
  return I;
});
const WORLD_R = ISLETS.length ? R_ISLE + 2 * Math.max(...ISLETS.map((I) => I.r)) + 6 : R_ISLE + 1;
// 鏡頭取景：以本島為主，往小島的方向偏一點，讓所有島都放得進畫面
const CAM_R = ISLETS.length ? R_ISLE + 10 + (ISLETS.length - 1) * 3.5 : R_ISLE + 1;
const HOME_C = ISLETS.reduce((v, I) => v.add(I.dir.clone().multiplyScalar(8.5 / ISLETS.length)), new V3(0, 0, 0));

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -300, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.2;
controls.minZoom = 0.7;
controls.maxZoom = 6;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.addEventListener("change", () => {
  const t = controls.target, l = Math.hypot(t.x, t.z);
  if (l > WORLD_R) { const f = WORLD_R / l, dx = t.x * f - t.x, dz = t.z * f - t.z; t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
});
const HOME = { phi: 0.98, theta: FACE };
const homeZoom = () => (innerWidth >= 900 ? 0.84 : innerWidth < 600 ? 0.86 : 1);

const hemi = new THREE.HemisphereLight(0xfff6ea, 0x8a9a72, 1.2);
const sun = new THREE.DirectionalLight(0xfff0dc, 2);
sun.position.set(25, 40, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -WORLD_R, right: WORLD_R, top: WORLD_R, bottom: -WORLD_R, near: 1, far: 140 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun);

let night = 0;
function applySky() {
  const h = tw().h;
  const s = h >= 6 && h < 17 ? { bg: 0xe6eadf, sun: 2, hemi: 1.2, n: 0 } : h >= 17 && h < 19 ? { bg: 0xf1d6bd, sun: 1.4, hemi: 0.95, n: 0.5 } : h === 5 ? { bg: 0xdcdfe6, sun: 1.2, hemi: 0.9, n: 0.4 } : { bg: 0x3b4763, sun: 0.7, hemi: 0.75, n: 1 };
  scene.background = new THREE.Color(s.bg);
  document.body.style.background = "#" + s.bg.toString(16).padStart(6, "0");
  sun.intensity = s.sun; hemi.intensity = s.hemi; night = s.n;
}

/* ---- 低多邊形工具 ---- */
const MC = new Map();
const mat = (c, x = {}) => { const k = c + JSON.stringify(x); if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.88, ...x })); return MC.get(k); };
const soft = (c) => mat(c, { flatShading: false, roughness: 0.7 });
function mesh(geo, c, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, c && c.isMaterial ? c : mat(c));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const box = (p, w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z, p);
const cyl = (p, rt, rb, h, c, x, y, z, seg = 8) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y + h / 2, z, p);
const cone = (p, r, h, c, x, y, z, seg = 6) => mesh(new THREE.ConeGeometry(r, h, seg), c, x, y + h / 2, z, p);
const ball = (p, r, c, x, y, z, det = 0) => mesh(new THREE.IcosahedronGeometry(r, det), c, x, y, z, p);
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const FONT = '"Noto Sans TC", "PingFang TC", sans-serif';
const MONO = '"Space Mono", ui-monospace, monospace';
function textPlane(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * 128); cv.height = Math.round(h * 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.userData.redraw = () => { const c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); draw(c, cv.width, cv.height); tex.needsUpdate = true; };
  m.userData.redraw();
  return m;
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const C = { grass: 0x78c850, sand: 0xf8e3a3, cliff: 0xe3cfa2, plaza: 0xf6ecd4, path: 0x9aa4b0, road: 0x8d97a5, wall: 0xfff6e8, roof: 0xff7a59, wood: 0xd99a5b, dark: 0x8a5a33, tree1: 0x4fb83f, tree2: 0x6fcf4a, tree3: 0x8ddc5a, pine: 0x3fa64a, shallow: 0xa9d3cf };

/* ---- 海、遠山 ---- */
const seaGeo = new THREE.PlaneGeometry(360, 360, 80, 80);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = seaGeo.attributes.position.array.slice();
const sea = mesh(seaGeo, mat(0x86b7b8, { roughness: 0.5 }), 0, -1.15, 0);
sea.castShadow = false;
scene.add(sea);
// 島後方的山：平行投影下會出現在畫面上方，像政策島背後的山林
for (let i = 0; i < 16; i++) {
  const a = front + Math.PI + (i / 15 - 0.5) * 2.6, r = 70 + hash("mr" + i) * 22, h = 10 + hash("mh" + i) * 14, rad = 12 + hash("md" + i) * 10;
  const m = cone(scene, rad, h, [0xa9b98c, 0x9fb083, 0xb4c299][i % 3], Math.cos(a) * r, -1.3, Math.sin(a) * r, 7);
  m.castShadow = false; m.rotation.y = hash("mo" + i) * 3;
  for (let k = 0; k < 5; k++) {
    const ta = a + (hash("ta" + i + k) - 0.5) * 0.18, tr = r - rad * (0.3 + hash("tr" + i + k) * 0.5);
    cone(scene, 1.2, 3.4, 0x6d8c55, Math.cos(ta) * tr, -1.2 + h * 0.2 + hash("ty" + i + k) * h * 0.3, Math.sin(ta) * tr, 5).castShadow = false;
  }
}

/* ---- 島 ---- */
const pickables = [];
const tag = (obj, info) => { obj.traverse((o) => { if (o.isMesh) o.userData.pick = info; }); pickables.push(obj); };
function landmass(parent, r, seed) {
  const wob = (a) => 1 + 0.07 * Math.sin(3 * a + seed) + 0.045 * Math.sin(5 * a + seed * 1.7);
  const layer = (rt, rb, h, y, c) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 32, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), f = wob(Math.atan2(z, x)); p.setX(i, x * f); p.setZ(i, z * f); }
    g.computeVertexNormals();
    return mesh(g, c, 0, y, 0, parent);
  };
  const top = layer(r, r * 0.97, 0.8, -0.4, soft(C.grass));
  layer(r * 1.1, r * 1.13, 0.5, -0.95, soft(C.sand));
  layer(r * 0.97, r * 0.62, 2.6, -2.1, C.cliff);
  const sh = layer(r * 1.22, r * 1.22, 0.05, -1.08, mat(C.shallow, { flatShading: false, transparent: true, opacity: 0.75, roughness: 0.3 })); // 淺灘
  sh.castShadow = false; sh.receiveShadow = false;
  return { top, wob };
}
const world = new THREE.Group();
scene.add(world);

/* ---- 建築 ---- */
// 課外組：峮老師的巨型角色（齊劉海中長髮），旁邊站著橘白貓與灰白貓；腳邊招牌顯示辦公狀態
function catModel(base, white) {
  const g = new THREE.Group(), B = soft(base), W = soft(white), dark = soft(0x2a211c), pink = soft(0xf0a0a0);
  const body = mesh(new THREE.SphereGeometry(0.42, 16, 12), B, 0, 0.45, -0.05, g); body.scale.set(0.9, 1.1, 1);
  const chest = mesh(new THREE.SphereGeometry(0.28, 14, 10), W, 0, 0.5, 0.22, g); chest.scale.set(1, 1.2, 0.6);
  [-0.15, 0.15].forEach((x) => mesh(new THREE.SphereGeometry(0.11, 10, 8), W, x, 0.08, 0.28, g));
  const head = new THREE.Group(); head.position.set(0, 1.02, 0.05); g.add(head);
  const hd = mesh(new THREE.SphereGeometry(0.34, 18, 14), B, 0, 0, 0, head); hd.scale.set(1.1, 0.95, 0.95);
  const mz = mesh(new THREE.SphereGeometry(0.16, 12, 10), W, 0, -0.1, 0.24, head); mz.scale.set(1.3, 0.8, 0.7);
  mesh(new THREE.SphereGeometry(0.035, 8, 6), pink, 0, -0.04, 0.35, head);
  [-0.13, 0.13].forEach((x) => { mesh(new THREE.SphereGeometry(0.045, 8, 6), dark, x, 0.05, 0.3, head); const e = mesh(new THREE.ConeGeometry(0.12, 0.24, 4), B, x * 1.7, 0.3, -0.02, head); e.rotation.z = x > 0 ? -0.35 : 0.35; });
  const tail = mesh(new THREE.TorusGeometry(0.32, 0.06, 6, 14, Math.PI * 1.1), B, 0.32, 0.38, -0.3, g); tail.rotation.set(0, Math.PI / 2, -0.4);
  g.userData.tail = tail;
  return g;
}
function bOffice(g) {
  cyl(g, 2.4, 2.5, 0.3, 0xe2d6c3, 0, 0, 0, 24);
  const T = person({ shirt: "#C8623F", hair: "#3B2E26", skin: "#F3D2B8" });
  const hair = soft(0x3b2e26);
  // 中長髮：後腦到肩膀的髮片，前額齊劉海
  const back = mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.72, 20, 1, true, Math.PI / 3, (Math.PI * 4) / 3), mat(0x3b2e26, { flatShading: false, roughness: 0.7, side: THREE.DoubleSide }), 0, 1.22, -0.02, T);
  back.castShadow = true;
  mesh(new THREE.CylinderGeometry(0.455, 0.45, 0.17, 20, 1, false, -Math.PI / 3.2, (Math.PI * 2) / 3.2), hair, 0, 1.68, 0.02, T);
  const mouth = mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), soft(0xb04a3a), 0, 1.33, 0.4, T); mouth.rotation.z = Math.PI;
  T.scale.setScalar(3.1); T.position.y = 0.3; g.add(T);
  g.userData.giant = T;
  const orange = catModel(0xe8913f, 0xfbfaf6); orange.scale.setScalar(1.15); orange.position.set(-1.7, 0.3, 0.6); orange.rotation.y = 0.35; g.add(orange);
  const gray = catModel(0x9aa0a6, 0xfbfaf6); gray.scale.setScalar(1.05); gray.position.set(1.75, 0.3, 0.5); gray.rotation.y = -0.4; g.add(gray);
  g.userData.cats = [orange, gray];
  // 腳邊的辦公狀態招牌（燈會依辦公時間亮起）
  const win = mat(0xf6efe2, { emissive: 0xffc77a, emissiveIntensity: 0 });
  g.userData.win = win;
  [-1.55, 1.55].forEach((x) => { cyl(g, 0.06, 0.06, 0.95, C.dark, x, 0.3, 2.35, 5); mesh(new THREE.SphereGeometry(0.13, 10, 8), win, x, 1.35, 2.35, g); });
  const sign = textPlane(2.9, 0.75, (c, w, h) => {
    const st = officeStatus();
    rr(c, 4, 4, w - 8, h - 8, 22); c.fillStyle = "#2A211C"; c.fill();
    c.fillStyle = "#FFFDF9"; c.font = `900 ${h * 0.42}px ${FONT}`; c.textBaseline = "middle"; c.fillText("課外組峮老師", 22, h / 2 + 2);
    c.fillStyle = st.open ? "#8FD6A0" : "#F19A84"; c.font = `700 ${h * 0.36}px ${FONT}`; c.textAlign = "right"; c.fillText(st.short, w - 24, h / 2 + 2);
  });
  sign.position.set(0, 0.95, 2.4); g.add(sign);
  g.userData.sign = sign; g.userData.h = 6.5;
}
// 路思義教堂：島上的地標造景（沒有點擊功能）。前後兩對弧形屋面（後面那對較高、較寬），
// 兩片屋面在頂端留一道天窗縫，前後之間也留一道縫，正面是有橫格的玻璃立面，頂上有十字架
function tileTex() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const c = cv.getContext("2d");
  c.fillStyle = "#D9B45E"; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = "#B8913F"; c.lineWidth = 3;
  for (let k = -128; k <= 256; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 128, 128); c.stroke(); c.beginPath(); c.moveTo(k, 128); c.lineTo(k + 128, 0); c.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 4); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glassTex(door) {
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 256; const c = cv.getContext("2d");
  c.fillStyle = "#8FA9AE"; c.fillRect(0, 0, 128, 256);
  c.strokeStyle = "#3E4A4C"; c.lineWidth = 3;
  for (let y = 18; y < 256; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y); c.stroke(); }
  c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 256); c.stroke();
  if (door) { c.fillStyle = "#F3E6CE"; c.beginPath(); c.moveTo(48, 256); c.lineTo(48, 222); c.lineTo(64, 212); c.lineTo(80, 222); c.lineTo(80, 256); c.fill(); c.stroke(); c.fillStyle = "#2A211C"; c.fillRect(0, 240, 46, 8); c.fillRect(82, 240, 46, 8); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 由網格點建一片曲面：f(u, s) 回傳 [x, y, z]
function surf(f, nu, ns, m, parent, flip) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= ns; i++) for (let j = 0; j <= nu; j++) { pos.push(...f(j / nu, i / ns)); uv.push(j / nu, i / ns); }
  for (let i = 0; i < ns; i++) for (let j = 0; j < nu; j++) { const a = i * (nu + 1) + j, b = a + nu + 1; flip ? idx.push(a, a + 1, b, b, a + 1, b + 1) : idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
}
function bClock(g) {
  cyl(g, 2.9, 3, 0.25, 0xe2d6c3, 0, 0, 0, 24);
  const tx = tileTex(), tiles = new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.6, side: THREE.DoubleSide });
  const ch = new THREE.Group(); ch.position.set(0, 0.25, -0.2); g.add(ch); // 正面朝鏡頭，與正立面圖一致
  const GAP = 0.06, P = 1.8, H1 = 3.05, H2 = 3.5, Wf = 0.75, Wj = 2.25, Wr = 0.8;
  const zF = 1.75, zJ = -0.45, zR = -1.65; // 正面、前後交接處、背面
  const half = (w, s) => GAP + w * Math.pow(1 - s, P);
  // 前面那對：前窄後寬，頂高 H1；正面是一個垂直平面，左右對稱
  const frontZ = () => zF;
  [-1, 1].forEach((sd) => surf((u, s) => [sd * half(Wf + (Wj * 0.92 - Wf) * u, s), H1 * s, frontZ(s) + (zJ - frontZ(s)) * u], 8, 14, tiles, ch, sd < 0));
  // 後面那對：前寬後窄（弧形收窄），頂高 H2，背面頂端略往內收
  [-1, 1].forEach((sd) => surf((u, s) => [sd * half(Wr + (Wj - Wr) * Math.pow(1 - u, 2), s), H2 * s, zJ - 0.08 + (zR + 0.18 * s - zJ + 0.08) * u], 8, 14, tiles, ch, sd < 0));
  // 玻璃立面：正面（含門）、前後交接處露出的部分、背面
  const face = (w, H, zf, tex) => surf((u, s) => { const x = half(w, s) * 0.97; return [-x + 2 * x * u, H * s, zf(s)]; }, 1, 14, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, side: THREE.DoubleSide }), ch);
  face(Wf, H1, frontZ, glassTex(true));
  face(Wj, H2, () => zJ - 0.1, glassTex(false));
  face(Wr, H2, (s) => zR + 0.18 * s, glassTex(false));
  // 十字架
  box(ch, 0.06, 1.1, 0.06, 0x2a211c, 0, H2, zJ - 0.1); box(ch, 0.45, 0.06, 0.06, 0x2a211c, 0, H2 + 0.78, zJ - 0.1);
  g.userData.h = H2 + 1.4;
}
function bBoard(g) {
  [-1.3, 1.3].forEach((x) => box(g, 0.2, 2.6, 0.2, C.dark, x, 0, 0));
  box(g, 3, 1.8, 0.2, C.wood, 0, 0.9, 0);
  box(g, 3.3, 0.25, 0.5, C.roof, 0, 2.7, 0);
  const notes = textPlane(2.7, 1.5, (c, w, h) => {
    c.fillStyle = "#F3E6CE"; c.fillRect(0, 0, w, h);
    ["#FFF1B8", "#F9D3C2", "#DCEBE6", "#E4EDCF"].forEach((col, i) => { c.save(); c.translate(30 + (i * (w - 60)) / 4, 40 + (i % 2) * 24); c.rotate((i % 2 ? 1 : -1) * 0.06); c.fillStyle = col; c.fillRect(0, 0, (w - 80) / 4, h - 104); c.restore(); });
    c.fillStyle = "#2A211C"; c.font = `900 ${h * 0.2}px ${FONT}`; c.textAlign = "center"; c.fillText("公告", w / 2, h - 14);
  });
  notes.position.set(0, 1.8, 0.11); g.add(notes);
  g.userData.h = 4.2;
}
function sailboat(col) {
  const boat = new THREE.Group();
  box(boat, 1.2, 0.6, 2.8, col, 0, 0, 0);
  box(boat, 1, 0.1, 2.5, 0xf5ead2, 0, 0.6, 0);
  cyl(boat, 0.05, 0.05, 2.4, 0xdddddd, 0, 0.6, -0.1, 5);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.8, -0.2, 0, 2.9, -0.2, 0, 0.8, -1.4], 3));
  sg.computeVertexNormals();
  mesh(sg, mat(0xfffdf9, { side: THREE.DoubleSide }), 0, 0, 0, boat);
  return boat;
}
function bDock(g) {
  for (let i = 0; i < 5; i++) box(g, 1.6, 0.18, 0.9, C.wood, 0, -0.35, i * 0.95);
  [-0.75, 0.75].forEach((x) => [0.6, 2.4, 4].forEach((z) => cyl(g, 0.1, 0.1, 1.5, C.dark, x, -1.5, z, 5)));
  const boat = sailboat(C.roof);
  boat.position.set(1.8, -1.15, 3);
  g.add(boat);
  g.userData.boat = boat; g.userData.h = 3;
}
// 場地借用館：以銘賢堂的造型呈現（紅磚牆、整排木格窗、深灰大斜屋頂與深出簷）
function bGym(g) {
  const brick = soft(0xb5533c), wallTop = 1.4;
  box(g, 4, 0.25, 2.6, 0xcfcac0, 0, 0, 0);
  box(g, 3.5, 1.15, 1.8, brick, 0, 0.25, 0);
  const win = textPlane(3.3, 0.48, (c, w, h) => { c.fillStyle = "#E9E1D2"; c.fillRect(0, 0, w, h); for (let k = 0; k < 6; k++) { const x = 12 + (k * (w - 24)) / 6; c.fillStyle = "#33403F"; c.fillRect(x + 6, 8, (w - 24) / 6 - 12, h - 16); c.strokeStyle = "#E9E1D2"; c.lineWidth = 3; for (let q = 1; q < 4; q++) { c.beginPath(); c.moveTo(x + 6 + (q * ((w - 24) / 6 - 12)) / 4, 8); c.lineTo(x + 6 + (q * ((w - 24) / 6 - 12)) / 4, h - 8); c.stroke(); } c.beginPath(); c.moveTo(x + 6, h / 2); c.lineTo(x + (w - 24) / 6 - 6, h / 2); c.stroke(); } });
  win.position.set(0, 1.08, 0.91); g.add(win);
  [-1.75, -1.05, -0.35, 0.35, 1.05, 1.75].forEach((x) => box(g, 0.09, 1.15, 0.06, 0xd8d2c4, x, 0.25, 0.92));
  box(g, 0.5, 0.62, 0.05, 0x33403f, 0, 0.25, 0.93);
  const sh = new THREE.Shape(); sh.moveTo(-0.9, 0); sh.lineTo(0.9, 0); sh.lineTo(0, 0.9); sh.closePath();
  const gable = mesh(new THREE.ExtrudeGeometry(sh, { depth: 3.5, bevelEnabled: false }), brick, -1.75, wallTop, 0, g); gable.rotation.y = Math.PI / 2;
  const roof = soft(0x4f5357), ang = Math.atan2(0.9, 0.9);
  [1, -1].forEach((k) => { const r = box(g, 4.2, 0.1, 1.7, roof, 0, 0, 0); r.position.set(0, wallTop + 0.36, k * 0.6); r.rotation.x = k * ang; });
  box(g, 4.2, 0.1, 0.16, 0x3c3f42, 0, wallTop + 0.9, 0);
  g.userData.h = 3.1;
}
// 器材借用館：課外組共用的大舞台與音響，組裝人員正在架設
function bStore(g) {
  box(g, 3.8, 0.12, 2.8, 0xe2d6c3, 0, 0, 0);
  box(g, 3.2, 0.5, 1.7, 0x2f2a33, 0, 0.12, -0.35); box(g, 3.22, 0.05, 1.72, 0x55505c, 0, 0.62, -0.35);
  box(g, 3.2, 0.42, 0.02, 0x3a3440, 0, 0.16, 0.51);
  // 桁架（Truss）：兩支立柱加一支橫樑，掛著舞台燈
  const truss = soft(0xb8c0c8);
  [-1.5, 1.5].forEach((x) => { [-0.07, 0.07].forEach((dx) => [-0.07, 0.07].forEach((dz) => box(g, 0.03, 2.2, 0.03, truss, x + dx, 0.67, -1.05 + dz))); for (let k = 0; k < 6; k++) box(g, 0.17, 0.02, 0.02, truss, x, 0.8 + k * 0.36, -1.05 + (k % 2 ? 0.07 : -0.07)).rotation.z = 0.5; });
  [-0.07, 0.07].forEach((dy) => [-0.07, 0.07].forEach((dz) => box(g, 3.1, 0.03, 0.03, truss, 0, 2.85 + dy, -1.05 + dz)));
  [-0.9, -0.3, 0.3, 0.9].forEach((x, k) => { cyl(g, 0.09, 0.07, 0.2, 0x2a211c, x, 2.6, -1.0, 8).rotation.x = 0.5; mesh(new THREE.CircleGeometry(0.06, 10), mat([0xffe27a, 0xc8443a, 0x6e8fb5, 0xffe27a][k], { emissive: 0xffc93c, emissiveIntensity: 0.5 }), x, 2.58, -0.9, g).rotation.x = -1.1; });
  // 舞台兩側的音響喇叭
  const spk = (x, y, z, s = 1) => { box(g, 0.5 * s, 0.7 * s, 0.42 * s, 0x1f1c22, x, y, z); [0.22, -0.1].forEach((dy, i) => { const c = mesh(new THREE.CircleGeometry(i ? 0.15 * s : 0.08 * s, 14), soft(0x4a4550), x, y + 0.35 * s + dy * s, z + 0.215 * s, g); c.castShadow = false; }); };
  spk(-1.65, 0.12, 0.75); spk(-1.65, 0.82, 0.75, 0.8); spk(1.65, 0.12, 0.75); spk(1.65, 0.82, 0.75, 0.8);
  box(g, 0.05, 1.0, 0.05, 0x2a211c, 0, 0.67, -0.1); ball(g, 0.07, 0x2a211c, 0, 1.72, -0.1);
  // 組裝人員：一位扛著喇叭、一位在舞台上調整燈架
  const crew1 = mini(g, { shirt: "#2A211C", hair: "#3B2E26", skin: "#F1CDB0", prop: "helmet" }, 0.55, 0.95, 0.12, 0.95, -0.5);
  box(crew1, 0.5, 0.42, 0.36, 0x1f1c22, 0, 1.62, 0.05);
  const crew2 = mini(g, { shirt: "#E8B04B", hair: "#2A211C", skin: "#F3D2B8", prop: "helmet" }, 0.55, -0.7, 0.67, -0.5);
  g.userData.bob = [crew1];
  g.userData.h = 3.4;
}
// 幹部交接館：新舊幹部在桌前交接資料夾與鑰匙
function bHandover(g, col) {
  box(g, 3.6, 0.12, 2.6, 0xe2d6c3, 0, 0, 0);
  const banner = textPlane(2.4, 0.5, (c, w, h) => { rr(c, 2, 2, w - 4, h - 4, 14); c.fillStyle = "#" + new THREE.Color(col).getHexString(); c.fill(); c.fillStyle = "#FFFDF9"; c.font = `900 ${h * 0.55}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("新舊幹部交接", w / 2, h / 2 + 2); });
  [-1.25, 1.25].forEach((x) => cyl(g, 0.05, 0.05, 2.1, 0xd9d2c5, x, 0.12, -1.0, 6));
  banner.position.set(0, 1.95, -0.98); g.add(banner);
  box(g, 1.8, 0.06, 0.8, C.wood, 0, 0.72, -0.1); [[-0.82, -0.42], [0.82, -0.42], [-0.82, 0.22], [0.82, 0.22]].forEach(([x, z]) => box(g, 0.06, 0.6, 0.06, C.dark, x, 0.12, z));
  [[-0.5, 0xc8623f], [-0.35, 0x6e8fb5], [0.45, 0x5f8f5a]].forEach(([x, c], k) => box(g, 0.32, 0.06 + k * 0.02, 0.24, c, x, 0.78, -0.15));
  box(g, 0.18, 0.04, 0.08, 0xe8b04b, 0.15, 0.79, 0.05); mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), soft(0xe8b04b), 0.02, 0.81, 0.05, g).rotation.x = Math.PI / 2;
  const oldP = mini(g, MINI[1], 0.6, -1.25, 0.12, -0.05, Math.PI / 2), newP = mini(g, MINI[3], 0.6, 1.25, 0.12, -0.05, -Math.PI / 2);
  const folder = box(g, 0.34, 0.26, 0.04, col, 0, 0, 0); folder.position.set(0, 1.15, -0.05); folder.userData.y0 = 1.15;
  g.userData.floaty = [folder]; g.userData.bob = [oldP, newP];
  g.userData.h = 3.2;
}
// 財產盤點館：貨架上的器材箱，盤點人員拿著清冊逐一核對
function bInventory(g, col) {
  box(g, 3.6, 0.12, 2.6, 0xe2d6c3, 0, 0, 0);
  const metal = soft(0x8d97a5), cs = [0xc8623f, 0x6e8fb5, 0xe8b04b, 0x5f8f5a, 0x9c83b5, 0xd9b98a];
  [-0.85, 0.85].forEach((x, r) => {
    [-0.65, 0.65].forEach((dx) => [-0.25, 0.25].forEach((dz) => box(g, 0.05, 2.0, 0.05, metal, x + dx, 0.12, -0.75 + dz)));
    for (let k = 0; k < 3; k++) {
      box(g, 1.4, 0.04, 0.56, metal, x, 0.42 + k * 0.6, -0.75);
      for (let q = 0; q < 3; q++) { const w = 0.3 + hash("iv" + r + k + q) * 0.1; box(g, w, 0.34, 0.42, cs[(r * 3 + k + q) % 6], x - 0.42 + q * 0.42, 0.46 + k * 0.6, -0.75); box(g, 0.12, 0.06, 0.01, 0xfffdf9, x - 0.42 + q * 0.42, 0.62 + k * 0.6, -0.535); }
    }
  });
  const sign = textPlane(1.6, 0.4, (c, w, h) => { rr(c, 2, 2, w - 4, h - 4, 12); c.fillStyle = "#2A211C"; c.fill(); c.fillStyle = "#FFFDF9"; c.font = `900 ${h * 0.55}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("財產盤點", w / 2, h / 2 + 2); });
  sign.position.set(0, 2.35, -0.72); g.add(sign);
  const checker = mini(g, { shirt: "#" + new THREE.Color(col).getHexString(), hair: "#3B2E26", skin: "#F3D2B8", prop: "clipboard" }, 0.62, 0.35, 0.12, 0.55, -0.3);
  // 推車上的箱子
  box(g, 0.6, 0.05, 0.45, metal, -1.15, 0.22, 0.75); [-0.25, 0.25].forEach((x) => cyl(g, 0.06, 0.06, 0.05, 0x2a211c, -1.15 + x, 0.12, 0.95, 8).rotation.x = Math.PI / 2); box(g, 0.05, 0.6, 0.05, metal, -1.42, 0.22, 0.55);
  box(g, 0.42, 0.3, 0.34, cs[2], -1.12, 0.27, 0.75); box(g, 0.34, 0.24, 0.3, cs[0], -1.12, 0.57, 0.75);
  g.userData.bob = [checker];
  g.userData.h = 2.9;
}
// 館內的小角色（坐著或站著）
const mini = (p, o, s, x, y, z, ry = 0) => { const m = person(o); m.scale.setScalar(s); m.position.set(x, y, z); m.rotation.y = ry; p.add(m); return m; };
const MINI = [["#E8B04B", "#3B2E26"], ["#6E8FB5", "#55463A"], ["#5F8F5A", "#2A211C"], ["#C97A8F", "#7A4B2E"], ["#9C83B5", "#3B2E26"], ["#D98B4E", "#2A211C"]].map(([shirt, hair]) => ({ shirt, hair, skin: "#F1CDB0" }));
// 活動安全館：活動現場的急救站（白色帳篷、紅十字旗、擔架、急救箱與救護人員）
function bAid(g) {
  box(g, 3.6, 0.12, 2.8, 0xe2d6c3, 0, 0, 0);
  const red = soft(0xc8443a), white = soft(0xfbfaf6), pole = soft(0xd9d2c5);
  [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]].forEach(([x, z]) => cyl(g, 0.05, 0.05, 1.7, pole, x, 0.12, z, 6));
  const top = cone(g, 2.05, 0.75, white, 0, 1.82, 0, 4); top.rotation.y = Math.PI / 4; top.scale.set(1, 1, 0.72);
  box(g, 2.7, 0.22, 0.03, red, 0, 1.6, 0.92); box(g, 2.7, 0.22, 0.03, red, 0, 1.6, -0.92);
  const sign = textPlane(1.6, 0.38, (c, w, h) => { rr(c, 2, 2, w - 4, h - 4, 12); c.fillStyle = "#FFFDF9"; c.fill(); c.fillStyle = "#C8443A"; c.font = `900 ${h * 0.6}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("✚ 急救站", w / 2, h / 2 + 2); });
  sign.position.set(0, 1.71, 0.94); g.add(sign);
  // 桌上的急救箱、旁邊的擔架、救護人員
  box(g, 1.1, 0.06, 0.5, C.wood, -0.6, 0.62, -0.45); [[-1.05, -0.65], [-0.15, -0.65], [-1.05, -0.25], [-0.15, -0.25]].forEach(([x, z]) => box(g, 0.05, 0.5, 0.05, C.dark, x, 0.12, z));
  box(g, 0.42, 0.28, 0.26, white, -0.75, 0.68, -0.45); box(g, 0.2, 0.06, 0.27, red, -0.75, 0.8, -0.45); box(g, 0.06, 0.2, 0.27, red, -0.75, 0.75, -0.45);
  box(g, 0.24, 0.3, 0.24, soft(0x6e8fb5), -0.25, 0.68, -0.5);
  const st = new THREE.Group(); st.position.set(0.55, 0.12, 0.35); st.rotation.y = 0.25; g.add(st);
  [-0.22, 0.22].forEach((x) => { cyl(st, 0.03, 0.03, 1.6, pole, x, 0.25, 0, 6).rotation.x = Math.PI / 2; [-0.6, 0.6].forEach((z) => box(st, 0.04, 0.22, 0.04, pole, x, 0, z)); });
  box(st, 0.42, 0.03, 1.3, soft(0xd9874e), 0, 0.24, 0);
  const medic = mini(g, { shirt: "#FBFAF6", hair: "#3B2E26", skin: "#F3D2B8", prop: "kit" }, 0.6, 0.6, 0.12, -0.45);
  box(medic, 0.3, 0.1, 0.02, 0xc8443a, 0, 0.82, 0.31); box(medic, 0.1, 0.3, 0.02, 0xc8443a, 0, 0.72, 0.31);
  g.userData.bob = [medic];
  // 紅十字旗
  cyl(g, 0.04, 0.04, 2.6, pole, 1.65, 0.12, 0.95, 6);
  const flag = textPlane(0.7, 0.48, (c, w, h) => { c.fillStyle = "#FFFDF9"; c.fillRect(0, 0, w, h); c.fillStyle = "#C8443A"; c.fillRect(w * 0.42, h * 0.15, w * 0.16, h * 0.7); c.fillRect(w * 0.27, h * 0.38, w * 0.46, h * 0.24); });
  flag.position.set(2.0, 2.45, 0.95); g.add(flag);
  g.userData.h = 3.2;
}
// 期初會議館：小學教室的課桌椅，大家面對面開會，老師在黑板前說明
function bHall(g) {
  box(g, 3.9, 0.15, 3.1, 0xe2c79c, 0, 0, 0);
  box(g, 3, 1.5, 0.12, 0x8a5a3b, 0, 0.75, -1.3);
  [-1.3, 1.3].forEach((x) => box(g, 0.1, 0.75, 0.1, 0x8a5a3b, x, 0.15, -1.3));
  const board = textPlane(2.8, 1.3, (c, w, h) => {
    c.fillStyle = "#3F6B4F"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#FFFDF9"; c.font = `900 ${h * 0.24}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("期初會議", w / 2, h * 0.3);
    c.font = `700 ${h * 0.11}px ${FONT}`; c.fillStyle = "#F3E6CE"; ["1 學生資訊系統登錄", "2 資料繳交　3 借用", "4 經費核銷　5 評鑑"].forEach((s, i) => c.fillText(s, w / 2, h * (0.56 + i * 0.14)));
  });
  board.position.set(0, 1.5, -1.23); g.add(board);
  box(g, 0.6, 0.7, 0.4, C.wood, 1.15, 0.15, -0.75);
  mini(g, { shirt: "#5F8F5A", hair: "#3B2E26", skin: "#F3D2B8" }, 0.55, 0.55, 0.15, -0.85);
  const metal = soft(0x8d97a5), top = soft(0xe8c08a), seat = soft(0xd99a5b);
  const deskSet = (x, z, ry, k) => {
    const s = new THREE.Group(); s.position.set(x, 0.15, z); s.rotation.y = ry; g.add(s);
    box(s, 0.62, 0.05, 0.42, top, 0, 0.5, 0); box(s, 0.56, 0.1, 0.36, soft(0x9a6a3c), 0, 0.4, 0);
    [[-0.27, -0.17], [0.27, -0.17], [-0.27, 0.17], [0.27, 0.17]].forEach(([a, b]) => box(s, 0.04, 0.5, 0.04, metal, a, 0, b));
    box(s, 0.4, 0.04, 0.36, seat, 0, 0.3, 0.42); box(s, 0.4, 0.3, 0.04, seat, 0, 0.36, 0.62);
    [[-0.17, 0.27], [0.17, 0.27], [-0.17, 0.58], [0.17, 0.58]].forEach(([a, b]) => box(s, 0.035, 0.3, 0.035, metal, a, 0, b));
    box(s, 0.2, 0.01, 0.26, soft(0xfffdf9), 0.05, 0.55, 0).rotation.y = 0.2;
    mini(s, MINI[k], 0.46, 0, 0.12, 0.4, Math.PI);
  };
  [-0.15, 0.55, 1.25].forEach((z, i) => { deskSet(-0.75, z, -Math.PI / 2, i); deskSet(0.75, z, Math.PI / 2, i + 3); });
  g.userData.h = 3.4;
}
// 社團行政館：活動服務台，服務員在櫃台後面
function bTrack(g, col) {
  box(g, 3.6, 0.15, 2.8, 0xe2d6c3, 0, 0, 0);
  box(g, 3.2, 1.9, 0.15, C.wall, 0, 0.15, -1.15);
  [-1.55, 1.55].forEach((x) => cyl(g, 0.07, 0.07, 2.4, 0xffffff, x, 0.15, 0.2, 6));
  for (let k = 0; k < 6; k++) box(g, 3.3 / 6, 0.08, 1.6, k % 2 ? 0xfffdf9 : col, -1.65 + 3.3 / 12 + (k * 3.3) / 6, 2.5, -0.4).rotation.x = 0.18;
  const sign = textPlane(2.4, 0.55, (c, w, h) => { rr(c, 2, 2, w - 4, h - 4, 16); c.fillStyle = "#2A211C"; c.fill(); c.fillStyle = "#FFFDF9"; c.font = `900 ${h * 0.55}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("服務台", w / 2, h / 2 + 2); });
  sign.position.set(0, 1.65, -1.06); g.add(sign);
  const staff = mini(g, { shirt: "#" + new THREE.Color(col).getHexString(), hair: "#3B2E26", skin: "#F3D2B8", prop: "clipboard" }, 0.7, 0, 0.15, -0.45);
  g.userData.bob = [staff];
  box(g, 2.6, 0.55, 0.55, col, 0, 0.15, 0.35); box(g, 2.75, 0.07, 0.65, 0xfffdf9, 0, 0.7, 0.35);
  box(g, 2.2, 0.24, 0.02, 0xfffdf9, 0, 0.32, 0.63);
  const gold = mat(0xe8b04b, { metalness: 0.45, roughness: 0.4 });
  mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, -0.9, 0.77, 0.4, g);
  [0, 1, 2].forEach((k) => box(g, 0.34, 0.03, 0.26, k % 2 ? 0xf3e6ce : 0xfffdf9, 0.8, 0.77 + k * 0.03, 0.35).rotation.y = k * 0.15);
  const visitor = mini(g, MINI[0], 0.55, 1.0, 0.15, 1.15, Math.PI * 0.85);
  g.userData.bob.push(visitor);
  g.userData.h = 3.4;
}
// 社團活動館：嘉年華旋轉木馬、氣球，還有在玩的人
function bTent(g, col) {
  box(g, 3.8, 0.12, 3, 0xf3e6ce, 0, 0, 0);
  const cx = -0.55;
  cyl(g, 1.15, 1.2, 0.22, col, cx, 0.12, 0, 20);
  const spin = new THREE.Group(); spin.position.set(cx, 0.34, 0); g.add(spin);
  cyl(spin, 0.09, 0.09, 2.1, 0xe8b04b, 0, 0, 0, 8);
  const cols = [col, 0xfffdf9];
  for (let k = 0; k < 10; k++) mesh(new THREE.ConeGeometry(1.3, 0.75, 2, 1, false, (k * Math.PI) / 5, Math.PI / 5), cols[k % 2], 0, 2.45, 0, spin); // 紅白相間的頂棚
  ball(spin, 0.12, 0xe8b04b, 0, 2.9, 0);
  const horses = [0xfffdf9, 0xf9d3c2, 0xdcebe6, 0xfff1b8];
  horses.forEach((hc, k) => {
    const a = (k * Math.PI) / 2, x = Math.cos(a) * 0.82, z = Math.sin(a) * 0.82;
    cyl(spin, 0.03, 0.03, 1.75, 0xdddddd, x, 0.25, z, 5);
    const h = new THREE.Group(); h.position.set(x, 0.75 + (k % 2) * 0.18, z); h.rotation.y = -a; spin.add(h);
    box(h, 0.18, 0.2, 0.5, hc, 0, 0, 0); box(h, 0.14, 0.26, 0.14, hc, 0, 0.12, 0.25); box(h, 0.12, 0.1, 0.18, hc, 0, 0.3, 0.34);
    [-0.06, 0.06].forEach((xx) => [-0.17, 0.17].forEach((zz) => box(h, 0.05, 0.22, 0.05, hc, xx, -0.2, zz)));
    if (k % 2 === 0) mini(h, MINI[k + 1], 0.36, 0, 0.02, 0, Math.PI / 2);
  });
  g.userData.spin = spin;
  // 氣球
  [[1.25, -0.6, 0xc8443a, 2.3], [1.55, -0.35, 0xe8b04b, 2.0], [1.35, -0.25, 0x6e8fb5, 2.5]].forEach(([x, z, c, y]) => { cyl(g, 0.01, 0.01, y - 0.3, 0xffffff, x, 0.12, z, 3); const b = ball(g, 0.22, soft(c), x, y, z, 1); b.scale.set(1, 1.2, 1); });
  // 開心跳著玩的人
  g.userData.bob = [mini(g, MINI[3], 0.52, 1.0, 0.12, 0.7, -0.4), mini(g, MINI[5], 0.5, 1.6, 0.12, 0.95, -0.7), mini(g, MINI[2], 0.5, 0.35, 0.12, 1.25, 0.2)];
  g.userData.jump = true;
  g.userData.h = 3.6;
}
// 經費館：大計算機與一疊疊硬幣
function bBank(g) {
  box(g, 3.6, 0.15, 2.6, 0xe2d6c3, 0, 0, 0);
  const calc = new THREE.Group(); calc.position.set(-0.55, 0.15, -0.2); calc.rotation.x = -0.22; g.add(calc);
  box(calc, 1.8, 2.5, 0.4, 0x3b4a5c, 0, 0, 0);
  const lcd = textPlane(1.5, 0.55, (c, w, h) => { c.fillStyle = "#BFD8B0"; c.fillRect(0, 0, w, h); c.fillStyle = "#2A3A2A"; c.font = `700 ${h * 0.5}px ${MONO}`; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText("3,600", w - 18, h / 2 + 3); c.font = `700 ${h * 0.24}px ${MONO}`; c.textAlign = "left"; c.fillText("NT$", 14, h * 0.3); });
  lcd.position.set(0, 2.05, 0.21); calc.add(lcd);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) box(calc, 0.3, 0.26, 0.08, k === 3 ? 0xc8623f : r === 0 ? 0xd9d2c5 : 0xfffdf9, -0.56 + k * 0.375, 0.2 + r * 0.38, 0.22);
  const gold = mat(0xe8b04b, { metalness: 0.35, roughness: 0.45 });
  [[0.75, 0.25, 6], [1.2, -0.25, 9], [1.35, 0.55, 4], [0.7, 0.85, 2]].forEach(([x, z, n]) => { for (let k = 0; k < n; k++) cyl(g, 0.24, 0.24, 0.08, gold, x + (hash("cn" + x + k) - 0.5) * 0.03, 0.15 + k * 0.085, z, 14); });
  const coin = new THREE.Group(); coin.position.set(0.95, 2.5, 0.2); g.add(coin);
  cyl(coin, 0.55, 0.55, 0.14, gold, 0, -0.07, 0, 20).rotation.x = Math.PI / 2;
  [0.075, -0.075].forEach((z, i) => { const t = textPlane(0.7, 0.7, (c, w, h) => { c.fillStyle = "#B8862E"; c.font = `900 ${h * 0.7}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", w / 2, h / 2 + 4); }); t.position.set(0, 0, z); if (i) t.rotation.y = Math.PI; coin.add(t); });
  g.userData.spin = coin; g.userData.h = 3.6;
}
// 評鑑館：埋首處理各種檔案的角色，旁邊有檔案櫃、資料夾，還有飛來飛去的文件
function bPodium(g) {
  box(g, 3.6, 0.15, 2.6, 0xe2d6c3, 0, 0, 0);
  box(g, 0.9, 1.9, 0.7, 0x8d97a5, -1.25, 0.15, -0.7);
  for (let k = 0; k < 4; k++) { box(g, 0.8, 0.4, 0.04, 0xb4bcc6, -1.25, 0.25 + k * 0.45, -0.33); box(g, 0.24, 0.05, 0.05, 0x5a6370, -1.25, 0.42 + k * 0.45, -0.3); }
  const gold = mat(0xe8b04b, { metalness: 0.45, roughness: 0.4 });
  cyl(g, 0.14, 0.2, 0.12, gold, -1.25, 2.05, -0.7); g.userData.spin = cyl(g, 0.28, 0.12, 0.38, gold, -1.25, 2.17, -0.7);
  box(g, 1.9, 0.07, 0.95, C.wood, 0.25, 0.6, 0); [[-0.6, -0.35], [1.1, -0.35], [-0.6, 0.35], [1.1, 0.35]].forEach(([x, z]) => box(g, 0.07, 0.45, 0.07, C.dark, x, 0.15, z));
  const worker = mini(g, { shirt: "#C97A8F", hair: "#3B2E26", skin: "#F3D2B8" }, 0.68, 0.25, 0.15, -0.75);
  box(g, 0.34, 0.26, 0.04, 0xe8b04b, 0.25, 0.75, -0.3).rotation.x = -0.5;
  const fc = [0xc8623f, 0x6e8fb5, 0x5f8f5a, 0xe8b04b, 0x9c83b5];
  [[-0.45, 5], [0.95, 7]].forEach(([x, n]) => { for (let k = 0; k < n; k++) box(g, 0.42, 0.07, 0.32, fc[k % 5], x + (hash("fd" + x + k) - 0.5) * 0.06, 0.67 + k * 0.075, 0.05).rotation.y = (hash("fr" + x + k) - 0.5) * 0.3; });
  [[0.9, 0.95], [1.4, 0.7]].forEach(([x, z], i) => { box(g, 0.5, 0.36, 0.38, 0xd9b98a, x, 0.15, z); box(g, 0.5, 0.04, 0.38, 0xc9a774, x, 0.51, z); box(g, 0.12, 0.42, 0.04, fc[i + 1], x - 0.1, 0.38, z); });
  const papers = [0, 1, 2].map((k) => { const p = box(g, 0.28, 0.01, 0.36, 0xfffdf9, 0, 0, 0); p.userData.k = k; return p; });
  g.userData.papers = papers; g.userData.bob = [worker];
  g.userData.h = 3.2;
}
// 小秘書啊牛：參考東海牛奶節的乳牛造型（白身深藍斑點、黃色口鼻與角、頭頂捲毛），以低多邊形重新建模
let cowMsg = null; // 解鎖動畫時泡泡暫時改成這句話
function cowModel() {
  const g = new THREE.Group();
  const white = soft(0xfbfaf6), spot = soft(0x34495e), yellow = soft(0xe8c04a), dark = soft(0x1f2a36);
  const spotOn = (r, x, y, z, s = 1) => { const m = mesh(new THREE.SphereGeometry(0.15 * s, 10, 8), spot, x, y, z, g); m.scale.set(1, 1, 0.35); m.lookAt(m.position.clone().sub(new V3(0, y, 0)).multiplyScalar(2).add(new V3(0, y, 0))); return m; };
  // 腿與蹄
  [-0.17, 0.17].forEach((x) => { mesh(new THREE.CapsuleGeometry(0.12, 0.22, 4, 8), white, x, 0.26, 0, g); mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.12, 10), yellow, x, 0.06, 0.02, g); });
  // 身體（圓滾）與斑點
  const body = mesh(new THREE.SphereGeometry(0.42, 18, 14), white, 0, 0.78, 0, g); body.scale.set(1, 1.08, 0.92);
  spotOn(0, 0.3, 0.88, 0.22); spotOn(0, -0.28, 0.66, 0.26, 1.2); spotOn(0, 0.05, 0.95, -0.36, 1.4); spotOn(0, -0.36, 0.95, -0.12);
  // 手臂：右手揮手、左手抱著資料夾板
  const armR = mesh(new THREE.CapsuleGeometry(0.09, 0.32, 4, 8), white, 0.48, 1.05, 0, g); armR.rotation.z = -2.3; g.userData.armR = armR;
  mesh(new THREE.SphereGeometry(0.1, 10, 8), yellow, 0.72, 1.3, 0, g);
  const armL = mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), white, -0.42, 0.72, 0.14, g); armL.rotation.set(0.6, 0, 0.5);
  box(g, 0.34, 0.44, 0.03, soft(0x8a5a3b), -0.22, 0.52, 0.42); box(g, 0.28, 0.34, 0.01, soft(0xfffdf9), -0.22, 0.56, 0.44);
  // 頭、口鼻、鼻孔、眼睛、耳朵、角、頭頂捲毛
  const head = new THREE.Group(); head.position.set(0, 1.55, 0.05); g.add(head);
  const hd = mesh(new THREE.SphereGeometry(0.42, 20, 16), white, 0, 0, 0, head); hd.scale.set(1.05, 0.95, 0.95);
  const sp = mesh(new THREE.SphereGeometry(0.16, 10, 8), spot, -0.2, 0.08, 0.3, head); sp.scale.set(1, 1, 0.4); sp.rotation.y = -0.5;
  const muzzle = mesh(new THREE.SphereGeometry(0.3, 18, 12), yellow, 0, -0.13, 0.3, head); muzzle.scale.set(1.15, 0.75, 0.75);
  [-0.09, 0.09].forEach((x) => mesh(new THREE.SphereGeometry(0.035, 8, 6), dark, x, -0.08, 0.53, head));
  [-0.16, 0.16].forEach((x) => mesh(new THREE.SphereGeometry(0.045, 8, 6), dark, x, 0.12, 0.37, head));
  [-1, 1].forEach((s) => {
    const ear = mesh(new THREE.SphereGeometry(0.13, 10, 8), white, s * 0.44, 0.08, -0.02, head); ear.scale.set(1.3, 0.55, 0.6); ear.rotation.z = s * -0.3;
    const horn = mesh(new THREE.ConeGeometry(0.07, 0.26, 8), yellow, s * 0.27, 0.42, -0.02, head); horn.rotation.z = s * -0.45;
  });
  for (let k = 0; k < 5; k++) { const c = mesh(new THREE.TorusGeometry(0.07, 0.03, 6, 12), white, -0.12 + k * 0.06, 0.4 + (k % 2) * 0.04, 0.1 - (k % 3) * 0.05, head); c.rotation.set(Math.PI / 2 + k * 0.4, k, 0); }
  // 尾巴
  const tail = mesh(new THREE.CapsuleGeometry(0.03, 0.3, 4, 6), white, 0.1, 0.65, -0.42, g); tail.rotation.x = 0.8;
  mesh(new THREE.SphereGeometry(0.06, 8, 6), spot, 0.1, 0.5, -0.56, g);
  return g;
}
function bTodo(g) {
  cyl(g, 0.9, 1, 0.18, 0xe2d6c3, 0, 0, 0, 16);
  const cow = cowModel();
  cow.scale.setScalar(1.35); cow.position.y = 0.18;
  g.add(cow);
  // 旁邊放一瓶牛奶
  const bottle = new THREE.Group(); bottle.position.set(0.8, 0.18, 0.3); g.add(bottle);
  cyl(bottle, 0.16, 0.18, 0.42, mat(0xfbfaf6, { flatShading: false }), 0, 0, 0, 14); cyl(bottle, 0.1, 0.16, 0.14, mat(0xfbfaf6, { flatShading: false }), 0, 0.42, 0, 14); cyl(bottle, 0.11, 0.11, 0.07, soft(0xe8c04a), 0, 0.56, 0, 14);
  cyl(bottle, 0.165, 0.185, 0.16, soft(0xe8c04a), 0, 0.08, 0, 14);
  g.userData.npc = cow;
  const bubble = textPlane(3.8, 1.5, (c, w, h) => {
        const bh = h * 0.78;
    rr(c, 6, 6, w - 12, bh - 6, 34); c.fillStyle = cowMsg ? "#FFE9A8" : "#FFFDF9"; c.fill(); c.lineWidth = 8; c.strokeStyle = "#2A211C"; c.stroke();
    c.beginPath(); c.moveTo(w / 2 - 22, bh - 4); c.lineTo(w / 2, h - 6); c.lineTo(w / 2 + 22, bh - 4); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = cowMsg ? "#FFE9A8" : "#FFFDF9"; c.fillRect(w / 2 - 18, bh - 14, 36, 14);
    c.textAlign = "center"; c.textBaseline = "middle";
    if (cowMsg) { c.fillStyle = "#C8623F"; c.font = `900 ${h * 0.34}px ${FONT}`; c.fillText(cowMsg, w / 2, bh * 0.52); return; }
    const n = upcoming()[0], k = n ? daysLeft(n.at) : null, t = n ? (n.title.length > 9 ? n.title.slice(0, 9) + "…" : n.title) : "";
    c.fillStyle = "#C8623F"; c.font = `900 ${h * 0.2}px ${FONT}`; c.fillText(n ? `啊牛提醒・${k === 0 ? "今天截止" : "D-" + k}` : "啊牛提醒", w / 2, bh * 0.33);
    c.fillStyle = "#2A211C"; c.font = `900 ${h * 0.19}px ${FONT}`; c.fillText(n ? t : "目前沒有截止日", w / 2, bh * 0.7);
  });
  bubble.position.set(0, 3.7, 0); g.add(bubble);
  g.userData.sign = bubble; g.userData.h = 4.7;
}
function bHouse(g, col) {
  box(g, 2.4, 1.6, 2, C.wall, 0, 0, 0);
  const r = cone(g, 2, 1.2, col, 0, 1.6, 0, 4); r.rotation.y = Math.PI / 4;
  box(g, 0.7, 1, 0.08, C.dark, 0, 0, 1.02);
  g.userData.h = 3.4;
}
const BUILD = { hall: bHall, track: bTrack, tent: bTent, bank: bBank, gym: bGym, aid: bAid, store: bStore, podium: bPodium, house: bHouse, handover: bHandover, inventory: bInventory };

// 圓滾滾的樹：兩三顆球疊在一起
function tree(p, x, z, s, k) {
  cyl(p, 0.12 * s, 0.16 * s, 0.7 * s, 0x9a6a3c, x, 0, z, 6);
  const col = soft([C.tree1, C.tree2, C.tree3][Math.floor(k * 6) % 3]);
  mesh(new THREE.SphereGeometry(0.78 * s, 14, 10), col, x, 1.25 * s, z, p);
  mesh(new THREE.SphereGeometry(0.5 * s, 12, 8), col, x + 0.35 * s, 1.75 * s, z + 0.1 * s, p);
  if (k > 0.5) mesh(new THREE.SphereGeometry(0.42 * s, 12, 8), col, x - 0.4 * s, 1.6 * s, z - 0.15 * s, p);
}
const lamps = [];
// 東海大學風格的路牌：深咖啡色木牌、米白字、白色箭頭、下方英文；白色柱子頂端有燈罩
function signBoard(zh, en, dir, w = 2.3) {
  return textPlane(w, 0.52, (c, W, H) => {
    rr(c, 3, 3, W - 6, H - 6, 6); c.fillStyle = "#4E3328"; c.fill(); c.lineWidth = 4; c.strokeStyle = "#7A5A48"; c.stroke();
    const ax = dir === "r" ? W - 46 : 46, ay = H * 0.42;
    c.fillStyle = "#FFFFFF"; c.beginPath();
    if (dir === "u") { c.moveTo(ax, ay - 22); c.lineTo(ax - 18, ay); c.lineTo(ax - 7, ay); c.lineTo(ax - 7, ay + 22); c.lineTo(ax + 7, ay + 22); c.lineTo(ax + 7, ay); c.lineTo(ax + 18, ay); }
    else { const k = dir === "r" ? 1 : -1; c.moveTo(ax + 22 * k, ay); c.lineTo(ax, ay - 17); c.lineTo(ax, ay - 7); c.lineTo(ax - 22 * k, ay - 7); c.lineTo(ax - 22 * k, ay + 7); c.lineTo(ax, ay + 7); c.lineTo(ax, ay + 17); }
    c.closePath(); c.fill();
    const tx = dir === "r" ? 24 : 92;
    c.textAlign = "left"; c.textBaseline = "middle"; c.fillStyle = "#F3E6C8"; c.font = `900 ${H * 0.44}px ${FONT}`; c.fillText(zh, tx, H * 0.38);
    c.fillStyle = "#E8D9A8"; c.font = `700 ${H * 0.17}px ${FONT}`; c.fillText(en || "", tx, H * 0.78);
  });
}
function signPost(boards, h = 3.4) {
  const g = new THREE.Group();
  cyl(g, 0.11, 0.13, h, 0xeeeae2, 0, 0, 0, 8);
  const hat = mesh(new THREE.ConeGeometry(0.75, 0.28, 16, 1, true), mat(0xf4f1ea, { side: THREE.DoubleSide }), 0, h + 0.05, 0, g); hat.castShadow = true;
  cyl(g, 0.2, 0.12, 0.25, 0xd9d4ca, 0, h - 0.2, 0, 8);
  const L = boards.filter((b) => b.dir !== "r"), R = boards.filter((b) => b.dir === "r");
  [[L, -1], [R, 1]].forEach(([list, k]) => list.forEach((b, i) => { const p = signBoard(b.zh, b.en, b.dir); p.position.set(k * 1.25, h - 0.55 - i * 0.58, 0.14); g.add(p); }));
  return g;
}
function lampPost(p, x, z) {
  cyl(p, 0.07, 0.07, 1.2, 0x3d3530, x, 0, z, 6);
  const m = mat(0xfff6d8, { emissive: 0xffc77a, emissiveIntensity: 0 });
  lamps.push(m);
  mesh(new THREE.IcosahedronGeometry(0.22, 0), m, x, 1.35, z, p);
}
const angOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/* ---- 大島 ---- */
const center = new THREE.Group();   // 中央區（課外組）的建築都放在這個群組
world.add(center);
const LAND = landmass(world, R_ISLE, 1.3);
tag(LAND.top, { t: "ground" });
const flatRoad = (p, geo, x, z, ry = 0) => { const m = mesh(geo, soft(C.road), x, 0.045, z, p); m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.castShadow = false; return m; };
const dashAt = (p, x, z, ry, len = 0.38) => { const d = box(p, 0.06, 0.02, len, 0xffffff, x, 0.05, z); d.rotation.y = ry; d.castShadow = false; };
// 直線道路：從半徑 r0 到 r1，方位 a
function radialRoad(a, r0, r1, w = 1.4) {
  const len = r1 - r0, m = (r0 + r1) / 2;
  const road = box(world, len, 0.05, w, C.road, Math.cos(a) * m, 0, Math.sin(a) * m);
  road.rotation.y = -a; road.castShadow = false;
  for (let s = r0 + 0.6; s < r1 - 0.3; s += 1.1) dashAt(world, Math.cos(a) * s, Math.sin(a) * s, -a + Math.PI / 2);
}
// 中央廣場、噴水池、校旗
cyl(center, 3.2, 3.2, 0.06, C.plaza, 0, 0, 0, 24).castShadow = false;
flatRoad(center, new THREE.RingGeometry(3.2, 4.6, 48), 0, 0);
for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; dashAt(center, Math.cos(a) * RW, Math.sin(a) * RW, -a); }
cyl(center, 1.3, 1.5, 0.5, 0xd9cbb4, 0, 0, 0, 10);
cyl(center, 1.05, 1.05, 0.12, 0x9fcfd0, 0, 0.45, 0, 10);
cyl(center, 0.18, 0.25, 1.2, 0xd9cbb4, 0, 0.5, 0);
ball(center, 0.35, 0xbfe2e2, 0, 1.85, 0);
const flag = box(center, 1.4, 0.8, 0.04, C.roof, 2.1, 3.3, -1.6);
cyl(center, 0.06, 0.06, 4.2, 0xdddddd, 1.4, 0, -1.6, 6);
// 外圈環狀道路與連絡道路
flatRoad(world, new THREE.RingGeometry(RO - 0.7, RO + 0.7, 120), 0, 0);
for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; dashAt(world, Math.cos(a) * RO, Math.sin(a) * RO, -a); }
SPOKES.forEach((a) => radialRoad(a, 4.6, RO - 0.7));
// 中央區的地點：方位相對鏡頭正前方，避開連絡道路（本島兩館各有一條）
const SPOT = {
  office: { a: front + Math.PI, r: 7.4, build: bOffice },
  chapel: { a: front + Math.PI * 1.25, r: 7.2, build: bClock }, // 造景，不能點
  news: { a: front + Math.PI * 0.83, r: 7, build: bBoard },
  todo: { a: front + Math.PI / 6, r: 7, build: bTodo },
  links: { a: front, r: R_ISLE * 0.95, build: bDock },
};
radialRoad(front, RO + 0.7, R_ISLE * 0.93); // 通往碼頭的路
const centerObj = {};
Object.entries(SPOT).forEach(([id, s]) => {
  const g = new THREE.Group();
  s.build(g);
  g.position.set(Math.cos(s.a) * s.r, 0, Math.sin(s.a) * s.r);
  g.rotation.y = id === "links" ? Math.atan2(Math.cos(s.a), Math.sin(s.a)) : FACE; // 碼頭沿 +z 伸向海面
  if (id === "office") g.scale.setScalar(0.85);
  center.add(g);
  if (id !== "chapel") tag(g, { t: "spot", id });
  centerObj[id] = g;
  s.pos = g.position.clone();
});
for (let k = 0; k < 8; k++) { const a = front + (k + 0.5) * Math.PI / 4; lampPost(center, Math.cos(a) * 5, Math.sin(a) * 5); }
// 碼頭路口的指路牌：箭頭依各館在畫面上的左右方向
const SIGN_POS = FACE_DIR.clone().multiplyScalar(RO + 2.4).add(new V3(FACE_DIR.z, 0, -FACE_DIR.x).multiplyScalar(-5));
{
  const right = new V3(Math.cos(FACE), 0, -Math.sin(FACE)), dirTo = (p) => (p.clone().sub(SIGN_POS).dot(right) > 0 ? "r" : "l");
  const boards = [{ zh: "課外組峮老師", en: "Extracurricular Activities", dir: dirTo(new V3()) }, ...MAIN.map((d) => ({ zh: d.name, en: d.en, dir: dirTo(d.pos) })), ...ISLETS.map((I) => ({ zh: I.name, en: ISLET_EN[I.name], dir: dirTo(I.pos) }))];
  const sp = signPost(boards, 3.4 + Math.max(0, Math.ceil(boards.length / 2) - 4) * 0.58); sp.position.copy(SIGN_POS); sp.rotation.y = FACE; world.add(sp);
}

/* ---- 各行政分類的建築區（沿外圈道路排列） ---- */
ISL.forEach((d) => {
  const g = new THREE.Group();
  g.position.copy(d.pos);
  world.add(g);
  d.group = g;
  const col = new THREE.Color(d.color).getHex();
  const lot = cyl(g, 2.7, 2.7, 0.07, new THREE.Color(d.color).lerp(new THREE.Color(0xfbf3e6), 0.6).getHex(), 0, 0, 0, 24);
  lot.castShadow = false;
  tag(lot, { t: "isle", i: d.i });
  // 從外圈道路接到建築區的短車道（小島上的建築區另外鋪路）
  if (!d.islet) radialRoad(d.a, RO + 0.7, R_LOT - 1.6, 1.3);
  const b = new THREE.Group();
  (BUILD[d.building] || bHouse)(b, col);
  b.position.copy(d.dir).multiplyScalar(0.9); // 建築在車道的另一側，正面朝鏡頭
  b.rotation.y = FACE;
  g.add(b);
  tag(b, { t: "isle", i: d.i });
  d.build = b;
  // 角色站在建築的右前方（靠鏡頭那一側），拍照時不會被建築擋住；從車道口繞過建築側邊走過去
  const SR = new V3(Math.cos(FACE), 0, -Math.sin(FACE));
  d.door = d.dir.clone().multiplyScalar(-1.7);
  d.side = SR.clone().multiplyScalar(2.7).add(FACE_DIR.clone().multiplyScalar(0.4));
  d.spot = FACE_DIR.clone().multiplyScalar(2.1).add(SR.clone().multiplyScalar(1.5));
  const perp = new V3(-d.dir.z, 0, d.dir.x);
  lampPost(g, perp.x * 2.4 - d.dir.x * 1.6, perp.z * 2.4 - d.dir.z * 1.6);
});

/* ---- 獨立小島與橋 ---- */
const hikers = [];
ISLETS.forEach((ISLET) => {
  const g = new THREE.Group(); g.position.copy(ISLET.pos); world.add(g);
  const L = landmass(g, ISLET.r, 4.2 + ISLET.a);
  tag(L.top, { t: "isle", i: ISLET.halls[0].i });
  // 本島外圈道路 → 海岸、小島入口 → 小島中央 → 各建築區
  const seg = (p, q, w = 1.4) => { const len = p.distanceTo(q), m = p.clone().add(q).multiplyScalar(0.5), a = Math.atan2(q.z - p.z, q.x - p.x);
    const road = box(world, len, 0.05, w, C.road, m.x, 0, m.z); road.rotation.y = -a; road.castShadow = false;
    for (let s = 0.6; s < len - 0.3; s += 1.1) { const pt = p.clone().lerp(q, s / len); dashAt(world, pt.x, pt.z, -a + Math.PI / 2); } };
  seg(ISLET.dir.clone().multiplyScalar(RO + 0.7), ISLET.coast);
  seg(ISLET.entry, ISLET.pos);
  ISLET.halls.forEach((d) => seg(ISLET.pos, d.pos.clone().sub(d.dir.clone().multiplyScalar(1.6)), 1.3));
  // 木橋
  const p0 = ISLET.coast, p1 = ISLET.entry, len = p0.distanceTo(p1), m = p0.clone().add(p1).multiplyScalar(0.5);
  const bg = new THREE.Group(); bg.position.copy(m); bg.rotation.y = -ISLET.a; world.add(bg);
  const plank = mat(0xe0a866), rail = mat(0xa86a3a), n = Math.round(len / 0.5);
  for (let k = 0; k < n; k++) { const x = -len / 2 + (k + 0.5) * (len / n), y = Math.sin(((k + 0.5) / n) * Math.PI) * 0.35; mesh(new THREE.BoxGeometry(len / n - 0.06, 0.14, 1.6), plank, x, y - 0.05, 0, bg); }
  [-0.82, 0.82].forEach((z) => { for (let k = 0; k <= 4; k++) { const x = -len / 2 + (k * len) / 4, y = Math.sin((k / 4) * Math.PI) * 0.35; cyl(bg, 0.07, 0.07, 0.7, rail, x, y - 0.05, z, 5); } mesh(new THREE.BoxGeometry(len, 0.08, 0.08), rail, 0, 0.6, z, bg); });
  [-len / 2 + 0.6, len / 2 - 0.6].forEach((x) => cyl(bg, 0.12, 0.12, 1.4, rail, x, -1.5, 0, 6));
  ISLET.bridge = { p0, p1, len };
  // 小島入口的島名路牌（東海大學路牌風格）
  const sg = signPost([{ zh: ISLET.name, en: ISLET_EN[ISLET.name] || "", dir: "u" }], 2.2);
  sg.position.copy(ISLET.entry.clone().lerp(ISLET.pos, 0.35)).add(new V3(-ISLET.dir.z, 0, ISLET.dir.x).multiplyScalar(1.4)); sg.rotation.y = FACE; world.add(sg);
  // 兩館之間的小山，角色沿著山路往上爬
  const mtn = ISLET_MTN.has(ISLET.name) ? { pos: ISLET.pos.clone().add(ISLET.dir.clone().multiplyScalar(4.6)), R: 2.1, H: 3.2 } : null;
  if (mtn) {
    const mg = new THREE.Group(); mg.position.copy(mtn.pos); world.add(mg);
    cone(mg, mtn.R, mtn.H, soft(0x7fb35a), 0, 0, 0, 9).rotation.y = 0.3;
    cone(mg, mtn.R * 0.42, mtn.H * 0.42, soft(0x9a9184), 0, mtn.H * 0.58, 0, 7);
    for (let k = 0; k < 18; k++) { const q = k / 18, a = q * Math.PI * 5, y = q * mtn.H * 0.86, rr2 = mtn.R * (1 - y / mtn.H) + 0.03; const st = box(mg, 0.34, 0.04, 0.22, 0xd9b98a, Math.cos(a) * rr2, y, Math.sin(a) * rr2); st.rotation.y = -a; }
    cyl(mg, 0.03, 0.03, 0.7, 0xdddddd, 0, mtn.H - 0.05, 0, 4); box(mg, 0.4, 0.26, 0.02, 0xc8443a, 0.2, mtn.H + 0.38, 0);
    [0.15, 0.55].forEach((q0, k) => { const h = person({ shirt: ["#5F8F5A", "#E8B04B"][k], hair: "#3B2E26", skin: "#F1CDB0", prop: "backpack" }); h.scale.setScalar(0.42); mg.add(h); hikers.push({ h, q0, m: mtn }); });
    tag(mg, { t: "isle", i: ISLET.halls[0].i });
  }
  for (let i = 0, k = 0; i < 160 && k < (ISLET.halls.length > 2 ? 14 : 10); i++) {
    const a = hash("it" + ISLET.name + i) * Math.PI * 2, r = 2 + hash("ir" + ISLET.name + i) * (ISLET.r * 0.82 - 2), x = ISLET.pos.x + Math.cos(a) * r, z = ISLET.pos.z + Math.sin(a) * r;
    if (ISLET.halls.some((d) => Math.hypot(d.pos.x - x, d.pos.z - z) < 3.4) || Math.hypot(ISLET.pos.x - x, ISLET.pos.z - z) < 1.8) continue;
    // 不要種在館的正前方（鏡頭那一側），以免擋住建築
    if (ISLET.halls.some((d) => { const v = new V3(x - d.pos.x, 0, z - d.pos.z), f = v.dot(FACE_DIR); return f > -0.5 && f < 7 && Math.abs(v.x * FACE_DIR.z - v.z * FACE_DIR.x) < 3; })) continue;
    if (mtn && Math.hypot(mtn.pos.x - x, mtn.pos.z - z) < mtn.R + 0.9) continue;
    const toE = new V3(x, 0, z).sub(ISLET.pos), along = toE.dot(ISLET.dir.clone().negate()); if (along > 0 && Math.abs(toE.clone().cross(ISLET.dir).y) < 1.4) continue;
    tree(world, x, z, 0.65 + hash("is" + i) * 0.4, hash("ik" + i)); k++;
  }
});

/* ---- 樹：避開道路、建築區與中央地點 ---- */
{
  const roadAngles = [...SPOKES, front, ...ISLETS.map((I) => I.a)];
  const nearRadial = (x, z, r) => roadAngles.some((a) => { const along = x * Math.cos(a) + z * Math.sin(a), side = Math.abs(-x * Math.sin(a) + z * Math.cos(a)); return along > 4 && side < 1.6; }) ||
    MAIN.some((d) => { const along = x * Math.cos(d.a) + z * Math.sin(d.a), side = Math.abs(-x * Math.sin(d.a) + z * Math.cos(d.a)); return along > RO && along < R_LOT && side < 1.5; });
  let n = 0;
  for (let i = 0; i < 900 && n < 70; i++) {
    const a = hash("ta" + i) * Math.PI * 2, r = 5.2 + hash("tr" + i) * (R_ISLE - 5.2);
    if (r > R_ISLE * LAND.wob(a) * 0.9) continue;
    if (Math.abs(r - RO) < 1.4) continue;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (nearRadial(x, z, r)) continue;
    if (ISL.some((d) => Math.hypot(d.pos.x - x, d.pos.z - z) < 3.6)) continue;
    if (Object.values(SPOT).some((s) => Math.hypot(s.pos.x - x, s.pos.z - z) < 3)) continue;
    if (Math.hypot(SIGN_POS.x - x, SIGN_POS.z - z) < 2.6) continue;
    if (ISL.some((d) => { const v = new V3(x - d.pos.x, 0, z - d.pos.z), f = v.dot(FACE_DIR); return f > -0.5 && f < 8 && Math.abs(v.x * FACE_DIR.z - v.z * FACE_DIR.x) < 3.2; })) continue; // 不擋住館的正面
    tree(world, x, z, 0.7 + hash("ts" + i) * 0.55, hash("tk" + i)); n++;
  }
}

/* ---- 海上小島、帆船、雲 ---- */
const UMB = [0xc8623f, 0xe8b04b, 0x6e8fb5, 0xfbf3e6];
[[front + 0.95, 31], [front - 0.9, 33], [front + Math.PI * 0.62, 36], [front - Math.PI * 0.6, 35]].forEach(([a, r], i) => {
  const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scene.add(g);
  cyl(g, 2.6, 2.9, 0.5, C.sand, 0, -1.05, 0, 14);
  if (i % 2 === 0) for (let k = 0; k < 3; k++) { const x = (k - 1) * 1.3, z = (k % 2) * 0.6; cyl(g, 0.04, 0.04, 1.2, 0xffffff, x, -0.6, z, 4); cone(g, 0.6, 0.35, UMB[(i + k) % 4], x, 0.5, z, 8); }
  else { const t = new THREE.Group(); t.position.y = -0.6; g.add(t); tree(t, -0.6, 0, 0.7, 0.2); tree(t, 0.7, 0.4, 0.6, 0.7); }
});
const boats = [0, 1].map((i) => { const b = sailboat(i ? 0x6e8fb5 : 0xfbf3e6); b.scale.setScalar(0.8); scene.add(b); b.userData = { r: 30 + i * 6, a: front + 0.5 + i * 2.4, s: 0.02 + i * 0.008 }; return b; });
const clouds = [];
for (let i = 0; i < 9; i++) {
  const c = new THREE.Group();
  const cm = mat(0xffffff, { roughness: 1, emissive: 0xc9c0b4, emissiveIntensity: 0.35, flatShading: false });
  for (let k = 0; k < 4; k++) { const b = ball(c, 1.4 + hash("cl" + i + k) * 1.4, cm, k * 1.7, hash("cy" + i + k) * 0.8, hash("cz" + i + k) * 1, 1); b.castShadow = false; }
  c.userData = { r: WORLD_R + 14 + hash("cr" + i) * 22, a0: front + Math.PI + (hash("ca" + i) - 0.5) * 2.6, s: 0.2 + hash("cs" + i) * 0.3 };
  c.position.set(Math.cos(c.userData.a0) * c.userData.r, 8 + hash("ch" + i) * 8, Math.sin(c.userData.a0) * c.userData.r);
  scene.add(c); clouds.push(c);
}

/* ---- 提醒標記 ---- */
const markMat = (c) => mat(c, { emissive: c, emissiveIntensity: 0.35 });
ISL.forEach((d) => {
  const m = mesh(new THREE.OctahedronGeometry(0.5, 0), markMat(0xe8b04b), 0, 0, 0, d.group);
  m.castShadow = false;
  m.position.copy(d.build.position).setY(d.build.userData.h + 1.6);
  d.marker = m;
});
const newsMarker = mesh(new THREE.OctahedronGeometry(0.5, 0), markMat(0xc8443a), 0, 0, 0, center);
newsMarker.position.copy(SPOT.news.pos).setY(5.6);
function updMarkers() {
  ISL.forEach((d) => { const n = isleDl(d)[0], days = n ? daysLeft(n.at) : 99; d.marker.visible = days <= 7; d.marker.material = markMat(days <= 3 ? 0xc8443a : 0xe8b04b); });
  newsMarker.visible = unread().length > 0;
}

/* ---------------- 人物 ---------------- */
// 每個社團一件招牌道具，讓角色一眼看得出是哪個社團
function addProp(g, type, o) {
  const H = new V3(0.44, 0.52, 0.12); // 右手位置
  switch (type) {
    case "basketball": ball(g, 0.2, soft(0xd9733a), H.x + 0.05, H.y, H.z + 0.12, 1); break;
    case "volleyball": ball(g, 0.2, soft(0xf6f0e2), H.x + 0.05, H.y, H.z + 0.12, 1); ball(g, 0.205, mat(0xe8b04b, { wireframe: true }), H.x + 0.05, H.y, H.z + 0.12, 0); break;
    case "soccer": ball(g, 0.2, soft(0xffffff), 0.25, 0.2, 0.42, 1); ball(g, 0.205, mat(0x2a211c, { wireframe: true }), 0.25, 0.2, 0.42, 0); break;
    case "bowling": ball(g, 0.19, soft(0x2f3e6e), H.x + 0.04, H.y, H.z + 0.12, 1); break;
    case "rugby": ball(g, 0.22, soft(0x8a5a3b), H.x + 0.05, H.y + 0.05, H.z + 0.12, 1).scale.set(0.7, 0.7, 1.15); break;
    case "bat": { const b = cyl(g, 0.06, 0.035, 0.95, soft(0xd8b98a), 0, 0, 0, 8); b.position.set(H.x + 0.05, H.y + 0.35, H.z); b.rotation.z = -0.35; break; }
    case "racket": { const r = new THREE.Group(); cyl(r, 0.025, 0.025, 0.4, soft(0x2a211c), 0, 0, 0, 6); mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 16), soft(o.shirt), 0, 0.55, 0, r).scale.set(0.8, 1.1, 1); r.position.set(H.x + 0.05, H.y - 0.05, H.z + 0.05); r.rotation.z = -0.4; g.add(r); break; }
    case "bow": mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 16, Math.PI), soft(0x8a5a3b), -0.48, 0.75, 0.1, g).rotation.z = -Math.PI / 2; box(g, 0.01, 0.84, 0.01, 0xffffff, -0.48, 0.33, 0.1); break;
    case "sword": { const s = cyl(g, 0.03, 0.03, 1.15, soft(0xe9dcc0), 0, 0, 0, 6); s.position.set(H.x + 0.02, H.y + 0.45, H.z + 0.18); s.rotation.x = 0.5; break; }
    case "gloves": ball(g, 0.14, soft(0xc8443a), 0.44, 0.55, 0.14, 1); ball(g, 0.14, soft(0xc8443a), -0.44, 0.55, 0.14, 1); break;
    case "belt": mesh(new THREE.TorusGeometry(0.315, 0.04, 6, 20), soft(0x1f1a16), 0, 0.62, 0, g).rotation.x = Math.PI / 2; box(g, 0.08, 0.2, 0.04, 0x1f1a16, 0.08, 0.42, 0.31); break;
    case "frisbee": cyl(g, 0.26, 0.24, 0.04, soft(0xe8b04b), H.x + 0.08, H.y, H.z + 0.12, 16).rotation.x = 0.3; break;
    case "skateboard": { const s = new THREE.Group(); box(s, 0.25, 0.04, 0.9, soft(0xc8623f), 0, 0.08, 0); [-0.32, 0.32].forEach((z) => [-0.1, 0.1].forEach((x) => ball(s, 0.045, 0xfbf3e6, x, 0.05, z))); s.position.set(0.6, 0, 0.1); g.add(s); break; }
    case "skates": [-0.13, 0.13].forEach((x) => { box(g, 0.16, 0.12, 0.3, soft(0xfbf3e6), x, 0, 0.04); [-0.08, 0.08].forEach((z) => ball(g, 0.04, 0xc8623f, x, 0, 0.04 + z)); }); break;
    case "mat": { const m = cyl(g, 0.1, 0.1, 0.75, soft(0x9c83b5), 0, 0, 0, 10); m.position.set(0, 1.0, -0.36); m.rotation.z = Math.PI / 2; break; }
    case "backpack": { box(g, 0.48, 0.55, 0.26, soft(0x6e8fb5), 0, 0.55, -0.4); const r = cyl(g, 0.1, 0.1, 0.5, soft(0x5f8f5a), 0, 0, 0, 8); r.position.set(0, 1.18, -0.4); r.rotation.z = Math.PI / 2; break; }
    case "dumbbell": { const d = new THREE.Group(); cyl(d, 0.03, 0.03, 0.4, soft(0x555555), 0, -0.2, 0, 6); [-0.2, 0.2].forEach((y) => cyl(d, 0.1, 0.1, 0.08, soft(0x2a211c), 0, y - 0.04, 0, 10)); d.rotation.z = Math.PI / 2; d.position.set(H.x + 0.05, H.y, H.z + 0.1); g.add(d); break; }
    case "ring": { mesh(new THREE.TorusGeometry(0.36, 0.1, 8, 18), soft(0xe9e2d6), 0, 0.66, 0, g).rotation.x = Math.PI / 2; for (let k = 0; k < 4; k++) mesh(new THREE.TorusGeometry(0.36, 0.104, 8, 3, Math.PI / 4), soft(0xc8443a), 0, 0.66, 0, g).rotation.set(Math.PI / 2, 0, (k * Math.PI) / 2); break; }
    case "bib": box(g, 0.34, 0.26, 0.02, soft(0xffffff), 0, 0.68, 0.31); mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 20), soft(0xc8443a), 0, 1.55, 0, g).rotation.x = Math.PI / 2; break;
    case "pompom": ball(g, 0.18, soft(0xe8b04b), 0.46, 0.52, 0.12, 0); ball(g, 0.18, soft(0xe8b04b), -0.46, 0.52, 0.12, 0); break;
    case "kit": box(g, 0.34, 0.26, 0.16, soft(0xc8443a), H.x + 0.06, H.y - 0.2, H.z); box(g, 0.14, 0.04, 0.17, 0xffffff, H.x + 0.06, H.y - 0.09, H.z); box(g, 0.04, 0.14, 0.17, 0xffffff, H.x + 0.06, H.y - 0.14, H.z); break;
    case "clipboard": box(g, 0.32, 0.42, 0.03, soft(0x8a5a3b), H.x + 0.02, H.y - 0.18, H.z + 0.16); box(g, 0.26, 0.32, 0.01, soft(0xfffdf9), H.x + 0.02, H.y - 0.14, H.z + 0.18); box(g, 0.1, 0.04, 0.03, soft(0x555555), H.x + 0.02, H.y + 0.21, H.z + 0.18); mesh(new THREE.TorusGeometry(0.33, 0.015, 4, 20), soft(0xc8623f), 0, 1.0, 0, g).rotation.x = Math.PI / 2.6; box(g, 0.14, 0.18, 0.02, soft(0xffffff), 0, 0.62, 0.32); break;
    case "helmet": mesh(new THREE.SphereGeometry(0.46, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), soft(0x2a211c), 0, 1.55, -0.02, g).scale.set(1, 0.85, 1); box(g, 0.4, 0.03, 0.16, 0x2a211c, 0, 1.52, 0.45); break;
  }
}
function person(o) {
  const g = new THREE.Group();
  const shirt = soft(o.shirt), skin = soft(o.skin), hairM = soft(o.hair), pants = soft(0x2f2a3a), shoe = soft(0x2a211c);
  [-0.13, 0.13].forEach((x) => { mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), pants, x, 0.25, 0, g); mesh(new THREE.BoxGeometry(0.17, 0.08, 0.24), shoe, x, 0.04, 0.03, g); });
  mesh(new THREE.CapsuleGeometry(0.3, 0.35, 6, 12), shirt, 0, 0.78, 0, g);
  [-0.38, 0.38].forEach((x) => { mesh(new THREE.CapsuleGeometry(0.085, 0.32, 4, 8), shirt, x, 0.78, 0, g).rotation.z = x > 0 ? 0.12 : -0.12; mesh(new THREE.SphereGeometry(0.085, 10, 8), skin, x * 1.12, 0.54, 0, g); });
  mesh(new THREE.SphereGeometry(0.42, 20, 16), skin, 0, 1.45, 0, g);
  mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 1.47, -0.03, g).rotation.x = -0.25;
  [-0.14, 0.14].forEach((x) => {
    mesh(new THREE.SphereGeometry(0.045, 8, 6), soft(0x1f1a16), x, 1.46, 0.39, g);
    const bl = mesh(new THREE.CircleGeometry(0.07, 12), mat(0xf0a8a0, { transparent: true, opacity: 0.8, flatShading: false }), x * 1.45, 1.36, 0.37, g);
    bl.rotation.y = x * 2; bl.castShadow = false;
  });
  if (o.prop) addProp(g, o.prop, o);
  return g;
}

/* 玩家角色 */
const av = new THREE.Group();
const AV_HOME = FACE_DIR.clone().multiplyScalar(3.8);
av.position.copy(AV_HOME); av.rotation.y = FACE;
world.add(av);
const selRing = mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 32, Math.PI * 1.6), mat(0xc8623f, { emissive: 0xc8623f, emissiveIntensity: 0.4 }), 0, 0.04, 0, av);
selRing.rotation.x = Math.PI / 2; selRing.castShadow = false;
function rebuildAvatar() {
  av.children.filter((c) => c !== selRing).forEach((c) => av.remove(c));
  const p = person({ shirt: me.shirt, hair: me.hair, skin: me.skin, prop: myProp() });
  av.add(p);
  const i = pickables.findIndex((o) => o.userData.isMe);
  if (i >= 0) pickables.splice(i, 1);
  p.userData.isMe = true;
  tag(p, { t: "me" });
}
rebuildAvatar();

/* 老師與其他社團成員 */
const teacher = person({ shirt: "#5F8F5A", hair: "#55463A", skin: "#F1CDB0" });
teacher.position.copy(FACE_DIR.clone().multiplyScalar(2.2).add(new V3(-1.6, 0, 1.6).applyAxisAngle(new V3(0, 1, 0), FACE - Math.PI / 4)));
teacher.rotation.y = FACE;
world.add(teacher);
tag(teacher, { t: "teacher" });
const npcs = [];
function addNpc(i, home, rad) {
  const club = CLUBS[Math.floor(hash("nc" + i) * CLUBS.length)] || {};
  const p = person({ shirt: SHIRTS[Math.floor(hash("ns" + i) * SHIRTS.length)], hair: HAIRS[Math.floor(hash("nh" + i) * HAIRS.length)], skin: SKINS[Math.floor(hash("nk" + i) * SKINS.length)], prop: club.prop });
  p.scale.setScalar(0.85);
  p.position.copy(home).add(new V3(hash("nx" + i) - 0.5, 0, hash("nz" + i) - 0.5).multiplyScalar(rad));
  p.userData = { home, rad, goal: null, wait: hash("nw" + i) * 4 };
  world.add(p); npcs.push(p);
  tag(p, { t: "npc", club: club.name });
}
// 人數固定上限，不會因為社團或島變多而變擠；站在廣場側邊，避開角色站位與名牌
const NPC_MAX = 10, SIDE = new V3(-FACE_DIR.z, 0, FACE_DIR.x);
ISL.filter((d, i) => i < NPC_MAX - 2).forEach((d, i) => { const perp = new V3(-d.dir.z, 0, d.dir.x); addNpc(i, d.pos.clone().add(perp.multiplyScalar(i % 2 ? 1.6 : -1.6)).sub(d.dir.clone().multiplyScalar(0.6)), 0.6); });
[0, 1].forEach((k) => addNpc(40 + k, new V3(0, 0, 0), 3));
const NPC_MIN_ZOOM = 1.3; // 全景時隱藏路人，畫面只留島與名牌
const ISLET_LOD = 1.4; // 小於這個縮放時，小島只顯示島名
function stepNpcs(dt, t) {
  const show = camera.zoom >= NPC_MIN_ZOOM;
  npcs.forEach((n, i) => {
    n.visible = show;
    const u = n.userData;
    if (u.wait > 0) { u.wait -= dt; n.position.y = 0; return; }
    if (!u.goal) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * u.rad;
      u.goal = u.home.clone().add(new V3(Math.cos(a) * r, 0, Math.sin(a) * r));
      if (u.home.lengthSq() < 1) u.goal.setLength(2.2 + Math.random() * 1.2); // 中心島的人在噴水池外圍走動
    }
    const dir = u.goal.clone().sub(n.position).setY(0), dist = dir.length();
    if (dist < 0.05) { u.goal = null; u.wait = 2 + Math.random() * 5; return; }
    n.position.add(dir.multiplyScalar(Math.min(dist, 1.1 * dt) / dist));
    n.rotation.y = Math.atan2(dir.x, dir.z);
    n.position.y = Math.abs(Math.sin(t * 9 + i)) * 0.06;
  });
}

/* ---------------- 行走：沿著道路走 ---------------- */
let avAt = "C", avPath = [], avGoal = null;
const ringPt = (a, r = RW) => new V3(Math.cos(a) * r, 0, Math.sin(a) * r);
function arc(a0, a1, r = RW) {
  const pts = [], da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), m = Math.max(1, Math.ceil((Math.abs(da) * r) / 0.4));
  for (let k = 0; k <= m; k++) pts.push(ringPt(a0 + (da * k) / m, r));
  return pts;
}
const nearestSpoke = (a) => SPOKES.reduce((b, s) => (angOff(a, s) < angOff(a, b) ? s : b), SPOKES[0]);
const isleSpot = (d) => d.pos.clone().add(d.spot);
const hallIn = (d) => [d.pos.clone().add(d.door), d.pos.clone().add(d.side), isleSpot(d)]; // 車道口 → 建築側邊 → 站位
const hallOut = (d) => [d.pos.clone().add(d.side), d.pos.clone().add(d.door)];
// 路線：建築區 ⇄ 外圈道路 ⇄（連絡道路）⇄ 中央圓環
// 外圈道路 ⇄ 海岸 ⇄ 橋 ⇄ 小島中央
function isletPath(ISLET, outbound) {
  const b = ISLET.bridge, m = Math.ceil(b.len / 0.4), br = [];
  for (let k = 0; k <= m; k++) { const t = k / m, p = b.p0.clone().lerp(b.p1, t); p.y = Math.sin(t * Math.PI) * 0.35; br.push(p); }
  const pts = [ringPt(ISLET.a, RO), ...br, ISLET.pos.clone()];
  return outbound ? pts : pts.reverse();
}
function route(to) {
  const pts = [], curA = Math.atan2(av.position.z, av.position.x);
  let posA, onOuter;
  const from = avAt !== "C" ? ISL[avAt] : null;
  if (from) pts.push(...hallOut(from));
  if (from && from.isl) { const I = from.isl; pts.push(I.pos.clone()); if (ISL[to] && ISL[to].isl === I) { pts.push(...hallIn(ISL[to])); return pts; } pts.push(...isletPath(I, false)); posA = I.a; onOuter = true; }
  else if (from) { posA = from.a; pts.push(ringPt(posA, RO)); onOuter = true; }
  else { posA = curA; pts.push(ringPt(curA, RW)); onOuter = false; }
  if (to === "C") {
    if (onOuter) { const s = nearestSpoke(posA); pts.push(...arc(posA, s, RO), ringPt(s, RW)); posA = s; }
    pts.push(...arc(posA, front, RW), AV_HOME.clone());
  } else {
    const d = ISL[to], ta = d.isl ? d.isl.a : d.a;
    if (!onOuter) { const s = nearestSpoke(ta); pts.push(...arc(posA, s, RW), ringPt(s, RO)); posA = s; }
    pts.push(...arc(posA, ta, RO));
    if (d.isl) pts.push(...isletPath(d.isl, true));
    pts.push(...hallIn(d));
  }
  return pts;
}
function walkTo(to, onArrive) {
  if (avPath.length && avGoal) avAt = avGoal.from; // 走到一半改目的地：從出發點重新規劃
  if (to === avAt && !avPath.length) { onArrive && onArrive(); return; }
  avPath = route(to); avGoal = { to, onArrive, from: avAt };
}
function stepWalk(dt, t) {
  if (!avPath.length) { av.position.y = Math.max(0, av.position.y - dt); return; }
  let move = 7.5 * dt;
  while (move > 0 && avPath.length) {
    const nx = avPath[0], dir = nx.clone().sub(av.position), dist = dir.length();
    if (dist <= move) { av.position.copy(nx); avPath.shift(); move -= dist; }
    else { av.position.add(dir.multiplyScalar(move / dist)); move = 0; const fl = nx.clone().sub(av.position); if (fl.x || fl.z) av.rotation.y = Math.atan2(fl.x, fl.z); }
  }
  av.position.y += Math.abs(Math.sin(t * 14)) * 0.1;
  if (!avPath.length) { avAt = avGoal.to; av.rotation.y = FACE; const cb = avGoal.onArrive; avGoal = null; cb && cb(); }
}

/* ---------------- 鏡頭 ---------------- */
let tween = null;
const sph = new THREE.Spherical();
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  const base = CAM_R * (a < 0.8 ? 1.12 : 0.95);
  const hh = a >= 1 ? base : (base / a) * 0.9, hw = hh * a;
  camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
  camera.updateProjectionMatrix();
}
function flyTo(target, zoom, dur = 900) { tween = { s: performance.now(), d: RM ? 1 : dur, t0: controls.target.clone(), t1: target.clone(), z0: camera.zoom, z1: zoom }; }
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.s) / tween.d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const nt = tween.t0.clone().lerp(tween.t1, e), dv = nt.clone().sub(controls.target);
  controls.target.copy(nt); camera.position.add(dv);
  camera.zoom = tween.z0 + (tween.z1 - tween.z0) * e; camera.updateProjectionMatrix();
  if (k >= 1) tween = null;
}
// 讓目標落在 HUD 與資訊抽屜都沒蓋住的區域中央
function freeCenter() {
  const W = innerWidth, H = innerHeight, sh = $("sheet"), desk = W >= 900;
  let top = desk ? 0 : $("brand").getBoundingClientRect().bottom + 8, bottom = H, left = 0, right = desk ? $("rail").getBoundingClientRect().left - 8 : W;
  if (!sh.hidden) { const r = sh.getBoundingClientRect(); if (desk) right = r.left - 8; else { bottom = r.top - 8; top = 60; } }
  if (bottom - top < 120) bottom = top + 120;
  return { cx: (left + right) / 2, cy: (top + bottom) / 2, W, H };
}
function framed(p, zoom) {
  const { cx, cy, W, H } = freeCenter();
  const wpp = (camera.right - camera.left) / zoom / W;
  camera.updateMatrixWorld();
  const right = new V3().setFromMatrixColumn(camera.matrixWorld, 0), up = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
  return p.clone().setY(0).add(right.multiplyScalar((W / 2 - cx) * wpp)).add(up.multiplyScalar((cy - H / 2) * wpp));
}
const focusOn = (p, zoom) => flyTo(framed(p, zoom), zoom);
function goHome() {
  closeSheet(true);
  sph.set(camera.position.distanceTo(controls.target), HOME.phi, HOME.theta);
  camera.position.copy(controls.target).add(new V3().setFromSpherical(sph));
  flyTo(framed(HOME_C, homeZoom()), homeZoom());
  setSel(null);
}

/* ---------------- 名牌 ---------------- */
const lblEl = $("lbl"), labels = [];
// pri：越大越優先保留；minZoom：放大到這個倍率才顯示；selId：被選中時永遠顯示
function mkLabel(html, pos3, onClick, cls = "", opt = {}) {
  const el = document.createElement("button");
  el.type = "button"; el.className = "il " + cls; el.innerHTML = html;
  el.addEventListener("click", onClick);
  lblEl.appendChild(el);
  const L = { el, pos3, below: !!opt.below, pri: opt.pri || 0, minZoom: opt.minZoom || 0, maxZoom: opt.maxZoom || 0, hideFor: opt.hideFor || [], selId: opt.selId, me: !!opt.me, w: 0, h: 0 }; labels.push(L); return L;
}
function isleBadge(d) { const n = isleDl(d)[0]; if (!n) return ""; const k = daysLeft(n.at); return k <= 14 ? `<span class="d ${k <= 3 ? "hot" : ""}">D-${k}</span>` : ""; }
function buildLabels() {
  lblEl.innerHTML = ""; labels.length = 0;
  ISL.forEach((d) => {
    d.label = mkLabel(`<span class="no" style="--nc:${d.color}">${d.no}</span>${E(d.name)}${isleBadge(d)}${stamps["isle:" + d.key] ? '<span class="ok">✓</span>' : ""}`,
      d.pos.clone().add(d.build.position).setY(d.build.userData.h + 0.5), () => openIsle(d.i), "", { pri: 100 + (isleBadge(d).includes("hot") ? 5 : 0), selId: "isle:" + d.key, minZoom: d.islet ? ISLET_LOD : 0 });
  });
  // 小島：拉遠時只顯示一個島名，放大後才分成各館名牌
  ISLETS.forEach((I) => {
    const soon = I.halls.filter((d) => isleBadge(d)).sort((a, b) => isleDl(a)[0].at - isleDl(b)[0].at)[0];
    mkLabel(`${E(I.name)}${soon ? isleBadge(soon) : ""}`, I.pos.clone().setY(4),
      () => focusOn(I.pos, ISLET_LOD + 0.5), "", { pri: 100, maxZoom: ISLET_LOD, hideFor: I.halls.map((d) => "isle:" + d.key) });
  });
  CENTER_SPOTS.forEach((s) => {
    const o = centerObj[s.id], st = officeStatus();
    let extra = "";
    if (s.id === "office") extra = `<span class="d" style="background:${st.open ? "#5F8F5A" : "#7A6B60"}">${E(st.short)}</span>`;
    if (s.id === "news" && unread().length) extra = `<span class="d hot">${unread().length}</span>`;
    // 啊牛站在教堂前面，名牌改放在牠腳下，才不會擋住教堂正面
    const below = s.id === "todo";
    s.label = mkLabel(`<span class="no">${s.no}</span>${E(s.name)}${extra}`, below ? o.position.clone() : o.position.clone().setY((o.userData.h || 3) * o.scale.y + 0.4), () => openSpot(s.id), "",
      s.id === "office" ? { pri: 95, selId: s.id } : { pri: 50, minZoom: 1.5, selId: s.id, below });
  });
  mkLabel(`<b>${E(me.name || "我")}</b>${me.club ? `<span>${E(me.club)}</span>` : ""}`, () => av.position.clone().setY(av.position.y + 2.25), () => openChar("look"), "me", { pri: 70, minZoom: 1.8, me: true });
  refreshLabelState();
}
function refreshLabelState() {
  ISL.forEach((d) => d.label.el.classList.toggle("sel", sel === "isle:" + d.key));
  CENTER_SPOTS.forEach((s) => s.label.el.classList.toggle("sel", sel === s.id));
}
const pv = new V3();
// 名牌避讓：依優先順序擺放，會和已擺好的名牌重疊就淡出（島仍可直接點 3D 模型）
let wasCmp = null;
function placeLabels() {
  const W = innerWidth, H = innerHeight, z = camera.zoom, cmp = W < 600 && z < 1.6;
  if (cmp !== wasCmp) { lblEl.classList.toggle("cmp", cmp); labels.forEach((L) => (L.w = 0)); wasCmp = cmp; }
  const charOpen = !!(panelView && panelView.startsWith("char")), cand = [];
  labels.forEach((L) => {
    pv.copy(typeof L.pos3 === "function" ? L.pos3() : L.pos3).project(camera);
    const x = ((pv.x + 1) / 2) * W, y = ((1 - pv.y) / 2) * H;
    const off = pv.z > 1 || x < -80 || x > W + 80 || y < -40 || y > H + 40;
    L.el.classList.toggle("off", off);
    if (off) return;
    L.el.style.transform = L.below ? `translate(${x}px, ${y + 8}px) translate(-50%, 0)` : `translate(${x}px, ${y - 10}px) translate(-50%, -100%)`;
    const isSel = L.selId && L.selId === sel;
    if (!isSel && z < L.minZoom && !(L.me && charOpen)) { L.el.classList.add("hide"); return; }
    if (L.maxZoom && (z >= L.maxZoom || L.hideFor.includes(sel))) { L.el.classList.add("hide"); return; }
    if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
    cand.push({ L, x, y, p: isSel || (L.me && charOpen) ? 1e4 : L.pri });
  });
  cand.sort((a, b) => b.p - a.p);
  const placed = [];
  cand.forEach(({ L, x, y }) => {
    const r = L.below ? { l: x - L.w / 2 - 3, r: x + L.w / 2 + 3, t: y + 5, b: y + 8 + L.h + 3 } : { l: x - L.w / 2 - 3, r: x + L.w / 2 + 3, t: y - 10 - L.h - 3, b: y - 7 };
    const hit = placed.some((q) => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t);
    L.el.classList.toggle("hide", hit);
    if (!hit) placed.push(r);
  });
}

/* ---------------- 互動 ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null, sel = null, touring = false;
function pickAt(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true).find((h) => h.object.userData.pick);
  return hit && hit.object.userData.pick;
}
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; tween = null; touring = false; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 7 || performance.now() - downAt.t > 600) return;
  downAt = null;
  const p = pickAt(e);
  if (!p) return;
  if (p.t === "isle") openIsle(p.i);
  else if (p.t === "spot") openSpot(p.id);
  else if (p.t === "teacher") teacherTalk();
  else if (p.t === "me") openChar("look");
  else if (p.t === "npc") toast(`這位是${p.club || "體能性社團"}的夥伴`);
  else if (p.t === "center") openSpot("office");
});
renderer.domElement.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || e.buttons) return; renderer.domElement.style.cursor = pickAt(e) ? "pointer" : "grab"; });

function setSel(id) { sel = id; refreshLabelState(); }
function stamp(id, name) {
  if (stamps[id]) return;
  stamps[id] = Date.now(); LS.set("stamps", stamps);
  updHud(); buildLabels();
  const n = stampCount();
  toast(`蓋章！${name}（${n}/${STAMPS.length}）`);
  if (n === STAMPS.length) { confetti(); setTimeout(() => talk("CONGRATS", [["全部蓋滿了！", `${me.name || "你"}已經走遍整座群島，是合格的新任幹部。之後有新公告或快到的截止日，島上會浮出菱形提醒，記得常回來看看。`, "好"]]), 900); }
}
function openIsle(i, tour) {
  if (!tour) touring = false;
  const d = ISL[i];
  setSel("isle:" + d.key);
  renderIsle(d);
  focusOn(d.pos, innerWidth < 600 ? 2.4 : 2);
  walkTo(i, () => {
    stamp("isle:" + d.key, d.name);
    if (panelView === "isle:" + d.key) renderIsle(d, true);
    if (touring) setTimeout(tourNext, 2600);
  });
}
// 點「任務」：鏡頭飛到小秘書，牛跳起來轉一圈、灑出星星，泡泡顯示「解鎖任務！」，接著打開任務清單
let cowFx = null;
// 點啊牛：跳一下、撒星星，然後打開截止日提醒
function cowRemind() {
  touring = false;
  closeSheet(true);
  setSel("todo");
  focusOn(SPOT.todo.pos, innerWidth < 600 ? 3 : 2.6);
  walkTo("C", () => stamp("todo", "啊牛提醒"));
  cowMsg = "啊牛提醒！"; centerObj.todo.userData.sign.userData.redraw();
  const g = centerObj.todo, stars = [];
  if (!RM) for (let k = 0; k < 14; k++) {
    const s = mesh(new THREE.OctahedronGeometry(0.12 + Math.random() * 0.08, 0), mat(k % 2 ? 0xffe27a : 0xffffff, { emissive: k % 2 ? 0xffc93c : 0xffffff, emissiveIntensity: 0.6 }), 0, 2, 0, g);
    s.castShadow = false; s.userData.v = new V3(Math.cos(k * 0.45) * (1.5 + Math.random()), 2 + Math.random() * 1.5, Math.sin(k * 0.45) * (1.5 + Math.random())); stars.push(s);
  }
  cowFx = { s: performance.now(), stars };
  setTimeout(() => {
    cowMsg = null; centerObj.todo.userData.sign.userData.redraw();
    renderDeadlines("todo"); setSel("todo");
    focusOn(SPOT.todo.pos, innerWidth < 600 ? 2.1 : 1.8);
  }, RM ? 300 : 1400);
}
// 社團行政任務放在社團行政館（data.js 裡 tasks: true 的館）
const TASK_ISLE = ISL.find((d) => d.tasks);
const openTasks = () => (TASK_ISLE ? openIsle(TASK_ISLE.i) : null);
function stepCowFx(now) {
  if (!cowFx) return;
  const k = (now - cowFx.s) / 1000, cow = centerObj.todo.userData.npc;
  if (k < 1) { cow.position.y = 0.18 + Math.sin(k * Math.PI) * 1.2; cow.rotation.y = k * Math.PI * 2; }
  cowFx.stars.forEach((s) => { const f = Math.min(k, 1.3); s.position.set(s.userData.v.x * f, 2 + s.userData.v.y * f - 2.2 * f * f, s.userData.v.z * f); s.rotation.y += 0.2; s.scale.setScalar(Math.max(0, 1 - k / 1.4)); });
  if (k > 1.4) { cowFx.stars.forEach((s) => centerObj.todo.remove(s)); cow.position.y = 0.18; cow.rotation.y = 0; cowFx = null; }
}
function openSpot(id) {
  if (id === "todo" || id === "deadlines") return cowRemind(); // 截止日清單由啊牛提醒
  touring = false;
  setSel(id);
  ({ office: renderOffice, news: renderNews, todo: () => renderDeadlines("todo"), links: renderLinks })[id]();
  focusOn(SPOT[id].pos, innerWidth < 600 ? 2.1 : 1.8);
  walkTo("C", () => stamp(id, CENTER_SPOTS.find((s) => s.id === id).name));
}
let tourQ = [];
function startTour() {
  tourQ = ISL.map((d) => d.i).filter((i) => !stamps["isle:" + ISL[i].key]);
  if (!tourQ.length) tourQ = ISL.map((d) => d.i);
  touring = true;
  toast("出發！角色會帶你一座一座逛");
  tourNext();
}
function tourNext() {
  if (!touring) return;
  if (!tourQ.length) { touring = false; openSpot("office"); toast("導覽結束，回到課外組"); return; }
  openIsle(tourQ.shift(), true);
}

/* ---------------- 資訊抽屜 ---------------- */
let panelView = null;
const RAIL = { char: "bChar", list: "bList", todo: "bDl", [TASK_ISLE ? "isle:" + TASK_ISLE.key : "tasks"]: "bTodo", news: "bNews" };
function showSheet(view, html) {
  panelView = view;
  $("sbody").innerHTML = html;
  $("sheet").hidden = false; document.body.classList.add("sheeted");
  $("sbody").scrollTop = 0; $("toTop").hidden = true;
  Object.entries(RAIL).forEach(([v, id]) => $(id).setAttribute("aria-pressed", String(view === v || (v === "char" && view.startsWith("char")))));
  try { history.replaceState(null, "", "#" + view.replace("isle:", "isle-").replace(/^char.*/, "me")); } catch {}
}
function closeSheet(keepSel) {
  $("sheet").hidden = true; document.body.classList.remove("sheeted"); panelView = null; touring = false;
  Object.values(RAIL).forEach((id) => $(id).setAttribute("aria-pressed", "false"));
  if (!keepSel) setSel(null);
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
}
$("sx").addEventListener("click", () => closeSheet());
// 懸浮「回到最頂」：資訊抽屜往下捲才出現
$("sbody").addEventListener("scroll", () => { $("toTop").hidden = $("sbody").scrollTop < 200; }, { passive: true });
$("toTop").addEventListener("click", () => $("sbody").scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }));
addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("modal").hidden) endTalk(true); else closeSheet(); } });
const head = (tile, kick, title) => `<div class="sh"><div class="tile">${tile}</div><div><div class="kick">${kick}</div><h2>${E(title)}</h2></div></div>`;
const stampTag = (id) => (stamps[id] ? '<span class="tag ok">✓ 已蓋章</span>' : '<span class="tag">走到這裡可蓋章</span>');

function gcal(x) {
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("【截止】" + x.title) + "&dates=" + z(new Date(x.at - 18e5)) + "/" + z(x.at) + "&ctz=" + TZ + "&details=" + encodeURIComponent((x.detail || "") + "\n" + (x.link || D.links.schedule));
}
function icsFor(list) {
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const e = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//THU Athletic Clubs//ZH-TW", "X-WR-CALNAME:東海體能性社團截止日"];
  list.forEach((x) => L.push("BEGIN:VEVENT", `UID:${x.id}@thuathletic`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(new Date(x.at - 18e5))}`, `DTEND:${z(x.at)}`, `SUMMARY:${e("【截止】" + x.title)}`, `DESCRIPTION:${e((x.detail || "") + "\n" + (x.link || D.links.schedule))}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e("3 天後截止：" + x.title)}`, "TRIGGER:-P3D", "END:VALARM", "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e("明天截止：" + x.title)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT"));
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
function saveFile(name, blob, okMsg) {
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast(okMsg); }
  catch { toast("無法下載，請改用其他方式儲存"); }
}
const download = (name, text) => saveFile(name, new Blob([text], { type: "text/calendar;charset=utf-8" }), "已下載行事曆檔，開啟即可加入");
const subUrl = () => (location.protocol === "https:" ? "webcal://" + location.host + location.pathname.replace(/[^/]*$/, "") + "calendar.ics" : "calendar.ics");
const noTag = (no) => `<span style="font:700 13px var(--f-mono);color:var(--terra);margin-right:8px">${no}</span>`;

function dlItems(list, showIsle, openFirst) {
  if (!list.length) return '<p class="empty">目前沒有待辦的截止日。</p>';
  return '<ul class="items">' + list.map((x, k) => {
    const n = daysLeft(x.at), d = isleOf(x.category), l = lvl(n), open = openFirst && k === 0;
    return `<li class="item ${l === "hot" ? "hl" : ""}" style="--c:${d ? d.color : "var(--terra)"}"><button type="button" aria-expanded="${open}"><span class="dot"></span><span class="nm">${E(x.title)}<small>${fmt(x.at)} 截止${showIsle && d ? "・" + E(d.name) : ""}</small></span><span class="meta ${l}">${n === 0 ? "今天" : "D-" + n}</span><span class="chev">›</span></button>
      <div class="more" ${open ? "" : "hidden"}>${x.detail ? `<p>${E(x.detail)}</p>` : ""}<div class="acts"><a class="btn g" target="_blank" rel="noopener" href="${E(gcal(x))}">Google 日曆</a><button class="btn g" type="button" data-ics="${E(x.id)}">iPhone／其他</button>${x.link ? `<a class="btn g" target="_blank" rel="noopener" href="${E(x.link)}">相關文件 ↗</a>` : ""}${showIsle && d ? `<button class="btn" type="button" data-isle="${d.i}">去${E(d.name)}</button>` : ""}</div></div></li>`;
  }).join("") + "</ul>";
}
function pastItems(list) {
  return '<ul class="items past">' + list.map((x) => { const d = isleOf(x.category);
    return `<li class="item" style="--c:var(--mut);opacity:.75"><button type="button" aria-expanded="false"><span class="dot"></span><span class="nm">${E(x.title)}<small>${fmt(x.at)} 已截止${d ? "・" + E(d.name) : ""}</small></span><span class="meta">已截止</span><span class="chev">›</span></button>
      <div class="more" hidden>${x.detail ? `<p>${E(x.detail)}</p>` : ""}${x.link ? `<div class="acts"><a class="btn g" target="_blank" rel="noopener" href="${E(x.link)}">相關文件 ↗</a></div>` : ""}</div></li>`; }).join("") + "</ul>";
}
function newsItems(list) {
  if (!list.length) return '<p class="empty">目前沒有公告。</p>';
  return '<ul class="items">' + list.map((a) => { const d = isleOf(a.tag), nw = !read.includes(a.id);
    return `<li class="item ${nw ? "hl" : ""}" style="--c:${d ? d.color : "var(--terra)"}"><button type="button" aria-expanded="${nw}"><span class="dot"></span><span class="nm">${E(a.title)}<small>${[a.date, d && d.name].filter(Boolean).map(E).join("・")}</small></span><span class="meta ${nw ? "hot" : ""}">${a.pinned ? "置頂" : nw ? "NEW" : ""}</span><span class="chev">›</span></button><div class="more" ${nw ? "" : "hidden"}>${a.body ? `<p>${E(a.body)}</p>` : ""}${a.link ? `<div class="acts"><a class="btn t" target="_blank" rel="noopener" href="${E(a.link)}">查看公告 ↗</a></div>` : ""}</div></li>`; }).join("") + "</ul>";
}
function markRead(list) { let ch = false; list.forEach((a) => { if (!read.includes(a.id)) { read.push(a.id); ch = true; } }); if (ch) { LS.set("read", read); updHud(); updMarkers(); buildLabels(); } }

// 島內分區：相對期限的提醒（例如活動結束後 2 週內），附要準備的文件與下載按鈕
function sectionsHtml(d) {
  return (d.sections || []).map((s, k) => `<div class="sec" id="i-s${k}"><h4>${E(s.title)}</h4><ul class="items">${(s.rules || []).map((r) => `<li class="item" style="--c:${d.color}"><button type="button" aria-expanded="true"><span class="dot"></span><span class="nm">${E(r.title)}${r.note ? `<small>${E(r.note)}</small>` : ""}</span><span class="meta warn">${E(r.when || "")}</span><span class="chev">›</span></button>
    <div class="more">${r.files?.length ? `<p>${E(r.prep || "需準備：")}</p><ul class="files">${r.files.map((f) => `<li>${E(f)}</li>`).join("")}</ul>` : ""}${r.links?.length ? `<div class="acts">${r.links.map((l) => (l[1] ? `<a class="btn t" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>` : `<span class="btn g pend" aria-disabled="true">${E(l[0])}・連結待補</span>`)).join("")}</div>` : ""}</div></li>`).join("")}</ul></div>`).join("");
}
const sectionText = (d) => (d.sections || []).flatMap((s) => [s.title, ...(s.rules || []).flatMap((r) => [r.when, r.title, r.note, r.prep, ...(r.files || [])])]).filter(Boolean);
function renderIsle(d, keepScroll) {
  const dl = isleDl(d), news = isleNews(d), steps = d.guides.reduce((n, g) => n + g.steps.length, 0), duty = DUTY[d.key] || [];
  const mine = (r) => me.club && me.role === r;
  const st = $("sbody").scrollTop;
  const top = `${head(d.icon, `HALL ${d.no} · ${E(d.key)}`, d.name)}
    <p class="lead">${E(d.lead || d.guides[0]?.title || d.tagline)}</p>
    <p class="quote">「${E(d.tagline)}」</p>
    ${d.links?.length ? `<div class="acts">${d.links.map((l) => `<a class="btn big t ring" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>`).join("")}</div>` : ""}`;
  const foot = '<p class="foot">如有相關問題，請與課外組峮老師聯繫。</p>';
  // 社團行政館：只放社團行政任務
  if (d.tasks) {
    showSheet("isle:" + d.key, `${top}<div class="tags">${stampTag("isle:" + d.key)}</div><div class="sec" id="i-tasks"><h4>社團行政任務</h4></div>${taskBlock()}${foot}`);
    if (keepScroll) $("sbody").scrollTop = st;
    return;
  }
  // 頂部跳轉按鈕（data.js 設 jump: true 的館）
  const parts = [...(d.sections || []).map((x, k) => [`i-s${k}`, x.title]), ...(d.guides.length ? [["i-g", "攻略"]] : []), ["i-dl", "截止日"], ["i-news", "相關公告"], ["i-duty", "這一館在照顧誰"]];
  const html = `${top}
    ${d.jump ? `<div class="jump" role="navigation" aria-label="跳到這一頁的段落">${parts.map(([id, t]) => `<button class="btn g" type="button" data-jump="${id}">${E(t)}</button>`).join("")}</div>` : ""}
    <div class="tags"><span class="tag c" style="--c:${d.color}">${E(d.key)}</span>${d.sections?.length ? `<span class="tag">${d.sections.length} 個分區</span>` : `<span class="tag">${dl.length} 項截止</span>`}<span class="tag">${steps} 則攻略</span><span class="tag">${news.length} 則公告</span>${stampTag("isle:" + d.key)}</div>
    ${sectionsHtml(d)}
    ${d.guides.map((g, k) => `<div class="sec" ${k ? "" : 'id="i-g"'}><h4>${E(g.topic)}・攻略</h4><ul class="items"><li class="item" style="--c:${d.color}"><button type="button" aria-expanded="true"><span class="dot"></span><span class="nm">${E(g.title)}<small>${E(g.summary)}</small></span><span class="meta">${g.steps.length} 則</span><span class="chev">›</span></button><div class="more"><ol>${g.steps.map((s) => `<li>${E(s)}</li>`).join("")}</ol>${g.links?.length ? `<div class="acts">${g.links.map((l) => `<a class="btn g" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>`).join("")}</div>` : ""}</div></li></ul></div>`).join("")}
    <div class="sec" id="i-dl"><h4>截止日</h4>${dlItems(dl, false, true)}</div>
    <div class="sec" id="i-news"><h4>相關公告</h4>${newsItems(news)}</div>
    <div class="sec" id="i-duty"><h4>這一館在照顧誰</h4><ul class="items">${duty.map((r) => `<li class="item ${mine(r) ? "hl" : ""}"><div class="row"><span class="dot"></span><span class="nm">${E(r)}${mine(r) ? `<small>就是你！${E(me.club)}的${E(r)}</small>` : ""}</span><span></span><span></span></div></li>`).join("")}</ul></div>
    ${foot}`;
  showSheet("isle:" + d.key, html);
  if (keepScroll) $("sbody").scrollTop = st;
  markRead(news);
}
function placeItems(filter) {
  return '<ul class="items">' + ISL.filter((d) => !filter || filter(d)).map((d) => { const n = isleDl(d)[0], k = n ? daysLeft(n.at) : null;
    return `<li class="item ${myDuty(d) ? "hl" : ""}" style="--c:${d.color}"><button type="button" data-isle="${d.i}"><span class="dot"></span><span class="nm">${noTag(d.no)}${E(d.name)}<small>${E(d.tagline)}${myDuty(d) ? "・你的職責" : ""}</small></span><span class="meta ${k !== null ? lvl(k) : ""}">${k !== null ? "D-" + k : ""}${stamps["isle:" + d.key] ? " ✓" : ""}</span><span class="chev">›</span></button></li>`; }).join("") + "</ul>";
}
function renderOffice() {
  const st = officeStatus(), p = tw(), slots = D.office.hours.slots.map((s) => s.join("–")).join("、");
  // 本週（週一到週日）的實際日期，國定假日與補假標示不辦公
  const now = new Date(), monday = new Date(now.getTime() - ((p.wd + 6) % 7) * 864e5);
  const rows = [0, 1, 2, 3, 4, 5, 6].map((k) => { const di = dayInfo(new Date(monday.getTime() + k * 864e5)), isToday = di.key === ymd(p);
    return `<tr class="${isToday ? "today" : ""}"><td>${di.p.m}/${di.p.d}（${WEEK[di.p.wd]}）${isToday ? "今天" : ""}</td><td class="${di.open ? "" : "closed"}">${di.open ? slots : di.holiday ? `不辦公（${E(di.holiday)}）` : "不辦公"}</td></tr>`; }).join("");
  const unit = D.office.name.match(/^(\S+處)\s*(.+)$/); // 「學務處 課外活動暨學生發展組」拆成上方小字與標題
  const html = `${head("🏛", `CENTER 00 · ${unit ? unit[1] : "島嶼中心"}`, unit ? unit[2] : D.office.name)}
    <p class="lead">島上 ${ISL.length} 座行政館都有道路通到這裡，有問題就回來找我們。</p>
    <div class="bigst"><span class="lamp ${st.open ? "on" : "off"}"></span>${E(st.text)}</div>
    <p class="hours">辦公時間：週一至週五 ${D.office.hours.slots.map((s) => s.join("–")).join("、")}（國定假日不辦公）</p>
    <div class="jump" role="navigation" aria-label="跳到這一頁的段落">
      <button class="btn g" type="button" data-jump="o-hours">🕘 本週辦公時間</button>
      <button class="btn g" type="button" data-jump="o-map">📍 位置與導航</button>
      <button class="btn g" type="button" data-jump="o-tips">💡 洽公小提醒</button>
      <button class="btn g" type="button" data-jump="o-forms">📝 常用表單</button>
      <button class="btn g" type="button" data-jump="o-isles">🏛 各行政館</button>
    </div>
    <div class="tags">${stampTag("office")}</div>
    <div class="sec" id="o-hours"><h4>本週辦公時間</h4><table class="week"><tbody>${rows}</tbody></table></div>
    <div class="sec" id="o-map"><h4>位置與導航</h4><p class="quote">${E(D.office.locationNote)}</p><div class="acts">${D.office.mapUrl ? `<a class="btn t" target="_blank" rel="noopener" href="${E(D.office.mapUrl)}">開啟 Google 地圖導航</a>` : ""}<a class="btn g" target="_blank" rel="noopener" href="${E(D.links.office)}">課外組網站 ↗</a></div>${D.office.mapUrl ? "" : '<p class="foot">Google 地圖導航建置中。</p>'}</div>
    <div class="sec" id="o-tips"><h4>洽公小提醒</h4><ul class="items">${D.office.tips.map((t) => `<li class="item"><div class="row"><span class="dot"></span><span class="nm">${E(t)}</span><span></span><span></span></div></li>`).join("")}</ul></div>
    <div class="sec" id="o-forms"><h4>常用表單</h4><div class="acts">${(D.office.forms || []).map((l) => `<a class="btn g" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>`).join("")}</div></div>
    <div class="sec" id="o-isles"><h4>${ISL.length} 座行政館</h4>${placeItems()}</div>`;
  showSheet("office", html);
}
function renderDeadlines(view = "todo") {
  const html = `${head("🐮", "SECRETARY · 小秘書啊牛", "啊牛提醒")}
    <p class="lead">哞～我是小秘書啊牛！所有分類快到期的截止日都幫你記著。</p>
    <p class="quote">7 天內轉黃、3 天內轉紅，對應的館上方也會浮出菱形提醒。</p>
    <div class="tags"><span class="tag">${upcoming().length} 項截止日</span>${stampTag(view)}</div>
    <div class="acts"><a class="btn t" href="${E(subUrl())}">訂閱社團行事曆</a><button class="btn g" type="button" data-ics="all">全部加入行事曆</button><button class="btn g" type="button" id="notifyBtn">開啟網頁通知</button></div>
    <p class="foot">訂閱後，新的截止日會自動同步到手機，並在截止前 3 天、1 天提醒。</p>
    <div class="sec"><h4>依日期排序</h4>${dlItems(upcoming(), true, true)}</div>
    ${passed().length ? `<div class="sec"><button class="btn g" type="button" data-past="1">${showPast ? "隱藏已截止項目" : `顯示已截止項目（${passed().length}）`}</button>${showPast ? pastItems(passed()) : ""}</div>` : ""}
    <p class="foot">正式期程以 <a target="_blank" rel="noopener" href="${E(D.links.schedule)}">體能性社團作業期程表 ↗</a> 為準。</p>`;
  showSheet(view, html);
  renderNotifyBtn();
}
const isleTodos = (d) => todoList(curSem()).filter((x) => x.island === d.key);
function todoItems(list) {
  if (!list.length) return '<p class="empty">沒有任務。</p>';
  return '<ul class="items">' + list.map((x) => {
    const done = !!todoDone[x.key], d = isleOf(x.island);
    const btns = (x.links || []).map((l) => (l[1] ? `<a class="btn g" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>` : `<span class="btn g pend" aria-disabled="true">${E(l[0])}・連結待補</span>`)).join("");
    return `<li class="item todo ${done ? "done" : ""}" style="--c:${d ? d.color : "var(--terra)"}"><label class="row"><input type="checkbox" data-todo="${E(x.key)}" ${done ? "checked" : ""} aria-label="完成：${E(x.title)}"><span class="nm">${E(x.title)}${x.note ? `<small>${E(x.note)}</small>` : ""}</span><span class="meta">${x.when ? E(x.when) : ""}</span><span></span></label>${btns ? `<div class="more"><div class="acts">${btns}</div></div>` : ""}</li>`;
  }).join("") + "</ul>";
}
let todoSem = null;
function taskBlock(sem) {
  todoSem = sem || todoSem || curSem();
  const list = todoList(todoSem), n = list.filter((x) => todoDone[x.key]).length;
  return `<div class="tabs two" role="tablist">${["s1", "s2"].map((s) => `<button type="button" role="tab" data-sem="${s}" aria-selected="${todoSem === s}">${SEM_NAME[s]}${s === curSem() ? "・本學期" : ""}</button>`).join("")}</div>
    <div class="sec"><h4>完成進度・<span id="todoProg">${n}/${list.length}</span></h4><div class="prog"><i id="todoBar" style="width:${list.length ? (n / list.length) * 100 : 0}%"></i></div></div>
    <div class="sec"><h4>每學期共同項目</h4>${todoItems(list.filter((x) => x.sem === "common"))}</div>
    <div class="sec"><h4>${SEM_NAME[todoSem]}任務</h4>${todoItems(list.filter((x) => x.sem !== "common"))}</div>
    <p class="foot">打勾紀錄與公告閱讀狀態會自動記在這台手機或電腦的瀏覽器裡，下次打開連結會接著顯示，不會重來（換裝置或清除瀏覽紀錄才會重新開始）。標示「連結待補」的按鈕，課外組補上連結後就能點。</p>`;
}
function renderNews() {
  const html = `${head("📌", "BULLETIN · 公告", "公告欄")}<p class="lead">學期間的行政公告都貼在這裡。</p><div class="tags"><span class="tag">${anns.length} 則公告</span>${unread().length ? `<span class="tag c" style="--c:#C8443A">${unread().length} 則未讀</span>` : ""}${stampTag("news")}</div><div class="sec"><h4>最新公告</h4>${newsItems(anns)}</div>`;
  showSheet("news", html);
  markRead(anns);
}
function renderLinks() {
  const row = (t, s, href, ext = true) => `<li class="item"><a class="row" style="text-decoration:none;color:inherit" href="${E(href)}" ${ext ? 'target="_blank" rel="noopener"' : ""}><span class="dot"></span><span class="nm">${t}<small>${s}</small></span><span class="meta">${ext ? "↗" : ""}</span><span class="chev">›</span></a></li>`;
  const html = `${head("⛵", "HARBOR · 出航", "出航碼頭")}<p class="lead">從碼頭出航，前往課外組的其他平台。</p><div class="tags">${stampTag("links")}</div>
    <div class="sec"><h4>常用連結</h4><ul class="items">${row("課外組網站", "activity.thu.edu.tw", D.links.office)}${row("體能性社團 Linktree", "表單、雲端資料夾與常用連結", D.links.linktree)}${row("東海空間網場地借用", "space.thu.edu.tw", "https://space.thu.edu.tw/")}${row("推廣部場地借用", "中正堂、銘賢堂需要再登記推廣部借用網", "https://thurent.thu.edu.tw/borrow.php")}</ul></div>`;
  showSheet("links", html);
}
const isleHits = (d, q) => d.name.includes(q) || sectionText(d).some((s) => s.includes(q)) || ["s1", "s2"].some((sem) => todoList(sem).some((x) => x.island === d.key && (x.title + (x.note || "")).includes(q))) || d.guides.some((g) => [g.topic, g.title, g.summary, ...g.steps].some((s) => s.includes(q))) || isleDl(d).some((x) => (x.title + (x.detail || "")).includes(q)) || isleNews(d).some((a) => (a.title + (a.body || "")).includes(q));
function listResults(q) {
  const res = [];
  ISL.forEach((d) => {
    d.guides.forEach((g) => { const hit = [g.topic, g.title, g.summary, ...g.steps].find((s) => s.includes(q)); if (hit) res.push({ d, t: g.title, s: hit }); });
    isleDl(d).forEach((x) => { if ((x.title + (x.detail || "")).includes(q)) res.push({ d, t: x.title, s: `截止日・${fmt(x.at)}` }); });
    (d.sections || []).forEach((s) => (s.rules || []).forEach((r) => { if ([s.title, r.when, r.title, r.note, ...(r.files || [])].filter(Boolean).join(" ").includes(q)) res.push({ d, t: r.title, s: `${s.title}・${r.when || ""}` }); }));
    isleNews(d).forEach((a) => { if ((a.title + (a.body || "")).includes(q)) res.push({ d, t: a.title, s: "公告" + (a.body ? "・" + a.body : "") }); });
    ["s1", "s2"].forEach((sem) => todoList(sem).filter((x) => x.island === d.key && (sem === "s1" || x.sem !== "common")).forEach((x) => { if ((x.title + (x.note || "")).includes(q)) res.push({ d, t: x.title, s: `${x.sem === "common" ? "每學期" : SEM_NAME[sem]}任務${x.note ? "・" + x.note : ""}` }); }));
  });
  const hl = (s) => E(s).split(E(q)).join(`<mark>${E(q)}</mark>`);
  return `<div class="sec"><h4>搜尋結果・${res.length} 筆</h4>${res.length ? '<ul class="items">' + res.map((r) => `<li class="item" style="--c:${r.d.color}"><button type="button" data-isle="${r.d.i}"><span class="dot"></span><span class="nm">${hl(r.t)}<small>${E(r.d.name)}・${hl(r.s)}</small></span><span class="meta"></span><span class="chev">›</span></button></li>`).join("") + "</ul>" : `<p class="empty">找不到「${E(q)}」。可以在辦公時間到課外組當面詢問。</p>`}</div>`;
}
function renderList() {
  const centerList = '<ul class="items">' + CENTER_SPOTS.map((s) => `<li class="item"><button type="button" data-spot="${s.id}"><span class="dot"></span><span class="nm">${noTag(s.no)}${E(s.name)}</span><span class="meta">${stamps[s.id] ? "✓" : ""}</span><span class="chev">›</span></button></li>`).join("") + "</ul>";
  showSheet("list", `${head("≡", "INDEX · 清單", "群島清單")}<label class="foot" for="q">搜尋截止日、流程與公告</label><input id="q" class="search" type="search" autocomplete="off" placeholder="例如：保險、核銷、場地"><div id="results"></div><div id="places"><div class="sec"><h4>行政館</h4>${placeItems()}</div><div class="sec"><h4>中央・課外組</h4>${centerList}</div></div>`);
  $("q").addEventListener("input", (e) => { const q = e.target.value.trim(); $("results").innerHTML = q ? listResults(q) : ""; $("places").hidden = !!q; });
}

/* ---- 角色 ---- */
let charTab = "look", lastPhoto = null;
function openChar(tab) {
  touring = false;
  charTab = tab || charTab;
  renderChar();
  setSel(null);
  focusOn(av.position, innerWidth < 600 ? 5.2 : 4.4);
}
function renderChar() {
  const tabs = `<div class="tabs" role="tablist">${[["look", "外觀"], ["trip", "行程"], ["photo", "拍照"]].map(([k, t]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${charTab === k}">${t}</button>`).join("")}</div>`;
  let body = "";
  if (charTab === "look") {
    body = `<div class="field"><label for="meName">名字</label><input id="meName" class="search" maxlength="12" autocomplete="off" placeholder="替角色取個名字" value="${E(me.name)}"></div>
      <div class="field"><span>身份</span><div class="choices">${CLUBS.map((c) => `<button type="button" data-club="${E(c.name)}" aria-pressed="${me.club === c.name}">${E(c.name)}</button>`).join("")}</div></div>
      <div class="field"><span>職位</span><div class="choices sm">${ROLES.map((r) => `<button type="button" data-role="${E(r)}" aria-pressed="${me.role === r}">${E(r)}</button>`).join("")}</div></div>
      <div class="field"><span>球衣顏色</span><div class="sw">${SHIRTS.map((c) => `<button type="button" data-shirt="${c}" style="--c:${c}" aria-pressed="${me.shirt === c}" aria-label="球衣顏色 ${c}"></button>`).join("")}</div></div>
      <div class="field"><span>髮色</span><div class="sw">${HAIRS.map((c) => `<button type="button" data-hair="${c}" style="--c:${c}" aria-pressed="${me.hair === c}" aria-label="髮色 ${c}"></button>`).join("")}</div></div>
      <div class="field"><span>膚色</span><div class="sw">${SKINS.map((c) => `<button type="button" data-skin="${c}" style="--c:${c}" aria-pressed="${me.skin === c}" aria-label="膚色 ${c}"></button>`).join("")}</div></div>
      <div class="acts"><button class="btn big t" type="button" id="meDone">${me.club ? "完成，開始逛群島" : "先選一個身份"}</button></div>
      <p class="foot">角色只存在你自己的手機或電腦，不會上傳。</p>`;
  } else if (charTab === "trip") {
    const n = stampCount(), t = D.onboarding.filter((x) => tasks[x]).length, mine = ISL.filter(myDuty);
    body = `<div class="sec"><h4>幹部護照・${n} / ${STAMPS.length}</h4><div class="prog"><i style="width:${(n / STAMPS.length) * 100}%"></i></div>
      <div class="stamps">${STAMPS.map((s) => `<button type="button" class="stc ${stamps[s.id] ? "on" : ""}" data-stamp="${E(s.id)}"><i>${stamps[s.id] ? "THU" : s.no}</i>${E(s.name)}</button>`).join("")}</div>
      <div class="acts"><button class="btn big t ring" type="button" id="tourBtn">帶我逛一圈</button></div></div>
      ${mine.length ? `<div class="sec"><h4>${E(me.role)}要特別注意的館</h4>${placeItems(myDuty)}</div>` : ""}
      <div class="sec"><h4>新任幹部上任清單・<span id="taskN">${t}/${D.onboarding.length}</span></h4><ul class="tasks">${D.onboarding.map((x, i) => `<li><label for="task${i}"><input type="checkbox" id="task${i}" data-task="${i}" ${tasks[x] ? "checked" : ""}><span>${E(x)}</span></label></li>`).join("")}</ul></div>
      <div class="acts"><button class="btn g" type="button" id="resetSt">清除所有印章</button></div>`;
  } else {
    body = `<p class="lead">和你的角色在群島上合照，存成圖片分享到社團群組。</p>
      <div class="acts"><button class="btn big t ring" type="button" id="shoot">拍一張</button></div>
      ${lastPhoto ? `<img class="photo" src="${lastPhoto}" alt="${E(me.name || "我")}在行政群島的合照"><div class="acts"><button class="btn" type="button" id="savePhoto">下載圖片</button></div><p class="foot">手機也可以長按圖片儲存。</p>` : '<p class="foot">會拍下目前的畫面，可以先拖曳、縮放調整角度。</p>'}`;
  }
  showSheet("char:" + charTab, `${head("☺", "MY CHARACTER", "角色")}${tabs}${body}`);
}
function applyMe(redraw) {
  const st = $("sbody").scrollTop;
  LS.set("me", me); rebuildAvatar(); buildLabels(); updHud();
  if (redraw) { renderChar(); $("sbody").scrollTop = st; }
}
function shoot() {
  renderer.render(scene, camera); // 同一個 tick 內讀取畫面，不需要 preserveDrawingBuffer
  const src = renderer.domElement, W = Math.min(1200, src.width), H = Math.round((src.height / src.width) * W);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H + 200;
  const c = cv.getContext("2d");
  c.drawImage(src, 0, 0, W, H);
  c.fillStyle = "#FBF6EE"; c.fillRect(0, H, W, 200);
  // 三行由上往下排，文字太長時自動縮小，不會互相重疊
  const fit = (txt, size, weight, max) => { let z = size; do { c.font = `${weight} ${z}px ${FONT}`; z -= 2; } while (c.measureText(txt).width > max && z > 12); };
  const p = tw();
  c.fillStyle = "#C8623F"; c.font = "900 50px Archivo, sans-serif"; c.fillText("CLUB ON.", 40, H + 64);
  const who = `${me.name || "我"}・${me.club || "體能性社團"}・${me.role}`;
  c.fillStyle = "#2A211C"; fit(who, 34, 900, W - 80); c.fillText(who, 40, H + 120);
  const sub = `東海體能社團行政群島・集章 ${stampCount()}/${STAMPS.length}・${p.y}/${p.m}/${p.d}`;
  c.fillStyle = "#7A6B60"; fit(sub, 24, 700, W - 80); c.fillText(sub, 40, H + 166);
  lastPhoto = cv.toDataURL("image/png");
  renderChar();
}
$("sbody").addEventListener("input", (e) => { if (e.target.id === "meName") { me.name = e.target.value.trim(); LS.set("me", me); buildLabels(); } });
$("sbody").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("aria-expanded") && b.parentElement.classList.contains("item")) { const open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open); const m = b.nextElementSibling; if (m) m.hidden = !open; return; }
  if (b.dataset.jump === "top") { $("sbody").scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }); return; }
  if (b.dataset.jump) { const el = $(b.dataset.jump); if (el) el.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }); return; }
  if (b.dataset.isle !== undefined) return openIsle(+b.dataset.isle);
  if (b.dataset.spot) return openSpot(b.dataset.spot);
  if (b.dataset.tab) { charTab = b.dataset.tab; return renderChar(); }
  if (b.dataset.sem) { todoSem = b.dataset.sem; return TASK_ISLE && renderIsle(TASK_ISLE, true); }
  if (b.dataset.club) { me.club = b.dataset.club; return applyMe(true); }
  if (b.dataset.role) { me.role = b.dataset.role; return applyMe(true); }
  if (b.dataset.shirt) { me.shirt = b.dataset.shirt; return applyMe(true); }
  if (b.dataset.hair) { me.hair = b.dataset.hair; return applyMe(true); }
  if (b.dataset.skin) { me.skin = b.dataset.skin; return applyMe(true); }
  if (b.id === "meDone") { if (!me.club) return toast("請先選擇你的身份"); goHome(); toast(`${me.club}的${me.role}，歡迎登島！`); return; }
  if (b.id === "tourBtn") { closeSheet(true); return startTour(); }
  if (b.id === "shoot") return shoot();
  if (b.id === "savePhoto" && lastPhoto) return fetch(lastPhoto).then((r) => r.blob()).then((bl) => saveFile(`行政群島-${me.name || "合照"}.png`, bl, "已下載合照"));
  if (b.dataset.past) { const y = $("sbody").scrollTop; showPast = !showPast; renderDeadlines(); $("sbody").scrollTop = y; return; }
  if (b.dataset.ics) {
    if (b.dataset.ics === "all") return download("東海體能性社團截止日.ics", icsFor(upcoming()));
    const x = deadlines.find((d) => d.id === b.dataset.ics); return x && download(x.id + ".ics", icsFor([x]));
  }
  if (b.dataset.stamp) { const id = b.dataset.stamp; return id.startsWith("isle:") ? openIsle(isleOf(id.slice(5)).i) : openSpot(id); }
  if (b.id === "notifyBtn") return askNotify();
  if (b.id === "resetSt") {
    if (b.dataset.arm) { stamps = {}; LS.set("stamps", stamps); updHud(); buildLabels(); renderChar(); toast("印章已清除"); }
    else { b.dataset.arm = "1"; b.textContent = "確定清除？再按一次"; }
  }
});
$("sbody").addEventListener("change", (e) => {
  const k = e.target.dataset.todo;
  if (k) {
    todoDone[k] = e.target.checked; LS.set(todoKey, todoDone);
    e.target.closest("li").classList.toggle("done", e.target.checked);
    if ($("todoProg")) { const list = todoList(todoSem), n = list.filter((x) => todoDone[x.key]).length; $("todoProg").textContent = `${n}/${list.length}`; $("todoBar").style.width = `${(n / list.length) * 100}%`; if (n === list.length) { toast(`${SEM_NAME[todoSem]}任務全部完成！`); confetti(); } }
    centerObj.todo.userData.sign.userData.redraw(); updHud();
    return;
  }
  const i = e.target.dataset.task; if (i === undefined) return;
  tasks[D.onboarding[+i]] = e.target.checked; LS.set("tasks", tasks);
  const t = D.onboarding.filter((x) => tasks[x]).length;
  $("taskN").textContent = `${t}/${D.onboarding.length}`;
  if (t === D.onboarding.length) { toast("上任清單全部完成！"); confetti(); }
});

/* ---------------- 網頁通知 ---------------- */
function renderNotifyBtn() {
  const b = $("notifyBtn"); if (!b) return;
  if (!("Notification" in window)) { b.hidden = true; return; }
  if (Notification.permission === "granted") { b.textContent = "網頁通知已開啟"; b.disabled = true; }
  if (Notification.permission === "denied") { b.textContent = "通知已被封鎖"; b.disabled = true; }
}
function askNotify() {
  try { Notification.requestPermission().then((p) => { renderNotifyBtn(); if (p === "granted") { toast("已開啟網頁通知"); checkNotify(); } else toast("沒有開啟通知，仍可訂閱行事曆"); }).catch(() => toast("此環境無法開啟通知，請訂閱行事曆")); }
  catch { toast("此環境無法開啟通知，請訂閱行事曆"); }
}
function checkNotify() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const today = dayKey(new Date());
  if (LS.get("notified", 0) === today) return;
  upcoming().filter((x) => daysLeft(x.at) <= 3).forEach((x) => { const n = daysLeft(x.at); try { new Notification(n === 0 ? "今天截止" : `${n} 天後截止`, { body: `${x.title}｜${fmt(x.at)}` }); } catch {} });
  LS.set("notified", today);
}

/* ---------------- HUD、跑馬燈、對話 ---------------- */
$("bHome").addEventListener("click", goHome);
$("bChar").addEventListener("click", () => (panelView && panelView.startsWith("char") ? closeSheet() : openChar()));
$("bList").addEventListener("click", () => (panelView === "list" ? closeSheet() : renderList()));
$("bDl").addEventListener("click", () => (panelView === "todo" ? closeSheet() : openSpot("todo")));
$("bNews").addEventListener("click", () => (panelView === "news" ? closeSheet() : openSpot("news")));
$("bTodo").addEventListener("click", () => (TASK_ISLE && panelView === "isle:" + TASK_ISLE.key ? closeSheet() : openTasks()));
$("pOffice").addEventListener("click", () => openSpot("office"));
$("pNext").addEventListener("click", () => { const n = upcoming()[0], d = n && isleOf(n.category); d ? openIsle(d.i) : openSpot("deadlines"); });

function updHud() {
  const st = officeStatus();
  $("lamp").className = "lamp " + (st.open ? "on" : "off");
  $("officeTxt").textContent = "課外組 " + st.short;
  const n = upcoming()[0];
  $("nextN").textContent = n ? (daysLeft(n.at) === 0 ? "今天" : "D-" + daysLeft(n.at)) : "無";
  const soon = upcoming().filter((x) => daysLeft(x.at) <= 7).length;
  $("dlN").hidden = !soon; $("dlN").textContent = soon;
  const u = unread().length; $("newsN").hidden = !u; $("newsN").textContent = u;
  const tl = todoLeft(); $("todoN").hidden = !tl; $("todoN").textContent = tl;
  const s = stampCount(); $("stampN").hidden = !s; $("stampN").textContent = `${s}/${STAMPS.length}`;
}
let tkI = 0, tkCur = null;
function tickerMsgs() {
  const m = [], st = officeStatus();
  ISL.filter(myDuty).forEach((d) => { const n = isleDl(d)[0]; if (n) m.push({ t: `${me.role}注意：${d.name}「${n.title}」還有 ${daysLeft(n.at)} 天`, go: () => openIsle(d.i) }); });
  upcoming().slice(0, 3).forEach((x) => { const d = isleOf(x.category); m.push({ t: `${d ? d.name + "：" : ""}「${x.title}」還有 ${daysLeft(x.at)} 天`, go: () => (d ? openIsle(d.i) : openSpot("deadlines")) }); });
  if (unread().length) m.push({ t: `公告欄有 ${unread().length} 則新公告`, go: () => openSpot("news") });
  if (todoLeft()) m.push({ t: `${SEM_NAME[curSem()]}還有 ${todoLeft()} 項社團行政任務`, go: openTasks });
  m.push({ t: `課外組${st.text}`, go: () => openSpot("office") });
  m.push({ t: "拖曳移動群島，兩指縮放或旋轉", go: null });
  return m;
}
function tick() {
  const m = tickerMsgs(); tkCur = m[tkI++ % m.length];
  const s = $("tk"); s.style.opacity = 0;
  setTimeout(() => { s.textContent = tkCur.t; s.style.opacity = 1; }, RM ? 0 : 220);
}
$("ticker").addEventListener("click", () => tkCur && tkCur.go && tkCur.go());

// 置中對話卡：引導、老師叮嚀、恭喜都用它
let talkQ = [], talkK = "", talkI = 0, talkEnd = null;
function talk(kicker, steps, onEnd) { talkQ = steps; talkK = kicker; talkI = 0; talkEnd = onEnd || null; showTalk(); }
function showTalk() {
  const s = talkQ[talkI];
  $("mKick").textContent = `${talkK} / ${pad2(talkI + 1)}`;
  $("mTitle").textContent = s[0]; $("mText").textContent = s[1];
  $("mNext").textContent = talkI < talkQ.length - 1 ? "下一步 →" : s[2] || "開始探索";
  $("mSkip").textContent = s[3] ? s[3].label : "略過"; // 最後一步的次要按鈕可以是另一個選擇
  $("mSkip").hidden = talkQ.length < 2 && !s[3];
  $("modal").hidden = false;
  $("mNext").focus();
}
function endTalk(skip) { $("modal").hidden = true; const f = talkEnd; talkEnd = null; if (!skip) f && f(); }
$("mNext").addEventListener("click", () => { if (talkI < talkQ.length - 1) { talkI++; showTalk(); } else endTalk(); });
$("mSkip").addEventListener("click", () => { const alt = talkQ[talkI] && talkQ[talkI][3]; endTalk(true); if (alt) alt.go(); });
function teacherTalk() {
  const n = upcoming()[0], st = officeStatus(), L = [];
  if (n) { const d = isleOf(n.category); L.push(["最近的截止日", `「${n.title}」還有 ${daysLeft(n.at)} 天${d ? `，在${d.name}` : ""}。記得加入行事曆。`]); }
  if (unread().length) L.push(["有新公告", `公告欄有 ${unread().length} 則你還沒看過的公告。`]);
  if (todoLeft()) L.push(["行政任務", `${SEM_NAME[curSem()]}還有 ${todoLeft()} 項社團行政任務，到社團行政館可以一項一項打勾。`]);
  L.push(["隨時來找我們", `課外組${st.text}。週一至週五 9:00–12:00、13:30–17:00（國定假日除外）都可以來。`, "好"]);
  talk("課外組老師", L);
}

let toastT;
function toast(msg, ms = 2400) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms); }
function confetti() {
  if (RM) return;
  const cols = ["#C8623F", "#E8B04B", "#A9BE8B", "#6E8FB5", "#FFFDF9"];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement("div"); s.className = "cf"; s.style.background = cols[i % cols.length]; document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 200;
    s.animate([{ transform: "translate(-50%,-50%) scale(.6)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px),calc(-50% + ${Math.sin(a) * r - 40}px)) rotate(${(Math.random() - 0.5) * 540}deg)`, opacity: 0 }], { duration: 1300 + Math.random() * 600, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => s.remove();
  }
}

/* ---------------- 每分鐘更新 ---------------- */
function refreshTimed() {
  applySky();
  const open = officeStatus().open;
  centerObj.office.userData.win.emissiveIntensity = open ? 0.25 + night * 0.6 : night * 0.12;
  lamps.forEach((m) => (m.emissiveIntensity = night * 1.2));
  centerObj.office.userData.sign.userData.redraw();
  centerObj.todo.userData.sign.userData.redraw();
  updHud(); updMarkers(); buildLabels();
}

/* ---------------- 動畫迴圈 ---------------- */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  if (document.hidden) return;
  const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
  if (!RM) {
    const a = seaGeo.attributes.position;
    for (let i = 0; i < a.count; i++) { const x = seaBase[i * 3], z = seaBase[i * 3 + 2]; a.setY(i, Math.sin(x * 0.16 + t * 0.9) * 0.16 + Math.cos(z * 0.2 + t * 0.7) * 0.14); }
    a.needsUpdate = true; seaGeo.computeVertexNormals();
    clouds.forEach((c, i) => { const ang = c.userData.a0 + Math.sin(t * 0.03 * c.userData.s + i) * 0.25; c.position.x = Math.cos(ang) * c.userData.r; c.position.z = Math.sin(ang) * c.userData.r; });
    boats.forEach((b) => { b.userData.a += b.userData.s * dt; b.position.set(Math.cos(b.userData.a) * b.userData.r, -1.1 + Math.sin(t * 1.3) * 0.08, Math.sin(b.userData.a) * b.userData.r); b.rotation.y = -b.userData.a; });
    flag.rotation.y = Math.sin(t * 2) * 0.15;
    ISL.forEach((d) => { const u = d.build.userData, s = u.spin; if (s) s.rotation.y += dt * 1.2;
      (u.bob || []).forEach((m, k) => (m.position.y = 0.15 + (u.jump ? Math.abs(Math.sin(t * 5 + k * 1.3)) * 0.28 : Math.abs(Math.sin(t * 2 + k)) * 0.03)));
      (u.floaty || []).forEach((m) => (m.position.y = m.userData.y0 + Math.sin(t * 2.4) * 0.12));
      (u.papers || []).forEach((p) => { const q = (t * 0.45 + p.userData.k / 3) % 1; p.position.set(-0.45 + q * 1.4, 1.1 + Math.sin(q * Math.PI) * 0.9, 0.05); p.rotation.set(q * 6, q * 3, 0); }); d.marker.rotation.y += dt * 1.5; d.marker.position.y = d.build.userData.h + 1.6 + Math.sin(t * 2.4 + d.i) * 0.15; });
    newsMarker.rotation.y += dt * 1.5;
    hikers.forEach(({ h, q0, m }) => { const q = (t * 0.035 + q0) % 1, a = q * Math.PI * 5, y = q * m.H * 0.86, r = m.R * (1 - y / m.H) + 0.12; h.position.set(Math.cos(a) * r, y + Math.abs(Math.sin(t * 8 + q0 * 9)) * 0.04, Math.sin(a) * r); h.rotation.y = -a; });
    const boat = centerObj.links.userData.boat; boat.position.y = -1.15 + Math.sin(t * 1.4) * 0.08; boat.rotation.z = Math.sin(t * 1.1) * 0.05;
    teacher.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
    const og = centerObj.office.userData; og.giant.rotation.y = Math.sin(t * 0.6) * 0.12; og.cats.forEach((c, k) => (c.userData.tail.rotation.z = -0.4 + Math.sin(t * 1.5 + k) * 0.25));
    const cow = centerObj.todo.userData.npc;
    cow.userData.armR.rotation.z = -2.3 + Math.sin(t * 5) * 0.35; // 揮手
    if (!cowFx) { cow.position.y = 0.18 + Math.abs(Math.sin(t * 2.2)) * 0.05; cow.rotation.y = Math.sin(t * 0.8) * 0.25; }
    selRing.rotation.z += dt * 1.2;
    stepNpcs(dt, t);
  }
  selRing.visible = !!(panelView && panelView.startsWith("char"));
  stepCowFx(now);
  stepWalk(dt, t);
  stepTween(now);
  controls.update();
  renderer.render(scene, camera);
  placeLabels();
}

/* ---------------- 啟動 ---------------- */
addEventListener("resize", resize);
resize();
async function start() {
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch {}
  sph.set(80, HOME.phi, HOME.theta);
  camera.position.setFromSpherical(sph); camera.lookAt(0, 0, 0);
  camera.zoom = RM ? homeZoom() : 0.62; camera.updateProjectionMatrix(); controls.update();
  refreshTimed();
  loadHolidays().then(refreshTimed);
  $("splash").classList.add("out");
  requestAnimationFrame(loop);
  setTimeout(() => flyTo(framed(HOME_C, homeZoom()), homeZoom(), 1600), 50);
  tick(); setInterval(tick, 6000);
  setInterval(refreshTimed, 60000);
  checkNotify();
  const h = decodeURIComponent(location.hash.slice(1));
  const isle = h.startsWith("isle-") && isleOf(h.slice(5));
  if (isle) setTimeout(() => openIsle(isle.i), 500);
  else if (h === "todo" || h === "tasks") setTimeout(openTasks, 500); // 舊連結 #todo 仍會帶到任務
  else if (["office", "deadlines", "news", "links"].includes(h)) setTimeout(() => openSpot(h), 500);
  else if (h === "me") setTimeout(() => openChar("look"), 500);
  else if (h === "list") setTimeout(renderList, 500);
  else if (!LS.get("intro", false)) {
    LS.set("intro", true);
    talk("HELLO, 幹部", [
      ["每一館是一類行政", `島上有 ${ISL.length} 座行政館，各是一種行政分類：${ISL.map((d) => d.key).join("、")}。點一棟建築，或用右側清單探索每一類的截止日、流程與公告。`],
      ["中心是課外組", `島的中央是課外組，旁邊有路思義教堂、公告欄、小秘書啊牛（啊牛提醒：各項截止日）和碼頭。社團行政任務放在社團行政館，完成可以打勾。外圈道路連到 ${ISL.length} 座行政館，有問題就回來。`],
      ["提醒會浮在館上", "館的名牌上有 D-倒數；7 天內截止，館的上方會浮出黃色菱形，3 天內轉紅。訂閱社團行事曆，手機也會提醒你。"],
      ["想要的話，也可以建立角色", "不建立也能直接逛。想讓角色帶著社團道具、看到自己職位要注意的館，隨時可以點右上「角色」設定身份與職位。", "開始探索", { label: "建立角色", go: () => openChar("look") }],
    ]);
  }
}
start();
