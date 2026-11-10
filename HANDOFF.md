# 交接說明：CLUB ON. 體能行政群島

給接手的 Claude 對話（或助理）閱讀。開新對話時，請先說：

> 請閱讀 Chiunyii/Athletes_THU_tw 儲存庫的 HANDOFF.md 與 README.md，接續更新體能行政群島網站。

---

## 1. 這是什麼

- 東海大學學務處課外組「體能性社團」幹部用的 3D 互動行政資訊站，維護者是輔導老師峮老師（課外組）。
- **GitHub 儲存庫**：`Chiunyii/Athletes_THU_tw`，分支 `main`
- **正式網站**（GitHub Pages）：https://chiunyii.github.io/Athletes_THU_tw/
- **文字版**：https://chiunyii.github.io/Athletes_THU_tw/list.html
- **Claude 預覽頁（Artifact）**：https://claude.ai/artifact/C2YY3SEAbruue3vwzW9uF9（新對話用 Artifact 工具 `url` 參數更新同一個連結；先 `read` 再發布）
- 推送到 `main` 約 1 分鐘後自動部署（`.github/workflows/pages.yml`）。

## 2. 檔案

| 檔案 | 內容 |
|---|---|
| `js/sheet.js`、`js/sheet-snapshot.js`、`scripts/build-sheet.js` | Google 試算表公告：網站開啟時讀試算表（`data.sheet.csvUrl`），讀不到用部署時的備份；`pages.yml` 每 3 小時重新部署更新備份與行事曆。 |
| `js/data.js` | **所有內容**：各館、攻略、截止日、公告、行政任務、課外組資訊、角色職位、上任清單。日常更新只改這裡。 |
| `js/game.js` | Three.js 3D 群島（建築造型、小島、角色、名牌、資訊卡）。 |
| `index.html` | 主頁外殼與 CSS（字體：Zen Maru Gothic＋Noto Sans TC；「CLUB ON.」標誌用 Archivo）。 |
| `list.html` | 文字版（不需 3D）。 |
| `scripts/build-ics.js` | 部署時產生 `calendar.ics`（可訂閱行事曆，只含未過期截止日）。 |
| `scripts/typhoon.js` + `.github/workflows/typhoon.yml` | 每 30 分鐘抓人事行政總處臺中市停班公告 → `typhoon.json`，辦公時間自動標示「颱風假」。 |
| `scripts/security-check.js` + `.github/workflows/security.yml` | 每日 08:23 與每次推送跑資安檢查＋gitleaks。 |
| `scripts/build-preview.py` | 產生單檔預覽頁給 Artifact：`python3 scripts/build-preview.py <輸出.html>` |
| `README.md` | 完整功能說明。 |

另有 Claude 排程任務「每日資安檢查」（每天 08:53，推播報告到手機）。

## 3. 群島與各館（`data.js` 的 `islands`）

| 編號 | key | 館名 | 位置 | 造型 |
|---|---|---|---|---|
| 01 | 會議 | 期初會議館 | 本島 | 小學教室課桌椅 |
| 02 | 行政 | 社團行政館 | 行政島 | 服務台；只放社團行政任務打勾清單（`tasks: true`） |
| 03 | 活動 | 社團活動館 | 活動島 | 嘉年華旋轉木馬 |
| 04 | 經費 | 經費館 | 本島 | 計算機與硬幣；上方六顆跳轉按鈕（`jump`） |
| 05 | 場地 | 場地借用館 | 場地器材島 | 銘賢堂 |
| 06 | 安全 | 活動安全館 | 活動島 | 急救站 |
| 07 | 器材 | 器材借用館 | 場地器材島 | 舞台音響與組裝人員 |
| 08 | 評鑑 | 評鑑館 | 行政島 | 處理檔案的角色 |
| 09 | 交接 | 交接館 | 行政島 | 新舊幹部交接 |
| 10 | 財產 | 財產盤點館 | 行政島 | 貨架盤點 |
| 11 | 競賽 | 校外競賽館 | 校外競賽群島（由行政島延伸） | 頒獎台 |
| 12 | 培力 | 社團培力館 | 社團培力島 | 工作坊帳篷；**課外組辦的活動公告放這裡** |

本島另有：課外組峮老師巨型角色（含橘白貓、灰白貓）、路思義教堂（純造景）、公告欄、小秘書啊牛（「啊牛提醒」＝截止日清單）、出航機場（常用連結）、東海風格路牌、各種運動角色與海邊游泳／自由潛水。

## 4. 日常更新怎麼做

