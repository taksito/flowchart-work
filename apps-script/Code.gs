/**
 * Flowchart Work — Google Drive backend 雲端繳交與成績登記
 *
 * 1. 改下面的 CONFIG（至少改 TEACHER_KEY）。
 * 2. 選函式 setup，按「執行」一次，允許存取 Google Drive 和試算表。
 * 3. 部署 → 新增部署 → 網頁應用程式：執行身分「我」，存取權「任何人」。
 * 4. 把部署網址貼到 GitHub 的 config.js，以及批改台的「Google Drive」設定。
 *
 * 學生用學校 Google 帳號登入（選用）：
 * - GOOGLE_CLIENT_ID 填 Google Cloud 建立的 OAuth 用戶端 ID；留空 = 不用登入，學生自己填班級座號姓名。
 * - 成績試算表裡要有「名單 Roster」工作表：班級 Class｜座號 No.｜姓名 Name｜Email。
 * - 開啟後學生一定要登入才能繳交，班級座號姓名一律以名單為準。
 * - 第一次開啟後，要再執行一次 setup，允許「連線到外部服務」。
 *
 * 學生用新北市教育局 OpenID 登入（選用，和 Google 登入二選一）：
 * - NTPC_OPENID 改成 true，NTPC_SITE 填作業網站的網址（登入完成後只會回到這個網站）。
 * - NTPC_SCHOOL 填學校名稱的一部分（例如 忠孝國中），只讓這所學校的師生登入。
 * - 不需要名單：班級、座號、姓名直接用校務行政系統的資料。
 * - 開啟後要再執行一次 setup，允許「連線到外部服務」，再部署新版本。
 */
const CONFIG = {
  TEACHER_KEY: 'change-me-teacher',   // 教師密碼：批改台載入作業、寫回成績時要用。請一定要改掉。
  CLASS_CODE: '',                     // 班級代碼：留空 = 不需要；填了學生繳交時要輸入同樣的代碼。
  FOLDER_NAME: 'Flowchart Work 作業',   // Drive 裡的資料夾名稱
  SHEET_NAME: 'Flowchart Work 成績',    // 試算表名稱
  GOOGLE_CLIENT_ID: '',               // 學生登入用的 OAuth 用戶端 ID（…apps.googleusercontent.com）；留空 = 不用登入
  EMAIL_DOMAIN: 'apps.ntpc.edu.tw',   // 只接受這個網域的學校帳號
  ROSTER_TAB: '名單 Roster',           // 名單工作表名稱
  TEACHERS: 'taksito',                // 可以用「成績登錄」頁的老師：新北市 OpenID 帳號，多位用逗號分開（還要再輸入 TEACHER_KEY）
  MANUAL_TAB: '人工成績 Manual',       // 成績登錄頁寫入的分數：學習吧人工批改的分數、老師修改的分數
  GRADES_TAB: '其他成績 Grades',       // 其他作業（例如學習吧）的成績簿：班級｜座號｜姓名｜作業1｜作業2…；學生在「我的成績」頁看得到
  CLASS_PREFIX: '7',                  // 只用這個年級的班級（例如 7 = 七年級）；留空 = 全部班級
  LOGIN_REQUIRED: false,              // false = 不登入也能繳交（自己填班級座號姓名）；有登入就以校務行政資料為準。true = 一定要登入才能繳交
  NTPC_OPENID: true,                  // true = 學生用新北市 OpenID（校務行政帳號）登入後才能繳交
  NTPC_SITE: 'https://taksito.github.io/flowchart-work/, https://raw.githack.com/taksito/flowchart-work/',  // 作業網站網址（可以用逗號分開好幾個）：登入完成後只會回到這些網站
  SHOW_SCORES: true,                  // true = 學生登入「我的成績」頁可以看到老師批改的分數與評語；false = 只看繳交狀態
  NTPC_WEBAPP: '',                    // （選填）這個網頁應用程式的部署網址 …/exec，填了會更嚴格地確認登入是送給這裡的
  NTPC_SCHOOL: '忠孝國中',             // 只接受這所學校的師生（學校名稱或單位代碼）；留空 = 新北市所有學校
};

const UNITS = { dog: 'Dog Talk', score: 'Pass or Fail', bmi: 'BMI', sum: 'Summation', scratch: 'Scratch Pass or Fail', 'scratch-bmi': 'Scratch BMI', 'scratch-sum': 'Scratch Summation', 'scratch-pw': 'Scratch Password' };
/* Units added later work without changing this file: any short lowercase name is accepted. */
function unitName_(u) { return UNITS[u] || (/^[a-z][a-z0-9-]{1,30}$/.test(String(u || '')) ? String(u) : null); }
const SUB_HEAD = ['繳交時間 Time', '單元 Unit', '班級 Class', '座號 No.', '姓名 Name', '作品 Title', '自我批改分數 Self-check', '達成 Passed', '英文使用率 English %', '檔案 File', 'Email', '電腦代號 Device'];
const SCORE_HEAD = ['單元 Unit', '班級 Class', '座號 No.', '姓名 Name', '作品 Title', '總分 Total', '等第 Level', 'Structure 結構', 'Input 輸入', 'Process 計算', 'Decision 判斷', 'Output 輸出', 'Test run 執行測試', '英文使用率 English %', '需要修正 Fixes', '評語 Comment', '批改時間 Graded', 'Shapes 圖形', 'Text 文字', 'Lines 線段'];

/* ---------- one-time setup ---------- */
function setup() {
  const folder = rootFolder_();
  const ss = sheet_();
  if (CONFIG.NTPC_OPENID) {
    UrlFetchApp.fetch(NTPC_OP, { muteHttpExceptions: true });  // asks for permission to verify sign-ins
    ntpcSecret_();
    Logger.log('新北市 OpenID 登入已開啟。部署成網頁應用程式後，登入會回到 Return URL: ' + (ntpcReturn_() || '（部署後才有網址）'));
  }
  if (CONFIG.GOOGLE_CLIENT_ID) {
    UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=x', { muteHttpExceptions: true });  // asks for permission to verify sign-ins
    const map = roster_(true);
    Logger.log(map ? '名單 Roster: ' + Object.keys(map).length + ' 位學生有 Email' : '找不到「' + CONFIG.ROSTER_TAB + '」工作表，請把學生名單匯入成績試算表');
  }
  gradesTab_();
  manualTab_();
  Logger.log('資料夾 Folder: ' + folder.getUrl());
  Logger.log('試算表 Sheet: ' + ss.getUrl());
}
/* the gradebook for work done elsewhere: made once, with the class list from the roster when there is one */
function gradesTab_() {
  const ss = sheet_();
  let sh = ss.getSheetByName(CONFIG.GRADES_TAB);
  if (sh) return sh;
  sh = ss.insertSheet(CONFIG.GRADES_TAB);
  const rows = [['班級 Class', '座號 No.', '姓名 Name']].concat((rosterRows_() || []).map(function (x) { return [x.cls, x.seat, x.name]; }));
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  sh.setFrozenRows(1); sh.setFrozenColumns(3);
  sh.getRange(1, 4).setNote('從這一欄開始，每個作業一欄：第一列寫作業名稱，下面填分數。寫「缺交」= 學生會看到缺交；空白 = 還沒登錄。');
  return sh;
}

/* ---------- web app ---------- */
function doGet(e) {
  if (e && e.parameter && e.parameter['openid.mode']) return ntpcPage_(e.parameter);   // back from the NTPC OpenID sign-in
  return json_({ ok: true, app: 'Flowchart Work', units: Object.keys(UNITS) });
}

