/* 體能社團行政群島：Three.js
 * 中心島 = 課外組（辦公室、截止日鐘塔、公告欄、碼頭），外圍七座島 = 行政分類。
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
const fmt = (d) => { const p = tw(d); return `${p.m}/${p.d}（${WEEK[p.wd]}）${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`; };
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
const anns = D.announcements.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || parse(b.date) - parse(a.date));
let read = LS.get("read", []);
let stamps = LS.get("stamps", {});
let tasks = LS.get("tasks", {});
const unread = () => anns.filter((a) => !read.includes(a.id));

const ISL = D.islands.map((d, i) => ({ ...d, i, guides: D.guides.filter((g) => g.island === d.key) }));
const isleOf = (key) => ISL.find((d) => d.key === key);
const isleDl = (d) => upcoming().filter((x) => x.category === d.key);
const isleNews = (d) => anns.filter((a) => a.tag === d.key);
const lvl = (n) => (n <= 3 ? "hot" : n <= 7 ? "warn" : "ok");
const CENTER_SPOTS = [
  { id: "office", name: "課外組", icon: "🏛", c: "#8FCB8B" },
  { id: "deadlines", name: "截止日鐘塔", icon: "⏰", c: "#F4C95D" },
  { id: "news", name: "公告欄", icon: "📌", c: "#F28C72" },
  { id: "links", name: "出航碼頭", icon: "⛵", c: "#5FC4D6" },
];
const STAMPS = [...CENTER_SPOTS.map((s) => ({ id: s.id, name: s.name, icon: s.icon, c: s.c })), ...ISL.map((d) => ({ id: "isle:" + d.key, name: d.name, icon: d.icon, c: d.color }))];

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

/* 群島佈局：中心島 + 七座島圍成一圈，正前方（鏡頭方向）留給碼頭 */
const FACE = Math.PI / 4;                         // 預設鏡頭所在方位；建築都轉向這裡
const FACE_DIR = new V3(Math.sin(FACE), 0, Math.cos(FACE));
const RC = 9;                                    // 中心島半徑
const NI = ISL.length;
const front = Math.atan2(FACE_DIR.z, FACE_DIR.x); // xz 平面上的鏡頭方位角
ISL.forEach((d, i) => {
  d.r = 5;
  d.a = front + Math.PI / NI + (i * 2 * Math.PI) / NI;
  d.dist = RC + d.r + 4.5;
  d.dir = new V3(Math.cos(d.a), 0, Math.sin(d.a));
  d.pos = d.dir.clone().multiplyScalar(d.dist);
});
const WORLD_R = RC + 2 * 5 + 4.5 + 1;

const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.15;
controls.minZoom = 0.7;
controls.maxZoom = 4;
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.addEventListener("change", () => {
  const t = controls.target, l = Math.hypot(t.x, t.z);
  if (l > WORLD_R) { const f = WORLD_R / l, dx = t.x * f - t.x, dz = t.z * f - t.z; t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
});
const HOME = { phi: 0.98, theta: FACE };
const homeZoom = () => (innerWidth >= 900 ? 0.84 : 1);

const hemi = new THREE.HemisphereLight(0xeaf8ff, 0x6b8f5a, 1.15);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.1);
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
  const s = h >= 6 && h < 17 ? { bg: 0xbde5f4, sun: 2.1, hemi: 1.15, n: 0 } : h >= 17 && h < 19 ? { bg: 0xf6caa6, sun: 1.4, hemi: 0.9, n: 0.5 } : h === 5 ? { bg: 0xd3dcf0, sun: 1.2, hemi: 0.85, n: 0.4 } : { bg: 0x2c4472, sun: 0.65, hemi: 0.7, n: 1 };
  scene.background = new THREE.Color(s.bg);
  document.body.style.background = "#" + s.bg.toString(16).padStart(6, "0");
  sun.intensity = s.sun; hemi.intensity = s.hemi; night = s.n;
}

/* ---- 低多邊形工具 ---- */
const MC = new Map();
const mat = (c, x = {}) => { const k = c + JSON.stringify(x); if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, ...x })); return MC.get(k); };
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
const FONT = '"Zen Maru Gothic", "Noto Sans TC", sans-serif';
const NUMF = '"Barlow Condensed", "Arial Narrow", sans-serif';
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

/* ---- 海 ---- */
const seaGeo = new THREE.PlaneGeometry(320, 320, 80, 80);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = seaGeo.attributes.position.array.slice();
const sea = mesh(seaGeo, mat(0x5fc4d6, { roughness: 0.45 }), 0, -1.15, 0);
sea.castShadow = false;
scene.add(sea);

/* ---- 島 ---- */
const pickables = [];
const tag = (obj, info) => { obj.traverse((o) => { if (o.isMesh) o.userData.pick = info; }); pickables.push(obj); };
function landmass(parent, r, seed, grass) {
  const wob = (a) => 1 + 0.07 * Math.sin(3 * a + seed) + 0.045 * Math.sin(5 * a + seed * 1.7);
  const layer = (rt, rb, h, y, c) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, 32, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), f = wob(Math.atan2(z, x)); p.setX(i, x * f); p.setZ(i, z * f); }
    g.computeVertexNormals();
    return mesh(g, c, 0, y, 0, parent);
  };
  const top = layer(r, r * 0.96, 0.8, -0.4, grass);
  layer(r * 1.1, r * 1.12, 0.5, -0.95, 0xf3d7a0);
  layer(r * 0.96, r * 0.6, 2.6, -2.1, 0x9b7653);
  return { top, wob };
}

const world = new THREE.Group();
scene.add(world);

