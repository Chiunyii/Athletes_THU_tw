/* 東海體能島：Three.js 互動島嶼
 * 內容全部來自 js/data.js；這個檔案只負責島嶼、角色與資訊卡。 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const D = window.SITE_DATA;
const TZ = "Asia/Taipei";
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem("thuisle:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("thuisle:" + k, JSON.stringify(v)); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2600); }

/* ---------------- 時間工具（一律台灣時間） ---------------- */
function parse(s) {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || "23"}:${m[5] || "59"}:00+08:00`) : null;
}
function tw(d) {
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
    .formatToParts(d).forEach((x) => (p[x.type] = x.value));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
const dayKey = (d) => { const p = tw(d); return Date.UTC(p.y, p.m - 1, p.d); };
const daysLeft = (due, now = new Date()) => Math.round((dayKey(due) - dayKey(now)) / 864e5);
const fmt = (d) => { const p = tw(d); return `${p.m}/${p.d}（${WEEK[p.wd]}）${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`; };
const toMin = (s) => { const [h, m] = s.split(":"); return +h * 60 + +m; };

function officeStatus(now = new Date()) {
  const h = D.office.hours, p = tw(now), cur = p.h * 60 + p.min, openToday = h.days.includes(p.wd);
  if (openToday) {
    for (let i = 0; i < h.slots.length; i++) {
      const s = toMin(h.slots[i][0]), e = toMin(h.slots[i][1]);
      if (cur >= s && cur < e) return { open: true, short: "辦公中", text: `辦公中 · ${h.slots[i][1]} 前都有人` };
      if (cur < s) return { open: false, short: i === 0 ? "尚未開門" : "午休中", text: `${i === 0 ? "尚未開始" : "午休中"} · ${h.slots[i][0]} 開始辦公` };
    }
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
let read = store.get("read", []);
let stamps = store.get("stamps", []);
let tasksDone = store.get("tasks", {});
const unreadCount = () => anns.filter((a) => !read.includes(a.id)).length;

// 每個資訊站主題對應一種建築；新增的主題會自動用小屋表示
const GUIDE_KIND = { "g-handover": "track", "g-activity": "tent", "g-money": "bank", "g-venue": "gym", "g-safety": "aid", "g-equipment": "store", "g-review": "podium" };
const places = [
  { id: "office", name: "課外組", kind: "office", desc: "辦公時間、位置" },
  { id: "deadlines", name: "截止日鐘塔", kind: "clock", desc: "所有截止日倒數" },
  { id: "news", name: "公告欄", kind: "board", desc: "學期行政公告" },
  ...D.guides.map((g) => ({ id: g.id, name: g.topic, kind: GUIDE_KIND[g.id] || "house", desc: g.title, guide: g })),
  { id: "links", name: "出航碼頭", kind: "dock", desc: "課外組網站、Linktree" },
];
const placeById = Object.fromEntries(places.map((p) => [p.id, p]));

/* ---------------- Three.js 場景 ---------------- */
const canvas = $("scene");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  $("loading").hidden = true;
  document.body.insertAdjacentHTML("beforeend", '<div class="nogl"><div class="sticker"><b>這台裝置無法顯示 3D 島嶼</b><p>可以改看文字版，內容完全相同。</p><a class="btn go" href="list.html">開啟文字版</a></div></div>');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 400);
camera.position.set(34, 30, 34);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 20;
controls.maxDistance = 75;
controls.minPolarAngle = 0.45;
controls.maxPolarAngle = 1.12;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.target.set(0, 0, 0);

const hemi = new THREE.HemisphereLight(0xdff6ff, 0x5a7a4a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dc, 2.2);
sun.position.set(18, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
sun.shadow.bias = -0.0008;
scene.add(sun);

// 依台灣時間決定天色：白天、黃昏、夜晚
function skyFor(h) {
  if (h >= 6 && h < 17) return { bg: 0xbfe9f7, sun: 2.2, hemi: 1.1, night: 0 };
  if (h >= 17 && h < 19) return { bg: 0xf6c9a4, sun: 1.4, hemi: 0.85, night: 0.5 };
  if (h === 5) return { bg: 0xcfd9f0, sun: 1.2, hemi: 0.8, night: 0.4 };
  return { bg: 0x2a4170, sun: 0.7, hemi: 0.65, night: 1 };
}
let sky = skyFor(tw(new Date()).h);
function applySky() {
  sky = skyFor(tw(new Date()).h);
  scene.background = new THREE.Color(sky.bg);
  scene.fog = new THREE.Fog(sky.bg, 90, 200);
  sun.intensity = sky.sun;
  hemi.intensity = sky.hemi;
}
applySky();

/* ---- 低多邊形小工具 ---- */
const matCache = new Map();
function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra }));
  return matCache.get(key);
}
function mesh(geo, color, x = 0, y = 0, z = 0, extra) {
  const m = new THREE.Mesh(geo, typeof color === "object" ? color : mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);
const cyl = (rt, rb, h, c, x, y, z, seg = 8) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y + h / 2, z);
const cone = (r, h, c, x, y, z, seg = 6) => mesh(new THREE.ConeGeometry(r, h, seg), c, x, y + h / 2, z);
const ball = (r, c, x, y, z, detail = 1) => mesh(new THREE.IcosahedronGeometry(r, detail), c, x, y, z);

// 畫在畫布上的招牌文字
function textPlane(w, h, draw) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * 128); cv.height = Math.round(h * 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const redraw = () => { const c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); draw(c, cv.width, cv.height); tex.needsUpdate = true; };
  redraw();
  m.userData.redraw = redraw;
  return m;
}
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const NUMFONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }

/* ---- 海洋 ---- */
const seaGeo = new THREE.PlaneGeometry(260, 260, 70, 70);
seaGeo.rotateX(-Math.PI / 2);
const seaBase = seaGeo.attributes.position.array.slice();
const sea = mesh(seaGeo, mat(0x4fb8d6, { roughness: 0.4, metalness: 0.05 }), 0, -1.1, 0);
sea.castShadow = false;
scene.add(sea);
const foam = mesh(new THREE.TorusGeometry(17.6, 0.35, 4, 40), mat(0xffffff, { transparent: true, opacity: 0.7 }), 0, -0.95, 0);
foam.rotation.x = Math.PI / 2;
foam.castShadow = false;
scene.add(foam);

/* ---- 島嶼 ---- */
const island = new THREE.Group();
scene.add(island);
const wobble = (a) => 1 + 0.055 * Math.sin(3 * a) + 0.035 * Math.sin(7 * a + 1.3);
function islandLayer(rTop, rBot, h, y, color, seg = 30) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), f = wobble(Math.atan2(z, x));
    p.setX(i, x * f); p.setZ(i, z * f);
  }
  g.computeVertexNormals();
  return mesh(g, color, 0, y, 0);
}
island.add(islandLayer(16, 15, 1.2, -0.6, 0x7cc05f));       // 草地
island.add(islandLayer(15, 12.5, 2.2, -2.3, 0x9b7653));     // 土層
island.add(islandLayer(12.5, 6, 4, -5.4, 0x7d6148));         // 島底
island.add(islandLayer(17.3, 17.6, 0.8, -1.05, 0xf1d9a0));   // 沙灘
const ground = island.children[0];

// 中央廣場與步道
const plaza = cyl(3.6, 3.6, 0.08, 0xe9dcc0, 0, 0, 0, 20);
plaza.receiveShadow = true; plaza.castShadow = false;
island.add(plaza);
const fountain = new THREE.Group();
fountain.add(cyl(1.3, 1.5, 0.5, 0xc9bfae, 0, 0, 0, 10));
fountain.add(cyl(1.05, 1.05, 0.12, 0x6fd3ec, 0, 0.45, 0, 10));
fountain.add(cyl(0.18, 0.25, 1.2, 0xc9bfae, 0, 0.5, 0));
fountain.add(ball(0.35, 0x8fe1f2, 0, 1.85, 0, 0));
island.add(fountain);
// 校旗
island.add(cyl(0.06, 0.06, 4.2, 0xdddddd, -2.6, 0, -1.2, 6));
const flag = box(1.4, 0.8, 0.04, 0x1f5fa8, -1.9, 3.2, -1.2);
island.add(flag);

/* ---- 建築物 ---- */
function buildOffice(g) {
  g.add(box(4.6, 0.3, 3.6, 0xd8d1c2, 0, 0, 0));
  g.add(box(4.2, 2.4, 3.2, 0xf7f4ec, 0, 0.3, 0));
  g.add(box(4.2, 1.2, 3.2, 0xf1ede2, 0, 2.7, 0));
  const roof = cone(3.4, 1.6, 0x2f6db5, 0, 3.9, 0, 4); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.8); g.add(roof);
  g.add(box(1, 1.6, 0.1, 0x7a5136, 0, 0.3, 1.61));
  const win = mat(0x9fd8f0, { emissive: 0xffd27a, emissiveIntensity: 0 });
  g.userData.windows = win;
  [-1.4, 1.4].forEach((x) => { g.add(mesh(new THREE.BoxGeometry(0.8, 0.7, 0.08), win, x, 1.4, 1.62)); g.add(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.08), win, x, 3.2, 1.62)); });
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.08), win, 0, 3.2, 1.62));
  const sign = textPlane(2.6, 0.7, (c, w, h) => {
    const st = officeStatus();
    roundRect(c, 4, 4, w - 8, h - 8, 18); c.fillStyle = "#1d3142"; c.fill();
    c.fillStyle = "#fff"; c.font = `900 ${h * 0.5}px ${FONT}`; c.textBaseline = "middle"; c.fillText("課外組", 22, h / 2 + 2);
    c.fillStyle = st.open ? "#5cd47b" : "#ff7b6f"; c.font = `700 ${h * 0.36}px ${FONT}`; c.textAlign = "right"; c.fillText(st.short, w - 22, h / 2 + 2);
  });
  sign.position.set(0, 2.25, 1.66);
  g.add(sign);
  g.userData.sign = sign;
  g.userData.height = 6;
}
function buildClock(g) {
  g.add(box(2.4, 0.4, 2.4, 0xcfc6b4, 0, 0, 0));
  g.add(box(1.8, 5.2, 1.8, 0xe8dfcc, 0, 0.4, 0));
  g.add(box(2.1, 0.3, 2.1, 0xb8ab93, 0, 5.6, 0));
  const r = cone(1.7, 1.8, 0xd2493a, 0, 5.9, 0, 4); r.rotation.y = Math.PI / 4; g.add(r);
  const face = textPlane(1.5, 1.5, (c, w, h) => {
    const n = upcoming()[0], d = n ? daysLeft(n.at) : null;
    c.fillStyle = "#fffbef"; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); c.fill();
    c.lineWidth = 10; c.strokeStyle = "#1d3142"; c.stroke();
    c.fillStyle = d !== null && d <= 3 ? "#d6352a" : "#1d3142"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `700 ${h * 0.44}px ${NUMFONT}`; c.fillText(d === null ? "--" : d === 0 ? "今天" : "D-" + d, w / 2, h * 0.46);
    c.fillStyle = "#5d6f78"; c.font = `700 ${h * 0.12}px ${FONT}`; c.fillText("下個截止", w / 2, h * 0.76);
  });
  face.position.set(0, 4.4, 0.92);
  g.add(face);
  g.userData.sign = face;
  g.userData.height = 8.2;
}
function buildBoard(g) {
  [-1.3, 1.3].forEach((x) => g.add(box(0.2, 2.6, 0.2, 0x8a5a3b, x, 0, 0)));
  g.add(box(3, 1.8, 0.2, 0x9c6b47, 0, 0.9, 0));
  g.add(box(3.3, 0.25, 0.5, 0x6e4329, 0, 2.7, 0));
  const notes = textPlane(2.7, 1.5, (c, w, h) => {
    c.fillStyle = "#f3e6c8"; c.fillRect(0, 0, w, h);
    const cols = ["#fff8a8", "#ffd2cc", "#cfeefc", "#d9f4c9"];
    for (let i = 0; i < 4; i++) { c.save(); c.translate(30 + i * (w - 60) / 4, 46 + (i % 2) * 26); c.rotate((i % 2 ? 1 : -1) * 0.06); c.fillStyle = cols[i]; c.fillRect(0, 0, (w - 80) / 4, h - 110); c.restore(); }
    c.fillStyle = "#1d3142"; c.font = `900 ${h * 0.2}px ${FONT}`; c.textAlign = "center"; c.fillText("公告", w / 2, h - 16);
  });
  notes.position.set(0, 1.8, 0.11);
  g.add(notes);
  g.userData.height = 4;
}
function buildTrack(g) {
  const t = mesh(new THREE.TorusGeometry(1.9, 0.45, 3, 24), 0xc4553f, 0, 0.12, 0);
  t.rotation.x = Math.PI / 2; t.scale.set(1.25, 1, 1); g.add(t);
  const inner = cyl(1.45, 1.45, 0.1, 0x5fae4f, 0, 0, 0, 20); inner.scale.set(1.3, 1, 1); g.add(inner);
  // 接力棒
  const baton = cyl(0.12, 0.12, 0.9, 0xffc83d, 1.2, 0.3, 1.4); baton.rotation.z = Math.PI / 2; g.add(baton);
  g.add(box(0.15, 1.4, 0.15, 0xffffff, -2.6, 0, 0)); g.add(box(0.7, 0.5, 0.05, 0xffffff, -2.6, 1.0, 0.1));
  g.userData.height = 2.2;
}
function buildTent(g) {
  const t = cone(2, 2.6, 0xff8a3d, 0, 0, 0, 4); t.rotation.y = Math.PI / 4; g.add(t);
  g.add(box(0.8, 1.1, 0.1, 0x7b3b14, 0, 0, 1.35));
  g.add(cyl(0.05, 0.05, 3.6, 0xdddddd, 1.6, 0, 1, 5));
  g.add(box(0.9, 0.55, 0.04, 0x2fa35a, 2.08, 2.9, 1));
  g.add(cyl(0.6, 0.6, 0.3, 0x8a5a3b, -1.8, 0, 1.3, 6));
  g.userData.height = 3.6;
}
function buildBank(g) {
  g.add(box(3.4, 0.3, 2.6, 0xd8d1c2, 0, 0, 0));
  g.add(box(3, 1.8, 2.2, 0xf5efe0, 0, 0.3, 0));
  [-1.1, -0.37, 0.37, 1.1].forEach((x) => g.add(cyl(0.14, 0.14, 1.8, 0xffffff, x, 0.3, 1.2, 6)));
  const pd = cone(2.2, 0.9, 0xe8c25a, 0, 2.1, 0, 4); pd.rotation.y = Math.PI / 4; pd.scale.set(1.1, 1, 0.8); g.add(pd);
  const coin = cyl(0.8, 0.8, 0.22, mat(0xffcf3a, { metalness: 0.4, roughness: 0.4 }), 0, 3.5, 0, 16);
  coin.rotation.x = Math.PI / 2; g.add(coin);
  g.userData.spin = coin;
  g.userData.height = 5;
}
function buildGym(g) {
  g.add(cyl(2.4, 2.5, 1.2, 0xeeeae0, 0, 0, 0, 12));
  const dome = mesh(new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x3e9f6a, 0, 1.2, 0);
  g.add(dome);
  g.add(box(1.2, 1, 0.3, 0x2a5d84, 0, 0, 2.35));
  g.add(ball(0.35, 0xff8a3d, 1.9, 0.35, 2.1, 0));
  g.userData.height = 4.2;
}
function buildAid(g) {
  g.add(box(3, 1.9, 2.4, 0xffffff, 0, 0, 0));
  g.add(box(3.2, 0.3, 2.6, 0xe5483b, 0, 1.9, 0));
  g.add(box(1, 0.3, 0.06, 0xe5483b, 0, 0.95, 1.22)); g.add(box(0.3, 1, 0.06, 0xe5483b, 0, 0.6, 1.22));
  // AED 箱
  g.add(box(0.5, 0.6, 0.25, 0x2fa35a, 1.9, 0.4, 0.6));
  g.userData.height = 3.2;
}
function buildStore(g) {
  g.add(box(3.4, 1.6, 2.4, 0x9db4c0, 0, 0, 0));
  const roof = mesh(new THREE.CylinderGeometry(1.25, 1.25, 3.5, 10, 1, false, 0, Math.PI), 0x5b7f95, 0, 1.6, 0);
  roof.rotation.z = Math.PI / 2; g.add(roof);
  g.add(box(1.4, 1.2, 0.08, 0x3c5566, 0, 0, 1.21));
  g.add(ball(0.32, 0xff8a3d, -1.6, 0.32, 1.7, 0)); g.add(ball(0.3, 0xffffff, -1.0, 0.3, 1.9, 0)); g.add(ball(0.28, 0xf5d547, -1.3, 0.28, 2.4, 0));
  g.userData.height = 3.4;
}
function buildPodium(g) {
  g.add(box(1, 1.4, 1, 0xffd34d, 0, 0, 0)); g.add(box(1, 0.9, 1, 0xd9dfe6, -1.05, 0, 0)); g.add(box(1, 0.6, 1, 0xd99a62, 1.05, 0, 0));
  const gold = mat(0xffc83d, { metalness: 0.5, roughness: 0.35 });
  g.add(cyl(0.18, 0.28, 0.2, gold, 0, 1.4, 0)); g.add(cyl(0.06, 0.06, 0.3, gold, 0, 1.6, 0));
  const cup = cyl(0.42, 0.18, 0.55, gold, 0, 1.9, 0); g.add(cup);
  g.userData.spin = cup;
  g.userData.height = 3.4;
}
function buildHouse(g) {
  g.add(box(2.4, 1.6, 2, 0xf6efe0, 0, 0, 0));
  const r = cone(2, 1.2, 0x4a8fd0, 0, 1.6, 0, 4); r.rotation.y = Math.PI / 4; g.add(r);
  g.add(box(0.7, 1, 0.08, 0x7a5136, 0, 0, 1.02));
  g.userData.height = 3.4;
}
function buildDock(g) {
  for (let i = 0; i < 5; i++) g.add(box(1.6, 0.18, 0.9, 0xb98a5e, 0, -0.3, -i * 0.95));
  [-0.75, 0.75].forEach((x) => [0, -2, -3.8].forEach((z) => g.add(cyl(0.1, 0.1, 1.4, 0x8a5a3b, x, -1.4, z, 5))));
  const boat = new THREE.Group();
  const hull = box(1.2, 0.6, 2.8, 0xe5483b, 0, 0, 0); boat.add(hull);
  boat.add(box(1, 0.1, 2.5, 0xf5ead2, 0, 0.6, 0));
  boat.add(cyl(0.05, 0.05, 2.4, 0xdddddd, 0, 0.6, 0.1, 5));
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.8, 0.2, 0, 2.9, 0.2, 0, 0.8, 1.4], 3));
  sailGeo.computeVertexNormals();
  boat.add(mesh(sailGeo, mat(0xffffff, { side: THREE.DoubleSide })));
  boat.position.set(1.7, -1.1, -2.6);
  g.add(boat);
  g.userData.boat = boat;
  g.userData.height = 3;
}
const BUILDERS = { office: buildOffice, clock: buildClock, board: buildBoard, track: buildTrack, tent: buildTent, bank: buildBank, gym: buildGym, aid: buildAid, store: buildStore, podium: buildPodium, house: buildHouse, dock: buildDock };

// 放置：環狀排列，正面朝向中央廣場
const ring = places.filter((p) => p.kind !== "dock");
const R = 10.2;
const clickables = [];
ring.forEach((p, i) => {
  const a = (-3 * Math.PI) / 4 + (i * 2 * Math.PI) / ring.length;
  p.pos = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
});
{
  const dock = placeById.links;
  const a = -Math.PI / 4 + Math.PI / ring.length; // 畫面右側，避免被下方按鈕列擋住
  dock.pos = new THREE.Vector3(Math.cos(a) * 16.4, 0, Math.sin(a) * 16.4);
  dock.walkTo = new THREE.Vector3(Math.cos(a) * 14.2, 0, Math.sin(a) * 14.2);
}
places.forEach((p) => {
  const g = new THREE.Group();
  BUILDERS[p.kind](g);
  g.position.copy(p.pos);
  g.lookAt(0, 0, 0); // 建築的 +z 正面朝向中央廣場；碼頭沿 -z 伸向海面
  g.traverse((o) => { if (o.isMesh) o.userData.placeId = p.id; });
  island.add(g);
  p.group = g;
  if (!p.walkTo) p.walkTo = p.pos.clone().multiplyScalar((R - 3) / R);
  clickables.push(g);
  // 步道
  if (p.kind !== "dock") {
    const len = R - 3.6 - 2.2;
    const path = box(1.1, 0.06, len, 0xe9dcc0, 0, 0, 0);
    path.castShadow = false;
    const mid = p.pos.clone().normalize().multiplyScalar(3.6 + len / 2);
    path.position.set(mid.x, 0, mid.z);
    path.lookAt(0, 0, 0);
    island.add(path);
  }
});

/* ---- 樹、石頭、雲 ---- */
function rand(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const rnd = rand(7);
const blocked = (x, z) => Math.hypot(x, z) < 5 || places.some((p) => p.pos.distanceTo(new THREE.Vector3(x, 0, z)) < 3.4) ||
  ring.some((p) => { // 避開步道
    const dir = p.pos.clone().normalize(), v = new THREE.Vector3(x, 0, z), t = v.dot(dir);
    return t > 0 && t < R && v.clone().sub(dir.multiplyScalar(t)).length() < 1.2;
  });
let trees = 0;
for (let i = 0; i < 400 && trees < 46; i++) {
  const a = rnd() * Math.PI * 2, r = 4 + rnd() * 10.8, x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (r > 14.6 * wobble(a) || blocked(x, z)) continue;
  const t = new THREE.Group(), s = 0.7 + rnd() * 0.6;
  t.add(cyl(0.12, 0.16, 0.7, 0x7a5136, 0, 0, 0, 5));
  if (rnd() > 0.45) { t.add(cone(0.75, 1.5, 0x3f9a52, 0, 0.6, 0, 6)); t.add(cone(0.55, 1.1, 0x4fb062, 0, 1.4, 0, 6)); }
  else t.add(ball(0.75, [0x5bb46a, 0x7cc05f, 0x8fcf6a][Math.floor(rnd() * 3)], 0, 1.3, 0, 0));
  t.scale.setScalar(s);
  t.position.set(x, 0, z);
  t.rotation.y = rnd() * 6;
  island.add(t);
  trees++;
}
for (let i = 0; i < 10; i++) {
  const a = rnd() * Math.PI * 2, r = 16.2 + rnd() * 1.2;
  const rock = ball(0.3 + rnd() * 0.5, 0x9aa3a6, Math.cos(a) * r, -0.8, Math.sin(a) * r, 0);
  island.add(rock);
}
const clouds = [];
for (let i = 0; i < 7; i++) {
  const c = new THREE.Group();
  const n = 3 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) { const b = ball(1 + rnd() * 1.1, mat(0xffffff, { roughness: 1, emissive: 0x9aaabb, emissiveIntensity: 0.45 }), k * 1.3, rnd() * 0.6, rnd() * 0.8, 0); b.castShadow = false; c.add(b); }
  // 雲沿著島外圍繞圈，不會飄到鏡頭前
  c.userData.r = 30 + rnd() * 14; c.userData.a = rnd() * Math.PI * 2; c.userData.speed = 0.012 + rnd() * 0.012;
  c.position.y = 3 + rnd() * 3; // 低空雲在視線下方，不會擋住島
  c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r;
  scene.add(c);
  clouds.push(c);
}

/* ---- 提醒標記（漂浮的菱形） ---- */
const markers = {};
function marker(id, color) {
  const m = mesh(new THREE.OctahedronGeometry(0.45, 0), mat(color, { emissive: color, emissiveIntensity: 0.35 }));
  m.castShadow = false;
  const p = placeById[id];
  m.position.set(p.pos.x, (p.group.userData.height || 4) + 0.9, p.pos.z);
  island.add(m);
  markers[id] = m;
  return m;
}
marker("deadlines", 0xffc83d);
marker("news", 0xe5483b);
function updateMarkers() {
  const n = upcoming()[0], d = n ? daysLeft(n.at) : 99;
  markers.deadlines.visible = d <= 7;
  markers.deadlines.material = mat(d <= 3 ? 0xe5483b : 0xffc83d, { emissive: d <= 3 ? 0xe5483b : 0xffc83d, emissiveIntensity: 0.35 });
  markers.news.visible = unreadCount() > 0;
}

/* ---- 角色（新任幹部）與老師 ---- */
function person(shirt, hair) {
  const g = new THREE.Group();
  g.add(cyl(0.1, 0.1, 0.45, 0x2b3a4a, -0.13, 0, 0, 6)); g.add(cyl(0.1, 0.1, 0.45, 0x2b3a4a, 0.13, 0, 0, 6));
  g.add(cyl(0.3, 0.34, 0.65, shirt, 0, 0.42, 0, 8));
  g.add(ball(0.3, 0xf2c9a0, 0, 1.38, 0, 1));
  const h = ball(0.32, hair, 0, 1.5, -0.04, 1); h.scale.set(1, 0.7, 1); g.add(h);
  g.add(box(0.09, 0.09, 0.02, 0x1d3142, -0.11, 1.36, 0.28)); g.add(box(0.09, 0.09, 0.02, 0x1d3142, 0.11, 1.36, 0.28));
  return g;
}
const player = person(0x2f6db5, 0x2b2118);
player.add(box(0.36, 0.2, 0.02, 0xffffff, 0, 0.72, 0.31)); // 背號
player.position.set(0, 0.08, 4.4);
island.add(player);
const teacher = person(0x3f9a52, 0x55463a);
teacher.position.set(2.6, 0.08, 1.4);
teacher.rotation.y = -0.6;
teacher.traverse((o) => { if (o.isMesh) o.userData.placeId = "teacher"; });
island.add(teacher);
clickables.push(teacher);

/* ---------------- 3D 標籤 ---------------- */
const labelsEl = $("labels");
const labelOf = {};
places.forEach((p) => {
  const el = document.createElement("div");
  el.className = "label";
  el.innerHTML = `<span class="stamp"></span>${esc(p.name)}`;
  el.addEventListener("click", () => goTo(p.id));
  labelsEl.appendChild(el);
  labelOf[p.id] = el;
});
function refreshLabels() { places.forEach((p) => labelOf[p.id].classList.toggle("done", stamps.includes(p.id))); }
const tmpV = new THREE.Vector3();
function placeLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  places.forEach((p) => {
    tmpV.set(p.pos.x, (p.group.userData.height || 4) + 0.3, p.pos.z).applyMatrix4(island.matrixWorld).project(camera);
    const el = labelOf[p.id];
    const behind = tmpV.z > 1;
    el.classList.toggle("hidden", behind);
    el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
  });
}

/* ---------------- 互動：點擊與行走 ---------------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let down = null, walkTarget = null, pendingPlace = null, focus = null;
function pick(e) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(clickables, true)[0];
  if (hit) return { id: hit.object.userData.placeId };
  const g = ray.intersectObject(ground, false)[0];
  return g ? { point: island.worldToLocal(g.point.clone()) } : null;
}
canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; stopIntro(); });
canvas.addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
  down = null;
  const p = pick(e);
  if (!p) return;
  if (p.id === "teacher") return startTalk(TEACHER_TIPS());
  if (p.id) return goTo(p.id);
  const v = p.point.setY(0);
  if (v.length() > 7.6) v.setLength(7.6); // 角色只在內圈活動，避免穿過建築
  walkTarget = v; pendingPlace = null;
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || e.buttons) return;
  const p = pick(e);
  canvas.classList.toggle("pointer", !!(p && p.id));
});
function stopIntro() { controls.autoRotate = false; $("hint").hidden = true; }

function goTo(id) {
  const p = placeById[id];
  if (!p) return;
  stopIntro();
  closePanel(true);
  focus = p.pos.clone().multiplyScalar(0.45);
  if (player.position.distanceTo(p.walkTo) < 0.6) return arrive(p);
  walkTarget = p.walkTo.clone();
  pendingPlace = p;
}
function arrive(p) {
  player.lookAt(p.pos.x, player.position.y, p.pos.z);
  openPlace(p.id);
  if (!stamps.includes(p.id)) {
    stamps.push(p.id); store.set("stamps", stamps); refreshLabels(); updateHud();
    toast(`蓋到「${p.name}」的章了！（${stamps.length}/${places.length}）`);
    if (stamps.length === places.length) celebrate();
  }
}

/* ---------------- 資訊卡 ---------------- */
const panel = $("panel");
let panelOpen = null;
function showPanel(kicker, title, html, id) {
  $("pKicker").textContent = kicker; $("pTitle").textContent = title; $("pBody").innerHTML = html;
  panel.hidden = false; panelOpen = id;
  $("pBody").scrollTop = 0;
  try { history.replaceState(null, "", "#" + id); } catch {}
}
function closePanel(silent) {
  panel.hidden = true; panelOpen = null;
  if (!silent) try { history.replaceState(null, "", location.pathname); } catch {}
}
$("pClose").addEventListener("click", () => closePanel());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closePanel(); $("talk").hidden = true; } });

const stampLine = (id) => (stamps.includes(id) ? '<span class="stamped">已蓋章</span>' : "");
function gcal(x) {
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("【截止】" + x.title) +
    "&dates=" + z(new Date(x.at - 18e5)) + "/" + z(x.at) + "&ctz=" + TZ + "&details=" + encodeURIComponent((x.detail || "") + "\n" + (x.link || D.links.schedule));
}
function icsFor(list) {
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const e = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//THU Athletic Clubs//ZH-TW", "X-WR-CALNAME:東海體能性社團截止日"];
  list.forEach((x) => L.push("BEGIN:VEVENT", `UID:${x.id}@thuathletic`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(new Date(x.at - 18e5))}`, `DTEND:${z(x.at)}`,
    `SUMMARY:${e("【截止】" + x.title)}`, `DESCRIPTION:${e((x.detail || "") + "\n" + (x.link || D.links.schedule))}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e("3 天後截止：" + x.title)}`, "TRIGGER:-P3D", "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e("明天截止：" + x.title)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT"));
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
function download(name, text) {
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast("已下載行事曆檔，開啟即可加入");
  } catch { toast("無法下載，請改用「Google 日曆」按鈕"); }
}
const subUrl = () => location.protocol === "https:" ? "webcal://" + location.host + location.pathname.replace(/[^/]*$/, "") + "calendar.ics" : "calendar.ics";