function doPost(e) {
  if (e && e.parameter && e.parameter['openid.mode']) return ntpcPage_(e.parameter);   // the OpenID server may send long replies as a form POST
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  /* read-only actions for "Load all": no lock, so several batches can run at once */
  if (req.action === 'index' || req.action === 'fetch') {
    try { return json_(req.action === 'index' ? index_(req) : fetch_(req)); } catch (err) { return json_({ ok: false, error: 'server_error', message: String(err) }); }
  }
  if (req.action === 'class_get') {
    try { return json_(classGet_(req)); } catch (err) { return json_({ ok: false, error: 'server_error', message: String(err) }); }
  }
  if (req.action === 'mine') {
    try { return json_(mine_(req)); } catch (err) { return json_({ ok: false, error: 'server_error', message: String(err) }); }
  }
  if (req.action === 'room_get') {
    try { return json_(roomGet_(req)); } catch (err) { return json_({ ok: false, error: 'server_error', message: String(err) }); }
  }
  if (req.action === 'whoami') {
    try { return json_(whoami_(req)); } catch (err) { return json_({ ok: false, error: 'server_error', message: String(err) }); }
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (req.action === 'submit') return json_(submit_(req));
    if (req.action === 'list') return json_(list_(req));
    if (req.action === 'classes') return json_(classes_(req));
    if (req.action === 'delete') return json_(delete_(req));
    if (req.action === 'rename') return json_(rename_(req));
    if (req.action === 'save') return json_(save_(req));
    if (req.action === 'class_set') return json_(classSet_(req));
    if (req.action === 'class_import') return json_(classImport_(req));
    if (req.action === 'seat_set') return json_(seatSet_(req));
    if (req.action === 'att_add') return json_(attAdd_(req));
    if (req.action === 'att_del') return json_(attDel_(req));
    if (req.action === 'room_import') return json_(roomImport_(req));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server_error', message: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

/* ---------- actions ---------- */
function submit_(req) {
  if (CONFIG.CLASS_CODE && String(req.code || '').trim() !== CONFIG.CLASS_CODE) return { ok: false, error: 'bad_code' };
  const unit = unitName_(req.unit) ? req.unit : null;
  if (!unit) return { ok: false, error: 'bad_unit' };
  let who = who_(req), email = '';
  if (loginOn_() && (req.idToken || CONFIG.LOGIN_REQUIRED)) {   /* signed in: the school records decide who it is */
    const v = verify_(req.idToken);
    if (v.error) return { ok: false, error: v.error, email: v.email || '' };
    who = v.who; email = v.email;
  }
  if (!who.name) return { ok: false, error: 'no_name' };
  const student = who.student;
  const work = req.work;
  const isFlow = work && Array.isArray(work.nodes) && Array.isArray(work.edges);
  const isBlocks = work && work.workspace && typeof work.workspace === 'object';
  if (!isFlow && !isBlocks) return { ok: false, error: 'bad_work' };
  if (JSON.stringify(work).length > 500000) return { ok: false, error: 'too_large' };
  work.task = unit;
  work.student = student; work.cls = who.cls; work.seat = who.seat; work.name = who.name;
  if (email) work.email = email;
  const device = /^PC-[A-Z0-9]{4}$/.test(String(req.device || '')) ? String(req.device) : '';
  if (device) work.device = device;
  work.submittedAt = new Date().toISOString();

  const folder = unitFolder_(unit);
  const name = student + '.json';
  const it = folder.getFilesByName(name);
  const file = it.hasNext() ? it.next() : null;
  const content = JSON.stringify(work);
  let f;
  if (file) { file.setContent(content); f = file; } else { f = folder.createFile(name, content, MimeType.PLAIN_TEXT); namesChanged_(unit); }

  const ck = req.check || {};
  const sh = tab_('繳交紀錄 Submissions', SUB_HEAD);
  if (!sh.getRange(1, 11).getValue()) sh.getRange(1, 11).setValue('Email').setFontWeight('bold');
  if (!sh.getRange(1, 12).getValue()) sh.getRange(1, 12).setValue('電腦代號 Device').setFontWeight('bold');
  sh.appendRow([new Date(), unitName_(unit), who.cls, who.seat, who.name, clean_(req.title), num_(ck.total), ck.passed ? 'Yes' : 'No', num_(ck.english), f.getUrl(), email, device]);
  return { ok: true, time: work.submittedAt, file: name };
}

function list_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const units = req.unit && unitName_(req.unit) ? [req.unit] : Object.keys(UNITS);
  const cls = req.cls === OTHER ? OTHER : clean_(req.cls);
  const known = knownClasses_();
  const works = [];
  units.forEach(function (u) {
    const files = unitFolder_(u).getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (!/\.json$/i.test(f.getName())) continue;
      if (cls === OTHER && !isOther_(f.getName(), known)) continue;
      if (cls && cls !== OTHER && f.getName().indexOf(cls + '-') !== 0) continue;   // files are named "701-12 王小明.json"
      try {
        const w = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
        w.task = u;
        works.push({ unit: u, file: f.getName(), updated: f.getLastUpdated().toISOString(), work: w });
      } catch (err) {}
    }
  });
  const roster = cls === OTHER ? [] : (rosterRows_() || []).filter(function (x) { return !cls || x.cls === cls; });
  return { ok: true, works: works, cls: cls, roster: roster, sheetUrl: sheet_().getUrl(), folderUrl: rootFolder_().getUrl() };
}

/* names of every submitted file (no contents), so the desk can show progress while it loads them */
function index_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const units = req.unit && unitName_(req.unit) ? [req.unit] : Object.keys(UNITS), items = [];
  units.forEach(function (u) {
    const files = unitFolder_(u).getFiles();
    while (files.hasNext()) { const f = files.next(); if (/\.json$/i.test(f.getName())) items.push({ unit: u, file: f.getName() }); }
  });
  return { ok: true, items: items, roster: rosterRows_() || [], sheetUrl: sheet_().getUrl(), folderUrl: rootFolder_().getUrl() };
}
/* contents of up to 40 files from index_ */
function fetch_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const items = Array.isArray(req.items) ? req.items.slice(0, 40) : [], works = [];
  items.forEach(function (x) {
    const f = findWork_(x.unit, x.file); if (!f) return;
    try { const w = JSON.parse(f.getBlob().getDataAsString('UTF-8')); w.task = x.unit; works.push({ unit: x.unit, file: f.getName(), updated: f.getLastUpdated().toISOString(), work: w }); } catch (err) {}
  });
  return { ok: true, works: works };
}