/* ---- 建築 ---- */
function bOffice(g) {
  box(g, 5, 0.3, 3.8, 0xd8d1c2, 0, 0, 0);
  box(g, 4.6, 2.5, 3.4, 0xfaf6ec, 0, 0.3, 0);
  box(g, 4.6, 1.3, 3.4, 0xf3eee2, 0, 2.8, 0);
  const roof = cone(g, 3.6, 1.7, 0x2f6db5, 0, 4.1, 0, 4); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.82);
  box(g, 1.1, 1.7, 0.1, 0x7a5136, 0, 0.3, 1.71);
  const win = mat(0xa8dcf0, { emissive: 0xffd27a, emissiveIntensity: 0 });
  g.userData.win = win;
  [-1.5, 1.5].forEach((x) => { mesh(new THREE.BoxGeometry(0.9, 0.75, 0.08), win, x, 1.45, 1.72, g); mesh(new THREE.BoxGeometry(0.9, 0.6, 0.08), win, x, 3.4, 1.72, g); });
  mesh(new THREE.BoxGeometry(0.9, 0.6, 0.08), win, 0, 3.4, 1.72, g);
  const sign = textPlane(2.9, 0.75, (c, w, h) => {
    const st = officeStatus();
    rr(c, 4, 4, w - 8, h - 8, 22); c.fillStyle = "#183D3B"; c.fill();
    c.fillStyle = "#FFFDF6"; c.font = `900 ${h * 0.5}px ${FONT}`; c.textBaseline = "middle"; c.fillText("課外組", 24, h / 2 + 2);
    c.fillStyle = st.open ? "#6BE39A" : "#FF8B7E"; c.font = `700 ${h * 0.36}px ${FONT}`; c.textAlign = "right"; c.fillText(st.short, w - 24, h / 2 + 2);
  });
  sign.position.set(0, 2.35, 1.76); g.add(sign);
  g.userData.sign = sign; g.userData.h = 6.3;
}
function bClock(g) {
  box(g, 2.4, 0.4, 2.4, 0xcfc6b4, 0, 0, 0);
  box(g, 1.8, 5.2, 1.8, 0xefe6d2, 0, 0.4, 0);
  box(g, 2.1, 0.3, 2.1, 0xb8ab93, 0, 5.6, 0);
  const r = cone(g, 1.7, 1.8, 0xd9483b, 0, 5.9, 0, 4); r.rotation.y = Math.PI / 4;
  const face = textPlane(1.5, 1.5, (c, w, h) => {
    const n = upcoming()[0], d = n ? daysLeft(n.at) : null;
    c.fillStyle = "#FFFDF6"; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); c.fill();
    c.lineWidth = 10; c.strokeStyle = "#183D3B"; c.stroke();
    c.fillStyle = d !== null && d <= 3 ? "#D9483B" : "#183D3B"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `700 ${h * 0.42}px ${NUMF}`; c.fillText(d === null ? "--" : d === 0 ? "今天" : "D-" + d, w / 2, h * 0.47);
    c.fillStyle = "#4F6B69"; c.font = `700 ${h * 0.12}px ${FONT}`; c.fillText("下個截止", w / 2, h * 0.77);
  });
  face.position.set(0, 4.4, 0.92); g.add(face);
  g.userData.sign = face; g.userData.h = 8.3;
}
function bBoard(g) {
  [-1.3, 1.3].forEach((x) => box(g, 0.2, 2.6, 0.2, 0x8a5a3b, x, 0, 0));
  box(g, 3, 1.8, 0.2, 0x9c6b47, 0, 0.9, 0);
  box(g, 3.3, 0.25, 0.5, 0x6e4329, 0, 2.7, 0);
  const notes = textPlane(2.7, 1.5, (c, w, h) => {
    c.fillStyle = "#F3E6C8"; c.fillRect(0, 0, w, h);
    ["#FFF3A8", "#FFD2CC", "#CFEEFC", "#D9F4C9"].forEach((col, i) => { c.save(); c.translate(30 + (i * (w - 60)) / 4, 40 + (i % 2) * 24); c.rotate((i % 2 ? 1 : -1) * 0.06); c.fillStyle = col; c.fillRect(0, 0, (w - 80) / 4, h - 104); c.restore(); });
    c.fillStyle = "#183D3B"; c.font = `900 ${h * 0.2}px ${FONT}`; c.textAlign = "center"; c.fillText("公告", w / 2, h - 14);
  });
  notes.position.set(0, 1.8, 0.11); g.add(notes);
  g.userData.h = 4.2;
}
function bDock(g) {
  for (let i = 0; i < 5; i++) box(g, 1.6, 0.18, 0.9, 0xb98a5e, 0, -0.35, i * 0.95);
  [-0.75, 0.75].forEach((x) => [0.6, 2.4, 4].forEach((z) => cyl(g, 0.1, 0.1, 1.5, 0x8a5a3b, x, -1.5, z, 5)));
  const boat = new THREE.Group();
  box(boat, 1.2, 0.6, 2.8, 0xd9483b, 0, 0, 0);
  box(boat, 1, 0.1, 2.5, 0xf5ead2, 0, 0.6, 0);
  cyl(boat, 0.05, 0.05, 2.4, 0xdddddd, 0, 0.6, -0.1, 5);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.8, -0.2, 0, 2.9, -0.2, 0, 0.8, -1.4], 3));
  sg.computeVertexNormals();
  mesh(sg, mat(0xffffff, { side: THREE.DoubleSide }), 0, 0, 0, boat);
  boat.position.set(1.8, -1.15, 3);
  g.add(boat);
  g.userData.boat = boat; g.userData.h = 3;
}
function bTrack(g, col) {
  const t = mesh(new THREE.TorusGeometry(1.9, 0.45, 3, 24), 0xc4553f, 0, 0.12, 0, g);
  t.rotation.x = Math.PI / 2; t.scale.set(1.25, 1, 1);
  const inner = cyl(g, 1.45, 1.45, 0.1, 0x5fae4f, 0, 0, 0, 20); inner.scale.set(1.3, 1, 1);
  const baton = cyl(g, 0.12, 0.12, 0.9, 0xf4c95d, 1.2, 0.3, 1.4); baton.rotation.z = Math.PI / 2;
  box(g, 2, 1.6, 1.4, 0xfaf6ec, 0, 0, -2.6);
  const r = cone(g, 1.6, 1, col, 0, 1.6, -2.6, 4); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.75);
  g.userData.h = 3.4;
}
function bTent(g, col) {
  const t = cone(g, 2, 2.6, col, 0, 0, 0, 4); t.rotation.y = Math.PI / 4;
  box(g, 0.8, 1.1, 0.1, 0x7b3b14, 0, 0, 1.35);
  cyl(g, 0.05, 0.05, 3.6, 0xdddddd, 1.6, 0, 1, 5);
  box(g, 0.9, 0.55, 0.04, 0x2fa35a, 2.08, 2.9, 1);
  cyl(g, 0.6, 0.6, 0.3, 0x8a5a3b, -1.9, 0, 1.2, 6);
  g.userData.h = 3.8;
}
function bBank(g) {
  box(g, 3.4, 0.3, 2.6, 0xd8d1c2, 0, 0, 0);
  box(g, 3, 1.8, 2.2, 0xf5efe0, 0, 0.3, 0);
  [-1.1, -0.37, 0.37, 1.1].forEach((x) => cyl(g, 0.14, 0.14, 1.8, 0xffffff, x, 0.3, 1.2, 6));
  const pd = cone(g, 2.2, 0.9, 0xe8c25a, 0, 2.1, 0, 4); pd.rotation.y = Math.PI / 4; pd.scale.set(1.1, 1, 0.8);
  const coin = cyl(g, 0.8, 0.8, 0.22, mat(0xffcf3a, { metalness: 0.4, roughness: 0.4 }), 0, 3.5, 0, 16);
  coin.rotation.x = Math.PI / 2;
  g.userData.spin = coin; g.userData.h = 5;
}
function bGym(g, col) {
  cyl(g, 2.4, 2.5, 1.2, 0xeeeae0, 0, 0, 0, 12);
  mesh(new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), col, 0, 1.2, 0, g);
  box(g, 1.2, 1, 0.3, 0x2a5d84, 0, 0, 2.35);
  ball(g, 0.35, 0xff8a3d, 1.9, 0.35, 2.1);
  g.userData.h = 4.3;
}
function bAid(g) {
  box(g, 3, 1.9, 2.4, 0xffffff, 0, 0, 0);
  box(g, 3.2, 0.3, 2.6, 0xd9483b, 0, 1.9, 0);
  box(g, 1, 0.3, 0.06, 0xd9483b, 0, 0.95, 1.22); box(g, 0.3, 1, 0.06, 0xd9483b, 0, 0.6, 1.22);
  box(g, 0.5, 0.6, 0.25, 0x2fa35a, 1.9, 0.4, 0.6);
  g.userData.h = 3.3;
}
function bStore(g, col) {
  box(g, 3.4, 1.6, 2.4, 0xe9e4f2, 0, 0, 0);
  const roof = mesh(new THREE.CylinderGeometry(1.25, 1.25, 3.5, 10, 1, false, 0, Math.PI), col, 0, 1.6, 0, g);
  roof.rotation.z = Math.PI / 2;
  box(g, 1.4, 1.2, 0.08, 0x5a4a6e, 0, 0, 1.21);
  ball(g, 0.32, 0xff8a3d, -1.6, 0.32, 1.7); ball(g, 0.3, 0xffffff, -1.0, 0.3, 1.9); ball(g, 0.28, 0xf5d547, -1.3, 0.28, 2.4);
  g.userData.h = 3.5;
}
function bPodium(g) {
  box(g, 1, 1.4, 1, 0xffd34d, 0, 0, 0); box(g, 1, 0.9, 1, 0xd9dfe6, -1.05, 0, 0); box(g, 1, 0.6, 1, 0xd99a62, 1.05, 0, 0);
  const gold = mat(0xffc83d, { metalness: 0.5, roughness: 0.35 });
  cyl(g, 0.18, 0.28, 0.2, gold, 0, 1.4, 0); cyl(g, 0.06, 0.06, 0.3, gold, 0, 1.6, 0);
  g.userData.spin = cyl(g, 0.42, 0.18, 0.55, gold, 0, 1.9, 0);
  g.userData.h = 3.4;
}
function bHouse(g, col) {
  box(g, 2.4, 1.6, 2, 0xf6efe0, 0, 0, 0);
  const r = cone(g, 2, 1.2, col, 0, 1.6, 0, 4); r.rotation.y = Math.PI / 4;
  box(g, 0.7, 1, 0.08, 0x7a5136, 0, 0, 1.02);
  g.userData.h = 3.4;
}
const BUILD = { track: bTrack, tent: bTent, bank: bBank, gym: bGym, aid: bAid, store: bStore, podium: bPodium, house: bHouse };

