/* =========================================================
 * 體能性社團資訊站：內容資料檔
 * 老師/助理只需要改這個檔案，網站內容就會更新。
 *
 * 日期格式一律寫成 "YYYY-MM-DD"，時間可加 "HH:MM"（24 小時制）
 * 例如： "2026-11-20"  或  "2026-11-20 17:00"
 *
 * 截止日提醒（啊牛）＝deadlines ＋ 公告中有 due 的項目；已過期的會自動隱藏。
 * ========================================================= */
var SITE_DATA = {
  // 學期名稱，顯示在頁首
  term: "115 學年度第 1 學期",

  // 設為 true 時，頁面會顯示「範例資料」提示條；換成正式資料後請改為 false
  isSample: false,

  links: {
    office: "https://activity.thu.edu.tw/",
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
    // 臺中市颱風假：由 GitHub 自動檢查（.github/workflows/typhoon.yml）寫入 typhoon.json，網站開啟時讀取
    typhoonUrl: "https://raw.githubusercontent.com/Chiunyii/Athletes_THU_tw/main/typhoon.json",
    // 學校另外公告的停止辦公日（例如校慶補假、颱風停班），格式同上：{ "2026-11-20": "校慶補假" }
    closedDates: {},
    // 補班日（週末上班），格式："2027-01-23"
    workdays: [],
    // 課外組資訊卡上的「常用表單」按鈕
    forms: [
      ["校外競賽填報表單", "https://form2.thu.edu.tw/4825104"],
      ["社團校內指導老師聘任申請表", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=8"],
      ["校外指導老師法規", "https://activity.thu.edu.tw/web/admissions/detail.php?cid=1&id=9"],
      ["指導老師相關表單", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=8"],
    ],
    tips: [
      "送件前先確認文件已由社長與指導老師簽名，並與峮老師約時間唷！",
      "12:00–13:30 為午休時間，請避開這段時間洽公。",
      "國定假日、學校行政休假日及臺中市政府宣布的颱風假不辦公。",
    ],
  },

  /* ---------------------------------------------------------
   * 群島：每個行政分類是一座島，中心島是課外組
   * key 要和截止日的 category、公告的 tag、資訊站的 island 一致
   * islet：填同一個名稱的分類會放到本島旁邊的獨立小島（以橋相連），例如場地借用、器材借用都在「場地器材島」
 * building 可用：hall、track、tent、bank、gym、aid、store、podium、house、handover、inventory
   * lead：資訊卡上方的問題；links：最醒目的按鈕；jump: true 會在上方加上跳到各段落的按鈕
   * --------------------------------------------------------- */
  islands: [
    {
      key: "會議", name: "期初會議館", en: "Opening Meeting Hall", icon: "📣", color: "#8C9A5B", building: "hall",
      tagline: "每學期初召開的體能性社團會議，請先到指定表單報名。",
      // links：島上最醒目的按鈕；每學期換成新的會議資料與報名表單
      links: [["115-1 期初會議資料", "https://reurl.cc/8YYKp4"]],
    },
    {
      key: "行政", name: "社團行政館", en: "Club Administration Hall", islet: "行政島", icon: "📋", color: "#6E8FB5", building: "track", tasks: true, // tasks：社團行政任務（打勾清單）放在這一館
      lead: "社團有哪些行政事務？",
      tagline: "基本資料表繳交、幹部及社員名冊登錄等，館內記載社團行政任務，完成後可以打勾唷！",
    },
    {
      key: "活動", name: "社團活動館", en: "Club Activity Hall", islet: "活動島", icon: "⛺", color: "#D98B4E", building: "tent",
      lead: "辦活動多久要送出活動公文？",
      tagline: "活動前2週要完成場地借用及將活動公文送到課外組給峮老師。",
      links: [
        ["活動公文操作說明", "https://t365-my.sharepoint.com/:b:/g/personal/yccchiang_tdrive_thu_edu_tw/IQARwEaENFzHRKtlo05rcNa5AeKQeHE1Oxh7W4pjIA7qHok?e=3BMwrG"],
        ["臨時機車通行證申請", "https://carpass.stusrv.thu.edu.tw/"],
      ],
    },
    {
      key: "經費", name: "經費館", en: "Club Funding Hall", icon: "💰", color: "#D9B24E", building: "bank",
      // jump：上方跳到各段落的按鈕 [文字, 段落]；段落 i-s0、i-s1… 是 sections，i-g 攻略、i-dl 截止日、i-news 相關公告
      jump: [["活動", "i-s0"], ["器材", "i-s1"], ["指導老師", "i-s2"], ["核銷攻略", "i-g"], ["提醒事項", "i-dl"], ["相關公告", "i-news"]],
      tagline: "補助申請與核銷，收據一張都不能錯。",
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
            when: "社課結束後 1 週內", title: "繳交社課記錄表",
            links: [["文件下載", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=2"]],
          }],
        },
      ],
    },
    {
      key: "場地", name: "場地借用館", en: "Venue Booking Hall", islet: "場地器材島", icon: "🏟", color: "#6FA38C", building: "gym", tagline: "社課/活動場地借用與使用規範。",
      links: [
        ["場地借用說明", "https://activity.thu.edu.tw/web/page/page.php?lang=zh_tw&scid=7&sid=6"],
      ],
      linkSize: "small", // 上方按鈕改成一般大小
    },
    { key: "安全", name: "活動安全館", en: "Activity Safety Hall", islet: "活動島", icon: "⛑", color: "#C8623F", building: "aid", tagline: "保險、熱身、急救資訊，是體能性社團最重要的事。" },
    {
      key: "器材", name: "器材借用館", en: "Equipment Loan Hall", islet: "場地器材島", icon: "🎤", color: "#9C83B5", building: "store",
      lead: "共用器材怎麼借？", tagline: "舞台、音響等課外組共用器材，領取前 3–14 天上網登記。",
      links: [["器材借用系統", "https://oauth.thu.edu.tw/v1/wp-login.php?redirect_to=%2Fv1%2Findex.php%2Foauth%2Fauthorize%2F%3Fresponse_type%3Dcode%26client_id%3DRvmPMlzSklqta9ZzHt6JnEdkrTHWbq"]],
    },
    {
      key: "評鑑", name: "評鑑館", en: "Club Evaluation Hall", islet: "行政島", icon: "🏆", color: "#C97A8F", building: "podium",
      lead: "社團評鑑不只是「資料整理」",
      tagline: "更是回顧社團組織運作、活動執行及成果展現的機會！評鑑成績是由定期評分、平時評分及年度評鑑加總而成。",
      links: [["說明會簡報", "https://activity.thu.edu.tw/upload/activity/downloads_upload/1790143799-115%E5%B9%B4%E5%BA%A6%E5%AD%B8%E7%94%9F%E7%A4%BE%E5%9C%98%E8%A9%95%E9%91%91%E8%AA%AA%E6%98%8E%E6%9C%83%E7%B0%A1%E5%A0%B1.pdf"]],
    },
    { key: "交接", name: "交接館", en: "Handover Hall", islet: "行政島", icon: "🤝", color: "#7FA6A0", building: "handover", lead: "新舊幹部怎麼交接？", tagline: "帳冊、器材、帳號密碼、未完成事項，一次交接清楚。" },
    { key: "財產", name: "財產盤點館", en: "Property Inventory Hall", islet: "行政島", icon: "📦", color: "#B58A5E", building: "inventory", lead: "社團器材借用與保管", tagline: "財產盤點於每年 5 月上傳至指定表單。", links: [["財產盤點上傳表單", "https://form2.thu.edu.tw/5282503"]] },
    {
      key: "競賽", name: "校外競賽館", en: "Competition Hall", islet: "校外競賽群島", icon: "🥇", color: "#E0A030", building: "podium2",
      lead: "請有參加校外競賽的夥伴都務必填寫表單唷！", tagline: "如果有相關問題，請與峮老師聯繫～",
      links: [["電子表單上傳", "https://form2.thu.edu.tw/4825104"]],
    },
    {
      key: "培力", name: "社團培力館", en: "Club Empowerment Hall", islet: "社團培力島", icon: "🌱", color: "#5FA88A", building: "training",
      lead: "課外組辦理的社團培力活動", tagline: "研習、工作坊、講座等課外組辦理的活動公告都會放在這裡，記得報名參加唷！",
    },
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
  roles: ["社長", "副社長", "文書", "財務", "器材", "活動", "幹部", "社員", "輔導老師"],

  /* ---------------------------------------------------------
   * 截止日：會依日期自動排序、倒數，並可加入行事曆
   * category 建議使用：行政、經費、活動、場地、評鑑、安全
   * --------------------------------------------------------- */
  deadlines: [
    // 格式：{ id, title, due（"YYYY-MM-DD" 或 "YYYY-MM-DD HH:MM"）, category（對應館的 key）, detail, link }
    // 已過期的項目會自動收進「顯示已截止項目」，不必手動刪除
    {
      id: "d-1151-passbook",
      title: "社團郵局存摺更換辦理完成",
      due: "2026-10-30",
      category: "經費",
      detail: "新舊任社長攜帶雙證件、印章、社章、存摺與 50 元至郵局辦理，完成後拍存摺封面照片給老師核對（申請學輔經費及器材補助之社團務必配合）。",
      link: "https://form2.thu.edu.tw/4821779",
    },
    {
      id: "d-1151-activity",
      title: "學輔經費補助活動辦理完畢",
      due: "2026-12-11",
      category: "經費",
      detail: "本學期申請學輔經費的活動，請於此日前辦理完畢。",
      link: "",
    },
    {
      id: "d-1151-reimburse",
      title: "學輔經費核銷完成",
      due: "2026-12-16",
      category: "經費",
      detail: "核銷文件：審查核定項目之單據及相關附件、成效報告及收支結算表。請先傳訊與老師確認核銷時間。",
      link: "",
    },
  ],

  /* ---------------------------------------------------------
   * 行政公告：pinned=true 會置頂；date 為公告日期
   * --------------------------------------------------------- */
  announcements: [
    // 格式：{ id, date（可省略，YYYY-MM-DD）, pinned, tag（對應島的 key，例如 "經費"；課外組辦理的活動請用 "培力"，會出現在社團培力館）, title, body（可省略）, link（課外組公告網址）, linkText（按鈕文字，預設「查看公告」）}
    // 列表依這裡的順序顯示（置頂的排最前面），最新的請加在最上面
    // 公告有截止日時加上 due（同截止日格式），會自動出現在截止日提醒；可另寫 dueTitle 作為截止日提醒上的名稱
    // 一則公告有好幾個期限時改用 dues: [{ due, title, link（可省略）}, ...]；dueDetail 只顯示在截止日提醒
    {
      id: "a-1151-ev-2026100057", tag: "培力",
      title: "企劃能力就是超能力！從想法到行動：企劃書設計與團隊帶領",
      link: "https://event.ithu.tw/2026100057", linkText: "活動資訊與報名",
    },
    {
      id: "a-1151-1878", tag: "活動",
      title: "東海大學116年學生社團寒假服務隊申請公告",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1878",
    },
    {
      id: "a-1151-1877", tag: "評鑑",
      title: "【延長報名】東海大學 115年度學生社團年度評鑑延長報名至10/27 下午3:00，逾時將不再受理報名！",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1877",
      due: "2026-10-27 15:00", dueTitle: "年度評鑑延長報名截止",
    },
    {
      id: "a-1151-advisor-letter", tag: "行政",
      title: "各社團的校內外指導老師聘書已經印好放社團抽屜，請各位再抽空至課外組的社團抽屜領取後送給各指導老師！",
    },
    {
      id: "a-115-1813", tag: "評鑑",
      title: "東海大學115年度學生社團評鑑實施分期時程公告",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=&id=1813",
    },
    {
      id: "a-1151-1866", tag: "評鑑",
      title: "東海大學 115年度學生社團年度評鑑公告",
      // dueDetail：只顯示在截止日提醒，公告欄只顯示標題
      dueDetail: "評鑑日 11/21（六），地點：中正紀念堂大廳（舞台前）及社科院 SS101、SS102、SS108、SS109。報名社團 09:15–09:45 至中正紀念堂大廳報到並參加開幕式；下午場次簡報的社團 12:20–12:50 至各簡報教室報到；若中途離開，請於表定時間前 10 分鐘回到簡報教室，唱名未到改排該場次最後一組。展演結束後請指派至少 1 人於 15:30 前回中正紀念堂大廳參加評審講評、成績公佈及頒獎。展演方式為簡報、影片或實際展演，每社 5 分鐘＋評審問答 2 分鐘，內容範圍 114/11/1–115/10/31。當天請攜帶檔案隨身碟，除檔案無法開啟外，現場不接受更換檔案。展演規則、評分說明、展演教室及獎勵方式詳見公告附件第 2–4 頁。",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1866",
      dues: [
        { due: "2026-11-16 23:59", title: "年度評鑑成果展演檔案上傳", link: "https://ithu.tw/EZ8jG" },
        { due: "2026-11-21 09:15", title: "年度評鑑當天報到（09:15–09:45 中正紀念堂大廳）" },
      ],
    },
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
      body: "第2階段僅開放資本門器材申請（10/20 17:00 截止收件）。第1階段決議為「二階簡報」的社團：每案報告 5 分鐘，簡報請於 10/27（一）12:00 前傳至雲端資料夾，當天另存隨身碟帶到會場，並於報告時間前 20 分鐘到場；會議結束前未到場者取消申請資格。",
      link: "https://activity.thu.edu.tw/web/news/detail.php?cid=1&id=1852",
      dues: [
        { due: "2026-10-27 12:00", title: "二階簡報檔上傳雲端（第1階段決議二階簡報的社團）", link: "https://reurl.cc/jVeQ8M" },
        { due: "2026-10-28 12:20", title: "第2階段經費審查會議（二階簡報社團報告前 20 分鐘到場）" },
      ],
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
        id: "t-contest", island: "競賽", title: "填報校外競賽參與狀況",
        note: "需上傳獲獎狀況及照片至指定表單。",
        links: [["校外競賽填報表單", "https://form2.thu.edu.tw/4825104"]],
      },
    ],
    s1: [
      {
        id: "t1-advisor-in", island: "行政", title: "校內指導老師申請", note: "",
        links: [["社團校內指導老師聘任申請表", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=8"]],
      },
      {
        id: "t1-advisor-out", island: "行政", title: "校外指導老師申請",
        note: "各社團須於社課結束後繳交社課記錄表。",
        links: [["校外指導老師法規", "https://activity.thu.edu.tw/web/admissions/detail.php?cid=1&id=9"], ["相關表單", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=8"]],
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
        links: [["校外指導老師法規", "https://activity.thu.edu.tw/web/admissions/detail.php?cid=1&id=9"], ["相關表單", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=8"]],
      },
      {
        id: "t2-roster", island: "行政", title: "社員及幹部名單更新", note: "",
        links: [["操作說明", "https://t365-my.sharepoint.com/:b:/g/personal/yccchiang_tdrive_thu_edu_tw/IQARwEaENFzHRKtlo05rcNa5AeKQeHE1Oxh7W4pjIA7qHok?e=3BMwrG"]],
      },
      {
        id: "t2-inventory", island: "財產", when: "每年 5 月", title: "財產盤點",
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
      summary: "115-1 期初社團負責人會議（115/9/16）簡報重點整理，依會議六大段落提醒。",
      steps: [
        "學生資訊系統登錄：社長要在「社團 → 社員名單維護」登錄幹部及社員名單（10/01 前）；所有活動（包含社課）都要在「輸入社團活動申請」登錄，記得按儲存，並在「管理經費明細」填經費明細（不論有沒有申請補助都要填）。",
        "紙本送件：校外活動、大型場地借用、學生會經費補助，要列印紙本經指導老師簽名後，最晚於活動前一週送課外組簽核；社課使用一般教室無需送紙本。",
        "郵局存摺更換：先確認 114-2 學輔經費已全數入帳，填「社團申請郵局專戶（改選變更戶名用）」經校內指導老師、社長簽名送課外組；新舊任社長帶雙證件、印章、社章、存摺與 50 元到郵局辦理，10/30（五）前完成並拍存摺封面給老師。",
        "場地與器材借用：器材借用找楊美鳳老師、場地借用找謝孝林老師（連結見下方）；教室借用由註課組負責，只有社長、副社長、執行秘書、活動長有借用權限，請儘速登錄幹部資料。",
        "經費申請與核銷：學輔經費活動請於 12/11（五）前辦完、12/16（三）前完成核銷；平常於活動後二週內核銷（12 月活動為三天內），並先傳訊和老師約時間。補助以總預算 60% 為原則、餐費上限 120 元、雜費 5% 內；一張收據只能列一項補助項目，超過 10,000 元不可代墊；油資、郵資、服裝、小型器材等不得核銷。",
        "器材補助：經常門（10,000 元以下）僅第一學期開放申請；發票要打學校統編 52004800，單價、數量、總價與估價單一致；核銷附收支結算表及器材效益表（照片 2 張）。通過後務必執行完畢，未執行或未核銷將刪減下學期補助。",
        "社團評鑑：校內評鑑 115/11/21（六）全天；定期評分資料 10/21 前轉 PDF 上傳雲端（會議紀錄與表單需負責人、社長、指導老師簽章後掃描），請確認上一屆雲端帳號密碼已交接。",
        "其他提醒：邀請校外講師或自聘校外指導老師，需於活動前二週提出性侵害及犯罪查核；機車臨時通行證由社長於活動前 3 日線上申請（每活動至多 3 輛、一次至多 3 日），登錄後私訊老師簽核。",
        "活動安排：期中考 11/03–11/09、期末考 12/26–12/31 當週暫停所有活動，考前一週僅能辦室內活動；11/7、12/5 特殊選才及 11/13–15、11/17、11/20–21 碩博士面試期間，避免辦理大型活動。",
        "公務抽屜：學生活動中心二樓課外組進門右手邊，請撥空領取前一任證書及社團指導老師聘書。",
      ],
      links: [
        ["115-1 期初會議資料", "https://reurl.cc/8YYKp4"],
        ["器材借用（楊美鳳老師）", "https://reurl.cc/XxZNvR"],
        ["場地借用（謝孝林老師）", "https://reurl.cc/aEE1yX"],
      ],
    },
    {
      id: "g-handover",
      island: "交接",
      topic: "幹部交接",
      title: "新舊幹部怎麼交接？",
      summary: "帳冊、器材、帳號密碼、未完成事項，一次交接清楚。",
      steps: [
        "舊幹部整理交接清單：財務帳冊、器材清冊、社團帳號密碼、未結案活動。",
        "新舊幹部當面點交器材、存摺及社團運作資料等，雙方及指導老師皆需簽名（交接清冊文件請見下方下載）。",
        "於公告期限內繳交社團基本資料表及改選報告書至課外組。",
        "社團相關帳號密碼要記得交接唷！",
        "卸任幹部協助新任幹部加入體能性社團與峮老師的 LINE 社群。",
      ],
      links: [["交接清冊文件下載", "https://activity.thu.edu.tw/web/downloads/list.php?lang=zh_tw&cid=6"]],
    },
    {
      id: "g-activity",
      island: "活動",
      topic: "活動申請",
      title: "辦活動要做什麼？",
      summary: "場地、公文、保險，活動前準備好。",
      steps: [
        "活動前進行場地線上借用。",
        "請於活動前2週將活動公文送給課外組峮老師。",
        "校外活動請務必投保保險，並注意安全。",
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
      title: "社課/活動場地怎麼借？",
      summary: "固定練習與臨時活動都要登記，提早申請。",
      steps: [
        "確認場地管理單位與開放時段。",
        "依截止日送出借用申請。",
        "請遵守場地使用規範，使用完畢後落實場復作業並關閉燈光、冷氣。",
      ],
      links: [
        ["北側會議室借用系統", "http://student-space.thu.edu.tw/?fbclid=IwAR21sDWMpYoUxx5JJe1_3YS5UR_PiqMbXC71a8xrgMvupzeLSTQBpW0yHyA"],
        ["東海空間網場地借用", "https://space.thu.edu.tw/"],
        ["推廣部場地借用", "https://thurent.thu.edu.tw/borrow.php", "中正堂、銘賢堂需另至推廣部借用網登記"], // 第三項：按鈕下方的小字補充
      ],
    },
    {
      id: "g-safety",
      island: "安全",
      topic: "安全與保險",
      title: "體能性社團安全守則",
      summary: "保險、熱身、急救資訊，是體能性社團最重要的事。",
      steps: [
        "校外活動/校外社課出發前完成保險名冊。",
        "每次練習安排熱身與收操，如果有社員身體不適，務必要留意並關懷。",
        "社課/活動場地附近的 AED 位置與緊急聯絡方式，所有幹部都要知道。",
        "發生受傷事件，先處理傷者，事後與課外組峮老師說明處理狀況。",
        "希望大家平平安安，萬一不小心意外受傷，學校有學生平安保險可以申請。",
      ],
      links: [["學生平安保險申請資訊", "https://stulife.thu.edu.tw/web/page/page.php?lang=zh_tw&scid=13&sid=11"]],
    },
    {
      id: "g-equipment",
      island: "器材",
      topic: "器材借用",
      title: "共用器材借用申請",
      summary: "舞台、音響等共用器材，請於領取時間前 3–14 天上網登記。",
      steps: [
        "請各社團於領取時間前 3–14 天至器材借用系統網頁登記。",
        "器材室開放時間：週一至週五 08:20–11:20、14:00–16:00。",
        "領取器材前，社長需於社團資訊系統中完成此活動公文申請。",
        "借用器材者請務必加入課外共用器材借用官方 LINE@（ID：@646ybuwv），以利即時溝通及聯繫器材借用相關事項。",
      ],
      links: [
        ["課外組網站公告", "https://activity.thu.edu.tw/web/page/page.php?lang=zh_tw&scid=9&sid=11"],
        ["器材借用系統", "https://oauth.thu.edu.tw/v1/wp-login.php?redirect_to=%2Fv1%2Findex.php%2Foauth%2Fauthorize%2F%3Fresponse_type%3Dcode%26client_id%3DRvmPMlzSklqta9ZzHt6JnEdkrTHWbq"],
      ],
    },
    {
      id: "g-property",
      island: "財產",
      topic: "財產盤點",
      title: "社團器材借用與保管",
      summary: "財產盤點於每年 5 月上傳至指定表單。",
      steps: [
        "建立器材清冊，借出歸還都有紀錄。",
        "每學期初盤點器材，更新清冊、照片及維護說明。",
        "借出歸還登記日期與借用人。",
        "訂定器材報廢及維修流程，損壞器材拍照記錄，交接時一併說明。",
        "學校補助之器材報廢請向峮老師申請，請勿自行報廢。",
      ],
      links: [["財產盤點上傳表單", "https://form2.thu.edu.tw/5282503"]],
    },
    {
      id: "g-contest",
      island: "競賽",
      topic: "校外競賽填報",
      title: "填寫說明",
      summary: "資料填寫區間為 115 年 8 月 1 日至 116 年 7 月 31 日。",
      steps: [
        "資料填寫區間為115年8月1日至116年7月31日。",
        "填報之競賽僅需填寫有3間學校(含)以上參與的競賽活動，若非「臺灣地區」及「大陸、港、澳地區」，則需至少3個國家(含)以上參與。",
        "在學情況若為應屆畢業生，請務必填寫「畢業年月」。【例如：11506】",
        "文件下載後請點擊左上角「檔案 → 建立副本 → 下載複本」。",
      ],
      links: [["電子表單上傳", "https://form2.thu.edu.tw/4825104"], ["文件下載", "https://ithu.tw/iu5r6", "請點擊左上角檔案→建立副本→下載複本"]],
    },
    {
      id: "g-review",
      island: "評鑑",
      topic: "社團評鑑",
      title: "評鑑資料建置",
      summary: "雲端資料夾依規定分類，連結記得開檢視權限。",
      steps: [
        "建立雲端資料夾，依規定進行分類，雲端連結繳交（記得要開檢視權限唷！）。",
        "第二層資料請建置「組織運作」、「資源管理」、「規劃與執行」、「特色與績效」，可參考資料夾建置指引。",
        "每年 9–10 月都會辦理評鑑攻略課程，請留意公告並記得報名參加唷！",
      ],
      links: [["雲端連結繳交", "https://forms.gle/5tReoFjPnz9EaLBH6"], ["資料夾建置指引", "https://ithu.tw/DSAus"]],
    },
  ],

  /* ---------------------------------------------------------
   * 新任幹部上任任務清單（勾選紀錄只存在學生自己的瀏覽器）
   * --------------------------------------------------------- */
  onboarding: [
    "加入體能性社團幹部 LINE 社群",
    "把本站加到手機主畫面",
    "找到啊牛，並留意各項任務截止日",
    "完成社團基本資料表並繳交給課外組峮老師",
    "與上一屆完成器材與帳冊點交，並繳交移交清冊",
    "確認本學期社課及活動場地借用",
    "確認校外活動（含社課）社員保險與校外活動流程",
  ],
};

// 截止日提醒用：deadlines 加上公告中有 due 的項目（自動加入，不必重複填寫）
SITE_DATA.allDeadlines = function () {
  var fromNews = [];
  SITE_DATA.announcements.forEach(function (a) {
    var list = (a.dues || []).slice();
    if (a.due) list.unshift({ due: a.due, title: a.dueTitle });
    list.forEach(function (x, i) {
      fromNews.push({ id: "d-" + a.id + (i ? "-" + i : ""), title: x.title || a.title, due: x.due, category: a.tag || "",
        detail: a.dueDetail || a.body || "公告欄：" + a.title, link: x.link || a.link || "", fromNews: true });
    });
  });
  return SITE_DATA.deadlines.concat(fromNews);
};

if (typeof module !== "undefined") module.exports = SITE_DATA;