/* classes from the roster, plus any class found in the submitted file names */
function classes_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const set = {};
  (rosterRows_() || []).forEach(function (x) { set[x.cls] = 1; });
  if (req.unit && unitName_(req.unit)) {
    const files = unitFolder_(req.unit).getFiles();
    while (files.hasNext()) { const m = files.next().getName().match(/^(\d+)-/); if (m && (!CONFIG.CLASS_PREFIX || m[1].indexOf(CONFIG.CLASS_PREFIX) === 0)) set[m[1]] = 1; }
  }
  const classes = Object.keys(set).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
  return { ok: true, classes: classes };
}
/* works whose file name has no known class go to "其他 Other" */
const OTHER = '__other';
function knownClasses_() { const k = {}; (rosterRows_() || []).forEach(function (x) { k[x.cls] = 1; }); return k; }
function isOther_(fileName, known) {
  const m = String(fileName).match(/^(\d+)-\S/);
  if (!m) return true;
  if (Object.keys(known).length) return !known[m[1]];
  return !!CONFIG.CLASS_PREFIX && m[1].indexOf(CONFIG.CLASS_PREFIX) !== 0;
}
function findWork_(unit, file) {
  if (!unitName_(unit) || !/\.json$/i.test(String(file || ''))) return null;
  const it = unitFolder_(unit).getFilesByName(String(file));
  return it.hasNext() ? it.next() : null;
}
/* move one submitted file to the Drive trash (it can still be restored from the trash) */
function delete_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const f = findWork_(req.unit, req.file);
  if (!f) return { ok: false, error: 'not_found' };
  f.setTrashed(true);
  namesChanged_(req.unit);
  return { ok: true };
}
/* fix the class / seat / name of a submitted file: updates the file and its name */
function rename_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const f = findWork_(req.unit, req.file);
  if (!f) return { ok: false, error: 'not_found' };
  const who = who_({ cls: req.cls, seat: req.seat, name: req.name });
  if (!who.name) return { ok: false, error: 'no_name' };
  const name = who.student + '.json';
  if (name !== f.getName() && unitFolder_(req.unit).getFilesByName(name).hasNext()) return { ok: false, error: 'exists', file: name };
  const w = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
  w.student = who.student; w.cls = who.cls; w.seat = who.seat; w.name = who.name;
  f.setContent(JSON.stringify(w));
  if (name !== f.getName()) { f.setName(name); namesChanged_(req.unit); }
  return { ok: true, file: name };
}
/* roster tab rows: class, seat, name */
function rosterRows_() {
  const sh = sheet_().getSheetByName(CONFIG.ROSTER_TAB);
  if (!sh) return null;
  const v = sh.getDataRange().getDisplayValues(), out = [];
  for (let r = 1; r < v.length; r++) {
    const c = String(v[r][0] || '').trim(), seat = String(v[r][1] || '').trim(), name = String(v[r][2] || '').trim();
    if (c && name && (!CONFIG.CLASS_PREFIX || c.indexOf(CONFIG.CLASS_PREFIX) === 0)) out.push({ cls: c, seat: seat, name: name });
  }
  return out;
}

function save_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const rows = Array.isArray(req.rows) ? req.rows : [];
  const sh = tab_('成績 Scores', SCORE_HEAD);
  if (sh.getLastColumn() < SCORE_HEAD.length) sh.getRange(1, 1, 1, SCORE_HEAD.length).setValues([SCORE_HEAD]).setFontWeight('bold');
  const data = sh.getDataRange().getValues();
  const index = {};
  for (let r = 1; r < data.length; r++) index[[data[r][0], data[r][1], data[r][2], data[r][3]].join('\u0000')] = r + 1;
  const now = new Date();
  let added = 0, updated = 0;
  rows.forEach(function (x) {
    const g = x.groups || {};
    const unitName = unitName_(x.unit) || String(x.unit || '');
    const who = who_(x);
    const row = [unitName, who.cls, who.seat, who.name, clean_(x.title), num_(x.total), x.level || '',
      num_(g['結構']), num_(g['輸入']), num_(g['計算']), num_(g['判斷']), num_(g['輸出']), num_(g['執行測試']),
      num_(x.english), String(x.fixes || ''), String(x.comment || ''), now, num_(g['圖形']), num_(g['文字']), num_(g['線段'])];
    const key = [unitName, who.cls, who.seat, who.name].join('\u0000');
    if (!index[key] && x.prev) {
      const pw = who_(x.prev), pk = [unitName, pw.cls, pw.seat, pw.name].join('\u0000');
      if (index[pk]) { index[key] = index[pk]; delete index[pk]; }
    }
    if (index[key]) { sh.getRange(index[key], 1, 1, row.length).setValues([row]); updated++; }
    else { sh.appendRow(row); index[key] = sh.getLastRow(); added++; }
  });
  return { ok: true, added: added, updated: updated, sheetUrl: sheet_().getUrl() };
}

/* ---------- sign-in with the school Google account ---------- */
function whoami_(req) {
  if (!CONFIG.GOOGLE_CLIENT_ID) return { ok: false, error: 'login_off' };
  const v = verify_(req.idToken);
  if (v.error) return { ok: false, error: v.error, email: v.email || '' };
  return { ok: true, email: v.email, who: v.who, exp: v.exp };
}
function loginOn_() { return !!(CONFIG.GOOGLE_CLIENT_ID || CONFIG.NTPC_OPENID); }
function verify_(token) {
  if (!token) return { error: 'login_required' };
  if (String(token).indexOf('ntpc.') === 0) return CONFIG.NTPC_OPENID ? ntpcVerify_(token) : { error: 'login_off' };
  if (!CONFIG.GOOGLE_CLIENT_ID) return { error: 'bad_token' };
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { error: 'login_expired' };
  const p = JSON.parse(r.getContentText());
  if (p.aud !== CONFIG.GOOGLE_CLIENT_ID || String(p.email_verified) !== 'true') return { error: 'bad_token' };
  if (Number(p.exp) * 1000 < Date.now()) return { error: 'login_expired' };
  const email = String(p.email || '').toLowerCase();
  if (CONFIG.EMAIL_DOMAIN && !email.endsWith('@' + CONFIG.EMAIL_DOMAIN.toLowerCase())) return { error: 'bad_domain', email: email };
  const map = roster_();
  if (!map) return { error: 'no_roster', email: email };
  const x = map[email];
  if (!x) return { error: 'not_in_roster', email: email };
  return { email: email, exp: Number(p.exp), who: who_({ cls: x[0], seat: x[1], name: x[2] }) };
}
/* email -> [class, seat, name] from the roster tab (cached for 10 minutes) */
function roster_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) { const c = cache.get('roster'); if (c) return JSON.parse(c); }
  const sh = sheet_().getSheetByName(CONFIG.ROSTER_TAB);
  if (!sh) return null;
  const v = sh.getDataRange().getDisplayValues(), map = {};
  for (let r = 1; r < v.length; r++) {
    const email = String(v[r][3] || '').trim().toLowerCase();
    if (email) map[email] = [String(v[r][0]).trim(), String(v[r][1]).trim(), String(v[r][2]).trim()];
  }
  try { cache.put('roster', JSON.stringify(map), 600); } catch (err) {}
  return map;
}