function tree(p, x, z, s, k) {
  cyl(p, 0.12 * s, 0.16 * s, 0.7 * s, 0x8b5e3c, x, 0, z, 5);
  if (k > 0.45) { cone(p, 0.75 * s, 1.5 * s, 0x4c9f65, x, 0.6 * s, z); cone(p, 0.55 * s, 1.1 * s, 0x5daa4f, x, 1.4 * s, z); }
  else ball(p, 0.75 * s, [0x68b457, 0x7fc86a, 0x8fcb8b][Math.floor(k * 6.6) % 3], x, 1.3 * s, z);
}
function lampPost(p, x, z) {
  cyl(p, 0.07, 0.07, 1.2, 0x3d4a48, x, 0, z, 6);
  const m = mat(0xfff6d8, { emissive: 0xffd27a, emissiveIntensity: 0 });
  lamps.push(m);
  mesh(new THREE.IcosahedronGeometry(0.22, 0), m, x, 1.35, z, p);
}
const lamps = [];
const angOff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/* ---- 中心島：課外組 ---- */
const center = new THREE.Group();
world.add(center);
const CL = landmass(center, RC, 1.3, 0x8fcb8b);
tag(CL.top, { t: "center" });
cyl(center, 3.4, 3.4, 0.06, 0xece1c4, 0, 0, 0, 24).castShadow = false;
cyl(center, 1.3, 1.5, 0.5, 0xc9bfae, 0, 0, 0, 10);
cyl(center, 1.05, 1.05, 0.12, 0x6fd3ec, 0, 0.45, 0, 10);
cyl(center, 0.18, 0.25, 1.2, 0xc9bfae, 0, 0.5, 0);
ball(center, 0.35, 0x8fe1f2, 0, 1.85, 0);
const flag = box(center, 1.4, 0.8, 0.04, 0x1f5fa8, 2.1, 3.3, -1.6);
cyl(center, 0.06, 0.06, 4.2, 0xdddddd, 1.4, 0, -1.6, 6);

// 中心島上的地點放在兩座橋之間，避開走道
const mid = (k) => front + (k * 2 * Math.PI) / NI;  // k=0 為正前方（碼頭）
// 七座橋的方位是 front + (2i+1)π/7，所以 mid(k) 一定落在兩座橋中間；行走環道半徑 3.9，建築都放在環道外
const SPOT = {
  office: { a: mid(3), r: 6.4, build: bOffice },
  deadlines: { a: mid(4), r: 6.2, build: bClock },
  news: { a: mid(2), r: 6, build: bBoard },
  links: { a: mid(0), r: RC * 0.96, build: bDock },
};
const centerObj = {};
Object.entries(SPOT).forEach(([id, s]) => {
  const g = new THREE.Group();
  s.build(g);
  g.position.set(Math.cos(s.a) * s.r, 0, Math.sin(s.a) * s.r);
  if (id === "links") g.rotation.y = Math.atan2(Math.cos(s.a), Math.sin(s.a)); // 碼頭沿 +z 伸向海面
  else g.rotation.y = FACE;
  if (id === "office") g.scale.setScalar(0.92);
  center.add(g);
  tag(g, { t: "spot", id });
  centerObj[id] = g;
  s.pos = g.position.clone();
});
// 中心島的路燈與樹
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
  const L = landmass(g, d.r, hash(d.key) * 10, 0x8fcb8b);
  tag(L.top, { t: "isle", i: d.i });
  const col = new THREE.Color(d.color).getHex();
  // 島色廣場
  const pl = cyl(g, 2.4, 2.4, 0.06, new THREE.Color(d.color).lerp(new THREE.Color(0xfffdf6), 0.55).getHex(), 0, 0, 0, 20);
  pl.castShadow = false;
  // 從廣場到橋頭的步道
  const toC = Math.atan2(-d.dir.z, -d.dir.x), len = d.r - 2.2;
  const path = box(g, len, 0.05, 1.2, 0xe9dcc0, Math.cos(toC) * (2.2 + len / 2), 0, Math.sin(toC) * (2.2 + len / 2));
  path.rotation.y = -toC; path.castShadow = false;
  // 建築放在廣場後方，面向鏡頭
  const b = new THREE.Group();
  (BUILD[d.building] || bHouse)(b, col);
  b.position.copy(FACE_DIR).multiplyScalar(-0.9);
  b.rotation.y = FACE;
  g.add(b);
  tag(b, { t: "isle", i: d.i });
  d.build = b;
  d.spot = FACE_DIR.clone().multiplyScalar(2.1); // 角色站的位置（廣場前緣，島的區域座標）
  // 樹
  let n = 0;
  for (let i = 0; i < 200 && n < 9; i++) {
    const a = hash(d.key + "a" + i) * Math.PI * 2, r = 2.9 + hash(d.key + "r" + i) * (d.r * 0.85 - 2.9);
    if (angOff(a, toC) < 0.45 || angOff(a, FACE + 0) < 0.2) continue;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - b.position.x, z - b.position.z) < 2.8) continue;
    tree(g, x, z, 0.65 + hash(d.key + "s" + i) * 0.45, hash(d.key + "k" + i)); n++;
  }
  lampPost(g, Math.cos(toC + 0.5) * 2.7, Math.sin(toC + 0.5) * 2.7);
});