### 新增公告（最常見）
**老師自己可以在 Google 試算表新增**（「CLUB ON. 體能行政群島｜公告」，https://docs.google.com/spreadsheets/d/1TVEPkoI6d9qH9IQLxsjPA-HFE49DEOzyYjuW-yr5LC0/edit，欄位見 README「用 Google 試算表發公告」）。老師請 Claude 代為上架時，可以加在試算表（Google Drive 工具）或照下面的方式加在 `data.js`；多個截止日、`dueDetail` 等複雜公告只能放 `data.js`。

在 `js/data.js` 的 `announcements:` 陣列**最上方**（註解行之後）加一筆，最新的放最上面：

```js
{
  id: "a-1151-xxxx",            // 不可重複；課外組公告用網址的 id，活動用 ev-活動編號
  tag: "培力",                  // 對應館的 key；課外組辦的活動用 "培力"
  title: "公告標題",
  body: "內文（可省略）\n可以用 \\n 換行，表情符號 OK",
  link: "https://…",           // 可省略
  linkText: "活動資訊與報名",    // 可省略，預設「查看公告」
  due: "2026-12-01 17:00",      // 可省略；有截止日就會自動進啊牛提醒、館上 D-倒數、行事曆
  dueTitle: "截止日顯示名稱",    // 可省略
},
```
- 多個期限用 `dues: [{ due, title, link }]`；只想顯示在截止日、不想在公告欄出現的細節用 `dueDetail`。
- 已過期的截止日會自動收進「顯示已截止項目」，不必刪除。
- 只有日期沒時間 → 當天 23:59。

### 其他
- 截止日（非公告）：`deadlines` 陣列。
- 各館說明：`islands` 裡的 `lead`（問題標題）、`tagline`（引言）、`links`（上方大按鈕；`linkSize: "small"` 變一般大小）。
- 攻略：`guides`（`island` 對應館 key；`links` 第三項可放按鈕下方小字補充）。
- 行政任務打勾清單：`todos`（common / s1 / s2）。
- 課外組常用表單、洽公提醒、國定假日、手動停止辦公日：`office`（`forms`、`tips`、`holidays`、`closedDates`）。
- 新增小島：館的 `islet` 填同一個島名；位置在 `game.js` 的 `ISLET_AT`、英文名 `ISLET_EN`、從別的島延伸用 `ISLET_FROM`。新建築造型寫成 `bXxx(g, col)` 並加進 `BUILD`。

## 5. 每次修改的流程（給 Claude）

1. `git pull --rebase origin main`（颱風假機器人可能推過 `typhoon.json`）
2. 改 `js/data.js`（或其他檔）
3. 檢查：`node -e "require('./js/data.js')"`、`node --check`（game.js 是 ES module，可複製成 `.mjs` 再檢查）、`node scripts/security-check.js`；有新截止日時 `node scripts/build-ics.js`
4. 畫面有變動時用 Playwright 截圖確認（沙盒擋 jsdelivr：用 `page.route` 把 `https://cdn.jsdelivr.net/npm/three@0.160.0/**` 導到本機 `npm i three@0.160.0` 的檔案；`localStorage thuarch:intro=true` 跳過開場；`python3 -m http.server 8765` 起本機伺服器）
5. `python3 scripts/build-preview.py <scratchpad>/athletic-portal.html`，用 Artifact 工具發布到上面的預覽 URL
6. `git commit`（訊息用中文，結尾加上系統要求的 Co-Authored-By／Claude-Session 行）→ `git push -u origin main`（老師選擇「直接上線」；若對話環境指定了別的工作分支，也同步推一份過去）

## 6. 使用者偏好

- 全部用**繁體中文**回覆；說明要讓非工程背景的老師看得懂。
- 注意版權：所有角色、建築都是程式繪製的原創造型，不用現成角色或圖檔（啊牛是參考東海牛奶節乳牛重新建模）。
- 名牌文字固定 13px；各館造型統一 4.4 單位高、不超過峮老師；館底沒有方形底座。
- 截止日、相關公告預設收起。
- 不要捏造日期或連結；使用者沒給的就問或標示待補。
- 公告沒給截止日時不要自己加，回覆時提醒「有截止日可以補上」。

## 7. 待確認／未完成

- 語文館施工公告：標題寫「南棟」，內文施工範圍寫「北棟」，已照原文上架，等老師確認。
- `http://student-space.thu.edu.tw/`（北側會議室借用）不是 https，資安檢查列為提醒。
- Google 試算表公告：2026-11-10 已啟用（`sheet.csvUrl` 為發布到網路的 CSV 網址；老師給的是 pubhtml，改成 `pub?…&output=csv`）。
- 課外組導航用老師給的 Google 地圖分享連結（地圖上還搜尋不到「課外組」，之後若出現可換成正式地點）。
- GitHub 排程若 60 天沒有提交會暫停，需到 Actions 頁面重新啟用。