/* ---------- 我的成績 My scores: a signed-in student sees only their own work ---------- */
function mine_(req) {
  let who, preview = false;
  if (req.key) {   /* teacher preview: see the page as one student sees it */
    if (String(req.key) !== CONFIG.TEACHER_KEY || CONFIG.TEACHER_KEY === 'change-me-teacher') return { ok: false, error: 'bad_key' };
    const c = clean_(req.cls), n = clean_(req.seat);
    if (!c || !n) return { ok: false, error: 'no_class' };
    const r = (rosterRows_() || []).filter(function (x) { return x.cls === c && Number(x.seat) === Number(n); })[0];
    who = who_({ cls: c, seat: String(Number(n) || n), name: r ? r.name : '' }); preview = true;
  } else {
    if (!loginOn_()) return { ok: false, error: 'login_off' };
    const v = verify_(req.idToken);
    if (v.error) return { ok: false, error: v.error };
    who = v.who;
    if (!who.cls || !who.seat) return { ok: false, error: 'no_class', who: who };
  }
  const ss = sheet_(), sc = CONFIG.SHOW_SCORES ? ss.getSheetByName('成績 Scores') : null, gb = ss.getSheetByName(CONFIG.GRADES_TAB);
  const units = mineUnits_(who, subRows_(), sc ? sc.getDataRange().getValues() : [], function (u) { return workNames_(u); }, manualRows_());
  units.forEach(function (x) { delete x.manual; delete x.override; if (!CONFIG.SHOW_SCORES) x.final = ''; });
  const extra = extraFor_(who, gb ? gb.getDataRange().getDisplayValues() : [], !!CONFIG.SHOW_SCORES);
  if (!who.name && extra.name) who = who_({ cls: who.cls, seat: who.seat, name: extra.name });
  /* students see how many +1 they got, never their leave / late records */
  const bonus = bonusCount_(attRows_())[who.cls + '|' + String(Number(who.seat) || who.seat)] || 0;
  return { ok: true, who: who, preview: preview, scores: !!CONFIG.SHOW_SCORES, units: units, extra: extra.items, bonus: bonus };
}
/* Pure: this student's row of the gradebook -> [{name, value, state}] where state is score / missing / text / none */
function extraFor_(who, rows, showScores) {
  const out = { name: '', items: [] };
  if (!rows || rows.length < 1) return out;
  const head = rows[0].map(function (h) { return String(h || '').trim(); });
  const key = function (c, s) { const n = Number(s); return String(c || '').trim() + '-' + (String(s).trim() !== '' && isFinite(n) ? String(n) : String(s || '').trim()); };
  const me = key(who.cls, who.seat);
  const row = rows.slice(1).filter(function (r) { return key(r[0], r[1]) === me; })[0];
  out.name = row ? String(row[2] || '').trim() : '';
  for (let c = 3; c < head.length; c++) {
    if (!head[c]) continue;
    const v = row ? String(row[c] == null ? '' : row[c]).trim() : '';
    let state = 'none';
    if (/^(缺|缺交|未交|missing)$/i.test(v)) state = 'missing';
    else if (v !== '' && isFinite(Number(v))) state = 'score';
    else if (v !== '') state = 'text';
    out.items.push({ name: head[c], state: state, value: showScores || state === 'missing' ? v : '' });
  }
  return out;
}
/* names of the work files in one unit folder (cached for a minute, so a whole class can look at once) */
function workNames_(u) {
  const cache = CacheService.getScriptCache(), k = 'names:' + u, c = cache.get(k);
  if (c) return JSON.parse(c);
  const it = rootFolder_().getFoldersByName(unitName_(u)), names = [];
  if (it.hasNext()) { const files = it.next().getFiles(); while (files.hasNext()) { const n = files.next().getName(); if (/\.json$/i.test(n)) names.push(n); } }
  try { cache.put(k, JSON.stringify(names), 900); } catch (err) {}   /* listing a Drive folder is slow; the list is refreshed whenever a file is added, renamed or deleted */
  return names;
}
function namesChanged_(u) { try { CacheService.getScriptCache().remove('names:' + u); } catch (err) {} }
/* Pure: rows of the two sheets + file names -> one entry per unit for this student. Matched by class and seat number. */
function mineUnits_(who, subRows, scoreRows, names, manualRows) {
  const seatKey = function (c, s) { const n = Number(s); return String(c == null ? '' : c).trim() + '-' + (isFinite(n) && String(s).trim() !== '' ? String(n) : String(s == null ? '' : s).trim()); };
  const me = seatKey(who.cls, who.seat), byName = {};
  Object.keys(UNITS).forEach(function (u) { byName[UNITS[u]] = u; byName[u] = u; });
  const out = {};
  Object.keys(UNITS).forEach(function (u) {
    const files = (names(u) || []).filter(function (n) { const m = String(n).match(/^(\d+)-(\d+)\s/); return m && seatKey(m[1], m[2]) === me; });
    out[u] = { unit: u, name: UNITS[u], submitted: files.length > 0, time: '', self: '', passed: false, total: '', level: '', comment: '', fixes: '', graded: '' };
  });
  const iso = function (d) { return d instanceof Date ? d.toISOString() : String(d || ''); };
  const nm = String(who.name || '').trim(), byNameRow = {};
  for (let r = 1; r < subRows.length; r++) {
    const x = subRows[r], u = byName[String(x[1])];
    if (!u) continue;
    if (seatKey(x[2], x[3]) === me) { out[u].time = iso(x[0]); out[u].self = score_(x[6]); out[u].passed = String(x[7]) === 'Yes'; }
    else if (nm && String(x[2]).trim() === String(who.cls).trim() && String(x[4]).trim() === nm) byNameRow[u] = x;   // same class and name, seat fixed later
  }
  Object.keys(byNameRow).forEach(function (u) {
    if (out[u].self !== '') return;
    const x = byNameRow[u]; out[u].time = iso(x[0]); out[u].self = score_(x[6]); out[u].passed = String(x[7]) === 'Yes';
  });
  for (let r = 1; r < scoreRows.length; r++) {
    const x = scoreRows[r], u = byName[String(x[0])];
    if (!u || seatKey(x[1], x[2]) !== me) continue;
    out[u].total = String(x[5]).trim() === '' ? '' : num_(x[5]); out[u].level = String(x[6] || ''); out[u].fixes = String(x[14] || ''); out[u].comment = String(x[15] || ''); out[u].graded = iso(x[16]);
  }
  /* the auto-graded score: what the Grading Desk wrote back, otherwise the score the page gave when the work was handed in */
  Object.keys(out).forEach(function (u) { const x = out[u]; x.auto = x.total !== '' ? x.total : (x.submitted ? x.self : ''); x.manual = ''; x.override = ''; x.mcomment = ''; });
  (manualRows || []).slice(1).forEach(function (x) {
    const u = byName[String(x[3])];
    if (!u || seatKey(x[0], x[1]) !== me) return;
    out[u].manual = score_(x[4]); out[u].override = score_(x[5]); out[u].mcomment = String(x[8] == null ? '' : x[8]).trim();
  });
  return Object.keys(out).map(function (u) { return Object.assign(out[u], finalOf_(out[u])); });
}
/* a score typed by the teacher: a number, or '' when the cell is empty */
function score_(v) { const t = String(v == null ? '' : v).trim(); return t !== '' && isFinite(Number(t)) ? Math.round(Number(t) * 10) / 10 : ''; }
/* the score a unit counts as: the teacher's change if there is one, otherwise the higher of the auto-graded and 學習吧 scores
   (auto = Grading Desk score, or the score given when the work was handed in) */
function finalOf_(x) {
  const has = function (v) { return v !== '' && v != null && isFinite(Number(v)); };
  if (has(x.override)) return { final: Number(x.override), source: 'override' };
  let best = null;
  const auto = x.auto !== undefined ? x.auto : x.total;
  if (has(auto)) best = { final: Number(auto), source: 'auto' };
  if (has(x.manual) && (!best || Number(x.manual) > best.final)) best = { final: Number(x.manual), source: 'manual' };
  return best || { final: '', source: x.submitted ? 'waiting' : 'missing' };
}