/* ---- 橋 ---- */
function bridge(d) {
  const p0 = d.dir.clone().multiplyScalar(RC * 0.9), p1 = d.dir.clone().multiplyScalar(d.dist - d.r * 0.88);
  const len = p0.distanceTo(p1), m = p0.clone().add(p1).multiplyScalar(0.5);
  const g = new THREE.Group();
  g.position.copy(m);
  g.rotation.y = -d.a;
  world.add(g);
  const plank = mat(0xc89a6a), rail = mat(0x8a5a3b);
  const n = Math.round(len / 0.5);
  for (let k = 0; k < n; k++) {
    const x = -len / 2 + (k + 0.5) * (len / n), y = Math.sin(((k + 0.5) / n) * Math.PI) * 0.35;
    const pl = mesh(new THREE.BoxGeometry(len / n - 0.06, 0.14, 1.5), plank, x, y - 0.05, 0, g);
    pl.rotation.y = (hash(d.key + k) - 0.5) * 0.06;
  }
  [-0.78, 0.78].forEach((z) => {
    for (let k = 0; k <= 4; k++) { const x = -len / 2 + (k * len) / 4, y = Math.sin((k / 4) * Math.PI) * 0.35; cyl(g, 0.07, 0.07, 0.7, rail, x, y - 0.05, z, 5); }
    const r = mesh(new THREE.BoxGeometry(len, 0.08, 0.08), rail, 0, 0.75, z, g);
    r.position.y = 0.6;
  });
  [-len / 2 + 0.6, len / 2 - 0.6].forEach((x) => cyl(g, 0.12, 0.12, 1.4, rail, x, -1.5, 0, 6));
  d.bridge = { p0, p1, len };
}
ISL.forEach(bridge);

/* ---- 雲 ---- */
const clouds = [];
for (let i = 0; i < 8; i++) {
  const c = new THREE.Group();
  const cm = mat(0xffffff, { roughness: 1, emissive: 0x9aaabb, emissiveIntensity: 0.4 });
  for (let k = 0; k < 4; k++) { const b = ball(c, 1 + hash("cl" + i + k) * 1.1, cm, k * 1.3, hash("cy" + i + k) * 0.6, hash("cz" + i + k) * 0.8); b.castShadow = false; }
  // 只放在群島後方（遠離鏡頭的半圈），平行投影下才不會擋住島
  c.userData = { r: WORLD_R + 8 + hash("cr" + i) * 14, a0: front + Math.PI + (hash("ca" + i) - 0.5) * 2.4, a: 0, s: 0.2 + hash("cs" + i) * 0.3 };
  c.userData.a = c.userData.a0;
  c.position.set(Math.cos(c.userData.a) * c.userData.r, 3 + hash("ch" + i) * 4, Math.sin(c.userData.a) * c.userData.r);
  scene.add(c); clouds.push(c);
}

/* ---- 提醒標記：分類島上方的菱形 ---- */
ISL.forEach((d) => {
  const m = mesh(new THREE.OctahedronGeometry(0.5, 0), mat(0xf4c95d, { emissive: 0xf4c95d, emissiveIntensity: 0.35 }), 0, 0, 0, d.group);
  m.castShadow = false;
  m.position.copy(d.build.position).setY(d.build.userData.h + 1.6);
  d.marker = m;
});
const newsMarker = mesh(new THREE.OctahedronGeometry(0.5, 0), mat(0xd9483b, { emissive: 0xd9483b, emissiveIntensity: 0.35 }), 0, 0, 0, center);
newsMarker.position.copy(SPOT.news.pos).setY(5.6);
function updMarkers() {
  ISL.forEach((d) => {
    const n = isleDl(d)[0], days = n ? daysLeft(n.at) : 99;
    d.marker.visible = days <= 7;
    d.marker.material = days <= 3 ? mat(0xd9483b, { emissive: 0xd9483b, emissiveIntensity: 0.35 }) : mat(0xf4c95d, { emissive: 0xf4c95d, emissiveIntensity: 0.35 });
  });
  newsMarker.visible = unread().length > 0;
}

