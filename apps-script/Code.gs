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
 */
const CONFIG = {
  TEACHER_KEY: 'change-me-teacher',   // 教師密碼：批改台載入作業、寫回成績時要用。請一定要改掉。
  CLASS_CODE: '',                     // 班級代碼：留空 = 不需要；填了學生繳交時要輸入同樣的代碼。
  FOLDER_NAME: 'Flowchart Work 作業',   // Drive 裡的資料夾名稱
  SHEET_NAME: 'Flowchart Work 成績',    // 試算表名稱
  GOOGLE_CLIENT_ID: '',               // 學生登入用的 OAuth 用戶端 ID（…apps.googleusercontent.com）；留空 = 不用登入
  EMAIL_DOMAIN: 'apps.ntpc.edu.tw',   // 只接受這個網域的學校帳號
  ROSTER_TAB: '名單 Roster',           // 名單工作表名稱
  CLASS_PREFIX: '7',                  // 只用這個年級的班級（例如 7 = 七年級）；留空 = 全部班級
};

const UNITS = { bmi: 'BMI', score: 'Pass or Fail', scratch: 'Scratch Pass or Fail', 'scratch-bmi': 'Scratch BMI', sum: 'Summation', 'scratch-sum': 'Scratch Summation' };
/* Units added later work without changing this file: any short lowercase name is accepted. */
function unitName_(u) { return UNITS[u] || (/^[a-z][a-z0-9-]{1,30}$/.test(String(u || '')) ? String(u) : null); }
const SUB_HEAD = ['繳交時間 Time', '單元 Unit', '班級 Class', '座號 No.', '姓名 Name', '作品 Title', '自我批改分數 Self-check', '達成 Passed', '英文使用率 English %', '檔案 File', 'Email', '電腦代號 Device'];
const SCORE_HEAD = ['單元 Unit', '班級 Class', '座號 No.', '姓名 Name', '作品 Title', '總分 Total', '等第 Level', 'Structure 結構', 'Input 輸入', 'Process 計算', 'Decision 判斷', 'Output 輸出', 'Test run 執行測試', '英文使用率 English %', '需要修正 Fixes', '評語 Comment', '批改時間 Graded'];

/* ---------- one-time setup ---------- */
function setup() {
  const folder = rootFolder_();
  const ss = sheet_();
  if (CONFIG.GOOGLE_CLIENT_ID) {
    UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=x', { muteHttpExceptions: true });  // asks for permission to verify sign-ins
    const map = roster_(true);
    Logger.log(map ? '名單 Roster: ' + Object.keys(map).length + ' 位學生有 Email' : '找不到「' + CONFIG.ROSTER_TAB + '」工作表，請把學生名單匯入成績試算表');
  }
  Logger.log('資料夾 Folder: ' + folder.getUrl());
  Logger.log('試算表 Sheet: ' + ss.getUrl());
}

/* ---------- web app ---------- */
function doGet() {
  return json_({ ok: true, app: 'Flowchart Work', units: Object.keys(UNITS) });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  /* read-only actions for "Load all": no lock, so several batches can run at once */
  if (req.action === 'index' || req.action === 'fetch') {
    try { return json_(req.action === 'index' ? index_(req) : fetch_(req)); } catch (err) { return json_({ ok: false, error: 'server_error', message: String(err) }); }
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
  if (CONFIG.GOOGLE_CLIENT_ID) {
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
  if (file) { file.setContent(content); f = file; } else { f = folder.createFile(name, content, MimeType.PLAIN_TEXT); }

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
  if (name !== f.getName()) f.setName(name);
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
      num_(x.english), String(x.fixes || ''), String(x.comment || ''), now];
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
function verify_(token) {
  if (!token) return { error: 'login_required' };
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
function sheet_() {
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