/* ---------- 成績登錄 Gradebook page: one teacher enters 學習吧 scores and changes final scores ---------- */
const MANUAL_HEAD = ['班級 Class', '座號 No.', '姓名 Name', '單元 Unit', '學習吧分數 Manual', '老師修改 Override', '更新時間 Updated', '更新者 By', '評語 Comment'];
function manualTab_() {
  const ss = sheet_();
  let sh = ss.getSheetByName(CONFIG.MANUAL_TAB);
  if (sh) { if (String(sh.getRange(1, 9).getValue()) !== MANUAL_HEAD[8]) sh.getRange(1, 9).setValue(MANUAL_HEAD[8]).setFontWeight('bold'); return sh; }
  sh = ss.insertSheet(CONFIG.MANUAL_TAB);
  sh.getRange(1, 1, 1, MANUAL_HEAD.length).setValues([MANUAL_HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}
/* rows of every submission log, the old renamed ones first, so later rows (newer) win */
function subRows_() {
  const all = sheet_().getSheets().filter(function (sh) { return sh.getName().indexOf('繳交紀錄 Submissions') === 0; });
  all.sort(function (a, b) { return (a.getName() === '繳交紀錄 Submissions') - (b.getName() === '繳交紀錄 Submissions'); });
  let rows = [['head']];
  all.forEach(function (sh) { rows = rows.concat(sh.getDataRange().getValues().slice(1)); });
  return rows;
}
function manualRows_() { const sh = sheet_().getSheetByName(CONFIG.MANUAL_TAB); return sh ? sh.getDataRange().getValues() : []; }
/* signed in with NTPC OpenID as one of TEACHERS, and the teacher password */
function teacherAuth_(req) {
  if (!CONFIG.TEACHER_KEY || CONFIG.TEACHER_KEY === 'change-me-teacher') return { error: 'key_not_set' };
  const v = verify_(req.idToken);
  if (v.error) return { error: v.error };
  const list = String(CONFIG.TEACHERS || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  const acct = String(v.email || '').toLowerCase();
  if (!acct || list.indexOf(acct) < 0) return { error: 'not_teacher', email: acct };
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { error: 'bad_key' };
  return { email: acct };
}
function classGet_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const ss = sheet_(), sc = ss.getSheetByName('成績 Scores');
  const data = {
    roster: rosterRows_() || [], sub: subRows_(), sc: sc ? sc.getDataRange().getValues() : [], man: manualRows_(),
    names: function (u) { return workNames_(u); }
  };
  const classes = classList_(data);
  const cls = clean_(req.cls) || classes[0] || '';
  const students = cls ? classTable_(cls, data) : [], bonus = bonusCount_(attRows_());
  students.forEach(function (x) { x.bonus = bonus[cls + '|' + x.seat] || 0; });
  return { ok: true, email: a.email, classes: classes, cls: cls, units: Object.keys(UNITS).map(function (u) { return { unit: u, name: UNITS[u] }; }), students: students };
}
/* Pure: every class seen in the roster, file names, submissions, scores and manual scores */
function classList_(d) {
  const set = {};
  const add = function (c) { c = String(c == null ? '' : c).trim(); if (/^\d+$/.test(c) && (!CONFIG.CLASS_PREFIX || c.indexOf(CONFIG.CLASS_PREFIX) === 0)) set[c] = 1; };
  d.roster.forEach(function (x) { add(x.cls); });
  Object.keys(UNITS).forEach(function (u) { (d.names(u) || []).forEach(function (n) { const m = String(n).match(/^(\d+)-/); if (m) add(m[1]); }); });
  d.sub.slice(1).forEach(function (x) { add(x[2]); });
  d.sc.slice(1).forEach(function (x) { add(x[1]); });
  d.man.slice(1).forEach(function (x) { add(x[0]); });
  return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
}
/* Pure: one row per student of the class (roster first, then anyone found in the work), each with all units */
function classTable_(cls, d) {
  const seats = {};
  const put = function (c, s, n) {
    if (String(c == null ? '' : c).trim() !== cls) return;
    const k = String(Number(s) || String(s == null ? '' : s).trim()); if (!k || k === '0') return;
    if (!seats[k]) seats[k] = ''; if (!seats[k] && n) seats[k] = String(n).trim();
  };
  d.roster.forEach(function (x) { put(x.cls, x.seat, x.name); });
  d.man.slice(1).forEach(function (x) { put(x[0], x[1], x[2]); });
  d.sub.slice(1).forEach(function (x) { put(x[2], x[3], x[4]); });
  d.sc.slice(1).forEach(function (x) { put(x[1], x[2], x[3]); });
  Object.keys(UNITS).forEach(function (u) { (d.names(u) || []).forEach(function (n) { const m = String(n).match(/^(\d+)-(\d+)\s+(.+)\.json$/i); if (m) put(m[1], m[2], m[3]); }); });
  return Object.keys(seats).sort(function (a, b) { return Number(a) - Number(b) || a.localeCompare(b); }).map(function (k) {
    const who = { cls: cls, seat: k, name: seats[k] };
    return { cls: cls, seat: k, name: seats[k], units: mineUnits_(who, d.sub, d.sc, d.names, d.man).map(function (x) {
      return unitView_(x);
    }) };
  });
}
/* what the Gradebook page needs to know about one unit of one student */
function unitView_(x) { return { unit: x.unit, submitted: x.submitted, auto: x.auto, total: x.total, manual: x.manual, override: x.override, mcomment: x.mcomment || '', final: x.final, source: x.source }; }
const clip_ = function (t) { return String(t == null ? '' : t).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300); };
/* write one student's 學習吧 score, changed score and comment for one unit ('' clears it) */
function classSet_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const u = UNITS[req.unit] ? req.unit : null;
  const cls = clean_(req.cls), seat = String(Number(req.seat) || ''), name = clean_(req.name);
  if (!u || !/^\d+$/.test(cls) || !seat) return { ok: false, error: 'bad_request' };
  const val = function (v) { const t = String(v == null ? '' : v).trim(); if (t === '') return ''; const n = Number(t); return isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : null; };
  const man = val(req.manual), ovr = val(req.override), com = clip_(req.comment);
  if (man === null || ovr === null) return { ok: false, error: 'bad_score' };
  const sh = manualTab_(), rows = sh.getDataRange().getValues();
  let at = 0;
  for (let r = 1; r < rows.length; r++) {
    if (String(rows[r][0]).trim() === cls && String(Number(rows[r][1])) === seat && String(rows[r][3]) === UNITS[u]) { at = r + 1; break; }
  }
  const keepName = name || (at ? String(rows[at - 1][2] || '') : '');
  if (man === '' && ovr === '' && com === '') { if (at) sh.deleteRow(at); }
  else {
    const row = [cls, seat, keepName, UNITS[u], man, ovr, new Date(), a.email, com];
    if (at) sh.getRange(at, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  }
  const ss = sheet_(), sc = ss.getSheetByName('成績 Scores');
  const x = mineUnits_({ cls: cls, seat: seat, name: keepName }, subRows_(), sc ? sc.getDataRange().getValues() : [], function (v) { return workNames_(v); }, manualRows_())
    .filter(function (y) { return y.unit === u; })[0];
  return { ok: true, unit: unitView_(x) };
}
/* many 學習吧 scores at once: rows of {cls, seat, name, unit, manual, comment}; existing rows are updated, the changed score is kept */
function classImport_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const list = Array.isArray(req.rows) ? req.rows.slice(0, 1000) : [];
  if (!list.length) return { ok: false, error: 'bad_request' };
  const sh = manualTab_(), data = sh.getDataRange().getValues(), now = new Date();
  while (data.length && data[0].length < MANUAL_HEAD.length) data[0].push('');
  data.forEach(function (r) { while (r.length < MANUAL_HEAD.length) r.push(''); });
  const index = {};
  for (let r = 1; r < data.length; r++) index[[String(data[r][0]).trim(), String(Number(data[r][1])), String(data[r][3])].join('|')] = r;
  let added = 0, updated = 0; const skipped = [];
  list.forEach(function (x, i) {
    const u = UNITS[x.unit] ? x.unit : null, cls = clean_(x.cls), seat = String(Number(x.seat) || ''), t = String(x.manual == null ? '' : x.manual).trim(), n = Number(t);
    if (!u || !/^\d+$/.test(cls) || !seat || (t !== '' && !(isFinite(n) && n >= 0 && n <= 100))) { skipped.push(i + 1); return; }
    const man = t === '' ? '' : Math.round(n * 10) / 10, com = clip_(x.comment), k = [cls, seat, UNITS[u]].join('|');
    if (man === '' && com === '') { skipped.push(i + 1); return; }
    if (index[k] !== undefined) { const row = data[index[k]]; row[2] = clean_(x.name) || row[2]; row[4] = man; row[6] = now; row[7] = a.email; row[8] = com; updated++; }
    else { data.push([cls, seat, clean_(x.name), UNITS[u], man, '', now, a.email, com]); index[k] = data.length - 1; added++; }
  });
  sh.getRange(1, 1, data.length, MANUAL_HEAD.length).setValues(data);
  sh.getRange(1, 1, 1, MANUAL_HEAD.length).setValues([MANUAL_HEAD]).setFontWeight('bold');
  return { ok: true, added: added, updated: updated, skipped: skipped };
}