function deadlineHtml(list) {
  if (!list.length) return '<p class="muted">目前沒有待辦的截止日。</p>';
  return '<ul class="dl">' + list.map((x) => {
    const n = daysLeft(x.at), lvl = n <= 3 ? "hot" : n <= 7 ? "warn" : "ok";
    return `<li class="lvl-${lvl}"><div class="days"><b class="num">${n === 0 ? "今" : n}</b><small>${n === 0 ? "今天截止" : "天後"}</small></div><div>
      <h3>${esc(x.title)}</h3><div class="meta"><span>${fmt(x.at)}</span><span class="tag">${esc(x.category)}</span></div>
      ${x.detail ? `<p>${esc(x.detail)}</p>` : ""}
      <div class="row"><a class="btn" target="_blank" rel="noopener" href="${esc(gcal(x))}">Google 日曆</a><button class="btn" type="button" data-ics="${esc(x.id)}">iPhone／其他</button>
      ${x.link ? `<a class="btn" target="_blank" rel="noopener" href="${esc(x.link)}">相關文件</a>` : ""}</div></div></li>`;
  }).join("") + "</ul>";
}

const VIEWS = {
  office() {
    const st = officeStatus(), p = tw(new Date());
    const slots = D.office.hours.slots.map((s) => s.join("–")).join("、");
    const rows = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
      const on = D.office.hours.days.includes(wd);
      return `<tr class="${wd === p.wd ? "today" : ""}"><td>週${WEEK[wd]}${wd === p.wd ? "（今天）" : ""}</td><td class="${on ? "" : "muted"}">${on ? slots : "不辦公"}</td></tr>`;
    }).join("");
    return ["學務處", D.office.name, `${stampLine("office")}
      <div class="big-status"><span class="lamp ${st.open ? "on" : "off"}"></span>${esc(st.text)}</div>
      <table class="week"><tbody>${rows}</tbody></table>
      <div class="box"><b>位置與導航</b><p class="muted">${esc(D.office.locationNote)}</p>
      <div class="row" style="margin-top:8px">${D.office.mapUrl ? `<a class="btn go" target="_blank" rel="noopener" href="${esc(D.office.mapUrl)}">開啟 Google 地圖導航</a>` : '<span class="tag">導航建置中</span>'}
      <a class="btn" target="_blank" rel="noopener" href="${esc(D.links.office)}">課外組網站</a></div></div>
      <div><b>洽公小提醒</b><ul class="tips">${D.office.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`];
  },
  deadlines() {
    return ["截止日鐘塔", "截止日提醒", `${stampLine("deadlines")}
      <p class="muted">7 天內轉黃、3 天內轉紅。訂閱行事曆後，新的截止日會自動出現在手機，並在截止前 3 天、1 天提醒。</p>
      <div class="row"><a class="btn go" href="${esc(subUrl())}">訂閱社團行事曆</a><button class="btn" type="button" data-ics="all">全部加入行事曆</button><button class="btn" type="button" id="notifyBtn">開啟網頁通知</button></div>
      ${deadlineHtml(upcoming())}
      <p class="muted">正式期程以 <a target="_blank" rel="noopener" href="${esc(D.links.schedule)}">體能性社團作業期程表</a> 為準。</p>`];
  },
  news() {
    const html = '<ul class="news">' + anns.map((a) => `<li><h3>${a.pinned ? '<span class="pin">置頂</span>' : ""}${!read.includes(a.id) ? '<span class="new">NEW</span>' : ""}${esc(a.title)}</h3>
      <div class="meta"><span>${esc(a.date)}</span><span class="tag">${esc(a.tag)}</span></div><p>${esc(a.body)}</p></li>`).join("") + "</ul>";
    read = anns.map((a) => a.id); store.set("read", read); updateHud(); updateMarkers();
    return ["公告欄", "行政公告", stampLine("news") + html];
  },
  links() {
    return ["出航碼頭", "常用連結", `${stampLine("links")}
      <p class="muted">從這裡出航，前往課外組的其他平台。</p>
      <div class="places">
        <a class="btn" target="_blank" rel="noopener" href="${esc(D.links.office)}">課外組網站</a>
        <a class="btn" target="_blank" rel="noopener" href="${esc(D.links.schedule)}">作業期程表</a>
        <a class="btn" target="_blank" rel="noopener" href="${esc(D.links.linktree)}">體能性社團 Linktree</a>
        <a class="btn" href="list.html">本站文字版</a>
      </div>`];
  },
  map() {
    return ["島嶼地圖", "要去哪裡？", '<div class="places">' + places.map((p) =>
      `<button type="button" data-go="${esc(p.id)}"><b>${esc(p.name)}</b><span>${esc(p.desc)}</span>${stamps.includes(p.id) ? '<span class="ok">已蓋章</span>' : ""}</button>`).join("") + "</div>"];
  },
  search() {
    return ["搜尋", "找行政流程或公告", `<label class="muted" for="q">輸入關鍵字</label><input id="q" class="search" type="search" placeholder="例如：保險、核銷、場地" autocomplete="off"><div class="results" id="results"></div>`];
  },
  book() {
    const n = stamps.length, total = places.length, t = D.onboarding.filter((x) => tasksDone[x]).length;
    return ["新任幹部", "集章本與上任清單", `<div><b>走訪集章 ${n}/${total}</b><div class="progress" style="margin-top:6px"><i style="width:${(n / total) * 100}%"></i></div></div>
      <div class="stamps">${places.map((p) => `<button type="button" class="stampcell ${stamps.includes(p.id) ? "done" : ""}" data-go="${esc(p.id)}"><i>${stamps.includes(p.id) ? "東海" : ""}</i>${esc(p.name)}</button>`).join("")}</div>
      <div><b>上任清單 <span id="taskN">${t}/${D.onboarding.length}</span></b><p class="muted">勾選紀錄只存在你自己的手機或電腦。</p></div>
      <ul class="tasks">${D.onboarding.map((x, i) => `<li><label for="task${i}"><input type="checkbox" id="task${i}" data-task="${i}" ${tasksDone[x] ? "checked" : ""}><span>${esc(x)}</span></label></li>`).join("")}</ul>
      <button class="btn" type="button" id="resetStamps">重新集章</button>`];
  },
};
function guideView(p) {
  const g = p.guide;
  return [g.topic, g.title, `${stampLine(p.id)}<p>${esc(g.summary)}</p>
    <div class="box"><b>步驟</b><ol class="steps">${g.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
    ${g.links?.length ? `<div class="row">${g.links.map((l) => `<a class="btn" target="_blank" rel="noopener" href="${esc(l[1])}">${esc(l[0])}</a>`).join("")}</div>` : ""}
    <p class="muted">還有問題？請在辦公時間到課外組詢問。</p>`];
}
function openPlace(id) {
  const p = placeById[id];
  const v = VIEWS[id] ? VIEWS[id]() : p?.guide ? guideView(p) : null;
  if (!v) return;
  showPanel(v[0], v[1], v[2], id);
  if (id === "deadlines") renderNotifyBtn();
}
function openMenu(id) {
  if (placeById[id]) return goTo(id);
  stopIntro();
  const v = VIEWS[id]();
  showPanel(v[0], v[1], v[2], id);
  if (id === "search") { const q = $("q"); q.focus(); q.addEventListener("input", runSearch); runSearch(); }
}
function hl(text, q) { const s = esc(text); return q ? s.split(esc(q)).join(`<mark>${esc(q)}</mark>`) : s; }
function runSearch() {
  const q = $("q").value.trim();
  const out = [];
  if (q) {
    D.guides.forEach((g) => { const all = g.topic + g.title + g.summary + g.steps.join(""); if (all.includes(q)) out.push({ go: g.id, t: g.title, s: g.topic + "｜" + (g.steps.find((x) => x.includes(q)) || g.summary) }); });
    anns.forEach((a) => { if ((a.title + a.body).includes(q)) out.push({ go: "news", t: a.title, s: "公告｜" + a.body }); });
    deadlines.forEach((d) => { if ((d.title + (d.detail || "")).includes(q)) out.push({ go: "deadlines", t: d.title, s: "截止日｜" + fmt(d.at) }); });
  }
  $("results").innerHTML = !q ? '<p class="muted">可搜尋資訊站主題、公告與截止日。</p>' : out.length
    ? out.map((r) => `<button type="button" data-go="${esc(r.go)}"><b>${hl(r.t, q)}</b><small>${hl(r.s, q)}</small></button>`).join("")
    : `<p class="muted">找不到「${esc(q)}」。可以到課外組辦公時間當面詢問。</p>`;
}
$("pBody").addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go) return goTo(go.dataset.go);
  const ics = e.target.closest("[data-ics]");
  if (ics) {
    if (ics.dataset.ics === "all") return download("東海體能性社團截止日.ics", icsFor(upcoming()));
    const x = deadlines.find((d) => d.id === ics.dataset.ics);
    return x && download(x.id + ".ics", icsFor([x]));
  }
  if (e.target.id === "notifyBtn") return askNotify();
  if (e.target.id === "resetStamps") { stamps = []; store.set("stamps", stamps); refreshLabels(); updateHud(); openMenu("book"); toast("集章已重設"); }
});
$("pBody").addEventListener("change", (e) => {
  const i = e.target.dataset.task;
  if (i === undefined) return;
  tasksDone[D.onboarding[+i]] = e.target.checked; store.set("tasks", tasksDone);
  const t = D.onboarding.filter((x) => tasksDone[x]).length;
  $("taskN").textContent = `${t}/${D.onboarding.length}`;
  if (t === D.onboarding.length) toast("上任清單全部完成！");
});
document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openMenu(b.dataset.open)));
$("chipOffice").addEventListener("click", () => goTo("office"));
$("chipNext").addEventListener("click", () => goTo("deadlines"));

