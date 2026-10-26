/* =========================================================
 * 體能性社團資訊站：內容資料檔
 * 老師/助理只需要改這個檔案，網站內容就會更新。
 *
 * 日期格式一律寫成 "YYYY-MM-DD"，時間可加 "HH:MM"（24 小時制）
 * 例如： "2026-11-20"  或  "2026-11-20 17:00"
 *
 * ⚠ 目前的公告與截止日是「範例資料」，請依實際作業期程替換。
 * ========================================================= */
var SITE_DATA = {
  // 學期名稱，顯示在頁首
  term: "115 學年度第 1 學期",

  // 設為 true 時，頁面會顯示「範例資料」提示條；換成正式資料後請改為 false
  isSample: true,

  links: {
    office: "https://activity.thu.edu.tw/",
    schedule: "https://ithu.tw/aHSbj",
    linktree: "https://linktr.ee/thuathletic",
  },

  office: {
    name: "學務處 課外活動暨學生發展組",
    // 導航連結建置中：完成後把網址貼在 mapUrl，頁面會自動出現「開啟導航」按鈕
    mapUrl: "",
    locationNote: "導航位置建置中，完成後會在這裡提供 Google 地圖導航。",
    // 週一=1 ... 週五=5；每天可以有多個時段
    hours: {
      days: [1, 2, 3, 4, 5],
      slots: [
        ["09:00", "12:00"],
        ["13:30", "17:00"],
      ],
    },
    // 國定假日與補假：這些日子課外組不辦公（平日放假才需要列）。
    // 資料來源：行政院人事行政總處政府行政機關辦公日曆表（經 github.com/ruyut/TaiwanCalendar 整理）。
    // 正式網站開啟時也會自動下載當年度與下一年度的最新日曆；這裡是離線備用與手動補充。
    holidays: {
      "2026-01-01": "開國紀念日",
      "2026-02-16": "農曆除夕",
      "2026-02-17": "春節",
      "2026-02-18": "春節",
      "2026-02-19": "春節",
      "2026-02-20": "補假",
      "2026-02-27": "補假",
      "2026-04-03": "補假",
      "2026-04-06": "補假",
      "2026-05-01": "勞動節",
      "2026-06-19": "端午節",
      "2026-09-25": "中秋節",
      "2026-09-28": "孔子誕辰紀念日/教師節",
      "2026-10-09": "補假",
      "2026-10-26": "補假",
      "2026-12-25": "行憲紀念日",
      "2027-01-01": "開國紀念日",
      "2027-02-04": "小年夜",
      "2027-02-05": "農曆除夕",
      "2027-02-08": "春節",
      "2027-02-09": "補假",
      "2027-02-10": "補假",
      "2027-03-01": "補假",
      "2027-04-05": "清明節",
      "2027-04-06": "補假",
      "2027-04-30": "補假",
      "2027-06-09": "端午節",
      "2027-09-15": "中秋節",
      "2027-09-28": "孔子誕辰紀念日/教師節",
      "2027-10-11": "補假",
      "2027-10-25": "臺灣光復暨金門古寧頭大捷紀念日",
      "2027-12-24": "補假",
      "2027-12-31": "補假",
    },
    // 學校另外公告的停止辦公日（例如校慶補假、颱風停班），格式同上：{ "2026-11-20": "校慶補假" }
    closedDates: {},
    // 補班日（週末上班），格式："2027-01-23"
    workdays: [],
    tips: [
      "送件前先確認文件已由社長與指導老師簽名，並與峮老師約時間唷！",
      "12:00–13:30 為午休時間，請避開這段時間洽公。",
      "國定假日與學校行政休假日不辦公。",
    ],
  },

  /* ---------------------------------------------------------
   * 群島：每個行政分類是一座島，中心島是課外組
   * key 要和截止日的 category、公告的 tag、資訊站的 island 一致
   * islet：填同一個名稱的分類會放到本島旁邊的獨立小島（以橋相連），例如場地借用、器材借用都在「借用島」
 * building 可用：hall、track、tent、bank、gym、aid、store、podium、house
   * --------------------------------------------------------- */
  islands: [
    {
      key: "會議", name: "期初會議館", icon: "📣", color: "#8C9A5B", building: "hall",
      tagline: "每學期初召開的體能性社團會議，請先到指定表單報名。",
      // links：島上最醒目的按鈕；每學期換成新的會議資料與報名表單
      links: [["115-1 期初會議資料", "https://reurl.cc/8YYKp4"]],
    },
    { key: "行政", name: "行政館", icon: "📋", color: "#6E8FB5", building: "track", tagline: "幹部交接、名冊繳交，新任幹部的第一站。" },
    { key: "活動", name: "活動館", icon: "⛺", color: "#D98B4E", building: "tent", tagline: "辦活動前要送什麼、活動後要交什麼。" },
    {
      key: "經費", name: "經費館", icon: "💰", color: "#D9B24E", building: "bank", tagline: "補助申請與核銷，收據一張都不能錯。",
      // sections：島內分區；rules 是「相對期限」的提醒（例如活動結束後 2 週內），沒有固定日期所以不倒數
      // prep + files：要先準備給承辦老師的電子檔
      sections: [
        {
          title: "活動經費",
          rules: [{
            when: "活動結束後 2 週內", title: "完成活動經費核銷",
            note: "12 月及 1 月的活動，需在活動結束後 5 日內完成核銷。",
            prep: "須先約時間並提供以下電子檔給峮老師：", files: ["學輔成效報告", "收支結算表"],
            links: [["文件下載", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=3"]],
          }],
        },
        {
          title: "器材經費",
          rules: [{
            when: "收到發票 2 週內", title: "完成器材經費核銷", note: "",
            prep: "須先約時間並提供以下電子檔給峮老師：", files: ["器材效益表", "器材收支結算表"],
            links: [["文件下載", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=3"]],
          }],
        },
        {
          title: "校外指導老師鐘點費補助",
          rules: [{
            when: "社課結束後 1 週內", title: "校外指導老師提交社課記錄表",
            note: "需確認照片是否有拍攝到指導老師及社員，並詳述授課說明。",
            links: [["社團社課授課紀錄表 文件下載", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=2"]],
          }],
        },
      ],
    },
    { key: "場地", name: "場地借用館", islet: "借用島", icon: "🏟", color: "#6FA38C", building: "gym", tagline: "練習場地借用與使用規範。" },
    { key: "安全", name: "安全館", icon: "⛑", color: "#C8623F", building: "aid", tagline: "保險、急救、校外活動安全，體能性社團最重要的事。" },
    { key: "器材", name: "器材借用館", islet: "借用島", icon: "🏐", color: "#9C83B5", building: "store", tagline: "器材清冊、借用與保管。" },
    { key: "評鑑", name: "評鑑館", icon: "🏆", color: "#C97A8F", building: "podium", tagline: "成果與評鑑資料，平常就要存。" },
  ],

  /* ---------------------------------------------------------
   * 角色身份：課外組 + 體能性社團（社團名單來源：東海大學社團島）
   * prop 是角色手上的道具：basketball、soccer、volleyball、rugby、bat、racket、bow、
   * sword、gloves、belt、frisbee、skateboard、skates、mat、backpack、dumbbell、ring、
   * bowling、bib、pompom、kit、helmet、clipboard；新增社團時挑一個最接近的即可
   * --------------------------------------------------------- */
  clubs: [
    { name: "課外組", prop: "clipboard" },
    { name: "籃球社", prop: "basketball" },
    { name: "排球社", prop: "volleyball" },
    { name: "足球社", prop: "soccer" },
    { name: "棒球社", prop: "bat" },
    { name: "橄欖球社", prop: "rugby" },
    { name: "東海羽球聯盟", prop: "racket" },
    { name: "飛盤社", prop: "frisbee" },
    { name: "保齡球社", prop: "bowling" },
    { name: "射箭社", prop: "bow" },
    { name: "古代騎射社", prop: "bow" },
    { name: "馬術社", prop: "helmet" },
    { name: "劍道社", prop: "sword" },
    { name: "八方傳統武術社", prop: "sword" },
    { name: "跆拳社", prop: "belt" },
    { name: "空手道社", prop: "belt" },
    { name: "拳擊社", prop: "gloves" },
    { name: "肌力與體能社", prop: "dumbbell" },
    { name: "瑜珈社", prop: "mat" },
    { name: "馬拉松社", prop: "bib" },
    { name: "登山社", prop: "backpack" },
    { name: "水上活動社", prop: "ring" },
    { name: "自由潛水社", prop: "ring" },
    { name: "滑板社", prop: "skateboard" },
    { name: "風之舞溜冰社", prop: "skates" },
    { name: "競技啦啦社", prop: "pompom" },
    { name: "運動防護社", prop: "kit" },
  ],
  roles: ["社長", "副社長", "財務", "活動長", "器材長", "公關", "幹部", "社員", "輔導老師"],

  /* ---------------------------------------------------------
   * 截止日：會依日期自動排序、倒數，並可加入行事曆
   * category 建議使用：行政、經費、活動、場地、評鑑、安全
   * --------------------------------------------------------- */
  deadlines: [
    {
      id: "d-roster",
      title: "新任幹部名冊與交接清單繳交",
      due: "2026-10-31 17:00",
      category: "行政",
      detail: "新任社長、副社長、財務、活動長聯絡資料，與上一屆交接清單一併繳交。",
      link: "https://ithu.tw/aHSbj",
    },
    {
      id: "d-insurance",
      title: "11 月校外活動保險名冊",
      due: "2026-11-06 17:00",
      category: "安全",
      detail: "校外練習、移地訓練、比賽皆需於出發前完成保險名冊送件。",
      link: "",
    },
    {
      id: "d-venue",
      title: "12 月場地借用申請",
      due: "2026-11-13 17:00",
      category: "場地",
      detail: "體育館、球場、韻律教室等場地請提早登記，避免與系隊或課程衝突。",
      link: "",
    },
    {
      id: "d-winter",
      title: "寒假集訓／營隊活動申請",
      due: "2026-12-11 17:00",
      category: "活動",
      detail: "寒假期間的集訓、營隊需事先送活動申請表與安全計畫。",
      link: "",
    },
    {
      id: "d-report",
      title: "期末社團成果與評鑑資料上傳",
      due: "2027-01-08 17:00",
      category: "評鑑",
      detail: "活動照片、成果報告、出席紀錄整理後上傳，作為社團評鑑依據。",
      link: "",
    },
  ],

  /* ---------------------------------------------------------
   * 行政公告：pinned=true 會置頂；date 為公告日期
   * --------------------------------------------------------- */
  announcements: [
    // 格式：{ id, date（可省略，YYYY-MM-DD）, pinned, tag（對應島的 key，例如 "經費"）, title, body（可省略）, link（課外組公告網址）}
    // 列表依這裡的順序顯示（置頂的排最前面），最新的請加在最上面
    {
      id: "a-1151-1854", tag: "經費",
      title: "115學年度第1學期「大專校院帶動中小學社團發展」計畫補助審查結果公告",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1854",
    },
    {
      id: "a-1151-1853", tag: "經費",
      title: "115學年度第1學期第1階段社團器材審查結果公告",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1853",
    },
    {
      id: "a-1151-1852", tag: "經費",
      title: "115學年度第1學期第2階段社團器材申請及第1階段核定社團簡報公告",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1852",
    },
    {
      id: "a-1151-1851", tag: "經費",
      title: "115學年度第1學期第1階段社團活動審查結果公告",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1851",
    },
  ],

  /* ---------------------------------------------------------
   * 社團行政待辦清單：common 為每學期共同項目，s1 第一學期、s2 第二學期
   * island：同時顯示在哪一座島；when：時間提醒（文字）；note：注意事項
   * links：按鈕 [名稱, 網址]；網址留空 "" 會顯示為「連結待補」
   * --------------------------------------------------------- */
  todos: {
    common: [
      { id: "t-doc", island: "活動", title: "社課活動公文申請", note: "", links: [] },
      {
        id: "t-contest", island: "評鑑", title: "填報校外競賽參與狀況",
        note: "需上傳獲獎狀況及照片至指定表單。",
        links: [["校外競賽填報表單", ""]],
      },
    ],
    s1: [
      {
        id: "t1-advisor-in", island: "行政", title: "校內指導老師申請", note: "",
        links: [["課外組網站公告", "https://activity.thu.edu.tw/"], ["相關文件", ""]],
      },
      {
        id: "t1-advisor-out", island: "行政", title: "校外指導老師申請",
        note: "各社團須於社課結束後繳交社課記錄表。",
        links: [["法規及相關文件", ""]],
      },
      {
        id: "t1-roster", island: "行政", title: "社員及幹部名單登錄", note: "",
        links: [["操作說明", "https://t365-my.sharepoint.com/:b:/g/personal/yccchiang_tdrive_thu_edu_tw/IQARwEaENFzHRKtlo05rcNa5AeKQeHE1Oxh7W4pjIA7qHok?e=3BMwrG"]],
      },
      {
        id: "t1-bankbook-doc", island: "經費", title: "繳交變更存摺文件至課外組核章", note: "",
        links: [["文件下載", "https://activity.thu.edu.tw/upload/activity/downloads_upload/%E7%A4%BE%E5%9C%98%E7%B6%93%E8%B2%BB%E9%83%B5%E5%B1%80%E5%B0%88%E6%88%B6(%E6%94%B9%E9%81%B8%E8%AE%8A%E6%9B%B4%E6%88%B6%E5%90%8D%E7%94%A8).doc"]],
      },
      {
        id: "t1-bankbook-upload", island: "經費", title: "存摺上傳", note: "",
        links: [["存摺上傳表單", "https://form2.thu.edu.tw/4821779"]],
      },
    ],
    s2: [
      {
        id: "t2-advisor-out", island: "行政", title: "校外指導老師申請",
        note: "已於第一學期申請者，僅需繳交授課大綱；欲新聘任者需繳交完整文件。各社團須於社課結束後繳交社課記錄表。",
        links: [["法規及相關文件", ""]],
      },
      {
        id: "t2-roster", island: "行政", title: "社員及幹部名單更新", note: "",
        links: [["操作說明", "https://t365-my.sharepoint.com/:b:/g/personal/yccchiang_tdrive_thu_edu_tw/IQARwEaENFzHRKtlo05rcNa5AeKQeHE1Oxh7W4pjIA7qHok?e=3BMwrG"]],
      },
      {
        id: "t2-inventory", island: "器材", when: "每年 5 月", title: "財產盤點",
        note: "課外組峮老師提供盤點表件，請各社團將盤點結果上傳至表單。",
        links: [["盤點結果上傳表單", "https://form2.thu.edu.tw/5282503"]],
      },
      { id: "t2-election", island: "行政", when: "6 月初", title: "繳交新任社團基本資料表及改選報告書", note: "", links: [] },
      { id: "t2-handover", island: "行政", when: "7 月底前", title: "繳交交接清冊至課外組用印", note: "", links: [] },
    ],
  },

  /* ---------------------------------------------------------
   * 資訊站：各主題的說明，可搜尋
   * island 為所在的島（對應上方 islands 的 key）
 * steps 為步驟；links 為相關連結 [名稱, 網址]
   * --------------------------------------------------------- */
  guides: [
    {
      id: "g-meeting",
      island: "會議",
      topic: "期初會議",
      title: "115-1 期初會議",
      summary: "每學期初都會召開會議，所有社團都要先到指定表單報名。",
      steps: [
        "打開「115-1 期初會議資料」，確認會議日期、時間與地點。",
        "依會議資料中的指定表單完成報名（每個社團都要報名）。",
        "會議當天準時出席，帶著會議資料與要提問的事項。",
        "會後把重點轉達給社內幹部，並留意會議提到的截止日。",
      ],
      links: [["115-1 期初會議資料", "https://reurl.cc/8YYKp4"]],
    },
    {
      id: "g-handover",
      island: "行政",
      topic: "幹部交接",
      title: "新舊幹部怎麼交接？",
      summary: "帳冊、器材、帳號密碼、未完成事項，一次交接清楚。",
      steps: [
        "舊幹部整理交接清單：財務帳冊、器材清冊、社團帳號密碼、未結案活動。",
        "新舊幹部當面點交器材與存摺，雙方簽名。",
        "於期限內繳交新任幹部名冊至課外組。",
        "更新 LINE 社群、IG 等管理員權限。",
      ],
      links: [["作業期程表", "https://ithu.tw/aHSbj"]],
    },
    {
      id: "g-activity",
      island: "活動",
      topic: "活動申請",
      title: "辦活動要送什麼？",
      summary: "活動前送申請，活動後交成果，校外活動另需安全計畫。",
      steps: [
        "活動前依規定時間送出活動申請表。",
        "校外或具風險之活動，需附安全計畫與保險名冊。",
        "活動結束後繳交成果報告與照片。",
      ],
      links: [["課外組網站", "https://activity.thu.edu.tw/"]],
    },
    {
      id: "g-money",
      island: "經費",
      topic: "經費核銷",
      title: "經費申請與核銷注意事項",
      summary: "收據抬頭「東海大學」、統編「52004800」要正確；核銷前先和峮老師約時間。",
      steps: [
        "確認活動是否有申請補助，以及補助可支用的項目。",
        "取得收據或發票，檢查抬頭「東海大學」、統編「52004800」、日期、金額與品項。",
        "請先與峮老師約時間，並提供核銷文件電子檔，再依約好的時間將發票或收據送到課外組。",
      ],
      links: [],
    },
    {
      id: "g-venue",
      island: "場地",
      topic: "場地借用",
      title: "練習場地怎麼借？",
      summary: "固定練習與臨時活動都要登記，提早申請。",
      steps: [
        "確認場地管理單位與開放時段。",
        "依截止日送出借用申請。",
        "使用後恢復原狀並關閉燈光、冷氣。",
      ],
      links: [],
    },
    {
      id: "g-safety",
      island: "安全",
      topic: "安全與保險",
      title: "體能性社團安全守則",
      summary: "保險、熱身、急救資訊，是體能性社團最重要的事。",
      steps: [
        "校外活動出發前完成保險名冊。",
        "每次練習安排熱身與收操，並由幹部確認出席人數。",
        "練習場地附近的 AED 位置與緊急聯絡方式，所有幹部都要知道。",
        "發生受傷事件，先處理傷者，事後回報課外組並留下紀錄。",
      ],
      links: [],
    },
    {
      id: "g-equipment",
      island: "器材",
      topic: "器材管理",
      title: "社團器材借用與保管",
      summary: "建立器材清冊，借出歸還都有紀錄。",
      steps: [
        "每學期初盤點器材，更新清冊與照片。",
        "借出歸還登記日期與借用人。",
        "損壞器材拍照記錄，交接時一併說明。",
      ],
      links: [],
    },
    {
      id: "g-review",
      island: "評鑑",
      topic: "社團評鑑",
      title: "評鑑資料平常就要存",
      summary: "照片、簽到表、成果報告，每次活動後就整理。",
      steps: [
        "建立共用雲端資料夾，依學期與活動分類。",
        "每次活動後當週上傳照片與簽到表。",
        "期末依評鑑格式彙整成果。",
      ],
      links: [],
    },
  ],

  /* ---------------------------------------------------------
   * 新任幹部上任任務清單（勾選紀錄只存在學生自己的瀏覽器）
   * --------------------------------------------------------- */
  onboarding: [
    "加入體能性社團幹部 LINE 社群",
    "把本站加到手機主畫面",
    "把全部截止日加入自己的行事曆",
    "到課外組認識承辦老師（記得看辦公時間）",
    "完成新任幹部名冊繳交",
    "與上一屆完成器材與帳冊點交",
    "確認本學期練習場地借用",
    "確認社員保險與校外活動流程",
  ],
};

if (typeof module !== "undefined") module.exports = SITE_DATA;