/* ---------- sign-in with 新北市教育局 OpenID (OpenID 2.0) ---------- */
const NTPC_OP = 'https://openid.ntpc.edu.tw/OpenId/Provider';
const NTPC_SREG = 'http://openid.net/extensions/sreg/1.1';
const NTPC_HOURS = 4;   // a sign-in lasts this long
function ntpcReturn_() { return ScriptApp.getService().getUrl() || ''; }
/* is this return_to one of our own web app addresses? getUrl() often gives the …/dev address instead of the deployment's …/exec,
   so the deployment ids in NTPC_WEBAPP (optional) count too; with neither, any script.google.com web app address is accepted */
function ntpcOwnUrl_(u) {
  const id = execId_(u);
  if (!id) return false;
  const own = [execId_(ntpcReturn_())].concat(String(CONFIG.NTPC_WEBAPP || '').split(/[,\s]+/).map(execId_)).filter(Boolean);
  return !own.length || own.indexOf(id) >= 0;
}
/* the deployment id in …/macros/s/<id>/exec, so the two spellings of the same web app URL match */
function execId_(u) { const m = String(u || '').split('?')[0].match(/^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+|macros)\/s\/([\w-]+)\/exec$/); return m ? m[1] : null; }
function sites_() { return String(CONFIG.NTPC_SITE || '').split(/[,\s]+/).filter(function (x) { return /^https:\/\/[^/]+\//.test(x); }); }
function originOf_(u) { const m = String(u || '').match(/^https:\/\/[^/]+/); return m ? m[0] : ''; }
function ntpcSecret_() {
  const p = PropertiesService.getScriptProperties();
  let k = p.getProperty('NTPC_SECRET');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('NTPC_SECRET', k); }
  return k;
}
function b64_(s) { return Utilities.base64EncodeWebSafe(s, Utilities.Charset.UTF_8).replace(/=+$/, ''); }
function unb64_(s) { return Utilities.newBlob(Utilities.base64DecodeWebSafe(String(s) + '==='.slice((String(s).length + 3) % 4))).getDataAsString('UTF-8'); }
function sign_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, ntpcSecret_())).replace(/=+$/, ''); }

/* The OpenID server sends the student back here; check the reply with the server, then hand out our own signed sign-in. */
function ntpcLogin_(q) {
  if (!CONFIG.NTPC_OPENID) return { ok: false, error: 'login_off' };
  const r = ntpcCheck_(q, function (body) {
    return UrlFetchApp.fetch(NTPC_OP, { method: 'post', payload: body, muteHttpExceptions: true }).getContentText();
  }, function (nonce) {
    const c = CacheService.getScriptCache(), k = 'nonce:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, nonce));
    if (c.get(k)) return false;
    c.put(k, '1', 21600); return true;
  });
  if (r.error) return { ok: false, error: r.error, why: r.why || '' };
  const exp = Math.floor(Date.now() / 1000) + NTPC_HOURS * 3600;
  const body = b64_(JSON.stringify({ c: r.who.cls, s: r.who.seat, n: r.who.name, a: r.account, r: r.role, e: exp }));
  return { ok: true, email: r.account, who: r.who, role: r.role, exp: exp, token: 'ntpc.' + body + '.' + sign_(body) };
}
/* the small page the student sees after signing in: it passes the result to the work page and closes */
function ntpcPage_(q) {
  let r;
  try { r = ntpcLogin_(q); } catch (err) { r = { ok: false, error: 'server_error', why: String(err && err.message || err).slice(0, 120) }; }
  const sites = sites_();
  let back = String(q.back || '');
  if (!sites.some(function (x) { return back.indexOf(x) === 0; })) back = sites[0] || '';   // only ever go back to our own site
  const msg = { type: 'ntpc-login', ok: !!r.ok, error: r.error || '' };
  if (r.ok) msg.user = { cls: r.who.cls, seat: r.who.seat, name: r.who.name, student: r.who.student, email: r.email, role: r.role, exp: r.exp, token: r.token };
  const data = JSON.stringify(msg).replace(/</g, '\\u003c');
  const link = back ? back.split('#')[0] + '#ntpc=' + b64_(JSON.stringify(msg)) : '';
  const esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const text = r.ok ? '✓ 登入成功 Signed in：' + esc(r.who.student || r.who.name) + '<br><small>這個視窗會自動關閉。This window will close.</small>'
    : '登入沒有成功 Sign-in failed（' + esc(r.error) + (r.why ? '：' + esc(r.why) : '') + '）<br><small>' + esc(NTPC_MSG[r.error] || '請再試一次，或告訴老師。') + '</small>';
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;padding:32px 20px;text-align:center;color:#1f2933}a{display:inline-block;margin-top:16px;padding:10px 18px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none}small{color:#52606d}</style>' +
    '<p>' + text + '</p>' + (link ? '<a id="back" target="_top" href="' + esc(link) + '">回到作業 Back to my work</a>' : '') +
    '<script>(function(){var d=' + data + ',o=' + JSON.stringify(originOf_(back)) + ',sent=false;' +
    'try{var w=window.top.opener;if(w&&o){w.postMessage(d,o);sent=true;}}catch(e){}' +
    'if(sent&&d.ok)setTimeout(function(){try{window.top.close();}catch(e){}},600);})();<\/script>';
  return HtmlService.createHtmlOutput(html).setTitle('新北市 OpenID 登入 Sign in');
}
const NTPC_MSG = {
  ntpc_cancel: '你取消了登入。You cancelled the sign-in.',
  not_school: '這個帳號不是本校的學生或老師。This account is not from our school.',
  bad_openid: '登入驗證失敗，請重新登入。Please sign in again.',
  login_expired: '登入逾時，請重新登入。Please sign in again.',
  ntpc_no_data: '沒有收到姓名資料，請在授權畫面按「同意」。Please allow sharing your profile.',
  ntpc_no_class: '校務行政系統裡沒有你的班級座號，請告訴老師。Your class is missing; tell your teacher.',
  login_off: '老師還沒開啟登入功能。Sign-in is not turned on yet.'
};
function ntpcVerify_(token) {
  const p = String(token).split('.');
  if (p.length !== 3 || sign_(p[1]) !== p[2]) return { error: 'bad_token' };
  let d; try { d = JSON.parse(unb64_(p[1])); } catch (err) { return { error: 'bad_token' }; }
  if (Number(d.e) * 1000 < Date.now()) return { error: 'login_expired' };
  return { email: d.a, exp: d.e, who: who_({ cls: d.c, seat: d.s, name: d.n }) };
}