/* ---------------- 網頁通知 ---------------- */
function renderNotifyBtn() {
  const b = $("notifyBtn"); if (!b) return;
  if (!("Notification" in window)) { b.hidden = true; return; }
  if (Notification.permission === "granted") { b.textContent = "網頁通知已開啟"; b.disabled = true; }
  if (Notification.permission === "denied") { b.textContent = "通知已被封鎖"; b.disabled = true; }
}
function askNotify() {
  try {
    Notification.requestPermission().then((p) => { renderNotifyBtn(); if (p === "granted") { toast("已開啟網頁通知"); checkNotify(); } else toast("沒有開啟通知，仍可訂閱行事曆"); })
      .catch(() => toast("此環境無法開啟通知，請訂閱行事曆"));
  } catch { toast("此環境無法開啟通知，請訂閱行事曆"); }
}
function checkNotify() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const today = dayKey(new Date());
  if (store.get("notified", 0) === today) return;
  upcoming().filter((x) => daysLeft(x.at) <= 3).forEach((x) => {
    const n = daysLeft(x.at);
    try { new Notification(n === 0 ? "今天截止" : `${n} 天後截止`, { body: `${x.title}｜${fmt(x.at)}` }); } catch {}
  });
  store.set("notified", today);
}

/* ---------------- 老師對話 ---------------- */
let talkQueue = [];
function TEACHER_TIPS() {
  const n = upcoming()[0], st = officeStatus();
  const lines = [];
  if (n) lines.push(`最近的截止日是「${n.title}」，還有 ${daysLeft(n.at)} 天，${fmt(n.at)} 截止。去鐘塔可以一鍵加入行事曆。`);
  if (unreadCount()) lines.push(`公告欄有 ${unreadCount()} 則你還沒看過的公告，記得去看看。`);
  lines.push(`課外組現在${st.text}。週一至週五 9:00–12:00、13:30–17:00 都可以來找我們。`);
  return lines;
}
function startTalk(lines) { talkQueue = lines.slice(); nextTalk(); }
function nextTalk() {
  const t = $("talk");
  if (!talkQueue.length) { t.hidden = true; return; }
  $("talkText").textContent = talkQueue.shift();
  $("talkNext").textContent = talkQueue.length ? "下一句" : "開始探索";
  t.hidden = false;
}
$("talkNext").addEventListener("click", nextTalk);