/* ---- 角色 ---- */
function person(shirt, hair) {
  const g = new THREE.Group();
  cyl(g, 0.1, 0.1, 0.45, 0x2b3a4a, -0.13, 0, 0, 6); cyl(g, 0.1, 0.1, 0.45, 0x2b3a4a, 0.13, 0, 0, 6);
  cyl(g, 0.3, 0.34, 0.65, shirt, 0, 0.42, 0, 8);
  ball(g, 0.3, 0xf7d7be, 0, 1.38, 0, 1);
  const h = ball(g, 0.32, hair, 0, 1.5, -0.04, 1); h.scale.set(1, 0.7, 1);
  box(g, 0.08, 0.08, 0.02, 0x183d3b, -0.11, 1.32, 0.28); box(g, 0.08, 0.08, 0.02, 0x183d3b, 0.11, 1.32, 0.28);
  return g;
}
const av = person(0xf28c72, 0x2b2118);
box(av, 0.36, 0.2, 0.02, 0xffffff, 0, 0.72, 0.31);
const AV_HOME = FACE_DIR.clone().multiplyScalar(3.8);
av.position.copy(AV_HOME);
av.rotation.y = FACE;
world.add(av);
const teacher = person(0x2e8b57, 0x55463a);
teacher.position.copy(FACE_DIR.clone().multiplyScalar(2.2).add(new V3(-1.6, 0, 1.6).applyAxisAngle(new V3(0, 1, 0), FACE - Math.PI / 4)));
teacher.rotation.y = FACE;
world.add(teacher);
tag(teacher, { t: "teacher" });

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
function isleSpot(d) { return d.pos.clone().add(d.spot); }
function isleSide(d) { // 繞過建築的側邊點
  const perp = new V3(-FACE_DIR.z, 0, FACE_DIR.x), s = Math.sign(perp.dot(d.dir.clone().negate())) || 1;
  return d.pos.clone().add(perp.multiplyScalar(2.5 * s));
}
function route(to) {
  const pts = [];
  const curA = Math.atan2(av.position.z, av.position.x);
  if (avAt !== "C") { const d = ISL[avAt]; pts.push(isleSide(d)); pts.push(...bridgePts(d, false)); pts.push(ringPt(d.a)); }
  else pts.push(ringPt(curA));
  const fromA = avAt !== "C" ? ISL[avAt].a : curA;
  if (to === "C") { pts.push(...arc(fromA, front)); pts.push(AV_HOME.clone()); }
  else { const d = ISL[to]; pts.push(...arc(fromA, d.a)); pts.push(...bridgePts(d, true)); pts.push(isleSide(d)); pts.push(isleSpot(d)); }
  return pts;
}
function walkTo(to, onArrive) {
  if (to === avAt && !avPath.length) { onArrive && onArrive(); return; }
  avPath = route(to); avGoal = { to, onArrive };
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
  const hh = a >= 1 ? base : base / a * 0.9, hw = hh * a;
  camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
  camera.updateProjectionMatrix();
}
function flyTo(target, zoom, dur = 900) {
  tween = { s: performance.now(), d: RM ? 1 : dur, t0: controls.target.clone(), t1: target.clone(), z0: camera.zoom, z1: zoom };
}
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.s) / tween.d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const nt = tween.t0.clone().lerp(tween.t1, e), dv = nt.clone().sub(controls.target);
  controls.target.copy(nt); camera.position.add(dv);
  camera.zoom = tween.z0 + (tween.z1 - tween.z0) * e; camera.updateProjectionMatrix();
  if (k >= 1) tween = null;
}
// 讓目標落在 HUD 與資訊卡都沒蓋住的區域中央
function freeCenter() {
  const W = innerWidth, H = innerHeight, panel = $("panel"), desk = W >= 900;
  let top = $("top").getBoundingClientRect().bottom + 8, bottom = $("bottom").getBoundingClientRect().top - 8, left = 0, right = W;
  if (!panel.hidden) {
    const r = panel.getBoundingClientRect();
    if (desk) right = r.left - 8; else bottom = r.top - 8;
  }
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
function focusOn(p, zoom) { flyTo(framed(p, zoom), zoom); }
function goHome() {
  closePanel(true);
  sph.set(camera.position.distanceTo(controls.target), HOME.phi, HOME.theta);
  const off = new V3().setFromSpherical(sph);
  camera.position.copy(controls.target).add(off);
  flyTo(framed(new V3(0, 0, 0), homeZoom()), homeZoom());
  setSel(null);
}

/* ---------------- 名牌 ---------------- */
const lblEl = $("lbl"), labels = [];
function mkLabel(html, pos3, onClick, cls = "") {
  const el = document.createElement("button");
  el.type = "button"; el.className = "il " + cls; el.innerHTML = html;
  el.addEventListener("click", onClick);
  lblEl.appendChild(el);
  const L = { el, pos3 }; labels.push(L); return L;
}
function isleSub(d) {
  const dl = isleDl(d), n = dl[0], nn = isleNews(d).filter((a) => !read.includes(a.id)).length;
  const parts = [];
  if (dl.length) parts.push(`${dl.length} 項截止`);
  if (d.guides.length) parts.push(`${d.guides.length} 份流程`);
  if (nn) parts.push(`${nn} 則新公告`);
  const hit = n ? `<span class="hit ${lvl(daysLeft(n.at)) === "hot" ? "hot" : ""}">D-${daysLeft(n.at)}</span>` : "";
  return { sub: parts.join("・") || "目前沒有待辦", hit };
}
function buildLabels() {
  lblEl.innerHTML = ""; labels.length = 0;
  ISL.forEach((d) => {
    const s = isleSub(d);
    d.label = mkLabel(`<span class="ic" style="--c:${d.color}">${d.icon}</span><span>${E(d.name)}${s.hit}<small>${E(s.sub)}</small></span>`,
      d.pos.clone().add(d.build.position).setY(d.build.userData.h + 0.4), () => openIsle(d.i));
  });
  CENTER_SPOTS.forEach((s) => {
    const o = centerObj[s.id];
    let extra = "";
    if (s.id === "office") { const st = officeStatus(); extra = `<small>${E(st.short)}</small>`; }
    if (s.id === "deadlines") { const n = upcoming()[0]; extra = n ? `<small>最近 D-${daysLeft(n.at)}</small>` : ""; }
    if (s.id === "news") { const u = unread().length; extra = u ? `<small>${u} 則未讀</small>` : ""; }
    s.label = mkLabel(`<span class="ic" style="--c:${s.c}">${s.icon}</span><span>${E(s.name)}${extra}</span>`,
      o.position.clone().setY((o.userData.h || 3) * (s.id === "office" ? 0.92 : 1) + 0.3), () => openSpot(s.id), "sm");
  });
  refreshLabelState();
}
function refreshLabelState() {
  const q = query();
  ISL.forEach((d) => {
    d.label.el.classList.toggle("done", !!stamps["isle:" + d.key]);
    d.label.el.classList.toggle("sel", sel === "isle:" + d.key);
    d.label.el.classList.toggle("dim", !!q && !isleHits(d, q));
  });
  CENTER_SPOTS.forEach((s) => s.label.el.classList.toggle("sel", sel === s.id));
}
const pv = new V3();
function placeLabels() {
  const W = innerWidth, H = innerHeight;
  lblEl.classList.toggle("cmp", W < 600 && camera.zoom < 1.4);
  labels.forEach((L) => {
    pv.copy(L.pos3).project(camera);
    const x = (pv.x + 1) / 2 * W, y = (1 - pv.y) / 2 * H;
    const off = pv.z > 1 || x < -80 || x > W + 80 || y < -40 || y > H + 40;
    L.el.classList.toggle("off", off);
    if (!off) L.el.style.transform = `translate(${x}px, ${y - 14}px) translate(-50%, -100%)`;
  });
}

/* ---------------- 互動 ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; tween = null; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 7 || performance.now() - downAt.t > 600) return;
  downAt = null;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true).find((h) => h.object.userData.pick);
  if (!hit) return;
  const p = hit.object.userData.pick;
  if (p.t === "isle") openIsle(p.i);
  else if (p.t === "spot") openSpot(p.id);
  else if (p.t === "teacher") teacherTalk();
  else if (p.t === "center") openSpot("office");
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || e.buttons) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true).find((h) => h.object.userData.pick);
  renderer.domElement.style.cursor = hit ? "pointer" : "grab";
});

let sel = null;
function setSel(id) { sel = id; refreshLabelState(); renderChips(); }
function stamp(id, name) {
  if (stamps[id]) return;
  stamps[id] = Date.now(); LS.set("stamps", stamps);
  updHud(); refreshLabelState();
  const n = Object.keys(stamps).length;
  toast(`🏅 蓋章！${name}（${n}/${STAMPS.length}）`);
  if (n === STAMPS.length) { confetti(); setTimeout(() => startTalk(["恭喜！整座群島都走過一遍了，你已經是合格的新任幹部。", "之後有新公告或快到的截止日，島上會出現漂浮的菱形提醒，記得常回來看看。"]), 900); }
  if (!$("panel").hidden && panelView === "passport") renderPassport();
}
function openIsle(i) {
  const d = ISL[i];
  setSel("isle:" + d.key);
  renderIsle(d);
  focusOn(d.pos, innerWidth < 600 ? 2.4 : 2);
  walkTo(i, () => { stamp("isle:" + d.key, d.name); if (panelView === "isle:" + d.key) renderIsle(d); toast(`${d.name}到了！`); });
}
function openSpot(id) {
  setSel(id);
  const r = { office: renderOffice, deadlines: renderDeadlines, news: renderNews, links: renderLinks }[id];
  r();
  focusOn(SPOT[id].pos, innerWidth < 600 ? 2.1 : 1.8);
  walkTo("C", () => stamp(id, CENTER_SPOTS.find((s) => s.id === id).name));
}

/* ---------------- 資訊卡 ---------------- */
let panelView = null;
function showPanel(view, head, body, color) {
  panelView = view;
  $("ph").innerHTML = head; $("pbody").innerHTML = body;
  $("panel").style.setProperty("--c", color || "var(--sun)");
  $("panel").hidden = false; document.body.classList.add("paneled");
  document.body.classList.toggle("searching", view === "search");
  $("pbody").scrollTop = 0;
  setNav(["deadlines", "news", "passport"].includes(view) ? view : "map");
  try { history.replaceState(null, "", "#" + view.replace("isle:", "isle-")); } catch {}
}
function closePanel(keepSel) {
  $("panel").hidden = true; document.body.classList.remove("paneled", "searching"); panelView = null;
  setNav("map");
  if (!keepSel) setSel(null);
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
}
$("px").addEventListener("click", () => closePanel());
addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("talk").hidden) $("talk").hidden = true; else closePanel(); } });
const head = (icon, c, title, sub) => `<span class="ic" style="--c:${c}">${icon}</span><span>${E(title)}<small>${E(sub)}</small></span>`;
const stampLine = (id, hint) => stamps[id] ? `<div class="stampline ok">✓ 已蓋章 · ${fmtStamp(stamps[id])}</div>` : `<div class="stampline">${hint}</div>`;
const fmtStamp = (ts) => { const p = tw(new Date(ts)); return `${p.m}/${p.d} ${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`; };

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
function download(name, text) {
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast("已下載行事曆檔，開啟即可加入"); }
  catch { toast("無法下載，請改用「Google 日曆」按鈕"); }
}
const subUrl = () => location.protocol === "https:" ? "webcal://" + location.host + location.pathname.replace(/[^/]*$/, "") + "calendar.ics" : "calendar.ics";