/* Pure checks, kept apart from Google services so they can be tested. post(body) returns the server's reply; fresh(nonce) is false for a reused nonce. */
function ntpcCheck_(q, post, fresh) {
  const g = function (k) { return q['openid.' + k] == null ? '' : String(q['openid.' + k]); };
  if (g('mode') === 'cancel') return { error: 'ntpc_cancel' };
  const bad = function (why) { return { error: 'bad_openid', why: why }; };
  if (g('mode') !== 'id_res' || g('ns') !== 'http://specs.openid.net/auth/2.0') return bad('mode');
  if (g('op_endpoint').replace(/\/+$/, '').toLowerCase() !== NTPC_OP.toLowerCase()) return bad('op_endpoint');
  if (!ntpcOwnUrl_(g('return_to'))) return bad('return_to');
  if (!/^https?:\/\/openid\.ntpc\.edu\.tw\//i.test(g('claimed_id'))) return bad('claimed_id');
  const m = g('response_nonce').match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)/);
  if (!m || Math.abs(Date.now() - Date.parse(m[1])) > 10 * 60 * 1000) return { error: 'login_expired' };
  /* the sreg alias the server used (usually "sreg") */
  let alias = '';
  Object.keys(q).forEach(function (k) { const a = k.match(/^openid\.ns\.(\w+)$/); if (a && String(q[k]) === NTPC_SREG) alias = a[1]; });
  if (!alias) return { error: 'ntpc_no_data' };
  const signed = ',' + g('signed') + ',';
  const need = ['op_endpoint', 'return_to', 'response_nonce', 'assoc_handle', 'claimed_id', 'identity', alias + '.fullname', alias + '.timezone'];
  const unsigned = need.filter(function (k) { return signed.indexOf(',' + k + ',') < 0; });
  if (unsigned.length) return bad('unsigned:' + unsigned.join('+'));
  if (q['openid.' + alias + '.language'] != null && signed.indexOf(',' + alias + '.language,') < 0) return bad('unsigned:' + alias + '.language');
  /* ask the OpenID server whether it really signed this */
  const body = {};
  Object.keys(q).forEach(function (k) { if (/^openid\./.test(k)) body[k] = String(q[k]); });
  body['openid.mode'] = 'check_authentication';
  const reply = String(post(body) || '');
  if (!/(^|\n)is_valid:true(\r?\n|$)/.test(reply)) return bad('is_valid:' + reply.replace(/\s+/g, ' ').trim().slice(0, 80));
  if (!fresh(g('response_nonce') + '|' + g('claimed_id'))) return bad('nonce_used');
  /* who it is */
  const sr = function (k) { return g(alias + '.' + k).trim(); };
  let places = [];
  try { places = JSON.parse(sr('timezone') || '[]'); } catch (err) { places = []; }
  if (!Array.isArray(places)) places = [places];
  const school = String(CONFIG.NTPC_SCHOOL || '').trim();
  const short = function (t) { return String(t || '').replace(/國民中學/g, '國中').replace(/國民小學/g, '國小').replace(/\s/g, ''); };   // 新北市立忠孝國民中學 → 新北市立忠孝國中
  const here = places.filter(function (x) { return x && (!school || short(x.name).indexOf(short(school)) >= 0 || String(x.id || '') === school); });
  if (!here.length) return { error: 'not_school' };
  const roles = here.map(function (x) { return String(x.role || ''); });
  const role = roles.indexOf('學生') >= 0 ? '學生' : roles.indexOf('教師') >= 0 ? '教師' : roles.indexOf('管理員') >= 0 ? '管理員' : '';
  if (!role) return { error: 'not_school' };
  const name = sr('fullname') || sr('nickname');
  if (!name) return { error: 'ntpc_no_data' };
  let cls = '', seat = '';
  const lang = sr('language').match(/^(\d{2})(\d{2})(\d{2})/);
  if (role === '學生') {
    if (!lang) return { error: 'ntpc_no_class' };
    cls = String(Number(lang[1])) + lang[2]; seat = String(Number(lang[3]));
  }
  const account = g('claimed_id').replace(/\/+$/, '').split('/').pop();
  return { who: who_({ cls: cls, seat: seat, name: name }), role: role, account: account };
}

/* ---------- helpers ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s == null ? '' : s).replace(/[\\/:*?"<>|\r\n\t]/g, ' ').trim().slice(0, 80); }
function who_(x) {
  let cls = clean_(x.cls), seat = clean_(x.seat), name = clean_(x.name);
  if (!name && x.student) {
    const st = clean_(x.student);
    let m = st.match(/^(\d+)\s*[-\s]\s*(\d+)\s+(.+)$/);
    if (m) { cls = m[1]; seat = m[2]; name = m[3]; }
    else if ((m = st.match(/^(\d+)\s+(.+)$/))) { seat = m[1]; name = m[2]; }
    else name = st;
  }
  const student = (cls ? cls + (seat ? '-' : '') : '') + seat + ((cls || seat) ? ' ' : '') + name;
  return { cls: cls, seat: seat, name: name, student: name ? student : '' };
}
function num_(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 10) / 10 : ''; }

function rootFolder_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (err) {} }
  const f = DriveApp.createFolder(CONFIG.FOLDER_NAME);
  p.setProperty('FOLDER_ID', f.getId());
  return f;
}
function unitFolder_(unit) {
  const root = rootFolder_(), name = unitName_(unit);
  const it = root.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  /* works submitted before this unit had a display name were saved in a folder named after its key */
  const old = root.getFoldersByName(String(unit));
  if (old.hasNext()) { const f = old.next(); f.setName(name); return f; }
  return root.createFolder(name);
}
let SS_ = null;   /* opened once per request: opening the spreadsheet is slow */
function sheet_() {
  if (SS_) return SS_;
  SS_ = openSheet_();
  return SS_;
}
function openSheet_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (err) {} }
  const ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(rootFolder_());
  p.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function tab_(name, head) {
  const ss = sheet_();
  let sh = ss.getSheetByName(name);
  if (sh && sh.getLastRow() >= 1 && String(sh.getRange(1, 3).getValue()) !== head[2]) {
    if (sh.getLastRow() <= 1) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); }
    else { sh.setName(name + ' (舊 old)'); sh = null; }
  }
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
    const first = ss.getSheets()[0];
    if (first.getName() === '工作表1' || first.getName() === 'Sheet1') { if (first.getLastRow() === 0) ss.deleteSheet(first); }
  }
  return sh;
}

/* ---------- 座位表與點名 Seating and attendance (teacher only, in the Gradebook) ---------- */
/* Computer-room layout: [seat, x %, y %]; the podium is at the bottom. */
const SEAT_KEYS = ['left-13', 'left-1', 'left-2', 'left-3', 'left-14', 'left-4', 'left-5', 'left-6', 'left-15', 'left-7', 'left-8', 'left-9', 'left-16', 'left-10', 'left-11', 'left-12',
  'right-1', 'right-2', 'right-3', 'right-4', 'right-5', 'right-6', 'right-7', 'right-8', 'right-9', 'right-10', 'right-11', 'right-12', 'right-13', 'right-14', 'right-15', 'right-16'];
const SEAT_TAB = '座位表 Seating', SEAT_HEAD = ['班級 Class', '座位 Seat', '座號 No.', '姓名 Name', '更新時間 Updated', '更新者 By'];
const ATT_TAB = '點名紀錄 Attendance', ATT_HEAD = ['編號 ID', '日期 Date', '班級 Class', '座號 No.', '姓名 Name', '類型 Type', '理由 Reason', '加分 Points', '建立時間 Created', '建立者 By'];
const ATT_TYPES = { leave: '事病假', late: '遲到', bonus: '加分' };
function attType_(t) { t = String(t == null ? '' : t).trim(); if (ATT_TYPES[t]) return t; for (const k in ATT_TYPES) if (ATT_TYPES[k] === t) return k; return ''; }
function day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Taipei', 'yyyy-MM-dd');
  const m = String(v == null ? '' : v).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function seatRows_() { const sh = sheet_().getSheetByName(SEAT_TAB); return sh ? sh.getDataRange().getValues() : []; }