/* ---------------- HUD ---------------- */
function updateHud() {
  const st = officeStatus();
  $("lamp").className = "lamp " + (st.open ? "on" : "off");
  $("officeText").textContent = "課外組 " + st.short;
  const n = upcoming()[0];
  if (n) { const d = daysLeft(n.at); $("nextDays").textContent = d === 0 ? "今天" : d; $("nextUnit").textContent = d === 0 ? "" : "天"; }
  else { $("nextDays").textContent = "無"; $("nextUnit").textContent = ""; }
  const u = unreadCount();
  $("unread").hidden = !u; $("unread").textContent = u;
  $("stampCount").textContent = `${stamps.length}/${places.length}`;
  $("term").textContent = D.term + (D.isSample ? "・範例資料" : "");
}
function refreshTimed() {
  applySky();
  const office = placeById.office.group.userData;
  office.windows.emissiveIntensity = officeStatus().open ? 0.25 + sky.night * 0.6 : sky.night * 0.15;
  office.sign.userData.redraw();
  placeById.deadlines.group.userData.sign.userData.redraw();
  updateHud(); updateMarkers();
}
function celebrate() {
  const c = document.createElement("div"); c.className = "confetti";
  const cols = ["#ffc83d", "#e5483b", "#3f9a52", "#2f6db5", "#ffffff"];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "%"; p.style.background = cols[i % cols.length];
    p.style.animationDelay = Math.random() * 0.8 + "s";
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 4000);
  setTimeout(() => startTalk(["恭喜！整座島都走過一遍了，你已經是合格的新任幹部。", "之後有新公告或截止日，島上會出現漂浮的提醒標記，記得常回來看看。"]), 900);
}