function dlRows(list, showIsle) {
  if (!list.length) return '<p class="empty">目前沒有待辦的截止日。</p>';
  return '<ul class="rows">' + list.map((x) => {
    const n = daysLeft(x.at), d = isleOf(x.category);
    return `<li class="dlrow lv-${lvl(n)}" style="--c:${d ? d.color : "var(--ink)"}"><div class="days"><b>${n === 0 ? "今" : n}</b><small>${n === 0 ? "今天截止" : "天後"}</small></div><div>
      <b>${E(x.title)}</b><small>${fmt(x.at)} 截止${showIsle && d ? `・${E(d.name)}` : ""}</small>${x.detail ? `<p>${E(x.detail)}</p>` : ""}
      <div class="acts"><a class="btn g" target="_blank" rel="noopener" href="${E(gcal(x))}">Google 日曆</a><button class="btn g" type="button" data-ics="${E(x.id)}">iPhone／其他</button>${x.link ? `<a class="btn g" target="_blank" rel="noopener" href="${E(x.link)}">相關文件</a>` : ""}${showIsle && d ? `<button class="btn g" type="button" data-isle="${d.i}">去${E(d.name)}</button>` : ""}</div></div></li>`;
  }).join("") + "</ul>";
}
function newsRows(list) {
  if (!list.length) return '<p class="empty">目前沒有公告。</p>';
  return '<ul class="rows">' + list.map((a) => { const d = isleOf(a.tag); return `<li style="--c:${d ? d.color : "var(--ink)"}"><b>${a.pinned ? '<span class="pin">置頂</span>' : ""}${!read.includes(a.id) ? '<span class="new">NEW</span>' : ""}${E(a.title)}</b><small>${E(a.date)}${d ? "・" + E(d.name) : ""}</small><p>${E(a.body)}</p></li>`; }).join("") + "</ul>";
}
function markRead(list) { let ch = false; list.forEach((a) => { if (!read.includes(a.id)) { read.push(a.id); ch = true; } }); if (ch) { LS.set("read", read); updHud(); updMarkers(); buildLabels(); } }