function attRows_() { const sh = sheet_().getSheetByName(ATT_TAB); return sh ? sh.getDataRange().getValues() : []; }
/* Pure: 'cls|seat' -> number of +1 */
function bonusCount_(rows) {
  const out = {};
  (rows || []).slice(1).forEach(function (r) {
    if (attType_(r[5]) !== 'bonus') return;
    const k = String(r[2]).trim() + '|' + String(Number(r[3]) || r[3]); out[k] = (out[k] || 0) + (Number(r[7]) || 1);
  });
  return out;
}
/* Pure: one class's seats, students and records */
function roomOf_(cls, seatRows, attRows, roster, manRows) {
  const seats = {}, students = {}, records = [];
  (seatRows || []).slice(1).forEach(function (r) {
    if (String(r[0]).trim() !== cls || SEAT_KEYS.indexOf(String(r[1])) < 0) return;
    const n = String(Number(r[2]) || ''); if (n) { seats[String(r[1])] = n; if (r[3] && !students[n]) students[n] = String(r[3]).trim(); }
  });
  (roster || []).forEach(function (x) { if (x.cls === cls) { const n = String(Number(x.seat) || ''); if (n) students[n] = x.name; } });
  (manRows || []).slice(1).forEach(function (r) { if (String(r[0]).trim() === cls) { const n = String(Number(r[1]) || ''); if (n && !students[n] && r[2]) students[n] = String(r[2]).trim(); } });
  (attRows || []).slice(1).forEach(function (r) {
    if (String(r[2]).trim() !== cls) return;
    const n = String(Number(r[3]) || ''), t = attType_(r[5]); if (!n || !t) return;
    if (!students[n] && r[4]) students[n] = String(r[4]).trim();
    records.push({ id: String(r[0]), date: day_(r[1]), seat: n, name: String(r[4] || ''), type: t, reason: String(r[6] || ''), points: Number(r[7]) || 0 });
  });
  records.sort(function (a, b) { return b.date.localeCompare(a.date) || Number(a.seat) - Number(b.seat); });
  return {
    seats: seats, records: records,
    students: Object.keys(students).sort(function (a, b) { return Number(a) - Number(b); }).map(function (n) { return { seat: n, name: students[n] }; })
  };
}
function roomGet_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const cls = clean_(req.cls);
  if (!/^\d+$/.test(cls)) return { ok: false, error: 'bad_request' };
  const r = roomOf_(cls, seatRows_(), attRows_(), rosterRows_() || [], manualRows_());
  return { ok: true, cls: cls, seatKeys: SEAT_KEYS, seats: r.seats, students: r.students, records: r.records };
}
/* save a class's whole seating chart: seats = {seatKey: seat number} */
function seatSet_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const cls = clean_(req.cls), map = req.seats && typeof req.seats === 'object' ? req.seats : null;
  if (!/^\d+$/.test(cls) || !map) return { ok: false, error: 'bad_request' };
  const names = {}; (Array.isArray(req.names) ? req.names : []).forEach(function (x) { if (x && x.seat) names[String(Number(x.seat))] = clean_(x.name); });
  const used = {}, rows = [], now = new Date();
  for (const k in map) {
    const n = String(Number(map[k]) || '');
    if (SEAT_KEYS.indexOf(k) < 0 || !n || used[n]) return { ok: false, error: 'bad_seats' };
    used[n] = 1; rows.push([cls, k, n, names[n] || '', now, a.email]);
  }
  writeSeats_({ [cls]: rows });
  return { ok: true, saved: rows.length };
}
function writeSeats_(byCls) {
  const sh = tab_(SEAT_TAB, SEAT_HEAD), data = sh.getDataRange().getValues();
  const keep = [SEAT_HEAD].concat(data.slice(1).filter(function (r) { return !byCls[String(r[0]).trim()]; }));
  Object.keys(byCls).forEach(function (c) { byCls[c].forEach(function (r) { keep.push(r); }); });
  sh.clearContents();
  sh.getRange(1, 1, keep.length, SEAT_HEAD.length).setValues(keep);
  sh.getRange(1, 1, 1, SEAT_HEAD.length).setFontWeight('bold');
}
function attAdd_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const cls = clean_(req.cls), seat = String(Number(req.seat) || ''), t = attType_(req.type), date = day_(req.date);
  if (!/^\d+$/.test(cls) || !seat || !t || !date) return { ok: false, error: 'bad_request' };
  const id = Utilities.getUuid().slice(0, 8), row = [id, date, cls, seat, clean_(req.name), ATT_TYPES[t], clip_(req.reason), t === 'bonus' ? 1 : 0, new Date(), a.email];
  const sh = tab_(ATT_TAB, ATT_HEAD);
  sh.appendRow(row);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat('@');
  return { ok: true, record: { id: id, date: date, seat: seat, name: row[4], type: t, reason: row[6], points: row[7] } };
}
function attDel_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const id = String(req.id || '');
  const sh = sheet_().getSheetByName(ATT_TAB);
  if (!id || !sh) return { ok: false, error: 'not_found' };
  const v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let r = v.length - 1; r >= 1; r--) if (String(v[r][0]) === id) { sh.deleteRow(r + 1); return { ok: true }; }
  return { ok: false, error: 'not_found' };
}
/* bring in an old seating chart and attendance records; the same record twice is skipped */
function roomImport_(req) {
  const a = teacherAuth_(req);
  if (a.error) return { ok: false, error: a.error, email: a.email || '' };
  const seats = Array.isArray(req.seats) ? req.seats.slice(0, 2000) : [], recs = Array.isArray(req.records) ? req.records.slice(0, 5000) : [];
  const now = new Date(), byCls = {}, used = {}; let seatCount = 0; const skipped = [];
  seats.forEach(function (x, i) {
    const cls = clean_(x.cls), k = String(x.key || ''), n = String(Number(x.seat) || '');
    if (!/^\d+$/.test(cls) || SEAT_KEYS.indexOf(k) < 0 || !n || used[cls + '|' + n] || used[cls + '#' + k]) { skipped.push('seat ' + (i + 1)); return; }
    used[cls + '|' + n] = used[cls + '#' + k] = 1;
    (byCls[cls] = byCls[cls] || []).push([cls, k, n, clean_(x.name), now, a.email]); seatCount++;
  });
  if (seatCount) writeSeats_(byCls);
  let added = 0, dup = 0;
  if (recs.length) {
    const sh = tab_(ATT_TAB, ATT_HEAD), have = {};
    sh.getDataRange().getValues().slice(1).forEach(function (r) { have[[day_(r[1]), String(r[2]).trim(), String(Number(r[3])), attType_(r[5]), String(r[8] instanceof Date ? r[8].getTime() : r[8])].join('|')] = 1; });
    const out = [];
    recs.forEach(function (x, i) {
      const cls = clean_(x.cls), n = String(Number(x.seat) || ''), t = attType_(x.type), d = day_(x.date);
      const when = x.created ? new Date(String(x.created).replace(' ', 'T').replace(/\+00$/, 'Z')) : now;
      const at = isNaN(when.getTime()) ? now : when;
      if (!/^\d+$/.test(cls) || !n || !t || !d) { skipped.push('record ' + (i + 1)); return; }
      const k = [d, cls, n, t, String(at.getTime())].join('|');
      if (have[k]) { dup++; return; }
      have[k] = 1;
      out.push([Utilities.getUuid().slice(0, 8), d, cls, n, clean_(x.name), ATT_TYPES[t], clip_(x.reason === 'null' ? '' : x.reason), t === 'bonus' ? 1 : 0, at, a.email]);
    });
    if (out.length) {
      const start = sh.getLastRow() + 1;
      sh.getRange(start, 2, out.length, 1).setNumberFormat('@');
      sh.getRange(start, 1, out.length, ATT_HEAD.length).setValues(out);
    }
    added = out.length;
  }
  return { ok: true, seats: seatCount, records: added, duplicates: dup, skipped: skipped };
}
