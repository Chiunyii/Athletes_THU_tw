/* 體能社團行政群島：Three.js
 * 中心島 = 課外組（辦公室、截止日鐘塔、公告欄、碼頭），外圍一圈島 = 行政分類（數量由 data.js 的 islands 決定）。
 * 玩家可以（選填）建立角色：身份、職位、外觀；角色會走過橋到各島蓋章。
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
function officeStatus() {
  const h = D.office.hours, p = tw(), cur = p.h * 60 + p.min, openToday = h.days.includes(p.wd);
  if (openToday) for (let i = 0; i < h.slots.length; i++) {
    const s = toMin(h.slots[i][0]), e = toMin(h.slots[i][1]);
    if (cur >= s && cur < e) return { open: true, short: "辦公中", text: `辦公中 · ${h.slots[i][1]} 前都有人` };
    if (cur < s) return { open: false, short: i ? "午休中" : "尚未開門", text: `${i ? "午休中" : "尚未開始"} · ${h.slots[i][0]} 開始辦公` };
  }
  for (let k = 1; k <= 7; k++) {
    const wd = (p.wd + k) % 7;
    if (h.days.includes(wd)) return { open: false, short: "休息中", text: `${openToday ? "下班了" : "今天不辦公"} · ${k === 1 ? "明天" : "週" + WEEK[wd]} ${h.slots[0][0]} 開始辦公` };
  }
  return { open: false, short: "休息中", text: "目前休息" };
}

/* ---------------- 資料 ---------------- */
const deadlines = D.deadlines.map((x) => ({ ...x, at: parse(x.due) })).filter((x) => x.at).sort((a, b) => a.at - b.at);
const upcoming = () => deadlines.filter((x) => x.at >= new Date());
const anns = D.announcements.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // 其餘依 data.js 的順序（最新在上）
let read = LS.get("read", []);
let stamps = LS.get("stamps", {});
let tasks = LS.get("tasks", {});
const unread = () => anns.filter((a) => !read.includes(a.id));
const CLUBS = D.clubs || [];
const ROLES = D.roles || ["社長", "幹部", "社員"];
// 每種行政分類主要由哪些職位負責（用來提醒「這是你的事」）
const DUTY = { 會議: ["社長", "副社長", "幹部", "輔導老師"], 行政: ["社長", "副社長"], 活動: ["社長", "活動長", "輔導老師"], 經費: ["社長", "財務", "輔導老師"], 場地: ["活動長", "器材長"], 安全: ["社長", "副社長", "活動長", "幹部", "輔導老師"], 器材: ["器材長", "幹部"], 評鑑: ["社長", "公關"] };

const ISL = D.islands.map((d, i) => ({ ...d, i, no: pad2(i + 1), guides: D.guides.filter((g) => g.island === d.key) }));
const isleOf = (key) => ISL.find((d) => d.key === key);
const isleDl = (d) => upcoming().filter((x) => x.category === d.key);
const isleNews = (d) => anns.filter((a) => a.tag === d.key);
const lvl = (n) => (n <= 3 ? "hot" : n <= 7 ? "warn" : "ok");
const CENTER_SPOTS = [
  { id: "office", no: "00", name: "課外組", icon: "🏛" },
  { id: "deadlines", no: "◷", name: "截止日鐘塔", icon: "⏰" },
  { id: "news", no: "✎", name: "公告欄", icon: "📌" },
  { id: "todo", no: "✓", name: "待辦看板", icon: "✅" },
  { id: "links", no: "↗", name: "出航碼頭", icon: "⛵" },
];
const STAMPS = [...CENTER_SPOTS.map((s) => ({ id: s.id, name: s.name, no: s.no })), ...ISL.map((d) => ({ id: "isle:" + d.key, name: d.name, no: d.no }))];

/* 社團行政待辦：每學期共同項目 + 該學期項目；共同項目每學期各自打勾 */
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
const myProp = () => (CLUBS.find((c) => c.name === me.club) || {}).prop;
const myDuty = (d) => !!me.club && (DUTY[d.key] || []).includes(me.role);

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

/* 群島佈局：中心島 + 分類島圍成一圈，正前方（鏡頭方向）留給碼頭 */
const FACE = Math.PI / 4;
const FACE_DIR = new V3(Math.sin(FACE), 0, Math.cos(FACE));
const RC = 9;
const NI = ISL.length;
const front = Math.atan2(FACE_DIR.z, FACE_DIR.x);
ISL.forEach((d, i) => {
  d.r = 5;
  d.a = front + Math.PI / NI + (i * 2 * Math.PI) / NI;
  d.dist = RC + d.r + 4.5;
  d.dir = new V3(Math.cos(d.a), 0, Math.sin(d.a));
  d.pos = d.dir.clone().multiplyScalar(d.dist);
});
const WORLD_R = RC + 2 * 5 + 4.5 + 1;

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
const homeZoom = () => (innerWidth >= 900 ? 0.84 : 1);

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
const C = { grass: 0xb7c893, sand: 0xebddbe, cliff: 0xb49a7a, plaza: 0xf3e9d6, path: 0xe8d9bc, wall: 0xfbf3e6, roof: 0xc8623f, wood: 0xb98a5e, dark: 0x6e4a33, tree1: 0x7e9c5a, tree2: 0x93ae6a, tree3: 0xa3bb78, pine: 0x6d8c55 };