/* ---------------- 動畫迴圈 ---------------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 600 ? 50 : 34;
  camera.updateProjectionMatrix();
  // 手機直式畫面拉遠一點，讓整座島放得下
  const want = w < 600 ? 62 : 56;
  if (!resize.done) { camera.position.setLength(want); resize.done = true; }
}
window.addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduce) controls.autoRotate = false;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  // 海浪
  if (!reduce) {
    const a = seaGeo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = seaBase[i * 3], z = seaBase[i * 3 + 2];
      a.setY(i, Math.sin(x * 0.18 + t * 0.9) * 0.18 + Math.cos(z * 0.22 + t * 0.7) * 0.16);
    }
    a.needsUpdate = true;
    seaGeo.computeVertexNormals();
    foam.scale.setScalar(1 + Math.sin(t * 1.2) * 0.012);
    clouds.forEach((c) => { c.userData.a += c.userData.speed * dt; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r; });
    flag.rotation.y = Math.sin(t * 2) * 0.15;
    places.forEach((p) => { const s = p.group.userData.spin; if (s) s.rotation.y += dt * 1.2; });
    const boat = placeById.links.group.userData.boat;
    boat.position.y = -1.1 + Math.sin(t * 1.4) * 0.08; boat.rotation.z = Math.sin(t * 1.1) * 0.05;
    Object.values(markers).forEach((m, i) => { m.rotation.y += dt * 1.5; m.position.y += Math.sin(t * 2.5 + i) * 0.004; });
  }
  // 角色行走
  if (walkTarget) {
    const dir = walkTarget.clone().sub(player.position).setY(0), dist = dir.length();
    if (dist < 0.08) {
      walkTarget = null; player.position.y = 0.08;
      if (pendingPlace) { const p = pendingPlace; pendingPlace = null; arrive(p); }
    } else {
      const step = Math.min(dist, 7 * dt);
      player.position.add(dir.normalize().multiplyScalar(step));
      player.rotation.y = Math.atan2(dir.x, dir.z);
      player.position.y = 0.08 + Math.abs(Math.sin(t * 14)) * 0.12;
    }
  }
  teacher.position.y = 0.08 + Math.abs(Math.sin(t * 2)) * 0.03;
  if (focus) { controls.target.lerp(focus, 0.06); if (controls.target.distanceTo(focus) < 0.02) focus = null; }
  controls.update();
  renderer.render(scene, camera);
  placeLabels();
  requestAnimationFrame(tick);
}

/* ---------------- 啟動 ---------------- */
async function start() {
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch {}
  refreshTimed(); refreshLabels();
  $("loading").hidden = true;
  tick();
  setInterval(refreshTimed, 60000);
  checkNotify();
  const hash = location.hash.slice(1);
  if (hash && (placeById[hash] || VIEWS[hash])) setTimeout(() => openMenu(hash), 400);
  else if (!store.get("intro", false)) {
    store.set("intro", true);
    startTalk([
      "歡迎來到東海體能島！我是課外組老師。新任幹部要知道的行政資訊，都藏在島上的建築裡。",
      "點一下建築物，你的角色就會走過去，打開資訊卡並蓋一個章。集滿全部的章，就完成上任認證。",
      "漂浮的黃色或紅色菱形代表「快截止」或「有新公告」。找不到路的話，可以用下方的「地圖」和「搜尋」。",
    ]);
  }
}
start();