function renderIsle(d) {
  const dl = isleDl(d), news = isleNews(d);
  const body = `<p class="tagl">${E(d.tagline)}</p>
    ${stampLine("isle:" + d.key, "🚶 •ᴗ• 正在過橋，走到島上就能蓋章…")}
    <div class="grp"><h3>⏰ 截止日 <span class="n">${dl.length} 項</span></h3>${dlRows(dl)}</div>
    ${d.guides.map((g) => `<div class="grp"><h3>🧭 ${E(g.title)}</h3><p class="tagl" style="--c:var(--paper2);margin:0 0 6px">${E(g.summary)}</p><ol class="steps">${g.steps.map((s) => `<li>${E(s)}</li>`).join("")}</ol>
      ${g.links?.length ? `<div class="acts">${g.links.map((l) => `<a class="btn g" target="_blank" rel="noopener" href="${E(l[1])}">${E(l[0])}</a>`).join("")}</div>` : ""}</div>`).join("")}
    <div class="grp"><h3>📌 相關公告 <span class="n">${news.length} 則</span></h3>${newsRows(news)}</div>
    <p class="foot">還有問題？請在辦公時間到中心島的課外組詢問。</p>`;
  showPanel("isle:" + d.key, head(d.icon, d.color, d.name, d.guides[0]?.topic ? d.guides.map((g) => g.topic).join("、") : "行政分類"), body, d.color);
  markRead(news);
}
function renderOffice() {
  const st = officeStatus(), p = tw(), slots = D.office.hours.slots.map((s) => s.join("–")).join("、");
  const rows = [1, 2, 3, 4, 5, 6, 0].map((wd) => { const on = D.office.hours.days.includes(wd); return `<tr class="${wd === p.wd ? "today" : ""}"><td>週${WEEK[wd]}${wd === p.wd ? "（今天）" : ""}</td><td class="${on ? "" : "closed"}">${on ? slots : "不辦公"}</td></tr>`; }).join("");
  const body = `<p class="tagl">群島的中心。七座行政島都有橋通到這裡，有問題就回來找我們。</p>${stampLine("office", "🚶 走到課外組就能蓋章")}
    <div class="big"><span class="lamp ${st.open ? "on" : "off"}"></span>${E(st.text)}</div>
    <table class="week"><tbody>${rows}</tbody></table>
    <div class="grp"><h3>📍 位置與導航</h3><p class="tagl" style="--c:var(--paper2)">${E(D.office.locationNote)}</p>
      <div class="acts">${D.office.mapUrl ? `<a class="btn" target="_blank" rel="noopener" href="${E(D.office.mapUrl)}">開啟 Google 地圖導航</a>` : '<span class="btn g" aria-disabled="true">導航建置中</span>'}<a class="btn g" target="_blank" rel="noopener" href="${E(D.links.office)}">課外組網站 ↗</a></div></div>
    <div class="grp"><h3>💡 洽公小提醒</h3><ul class="rows">${D.office.tips.map((t) => `<li style="--c:var(--grass)"><p style="margin:0">${E(t)}</p></li>`).join("")}</ul></div>
    <div class="grp"><h3>🗺 七座行政島</h3><div class="isles">${ISL.map((d) => `<button type="button" data-isle="${d.i}"><span class="ic" style="--c:${d.color}">${d.icon}</span><span>${E(d.name)}<small>${E(isleSub(d).sub)}</small></span></button>`).join("")}</div></div>`;
  showPanel("office", head("🏛", "#8FCB8B", D.office.name, "群島中心"), body, "#8FCB8B");
}
function renderDeadlines() {
  const body = `<p class="tagl">所有分類的截止日都在這座鐘塔。7 天內轉黃、3 天內轉紅，分類島上方也會出現提醒菱形。</p>${stampLine("deadlines", "🚶 走到鐘塔就能蓋章")}
    <div class="acts" style="margin:0 6px 4px"><a class="btn" href="${E(subUrl())}">訂閱社團行事曆</a><button class="btn g" type="button" data-ics="all">全部加入行事曆</button><button class="btn g" type="button" id="notifyBtn">開啟網頁通知</button></div>
    <p class="foot" style="margin-top:0">訂閱後，新的截止日會自動同步到手機，並在截止前 3 天、1 天提醒。</p>
    <div class="grp">${dlRows(upcoming(), true)}</div>
    <p class="foot">正式期程以 <a target="_blank" rel="noopener" href="${E(D.links.schedule)}">體能性社團作業期程表 ↗</a> 為準。</p>`;
  showPanel("deadlines", head("⏰", "#F4C95D", "截止日鐘塔", `${upcoming().length} 項待辦`), body, "#F4C95D");
  renderNotifyBtn();
}
function renderNews() {
  const body = `<p class="tagl">學期間的行政公告都貼在這裡。看過的公告會自動標記為已讀。</p>${stampLine("news", "🚶 走到公告欄就能蓋章")}<div class="grp">${newsRows(anns)}</div>`;
  showPanel("news", head("📌", "#F28C72", "公告欄", `${anns.length} 則公告`), body, "#F28C72");
  markRead(anns);
}
function renderLinks() {
  const body = `<p class="tagl">從碼頭出航，前往課外組的其他平台。</p>${stampLine("links", "🚶 走到碼頭就能蓋章")}
    <ul class="rows">
      <li style="--c:#5FC4D6"><b>課外組網站</b><small>activity.thu.edu.tw</small><div class="acts"><a class="btn" target="_blank" rel="noopener" href="${E(D.links.office)}">前往 ↗</a></div></li>
      <li style="--c:#F4C95D"><b>體能性社團各項作業期程</b><small>整學期的正式時程表</small><div class="acts"><a class="btn" target="_blank" rel="noopener" href="${E(D.links.schedule)}">前往 ↗</a></div></li>
      <li style="--c:#F28C72"><b>體能性社團 Linktree</b><small>表單、雲端資料夾與常用連結</small><div class="acts"><a class="btn" target="_blank" rel="noopener" href="${E(D.links.linktree)}">前往 ↗</a></div></li>
      <li style="--c:#8FCB8B"><b>本站文字版</b><small>不顯示 3D，內容相同</small><div class="acts"><a class="btn g" href="list.html">開啟</a></div></li>
    </ul>`;
  showPanel("links", head("⛵", "#5FC4D6", "出航碼頭", "常用連結"), body, "#5FC4D6");
}
function renderPassport() {
  const n = Object.keys(stamps).length, t = D.onboarding.filter((x) => tasks[x]).length;
  const body = `<div class="big"><span class="num" style="font-size:40px">${n}</span><span style="color:var(--mut);font-size:15px">/ ${STAMPS.length} 個印章</span></div>
    <div class="prog"><i style="width:${(n / STAMPS.length) * 100}%"></i></div>
    <div class="stamps">${STAMPS.map((s) => `<button type="button" class="stc ${stamps[s.id] ? "on" : ""}" data-stamp="${E(s.id)}" style="--c:${s.c}"><i>${s.icon}</i>${E(s.name)}</button>`).join("")}</div>
    <div class="grp"><h3>✅ 新任幹部上任清單 <span class="n" id="taskN">${t}/${D.onboarding.length}</span></h3>
    <ul class="tasks">${D.onboarding.map((x, i) => `<li><label for="task${i}"><input type="checkbox" id="task${i}" data-task="${i}" ${tasks[x] ? "checked" : ""}><span>${E(x)}</span></label></li>`).join("")}</ul></div>
    <p class="foot">印章與勾選紀錄只存在你自己的手機或電腦。</p>
    <div class="acts" style="margin:6px"><button class="btn g" type="button" id="resetSt">清除所有印章</button></div>`;
  showPanel("passport", head("🏅", "#F4C95D", "幹部護照", "走訪群島、完成上任清單"), body, "#F4C95D");
}
function renderSearch(q) {
  const out = [];
  ISL.forEach((d) => {
    d.guides.forEach((g) => { const hit = [g.topic, g.title, g.summary, ...g.steps].find((s) => s.includes(q)); if (hit) out.push({ d, t: g.title, s: hit }); });
    isleDl(d).forEach((x) => { if ((x.title + (x.detail || "")).includes(q)) out.push({ d, t: x.title, s: `截止日・${fmt(x.at)}` }); });
    isleNews(d).forEach((a) => { if ((a.title + a.body).includes(q)) out.push({ d, t: a.title, s: "公告・" + a.body }); });
  });
  const hl = (s) => E(s).split(E(q)).join(`<mark>${E(q)}</mark>`);
  const body = out.length ? '<ul class="rows">' + out.map((r) => `<li style="--c:${r.d.color}"><b>${hl(r.t)}</b><small>${E(r.d.name)}・${hl(r.s)}</small><div class="acts"><button class="btn g" type="button" data-isle="${r.d.i}">去${E(r.d.name)}</button></div></li>`).join("") + "</ul>"
    : `<p class="empty">找不到「${E(q)}」。可以在辦公時間到課外組當面詢問。</p>`;
  showPanel("search", head("⌕", "#F7F2E4", `搜尋「${q}」`, `找到 ${out.length} 筆`), body, "#F7F2E4");
}
$("pbody").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.isle !== undefined) return openIsle(+b.dataset.isle);
  if (b.dataset.ics) {
    if (b.dataset.ics === "all") return download("東海體能性社團截止日.ics", icsFor(upcoming()));
    const x = deadlines.find((d) => d.id === b.dataset.ics); return x && download(x.id + ".ics", icsFor([x]));
  }
  if (b.dataset.stamp) { const id = b.dataset.stamp; return id.startsWith("isle:") ? openIsle(isleOf(id.slice(5)).i) : openSpot(id); }
  if (b.id === "notifyBtn") return askNotify();
  if (b.id === "resetSt") {
    if (b.dataset.arm) { stamps = {}; LS.set("stamps", stamps); updHud(); refreshLabelState(); renderPassport(); toast("印章已清除"); }
    else { b.dataset.arm = "1"; b.textContent = "確定清除？再按一次"; }
  }
});
$("pbody").addEventListener("change", (e) => {
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

/* ---------------- 搜尋與島嶼籤 ---------------- */
const query = () => $("q").value.trim();
const isleHits = (d, q) => {
  let n = 0;
  d.guides.forEach((g) => { if ([g.topic, g.title, g.summary, ...g.steps].some((s) => s.includes(q))) n++; });
  isleDl(d).forEach((x) => { if ((x.title + (x.detail || "")).includes(q)) n++; });
  isleNews(d).forEach((a) => { if ((a.title + a.body).includes(q)) n++; });
  return n;
};
function renderChips() {
  const q = query();
  $("chips").innerHTML = ISL.map((d) => {
    const n = isleDl(d)[0], days = n ? daysLeft(n.at) : null, h = q ? isleHits(d, q) : 0;
    const small = q ? `${h} 符合` : days !== null ? `D-${days}` : "";
    return `<button type="button" class="chip ${q && !h ? "off" : ""}" data-isle="${d.i}" aria-pressed="${sel === "isle:" + d.key}" style="--c:${d.color}"><i>${d.icon}</i>${E(d.name)}${small ? ` <small class="${!q && days !== null && days <= 3 ? "hot" : ""}">${small}</small>` : ""}</button>`;
  }).join("");
}
$("chips").addEventListener("click", (e) => { const b = e.target.closest("[data-isle]"); if (b) openIsle(+b.dataset.isle); });
let qT;
$("q").addEventListener("input", () => {
  $("qx").hidden = !query();
  renderChips(); refreshLabelState();
  clearTimeout(qT);
  qT = setTimeout(() => { const q = query(); if (q) renderSearch(q); else if (panelView === "search") closePanel(); }, 250);
});
$("qx").addEventListener("click", () => { $("q").value = ""; $("qx").hidden = true; renderChips(); refreshLabelState(); if (panelView === "search") closePanel(); });

/* ---------------- HUD、分頁、對話 ---------------- */
function setNav(v) { document.querySelectorAll("nav.tab button").forEach((b) => b.dataset.v === v ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")); }
document.querySelectorAll("nav.tab button").forEach((b) => b.addEventListener("click", () => {
  const v = b.dataset.v;
  if (v === "map") return goHome();
  if (v === "deadlines" || v === "news") return openSpot(v);
  if (v === "passport") return panelView === "passport" ? closePanel() : renderPassport();
}));
$("stampBtn").addEventListener("click", renderPassport);
$("pOffice").addEventListener("click", () => openSpot("office"));
$("pNext").addEventListener("click", () => { const n = upcoming()[0], d = n && isleOf(n.category); d ? openIsle(d.i) : openSpot("deadlines"); });
$("goCenter").addEventListener("click", () => openSpot("office"));
$("home").addEventListener("click", goHome);

function updHud() {
  const st = officeStatus();
  $("lamp").className = "lamp " + (st.open ? "on" : "off");
  $("officeTxt").textContent = "課外組 " + st.short;
  const n = upcoming()[0];
  if (n) { const d = daysLeft(n.at); $("nextN").textContent = d === 0 ? "今天" : d; $("nextU").textContent = d === 0 ? "" : "天"; } else { $("nextN").textContent = "無"; $("nextU").textContent = ""; }
  const soon = upcoming().filter((x) => daysLeft(x.at) <= 7).length;
  $("dlN").hidden = !soon; $("dlN").textContent = soon; $("dlN").classList.toggle("hot", upcoming().some((x) => daysLeft(x.at) <= 3));
  const u = unread().length; $("newsN").hidden = !u; $("newsN").textContent = u;
  $("stampTxt").textContent = `${Object.keys(stamps).length} / ${STAMPS.length}`;
  $("sem").textContent = D.term + (D.isSample ? "・範例資料" : "");
}

// 跑馬燈：輪流顯示真正需要注意的事
let tkI = 0;
function tickerMsgs() {
  const m = [], st = officeStatus();
  upcoming().slice(0, 3).forEach((x) => { const d = isleOf(x.category); m.push({ t: `${d ? d.icon + " " + d.name + "：" : ""}「${x.title}」還有 ${daysLeft(x.at)} 天`, go: () => (d ? openIsle(d.i) : openSpot("deadlines")) }); });
  if (unread().length) m.push({ t: `📌 公告欄有 ${unread().length} 則新公告`, go: () => openSpot("news") });
  m.push({ t: `🏛 課外組${st.text}`, go: () => openSpot("office") });
  m.push({ t: "點一座島，•ᴗ• 會走過橋幫你蓋章", go: null });
  m.push({ t: "拖曳移動群島，兩指縮放或旋轉", go: null });
  return m;
}
let tkCur = null;
function tick() {
  const m = tickerMsgs(); tkCur = m[tkI++ % m.length];
  const s = $("tk"); s.style.opacity = 0;
  setTimeout(() => { s.textContent = tkCur.t; s.style.opacity = 1; }, RM ? 0 : 220);
}
$("ticker").addEventListener("click", () => tkCur && tkCur.go && tkCur.go());

let talkQ = [], talkTotal = 0;
function startTalk(lines) { talkQ = lines.slice(); talkTotal = lines.length; nextTalk(); }
function nextTalk() {
  if (!talkQ.length) { $("talk").hidden = true; return; }
  $("talkText").textContent = talkQ.shift();
  const at = talkTotal - talkQ.length;
  $("talkDots").innerHTML = talkTotal > 1 ? Array.from({ length: talkTotal }, (_, i) => `<i class="${i < at ? "on" : ""}"></i>`).join("") : "";
  $("talkNext").textContent = talkQ.length ? "下一步 →" : "開始探索";
  $("talk").hidden = false;
}
$("talkNext").addEventListener("click", nextTalk);
function teacherTalk() {
  const n = upcoming()[0], st = officeStatus(), L = [];
  if (n) { const d = isleOf(n.category); L.push(`最近的截止日是「${n.title}」，還有 ${daysLeft(n.at)} 天${d ? `，在${d.name}` : ""}。記得加入行事曆。`); }
  if (unread().length) L.push(`公告欄有 ${unread().length} 則你還沒看過的公告。`);
  L.push(`課外組${st.text}。週一至週五 9:00–12:00、13:30–17:00 都可以來找我們。`);
  startTalk(L);
}

let toastT;
function toast(msg, ms = 2400) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms); }
function confetti() {
  if (RM) return;
  const em = ["🎉", "✨", "🏅", "💛", "🎊"];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement("div"); s.className = "cf"; s.textContent = em[i % em.length]; document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 160;
    s.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px),calc(-50% + ${Math.sin(a) * r - 60}px)) scale(1.1) rotate(${(Math.random() - 0.5) * 200}deg)`, opacity: 0 }], { duration: 1300 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => s.remove();
  }
}

/* ---------------- 每分鐘更新：天色、辦公狀態、倒數 ---------------- */
function refreshTimed() {
  applySky();
  const open = officeStatus().open;
  centerObj.office.userData.win.emissiveIntensity = open ? 0.25 + night * 0.6 : night * 0.12;
  lamps.forEach((m) => (m.emissiveIntensity = night * 1.2));
  centerObj.office.userData.sign.userData.redraw();
  centerObj.deadlines.userData.sign.userData.redraw();
  updHud(); updMarkers(); buildLabels(); renderChips();
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
    clouds.forEach((c, i) => { const a = c.userData.a0 + Math.sin(t * 0.03 * c.userData.s + i) * 0.25; c.position.x = Math.cos(a) * c.userData.r; c.position.z = Math.sin(a) * c.userData.r; });
    flag.rotation.y = Math.sin(t * 2) * 0.15;
    ISL.forEach((d) => { const s = d.build.userData.spin; if (s) s.rotation.y += dt * 1.2; d.marker.rotation.y += dt * 1.5; d.marker.position.y = d.build.userData.h + 1.6 + Math.sin(t * 2.4 + d.i) * 0.15; });
    newsMarker.rotation.y += dt * 1.5;
    const boat = centerObj.links.userData.boat; boat.position.y = -1.15 + Math.sin(t * 1.4) * 0.08; boat.rotation.z = Math.sin(t * 1.1) * 0.05;
    teacher.position.y = Math.abs(Math.sin(t * 2)) * 0.03;
  }
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
  camera.position.setFromSpherical(sph); camera.lookAt(0, 0, 0); controls.update();
  camera.zoom = homeZoom(); camera.updateProjectionMatrix();
  if (!RM) { camera.zoom = 0.65; camera.updateProjectionMatrix(); sph.set(80, 1.12, HOME.theta - 0.9); camera.position.setFromSpherical(sph); controls.update(); }
  refreshTimed();
  $("splash").classList.add("out");
  requestAnimationFrame(loop);
  if (!RM) setTimeout(() => { sph.set(80, HOME.phi, HOME.theta); const off = new V3().setFromSpherical(sph); camera.position.copy(controls.target).add(off); flyTo(framed(new V3(0, 0, 0), homeZoom()), homeZoom(), 1600); }, 50);
  tick(); setInterval(tick, 6000);
  setInterval(refreshTimed, 60000);
  checkNotify();
  const h = location.hash.slice(1);
  const isle = h.startsWith("isle-") && isleOf(decodeURIComponent(h.slice(5)));
  if (isle) setTimeout(() => openIsle(isle.i), 500);
  else if (["office", "deadlines", "news", "links"].includes(h)) setTimeout(() => openSpot(h), 500);
  else if (h === "passport") setTimeout(renderPassport, 500);
  else if (!LS.get("intro", false)) {
    LS.set("intro", true);
    startTalk([
      `歡迎來到體能社團行政群島！中間這座是課外組，旁邊 ${ISL.length} 座小島，每座是一種行政分類：${ISL.map((d) => d.name.replace("島", "")).join("、")}。`,
      "點一座島，資訊卡會打開，•ᴗ• 也會走過橋去幫你蓋章。島上有該分類的截止日、辦事步驟和相關公告。",
      "島的上方出現黃色或紅色菱形，代表那裡有快到的截止日。下方的「截止日」「公告」可以一次看全部。",
    ]);
  }
}
start();