/* ---- 海、遠山 ---- */
const seaGeo = new THREE.PlaneGeometry(360, 360, 80, 80);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = seaGeo.attributes.position.array.slice();
const sea = mesh(seaGeo, mat(0x86b7b8, { roughness: 0.5 }), 0, -1.15, 0);
sea.castShadow = false;
scene.add(sea);
// 群島後方的山：平行投影下會出現在畫面上方，像政策島背後的山林
for (let i = 0; i < 16; i++) {
  const a = front + Math.PI + (i / 15 - 0.5) * 2.6, r = 70 + hash("mr" + i) * 22, h = 10 + hash("mh" + i) * 14, rad = 12 + hash("md" + i) * 10;
  const m = cone(scene, rad, h, [0xa9b98c, 0x9fb083, 0xb4c299][i % 3], Math.cos(a) * r, -1.3, Math.sin(a) * r, 7);
  m.castShadow = false; m.rotation.y = hash("mo" + i) * 3;
  for (let k = 0; k < 5; k++) {
    const ta = a + (hash("ta" + i + k) - 0.5) * 0.18, tr = r - rad * (0.3 + hash("tr" + i + k) * 0.5);
    cone(scene, 1.2, 3.4, C.pine, Math.cos(ta) * tr, -1.2 + h * 0.2 + hash("ty" + i + k) * h * 0.3, Math.sin(ta) * tr, 5).castShadow = false;
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
  const top = layer(r, r * 0.96, 0.8, -0.4, C.grass);
  layer(r * 1.1, r * 1.12, 0.5, -0.95, C.sand);
  layer(r * 0.96, r * 0.6, 2.6, -2.1, C.cliff);
  return { top, wob };
}
const world = new THREE.Group();
scene.add(world);

/* ---- 建築 ---- */
function bOffice(g) {
  box(g, 5, 0.3, 3.8, 0xe2d6c3, 0, 0, 0);
  box(g, 4.6, 2.5, 3.4, C.wall, 0, 0.3, 0);
  box(g, 4.6, 1.3, 3.4, 0xf4eadb, 0, 2.8, 0);
  const roof = cone(g, 3.6, 1.7, C.roof, 0, 4.1, 0, 4); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.82);
  box(g, 1.1, 1.7, 0.1, C.dark, 0, 0.3, 1.71);
  const win = mat(0xf6efe2, { emissive: 0xffc77a, emissiveIntensity: 0 });
  g.userData.win = win;
  [-1.5, 1.5].forEach((x) => { mesh(new THREE.BoxGeometry(0.9, 0.75, 0.08), win, x, 1.45, 1.72, g); mesh(new THREE.BoxGeometry(0.9, 0.6, 0.08), win, x, 3.4, 1.72, g); });
  mesh(new THREE.BoxGeometry(0.9, 0.6, 0.08), win, 0, 3.4, 1.72, g);
  const sign = textPlane(2.9, 0.75, (c, w, h) => {
    const st = officeStatus();
    rr(c, 4, 4, w - 8, h - 8, 22); c.fillStyle = "#2A211C"; c.fill();
    c.fillStyle = "#FFFDF9"; c.font = `900 ${h * 0.5}px ${FONT}`; c.textBaseline = "middle"; c.fillText("課外組", 24, h / 2 + 2);
    c.fillStyle = st.open ? "#8FD6A0" : "#F19A84"; c.font = `700 ${h * 0.36}px ${FONT}`; c.textAlign = "right"; c.fillText(st.short, w - 24, h / 2 + 2);
  });
  sign.position.set(0, 2.35, 1.76); g.add(sign);
  g.userData.sign = sign; g.userData.h = 6.3;
}
function bClock(g) {
  box(g, 2.4, 0.4, 2.4, 0xe2d6c3, 0, 0, 0);
  box(g, 1.8, 5.2, 1.8, 0xf1e6d4, 0, 0.4, 0);
  box(g, 2.1, 0.3, 2.1, 0xcdb99c, 0, 5.6, 0);
  const r = cone(g, 1.7, 1.8, C.roof, 0, 5.9, 0, 4); r.rotation.y = Math.PI / 4;
  const face = textPlane(1.5, 1.5, (c, w, h) => {
    const n = upcoming()[0], d = n ? daysLeft(n.at) : null;
    c.fillStyle = "#FFFDF9"; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); c.fill();
    c.lineWidth = 9; c.strokeStyle = "#2A211C"; c.stroke();
    c.fillStyle = d !== null && d <= 3 ? "#C8443A" : "#2A211C"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `700 ${h * 0.3}px ${MONO}`; c.fillText(d === null ? "--" : d === 0 ? "今天" : "D-" + d, w / 2, h * 0.47);
    c.fillStyle = "#C8623F"; c.font = `700 ${h * 0.12}px ${FONT}`; c.fillText("下個截止", w / 2, h * 0.75);
  });
  face.position.set(0, 4.4, 0.92); g.add(face);
  g.userData.sign = face; g.userData.h = 8.3;
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
function bTrack(g, col) {
  const t = mesh(new THREE.TorusGeometry(1.9, 0.45, 3, 24), 0xc9714f, 0, 0.12, 0, g);
  t.rotation.x = Math.PI / 2; t.scale.set(1.25, 1, 1);
  const inner = cyl(g, 1.45, 1.45, 0.1, 0x9fbc7a, 0, 0, 0, 20); inner.scale.set(1.3, 1, 1);
  const baton = cyl(g, 0.12, 0.12, 0.9, 0xe8b04b, 1.2, 0.3, 1.4); baton.rotation.z = Math.PI / 2;
  box(g, 2, 1.6, 1.4, C.wall, 0, 0, -2.6);
  const r = cone(g, 1.6, 1, col, 0, 1.6, -2.6, 4); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.75);
  g.userData.h = 3.4;
}
function bTent(g, col) {
  const t = cone(g, 2, 2.6, col, 0, 0, 0, 4); t.rotation.y = Math.PI / 4;
  box(g, 0.8, 1.1, 0.1, C.dark, 0, 0, 1.35);
  cyl(g, 0.05, 0.05, 3.6, 0xdddddd, 1.6, 0, 1, 5);
  box(g, 0.9, 0.55, 0.04, C.roof, 2.08, 2.9, 1);
  cyl(g, 0.6, 0.6, 0.3, C.wood, -1.9, 0, 1.2, 6);
  g.userData.h = 3.8;
}
function bBank(g) {
  box(g, 3.4, 0.3, 2.6, 0xe2d6c3, 0, 0, 0);
  box(g, 3, 1.8, 2.2, C.wall, 0, 0.3, 0);
  [-1.1, -0.37, 0.37, 1.1].forEach((x) => cyl(g, 0.14, 0.14, 1.8, 0xffffff, x, 0.3, 1.2, 6));
  const pd = cone(g, 2.2, 0.9, 0xd9b24e, 0, 2.1, 0, 4); pd.rotation.y = Math.PI / 4; pd.scale.set(1.1, 1, 0.8);
  const coin = cyl(g, 0.8, 0.8, 0.22, mat(0xe8b04b, { metalness: 0.35, roughness: 0.45 }), 0, 3.5, 0, 16);
  coin.rotation.x = Math.PI / 2;
  g.userData.spin = coin; g.userData.h = 5;
}
function bGym(g, col) {
  cyl(g, 2.4, 2.5, 1.2, C.wall, 0, 0, 0, 12);
  mesh(new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), col, 0, 1.2, 0, g);
  box(g, 1.2, 1, 0.3, C.dark, 0, 0, 2.35);
  ball(g, 0.35, 0xd98b4e, 1.9, 0.35, 2.1);
  g.userData.h = 4.3;
}
function bAid(g) {
  box(g, 3, 1.9, 2.4, C.wall, 0, 0, 0);
  box(g, 3.2, 0.3, 2.6, C.roof, 0, 1.9, 0);
  box(g, 1, 0.3, 0.06, 0xc8443a, 0, 0.95, 1.22); box(g, 0.3, 1, 0.06, 0xc8443a, 0, 0.6, 1.22);
  box(g, 0.5, 0.6, 0.25, 0x5f8f5a, 1.9, 0.4, 0.6);
  g.userData.h = 3.3;
}
function bStore(g, col) {
  box(g, 3.4, 1.6, 2.4, C.wall, 0, 0, 0);
  const roof = mesh(new THREE.CylinderGeometry(1.25, 1.25, 3.5, 10, 1, false, 0, Math.PI), col, 0, 1.6, 0, g);
  roof.rotation.z = Math.PI / 2;
  box(g, 1.4, 1.2, 0.08, C.dark, 0, 0, 1.21);
  ball(g, 0.32, 0xd98b4e, -1.6, 0.32, 1.7); ball(g, 0.3, 0xffffff, -1.0, 0.3, 1.9); ball(g, 0.28, 0xe8b04b, -1.3, 0.28, 2.4);
  g.userData.h = 3.5;
}
function bPodium(g) {
  box(g, 1, 1.4, 1, 0xe8b04b, 0, 0, 0); box(g, 1, 0.9, 1, 0xd9d2c5, -1.05, 0, 0); box(g, 1, 0.6, 1, 0xc9875a, 1.05, 0, 0);
  const gold = mat(0xe8b04b, { metalness: 0.45, roughness: 0.4 });
  cyl(g, 0.18, 0.28, 0.2, gold, 0, 1.4, 0); cyl(g, 0.06, 0.06, 0.3, gold, 0, 1.6, 0);
  g.userData.spin = cyl(g, 0.42, 0.18, 0.55, gold, 0, 1.9, 0);
  g.userData.h = 3.4;
}
function bHall(g, col) {
  box(g, 3.8, 0.3, 2.8, 0xe2d6c3, 0, 0, 0);
  box(g, 3.4, 2, 2.4, C.wall, 0, 0.3, 0);
  const r = cone(g, 2.9, 1.1, col, 0, 2.3, 0, 4); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.72);
  [-1.35, -0.45, 0.45, 1.35].forEach((x) => cyl(g, 0.12, 0.12, 2, 0xffffff, x, 0.3, 1.3, 6));
  box(g, 0.9, 1.3, 0.08, C.dark, 0, 0.3, 1.21);
  const banner = textPlane(2.4, 0.5, (c, w, h) => { rr(c, 2, 2, w - 4, h - 4, 14); c.fillStyle = "#C8623F"; c.fill(); c.fillStyle = "#FFFDF9"; c.font = `900 ${h * 0.55}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("期初會議", w / 2, h / 2 + 2); });
  banner.position.set(0, 1.95, 1.22); g.add(banner);
  // 前方排好的椅子
  for (let k = 0; k < 6; k++) box(g, 0.3, 0.35, 0.3, C.wood, -1.1 + (k % 3) * 1.1, 0, 2.1 + Math.floor(k / 3) * 0.55);
  g.userData.h = 3.6;
}
function bTodo(g) {
  [-0.9, 0.9].forEach((x) => { box(g, 0.12, 2.7, 0.12, C.dark, x, 0, 0).rotation.x = -0.1; });
  box(g, 0.12, 2.5, 0.12, C.dark, 0, 0, -0.55).rotation.x = 0.28;
  box(g, 2.3, 1.75, 0.1, 0xfffdf9, 0, 0.85, 0.05);
  const face = textPlane(2.1, 1.55, (c, w, h) => {
    const sem = curSem(), list = todoList(sem), left = list.filter((x) => !todoDone[x.key]);
    c.fillStyle = "#C8623F"; c.font = `900 ${h * 0.15}px ${FONT}`; c.fillText(`${SEM_NAME[sem]}待辦`, 18, h * 0.19);
    list.slice(0, 4).forEach((x, i) => {
      const y = h * (0.33 + i * 0.15), done = !!todoDone[x.key];
      c.strokeStyle = "#2A211C"; c.lineWidth = 5; c.strokeRect(20, y - h * 0.05, h * 0.09, h * 0.09);
      if (done) { c.strokeStyle = "#5F8F5A"; c.lineWidth = 8; c.beginPath(); c.moveTo(24, y); c.lineTo(36, y + 12); c.lineTo(56, y - 14); c.stroke(); }
      c.fillStyle = done ? "#9A8C80" : "#2A211C"; c.font = `700 ${h * 0.08}px ${FONT}`; c.fillText(x.title.length > 13 ? x.title.slice(0, 12) + "…" : x.title, 20 + h * 0.14, y + h * 0.035);
    });
    c.fillStyle = "#7A6B60"; c.font = `700 ${h * 0.08}px ${FONT}`; c.fillText(left.length ? `還有 ${left.length} 項` : "全部完成！", 20, h * 0.95);
  });
  face.position.set(0, 1.72, 0.11); g.add(face);
  g.userData.sign = face; g.userData.h = 3.3;
}
function bHouse(g, col) {
  box(g, 2.4, 1.6, 2, C.wall, 0, 0, 0);
  const r = cone(g, 2, 1.2, col, 0, 1.6, 0, 4); r.rotation.y = Math.PI / 4;
  box(g, 0.7, 1, 0.08, C.dark, 0, 0, 1.02);
  g.userData.h = 3.4;
}
const BUILD = { hall: bHall, track: bTrack, tent: bTent, bank: bBank, gym: bGym, aid: bAid, store: bStore, podium: bPodium, house: bHouse };

function tree(p, x, z, s, k) {
  cyl(p, 0.12 * s, 0.16 * s, 0.7 * s, 0x8b5e3c, x, 0, z, 5);
  if (k > 0.5) { cone(p, 0.75 * s, 1.5 * s, C.pine, x, 0.6 * s, z); cone(p, 0.55 * s, 1.1 * s, C.tree1, x, 1.4 * s, z); }
  else ball(p, 0.78 * s, [C.tree1, C.tree2, C.tree3][Math.floor(k * 6) % 3], x, 1.3 * s, z);
}
const lamps = [];
function lampPost(p, x, z) {
  cyl(p, 0.07, 0.07, 1.2, 0x3d3530, x, 0, z, 6);
  const m = mat(0xfff6d8, { emissive: 0xffc77a, emissiveIntensity: 0 });
  lamps.push(m);
  mesh(new THREE.IcosahedronGeometry(0.22, 0), m, x, 1.35, z, p);
}
const angOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/* ---- 中心島：課外組 ---- */
const center = new THREE.Group();
world.add(center);
const CL = landmass(center, RC, 1.3);
tag(CL.top, { t: "center" });
cyl(center, 3.4, 3.4, 0.06, C.plaza, 0, 0, 0, 24).castShadow = false;
cyl(center, 1.3, 1.5, 0.5, 0xd9cbb4, 0, 0, 0, 10);
cyl(center, 1.05, 1.05, 0.12, 0x9fcfd0, 0, 0.45, 0, 10);
cyl(center, 0.18, 0.25, 1.2, 0xd9cbb4, 0, 0.5, 0);
ball(center, 0.35, 0xbfe2e2, 0, 1.85, 0);
const flag = box(center, 1.4, 0.8, 0.04, C.roof, 2.1, 3.3, -1.6);
cyl(center, 0.06, 0.06, 4.2, 0xdddddd, 1.4, 0, -1.6, 6);
// 橋的方位是 front + (2i+1)π/N，所以 mid(k) 一定落在兩座橋中間；行走環道半徑 3.9，建築都放在環道外
const mid = (k) => front + (k * 2 * Math.PI) / NI;
const SPOT = {
  office: { a: mid(3), r: 6.4, build: bOffice },
  deadlines: { a: mid(4), r: 6.2, build: bClock },
  news: { a: mid(2), r: 6, build: bBoard },
  todo: { a: mid(6), r: 6, build: bTodo },
  links: { a: mid(0), r: RC * 0.96, build: bDock },
};
const centerObj = {};
Object.entries(SPOT).forEach(([id, s]) => {
  const g = new THREE.Group();
  s.build(g);
  g.position.set(Math.cos(s.a) * s.r, 0, Math.sin(s.a) * s.r);
  g.rotation.y = id === "links" ? Math.atan2(Math.cos(s.a), Math.sin(s.a)) : FACE; // 碼頭沿 +z 伸向海面
  if (id === "office") g.scale.setScalar(NI > 7 ? 0.8 : 0.92); // 島越多，橋越密，課外組要縮小才不會擋到走道
  center.add(g);
  tag(g, { t: "spot", id });
  centerObj[id] = g;
  s.pos = g.position.clone();
});
for (let k = 0; k < NI; k++) { const a = ISL[k].a; lampPost(center, Math.cos(a + 0.3) * 4.7, Math.sin(a + 0.3) * 4.7); }
{
  let n = 0;
  for (let i = 0; i < 300 && n < 18; i++) {
    const a = hash("ca" + i) * Math.PI * 2, r = 4.4 + hash("cr" + i) * (RC * 0.82 - 4.4);
    if (ISL.some((d) => angOff(a, d.a) < 0.3)) continue;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Object.values(SPOT).some((s) => Math.hypot(s.pos.x - x, s.pos.z - z) < 2.9)) continue;
    tree(center, x, z, 0.7 + hash("cs" + i) * 0.5, hash("ck" + i)); n++;
  }
}

/* ---- 分類島 ---- */
ISL.forEach((d) => {
  const g = new THREE.Group();
  g.position.copy(d.pos);
  world.add(g);
  d.group = g;
  const L = landmass(g, d.r, hash(d.key) * 10);
  tag(L.top, { t: "isle", i: d.i });
  const col = new THREE.Color(d.color).getHex();
  cyl(g, 2.4, 2.4, 0.06, new THREE.Color(d.color).lerp(new THREE.Color(0xfbf3e6), 0.65).getHex(), 0, 0, 0, 20).castShadow = false;
  const toC = Math.atan2(-d.dir.z, -d.dir.x), len = d.r - 2.2;
  const path = box(g, len, 0.05, 1.2, C.path, Math.cos(toC) * (2.2 + len / 2), 0, Math.sin(toC) * (2.2 + len / 2));
  path.rotation.y = -toC; path.castShadow = false;
  const b = new THREE.Group();
  (BUILD[d.building] || bHouse)(b, col);
  b.position.copy(FACE_DIR).multiplyScalar(-0.9);
  b.rotation.y = FACE;
  g.add(b);
  tag(b, { t: "isle", i: d.i });
  d.build = b;
  d.spot = FACE_DIR.clone().multiplyScalar(2.1);
  let n = 0;
  for (let i = 0; i < 200 && n < 9; i++) {
    const a = hash(d.key + "a" + i) * Math.PI * 2, r = 2.9 + hash(d.key + "r" + i) * (d.r * 0.85 - 2.9);
    if (angOff(a, toC) < 0.45 || angOff(a, FACE) < 0.2) continue;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - b.position.x, z - b.position.z) < 2.8) continue;
    tree(g, x, z, 0.65 + hash(d.key + "s" + i) * 0.45, hash(d.key + "k" + i)); n++;
  }
  lampPost(g, Math.cos(toC + 0.5) * 2.7, Math.sin(toC + 0.5) * 2.7);
});

/* ---- 橋 ---- */
ISL.forEach((d) => {
  const p0 = d.dir.clone().multiplyScalar(RC * 0.9), p1 = d.dir.clone().multiplyScalar(d.dist - d.r * 0.88);
  const len = p0.distanceTo(p1), m = p0.clone().add(p1).multiplyScalar(0.5);
  const g = new THREE.Group();
  g.position.copy(m); g.rotation.y = -d.a;
  world.add(g);
  const plank = mat(0xd2ab7f), rail = mat(C.dark);
  const n = Math.round(len / 0.5);
  for (let k = 0; k < n; k++) {
    const x = -len / 2 + (k + 0.5) * (len / n), y = Math.sin(((k + 0.5) / n) * Math.PI) * 0.35;
    mesh(new THREE.BoxGeometry(len / n - 0.06, 0.14, 1.5), plank, x, y - 0.05, 0, g).rotation.y = (hash(d.key + k) - 0.5) * 0.06;
  }
  [-0.78, 0.78].forEach((z) => {
    for (let k = 0; k <= 4; k++) { const x = -len / 2 + (k * len) / 4, y = Math.sin((k / 4) * Math.PI) * 0.35; cyl(g, 0.07, 0.07, 0.7, rail, x, y - 0.05, z, 5); }
    mesh(new THREE.BoxGeometry(len, 0.08, 0.08), rail, 0, 0.6, z, g);
  });
  [-len / 2 + 0.6, len / 2 - 0.6].forEach((x) => cyl(g, 0.12, 0.12, 1.4, rail, x, -1.5, 0, 6));
  d.bridge = { p0, p1, len };
});

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
ISL.filter((d, i) => i < NPC_MAX - 2).forEach((d, i) => addNpc(i, d.pos.clone().add(SIDE.clone().multiplyScalar(i % 2 ? 1.5 : -1.5)), 0.8));
[0, 1].forEach((k) => addNpc(40 + k, new V3(0, 0, 0), 3));
const NPC_MIN_ZOOM = 1.3; // 全景時隱藏路人，畫面只留島與名牌
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

/* ---------------- 行走：沿著橋走 ---------------- */
let avAt = "C", avPath = [], avGoal = null;
const ringPt = (a, r = 3.9) => new V3(Math.cos(a) * r, 0, Math.sin(a) * r);
function bridgePts(d, outbound) {
  const pts = [], m = Math.ceil(d.bridge.len / 0.4);
  for (let k = 0; k <= m; k++) { const t = outbound ? k / m : 1 - k / m; const p = d.bridge.p0.clone().lerp(d.bridge.p1, t); p.y = Math.sin(t * Math.PI) * 0.35; pts.push(p); }
  return pts;
}
function arc(a0, a1, r = 3.9) {
  const pts = [], da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), m = Math.max(1, Math.ceil((Math.abs(da) * r) / 0.4));
  for (let k = 0; k <= m; k++) pts.push(ringPt(a0 + (da * k) / m, r));
  return pts;
}
const isleSpot = (d) => d.pos.clone().add(d.spot);
function isleSide(d) { const perp = new V3(-FACE_DIR.z, 0, FACE_DIR.x), s = Math.sign(perp.dot(d.dir.clone().negate())) || 1; return d.pos.clone().add(perp.multiplyScalar(2.5 * s)); }
function route(to) {
  const pts = [], curA = Math.atan2(av.position.z, av.position.x);
  if (avAt !== "C") { const d = ISL[avAt]; pts.push(isleSide(d)); pts.push(...bridgePts(d, false)); pts.push(ringPt(d.a)); }
  else pts.push(ringPt(curA));
  const fromA = avAt !== "C" ? ISL[avAt].a : curA;
  if (to === "C") { pts.push(...arc(fromA, front)); pts.push(AV_HOME.clone()); }
  else { const d = ISL[to]; pts.push(...arc(fromA, d.a)); pts.push(...bridgePts(d, true)); pts.push(isleSide(d)); pts.push(isleSpot(d)); }
  return pts;
}
function walkTo(to, onArrive) {
  if (avPath.length && avGoal) avAt = avGoal.from; // 走到一半改目的地：從出發點重新規劃
  if (to === avAt && !avPath.length) { onArrive && onArrive(); return; }
  avPath = route(to); avGoal = { to, onArrive, from: avAt };
}
function stepWalk(dt, t) {
  if (!avPath.length) { av.position.y = Math.max(0, av.position.y - dt); return; }
  let move = 6.5 * dt;
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
  const base = WORLD_R * (a < 0.8 ? 1.12 : 0.95);
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
  flyTo(framed(new V3(0, 0, 0), homeZoom()), homeZoom());
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
  const L = { el, pos3, pri: opt.pri || 0, minZoom: opt.minZoom || 0, selId: opt.selId, me: !!opt.me, w: 0, h: 0 }; labels.push(L); return L;
}
function isleBadge(d) { const n = isleDl(d)[0]; if (!n) return ""; const k = daysLeft(n.at); return k <= 14 ? `<span class="d ${k <= 3 ? "hot" : ""}">D-${k}</span>` : ""; }
function buildLabels() {
  lblEl.innerHTML = ""; labels.length = 0;
  ISL.forEach((d) => {
    d.label = mkLabel(`<span class="no">${d.no}</span>${E(d.name)}${isleBadge(d)}${stamps["isle:" + d.key] ? '<span class="ok">✓</span>' : ""}`,
      d.pos.clone().add(d.build.position).setY(d.build.userData.h + 0.5), () => openIsle(d.i), "", { pri: 100 + (isleBadge(d).includes("hot") ? 5 : 0), selId: "isle:" + d.key });
  });
  CENTER_SPOTS.forEach((s) => {
    const o = centerObj[s.id], st = officeStatus();
    let extra = "";
    if (s.id === "office") extra = `<span class="d" style="background:${st.open ? "#5F8F5A" : "#7A6B60"}">${E(st.short)}</span>`;
    if (s.id === "news" && unread().length) extra = `<span class="d hot">${unread().length}</span>`;
    s.label = mkLabel(`<span class="no">${s.no}</span>${E(s.name)}${extra}`, o.position.clone().setY((o.userData.h || 3) * o.scale.y + 0.4), () => openSpot(s.id), "",
      s.id === "office" ? { pri: 95, selId: s.id } : { pri: 50, minZoom: 1.5, selId: s.id });
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
    L.el.style.transform = `translate(${x}px, ${y - 10}px) translate(-50%, -100%)`;
    const isSel = L.selId && L.selId === sel;
    if (!isSel && z < L.minZoom && !(L.me && charOpen)) { L.el.classList.add("hide"); return; }
    if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
    cand.push({ L, x, y, p: isSel || (L.me && charOpen) ? 1e4 : L.pri });
  });
  cand.sort((a, b) => b.p - a.p);
  const placed = [];
  cand.forEach(({ L, x, y }) => {
    const r = { l: x - L.w / 2 - 3, r: x + L.w / 2 + 3, t: y - 10 - L.h - 3, b: y - 7 };
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
  const n = Object.keys(stamps).length;
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
function openSpot(id) {
  touring = false;
  setSel(id);
  ({ office: renderOffice, deadlines: renderDeadlines, news: renderNews, todo: () => renderTodo(), links: renderLinks })[id]();
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
const RAIL = { char: "bChar", list: "bList", deadlines: "bDl", todo: "bTodo", news: "bNews" };
function showSheet(view, html) {
  panelView = view;
  $("sbody").innerHTML = html;
  $("sheet").hidden = false; document.body.classList.add("sheeted");
  $("sbody").scrollTop = 0;
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
function newsItems(list) {
  if (!list.length) return '<p class="empty">目前沒有公告。</p>';
  return '<ul class="items">' + list.map((a) => { const d = isleOf(a.tag), nw = !read.includes(a.id);
    return `<li class="item ${nw ? "hl" : ""}" style="--c:${d ? d.color : "var(--terra)"}"><button type="button" aria-expanded="${nw}"><span class="dot"></span><span class="nm">${E(a.title)}<small>${[a.date, d && d.name].filter(Boolean).map(E).join("・")}</small></span><span class="meta ${nw ? "hot" : ""}">${a.pinned ? "置頂" : nw ? "NEW" : ""}</span><span class="chev">›</span></button><div class="more" ${nw ? "" : "hidden"}>${a.body ? `<p>${E(a.body)}</p>` : ""}${a.link ? `<div class="acts"><a class="btn t" target="_blank" rel="noopener" href="${E(a.link)}">查看公告 ↗</a></div>` : ""}</div></li>`; }).join("") + "</ul>";
}
function markRead(list) { let ch = false; list.forEach((a) => { if (!read.includes(a.id)) { read.push(a.id); ch = true; } }); if (ch) { LS.set("read", read); updHud(); updMarkers(); buildLabels(); } }

function renderIsle(d, keepScroll) {
  const dl = isleDl(d), news = isleNews(d), steps = d.guides.reduce((n, g) => n + g.steps.length, 0), duty = DUTY[d.key] || [];
  const st = $("sbody").scrollTop;
  const mine = (r) => me.club && me.role === r;
  const html = `${head(d.icon, `ISLAND ${d.no} · ${E(d.key)}`, d.name)}
    <p class="lead">${E(d.guides[0]?.title || d.tagline)}</p>
    <p class="quote">「${E(d.tagline)}」</p>
    ${d.links?.length ? `<div class="acts">${d.links.map((l) => `<a class="btn big t ring" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>`).join("")}</div>` : ""}
    <div class="tags"><span class="tag c" style="--c:${d.color}">${E(d.key)}</span><span class="tag">${dl.length} 項截止</span><span class="tag">${steps} 個步驟</span><span class="tag">${news.length} 則公告</span>${stampTag("isle:" + d.key)}</div>
    <div class="sec"><h4>截止日</h4>${dlItems(dl, false, true)}</div>
    ${d.guides.map((g) => `<div class="sec"><h4>${E(g.topic)}・辦事步驟</h4><ul class="items"><li class="item" style="--c:${d.color}"><button type="button" aria-expanded="true"><span class="dot"></span><span class="nm">${E(g.title)}<small>${E(g.summary)}</small></span><span class="meta">${g.steps.length} 步</span><span class="chev">›</span></button><div class="more"><ol>${g.steps.map((s) => `<li>${E(s)}</li>`).join("")}</ol>${g.links?.length ? `<div class="acts">${g.links.map((l) => `<a class="btn g" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>`).join("")}</div>` : ""}</div></li></ul></div>`).join("")}
    ${isleTodos(d).length ? `<div class="sec"><h4>${SEM_NAME[curSem()]}行政待辦</h4>${todoItems(isleTodos(d))}</div>` : ""}
    <div class="sec"><h4>相關公告</h4>${newsItems(news)}</div>
    <div class="sec"><h4>這一島在照顧誰</h4><ul class="items">${duty.map((r) => `<li class="item ${mine(r) ? "hl" : ""}"><div class="row"><span class="dot"></span><span class="nm">${E(r)}${mine(r) ? `<small>就是你！${E(me.club)}的${E(r)}</small>` : ""}</span><span></span><span></span></div></li>`).join("")}</ul></div>
    <p class="foot">還有問題？請在辦公時間到中心島的課外組詢問。</p>`;
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
  const rows = [1, 2, 3, 4, 5, 6, 0].map((wd) => { const on = D.office.hours.days.includes(wd); return `<tr class="${wd === p.wd ? "today" : ""}"><td>週${WEEK[wd]}${wd === p.wd ? "（今天）" : ""}</td><td class="${on ? "" : "closed"}">${on ? slots : "不辦公"}</td></tr>`; }).join("");
  const html = `${head("🏛", "CENTER 00 · 群島中心", D.office.name)}
    <p class="lead">${ISL.length} 座行政島都有橋通到這裡，有問題就回來找我們。</p>
    <div class="bigst"><span class="lamp ${st.open ? "on" : "off"}"></span>${E(st.text)}</div>
    <div class="tags"><span class="tag">週一至週五</span><span class="tag">9:00–12:00</span><span class="tag">13:30–17:00</span>${stampTag("office")}</div>
    <div class="sec"><h4>辦公時間</h4><table class="week"><tbody>${rows}</tbody></table></div>
    <div class="sec"><h4>位置與導航</h4><p class="quote">${E(D.office.locationNote)}</p><div class="acts">${D.office.mapUrl ? `<a class="btn t" target="_blank" rel="noopener" href="${E(D.office.mapUrl)}">開啟 Google 地圖導航</a>` : '<span class="btn g" aria-disabled="true">導航建置中</span>'}<a class="btn g" target="_blank" rel="noopener" href="${E(D.links.office)}">課外組網站 ↗</a></div></div>
    <div class="sec"><h4>洽公小提醒</h4><ul class="items">${D.office.tips.map((t) => `<li class="item"><div class="row"><span class="dot"></span><span class="nm">${E(t)}</span><span></span><span></span></div></li>`).join("")}</ul></div>
    <div class="sec"><h4>${ISL.length} 座行政島</h4>${placeItems()}</div>`;
  showSheet("office", html);
}
function renderDeadlines() {
  const html = `${head("⏰", "CLOCK TOWER · 截止日", "截止日鐘塔")}
    <p class="lead">所有分類的截止日都在這裡。</p>
    <p class="quote">7 天內轉黃、3 天內轉紅，對應的島上方也會浮出菱形提醒。</p>
    <div class="tags"><span class="tag">${upcoming().length} 項待辦</span>${stampTag("deadlines")}</div>
    <div class="acts"><a class="btn t" href="${E(subUrl())}">訂閱社團行事曆</a><button class="btn g" type="button" data-ics="all">全部加入行事曆</button><button class="btn g" type="button" id="notifyBtn">開啟網頁通知</button></div>
    <p class="foot">訂閱後，新的截止日會自動同步到手機，並在截止前 3 天、1 天提醒。</p>
    <div class="sec"><h4>依日期排序</h4>${dlItems(upcoming(), true, true)}</div>
    <p class="foot">正式期程以 <a target="_blank" rel="noopener" href="${E(D.links.schedule)}">體能性社團作業期程表 ↗</a> 為準。</p>`;
  showSheet("deadlines", html);
  renderNotifyBtn();
}
const isleTodos = (d) => todoList(curSem()).filter((x) => x.island === d.key);
function todoItems(list) {
  if (!list.length) return '<p class="empty">沒有待辦項目。</p>';
  return '<ul class="items">' + list.map((x) => {
    const done = !!todoDone[x.key], d = isleOf(x.island);
    const btns = (x.links || []).map((l) => (l[1] ? `<a class="btn g" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])} ↗</a>` : `<span class="btn g pend" aria-disabled="true">${E(l[0])}・連結待補</span>`)).join("");
    return `<li class="item todo ${done ? "done" : ""}" style="--c:${d ? d.color : "var(--terra)"}"><label class="row"><input type="checkbox" data-todo="${E(x.key)}" ${done ? "checked" : ""} aria-label="完成：${E(x.title)}"><span class="nm">${E(x.title)}${x.note ? `<small>${E(x.note)}</small>` : ""}</span><span class="meta">${x.when ? E(x.when) : ""}</span><span></span></label>${btns ? `<div class="more"><div class="acts">${btns}</div></div>` : ""}</li>`;
  }).join("") + "</ul>";
}
let todoSem = null;
function renderTodo(sem) {
  todoSem = sem || todoSem || curSem();
  const list = todoList(todoSem), n = list.filter((x) => todoDone[x.key]).length;
  const html = `${head("✅", "TO-DO · 社團行政待辦", "社團行政待辦清單")}
    <p class="lead">每學期都要完成的社團行政事項，完成後打勾。</p>
    <div class="tabs two" role="tablist">${["s1", "s2"].map((s) => `<button type="button" role="tab" data-sem="${s}" aria-selected="${todoSem === s}">${SEM_NAME[s]}${s === curSem() ? "・本學期" : ""}</button>`).join("")}</div>
    <div class="sec"><h4>完成進度・<span id="todoProg">${n}/${list.length}</span></h4><div class="prog"><i id="todoBar" style="width:${list.length ? (n / list.length) * 100 : 0}%"></i></div></div>
    <div class="tags">${stampTag("todo")}</div>
    <div class="sec"><h4>每學期共同項目</h4>${todoItems(list.filter((x) => x.sem === "common"))}</div>
    <div class="sec"><h4>${SEM_NAME[todoSem]}待辦</h4>${todoItems(list.filter((x) => x.sem !== "common"))}</div>
    <p class="foot">打勾紀錄只存在你自己的手機或電腦。標示「連結待補」的按鈕，課外組補上連結後就能點。</p>`;
  showSheet("todo", html);
}
function renderNews() {
  const html = `${head("📌", "BULLETIN · 公告", "公告欄")}<p class="lead">學期間的行政公告都貼在這裡。</p><div class="tags"><span class="tag">${anns.length} 則公告</span>${unread().length ? `<span class="tag c" style="--c:#C8443A">${unread().length} 則未讀</span>` : ""}${stampTag("news")}</div><div class="sec"><h4>最新公告</h4>${newsItems(anns)}</div>`;
  showSheet("news", html);
  markRead(anns);
}
function renderLinks() {
  const row = (t, s, href, ext = true) => `<li class="item"><a class="row" style="text-decoration:none;color:inherit" href="${E(href)}" ${ext ? 'target="_blank" rel="noopener"' : ""}><span class="dot"></span><span class="nm">${t}<small>${s}</small></span><span class="meta">${ext ? "↗" : ""}</span><span class="chev">›</span></a></li>`;
  const html = `${head("⛵", "HARBOR · 出航", "出航碼頭")}<p class="lead">從碼頭出航，前往課外組的其他平台。</p><div class="tags">${stampTag("links")}</div>
    <div class="sec"><h4>常用連結</h4><ul class="items">${row("課外組網站", "activity.thu.edu.tw", D.links.office)}${row("體能性社團各項作業期程", "整學期的正式時程表", D.links.schedule)}${row("體能性社團 Linktree", "表單、雲端資料夾與常用連結", D.links.linktree)}${row("本站文字版", "不顯示 3D，內容相同", "list.html", false)}</ul></div>`;
  showSheet("links", html);
}
const isleHits = (d, q) => d.name.includes(q) || ["s1", "s2"].some((sem) => todoList(sem).some((x) => x.island === d.key && (x.title + (x.note || "")).includes(q))) || d.guides.some((g) => [g.topic, g.title, g.summary, ...g.steps].some((s) => s.includes(q))) || isleDl(d).some((x) => (x.title + (x.detail || "")).includes(q)) || isleNews(d).some((a) => (a.title + (a.body || "")).includes(q));
function listResults(q) {
  const res = [];
  ISL.forEach((d) => {
    d.guides.forEach((g) => { const hit = [g.topic, g.title, g.summary, ...g.steps].find((s) => s.includes(q)); if (hit) res.push({ d, t: g.title, s: hit }); });
    isleDl(d).forEach((x) => { if ((x.title + (x.detail || "")).includes(q)) res.push({ d, t: x.title, s: `截止日・${fmt(x.at)}` }); });
    isleNews(d).forEach((a) => { if ((a.title + (a.body || "")).includes(q)) res.push({ d, t: a.title, s: "公告" + (a.body ? "・" + a.body : "") }); });
    ["s1", "s2"].forEach((sem) => todoList(sem).filter((x) => x.island === d.key && (sem === "s1" || x.sem !== "common")).forEach((x) => { if ((x.title + (x.note || "")).includes(q)) res.push({ d, t: x.title, s: `${x.sem === "common" ? "每學期" : SEM_NAME[sem]}待辦${x.note ? "・" + x.note : ""}` }); }));
  });
  const hl = (s) => E(s).split(E(q)).join(`<mark>${E(q)}</mark>`);
  return `<div class="sec"><h4>搜尋結果・${res.length} 筆</h4>${res.length ? '<ul class="items">' + res.map((r) => `<li class="item" style="--c:${r.d.color}"><button type="button" data-isle="${r.d.i}"><span class="dot"></span><span class="nm">${hl(r.t)}<small>${E(r.d.name)}・${hl(r.s)}</small></span><span class="meta"></span><span class="chev">›</span></button></li>`).join("") + "</ul>" : `<p class="empty">找不到「${E(q)}」。可以在辦公時間到課外組當面詢問。</p>`}</div>`;
}
function renderList() {
  const centerList = '<ul class="items">' + CENTER_SPOTS.map((s) => `<li class="item"><button type="button" data-spot="${s.id}"><span class="dot"></span><span class="nm">${noTag(s.no)}${E(s.name)}</span><span class="meta">${stamps[s.id] ? "✓" : ""}</span><span class="chev">›</span></button></li>`).join("") + "</ul>";
  showSheet("list", `${head("≡", "INDEX · 清單", "群島清單")}<label class="foot" for="q">搜尋截止日、流程與公告</label><input id="q" class="search" type="search" autocomplete="off" placeholder="例如：保險、核銷、場地"><div id="results"></div><div id="places"><div class="sec"><h4>行政島</h4>${placeItems()}</div><div class="sec"><h4>中心島</h4>${centerList}</div></div>`);
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
    const n = Object.keys(stamps).length, t = D.onboarding.filter((x) => tasks[x]).length, mine = ISL.filter(myDuty);
    body = `<div class="sec"><h4>幹部護照・${n} / ${STAMPS.length}</h4><div class="prog"><i style="width:${(n / STAMPS.length) * 100}%"></i></div>
      <div class="stamps">${STAMPS.map((s) => `<button type="button" class="stc ${stamps[s.id] ? "on" : ""}" data-stamp="${E(s.id)}"><i>${stamps[s.id] ? "THU" : s.no}</i>${E(s.name)}</button>`).join("")}</div>
      <div class="acts"><button class="btn big t ring" type="button" id="tourBtn">帶我逛一圈</button></div></div>
      ${mine.length ? `<div class="sec"><h4>${E(me.role)}要特別注意的島</h4>${placeItems(myDuty)}</div>` : ""}
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
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H + 150;
  const c = cv.getContext("2d");
  c.drawImage(src, 0, 0, W, H);
  c.fillStyle = "#FBF6EE"; c.fillRect(0, H, W, 150);
  c.fillStyle = "#C8623F"; c.font = "900 54px Archivo, sans-serif"; c.fillText("CLUB ON.", 40, H + 72);
  c.fillStyle = "#2A211C"; c.font = `900 34px ${FONT}`; c.fillText(`${me.name || "我"}・${me.club || "體能性社團"}・${me.role}`, 40, H + 124);
  c.textAlign = "right"; c.fillStyle = "#7A6B60"; c.font = `700 24px ${FONT}`;
  const p = tw(); c.fillText(`東海體能社團行政群島・集章 ${Object.keys(stamps).length}/${STAMPS.length}・${p.y}/${p.m}/${p.d}`, W - 40, H + 124);
  lastPhoto = cv.toDataURL("image/png");
  renderChar();
}
$("sbody").addEventListener("input", (e) => { if (e.target.id === "meName") { me.name = e.target.value.trim(); LS.set("me", me); buildLabels(); } });
$("sbody").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("aria-expanded") && b.parentElement.classList.contains("item")) { const open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open); const m = b.nextElementSibling; if (m) m.hidden = !open; return; }
  if (b.dataset.isle !== undefined) return openIsle(+b.dataset.isle);
  if (b.dataset.spot) return openSpot(b.dataset.spot);
  if (b.dataset.tab) { charTab = b.dataset.tab; return renderChar(); }
  if (b.dataset.sem) return renderTodo(b.dataset.sem);
  if (b.dataset.club) { me.club = b.dataset.club; return applyMe(true); }
  if (b.dataset.role) { me.role = b.dataset.role; return applyMe(true); }
  if (b.dataset.shirt) { me.shirt = b.dataset.shirt; return applyMe(true); }
  if (b.dataset.hair) { me.hair = b.dataset.hair; return applyMe(true); }
  if (b.dataset.skin) { me.skin = b.dataset.skin; return applyMe(true); }
  if (b.id === "meDone") { if (!me.club) return toast("請先選擇你的身份"); goHome(); toast(`${me.club}的${me.role}，歡迎登島！`); return; }
  if (b.id === "tourBtn") { closeSheet(true); return startTour(); }
  if (b.id === "shoot") return shoot();
  if (b.id === "savePhoto" && lastPhoto) return fetch(lastPhoto).then((r) => r.blob()).then((bl) => saveFile(`行政群島-${me.name || "合照"}.png`, bl, "已下載合照"));
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
    if ($("todoProg")) { const list = todoList(todoSem), n = list.filter((x) => todoDone[x.key]).length; $("todoProg").textContent = `${n}/${list.length}`; $("todoBar").style.width = `${(n / list.length) * 100}%`; if (n === list.length) { toast(`${SEM_NAME[todoSem]}待辦全部完成！`); confetti(); } }
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
$("bDl").addEventListener("click", () => (panelView === "deadlines" ? closeSheet() : openSpot("deadlines")));
$("bNews").addEventListener("click", () => (panelView === "news" ? closeSheet() : openSpot("news")));
$("bTodo").addEventListener("click", () => (panelView === "todo" ? closeSheet() : openSpot("todo")));
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
  const s = Object.keys(stamps).length; $("stampN").hidden = !s; $("stampN").textContent = `${s}/${STAMPS.length}`;
}
let tkI = 0, tkCur = null;
function tickerMsgs() {
  const m = [], st = officeStatus();
  ISL.filter(myDuty).forEach((d) => { const n = isleDl(d)[0]; if (n) m.push({ t: `${me.role}注意：${d.name}「${n.title}」還有 ${daysLeft(n.at)} 天`, go: () => openIsle(d.i) }); });
  upcoming().slice(0, 3).forEach((x) => { const d = isleOf(x.category); m.push({ t: `${d ? d.name + "：" : ""}「${x.title}」還有 ${daysLeft(x.at)} 天`, go: () => (d ? openIsle(d.i) : openSpot("deadlines")) }); });
  if (unread().length) m.push({ t: `公告欄有 ${unread().length} 則新公告`, go: () => openSpot("news") });
  if (todoLeft()) m.push({ t: `${SEM_NAME[curSem()]}還有 ${todoLeft()} 項社團行政待辦`, go: () => openSpot("todo") });
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
  if (todoLeft()) L.push(["行政待辦", `${SEM_NAME[curSem()]}還有 ${todoLeft()} 項社團行政待辦，到待辦看板可以一項一項打勾。`]);
  L.push(["隨時來找我們", `課外組${st.text}。週一至週五 9:00–12:00、13:30–17:00 都可以來。`, "好"]);
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
  centerObj.deadlines.userData.sign.userData.redraw();
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
    ISL.forEach((d) => { const s = d.build.userData.spin; if (s) s.rotation.y += dt * 1.2; d.marker.rotation.y += dt * 1.5; d.marker.position.y = d.build.userData.h + 1.6 + Math.sin(t * 2.4 + d.i) * 0.15; });
    newsMarker.rotation.y += dt * 1.5;
    const boat = centerObj.links.userData.boat; boat.position.y = -1.15 + Math.sin(t * 1.4) * 0.08; boat.rotation.z = Math.sin(t * 1.1) * 0.05;
    teacher.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
    selRing.rotation.z += dt * 1.2;
    stepNpcs(dt, t);
  }
  selRing.visible = !!(panelView && panelView.startsWith("char"));
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
  $("splash").classList.add("out");
  requestAnimationFrame(loop);
  setTimeout(() => flyTo(framed(new V3(0, 0, 0), homeZoom()), homeZoom(), 1600), 50);
  tick(); setInterval(tick, 6000);
  setInterval(refreshTimed, 60000);
  checkNotify();
  const h = decodeURIComponent(location.hash.slice(1));
  const isle = h.startsWith("isle-") && isleOf(h.slice(5));
  if (isle) setTimeout(() => openIsle(isle.i), 500);
  else if (["office", "deadlines", "news", "todo", "links"].includes(h)) setTimeout(() => openSpot(h), 500);
  else if (h === "me") setTimeout(() => openChar("look"), 500);
  else if (h === "list") setTimeout(renderList, 500);
  else if (!LS.get("intro", false)) {
    LS.set("intro", true);
    talk("HELLO, 幹部", [
      ["每座島是一類行政", `${ISL.length} 座小島各是一種行政分類：${ISL.map((d) => d.key).join("、")}。點一座島，或用右側清單探索每一類的截止日、流程與公告。`],
      ["中心是課外組", `群島中間是課外組，旁邊有截止日鐘塔、公告欄、待辦看板和碼頭。${ISL.length} 座島都有橋通到這裡，有問題就回來。`],
      ["提醒會浮在島上", "島的名牌上有 D-倒數；7 天內截止，島上方會浮出黃色菱形，3 天內轉紅。訂閱社團行事曆，手機也會提醒你。"],
      ["想要的話，也可以建立角色", "不建立也能直接逛。想讓角色帶著社團道具、看到自己職位要注意的島，隨時可以點右上「角色」設定身份與職位。", "開始探索", { label: "建立角色", go: () => openChar("look") }],
    ]);
  }
}
start();
