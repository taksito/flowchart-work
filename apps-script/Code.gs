/**
 * Flowchart Work — Google Drive backend 雲端繳交與成績登記
 *
 * 1. 改下面的 CONFIG（至少改 TEACHER_KEY）。
 * 2. 選函式 setup，按「執行」一次，允許存取 Google Drive 和試算表。
 * 3. 部署 → 新增部署 → 網頁應用程式：執行身分「我」，存取權「任何人」。
 * 4. 把部署網址貼到 GitHub 的 config.js，以及批改台的「Google Drive」設定。
 */
const CONFIG = {
  TEACHER_KEY: 'change-me-teacher',   // 教師密碼：批改台載入作業、寫回成績時要用。請一定要改掉。
  CLASS_CODE: '',                     // 班級代碼：留空 = 不需要；填了學生繳交時要輸入同樣的代碼。
  FOLDER_NAME: 'Flowchart Work 作業',   // Drive 裡的資料夾名稱
  SHEET_NAME: 'Flowchart Work 成績',    // 試算表名稱
};

const UNITS = { bmi: 'BMI', score: 'Pass or Fail', scratch: 'Scratch Pass or Fail', 'scratch-bmi': 'Scratch BMI', sum: 'Summation', 'scratch-sum': 'Scratch Summation' };
/* Units added later work without changing this file: any short lowercase name is accepted. */
function unitName_(u) { return UNITS[u] || (/^[a-z][a-z0-9-]{1,30}$/.test(String(u || '')) ? String(u) : null); }
const SUB_HEAD = ['繳交時間 Time', '單元 Unit', '班級 Class', '座號 No.', '姓名 Name', '作品 Title', '自我批改分數 Self-check', '達成 Passed', '英文使用率 English %', '檔案 File'];
const SCORE_HEAD = ['單元 Unit', '班級 Class', '座號 No.', '姓名 Name', '作品 Title', '總分 Total', '等第 Level', 'Structure 結構', 'Input 輸入', 'Process 計算', 'Decision 判斷', 'Output 輸出', 'Test run 執行測試', '英文使用率 English %', '需要修正 Fixes', '評語 Comment', '批改時間 Graded'];

/* ---------- one-time setup ---------- */
function setup() {
  const folder = rootFolder_();
  const ss = sheet_();
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
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (req.action === 'submit') return json_(submit_(req));
    if (req.action === 'list') return json_(list_(req));
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
  const who = who_(req);
  if (!who.name) return { ok: false, error: 'no_name' };
  const student = who.student;
  const work = req.work;
  const isFlow = work && Array.isArray(work.nodes) && Array.isArray(work.edges);
  const isBlocks = work && work.workspace && typeof work.workspace === 'object';
  if (!isFlow && !isBlocks) return { ok: false, error: 'bad_work' };
  if (JSON.stringify(work).length > 500000) return { ok: false, error: 'too_large' };
  work.task = unit;
  work.student = student; work.cls = who.cls; work.seat = who.seat; work.name = who.name;
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
  sh.appendRow([new Date(), unitName_(unit), who.cls, who.seat, who.name, clean_(req.title), num_(ck.total), ck.passed ? 'Yes' : 'No', num_(ck.english), f.getUrl()]);
  return { ok: true, time: work.submittedAt, file: name };
}

function list_(req) {
  if (String(req.key || '') !== CONFIG.TEACHER_KEY) return { ok: false, error: 'bad_key' };
  const units = req.unit && unitName_(req.unit) ? [req.unit] : Object.keys(UNITS);
  const works = [];
  units.forEach(function (u) {
    const files = unitFolder_(u).getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (!/\.json$/i.test(f.getName())) continue;
      try {
        const w = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
        w.task = u;
        works.push({ unit: u, file: f.getName(), updated: f.getLastUpdated().toISOString(), work: w });
      } catch (err) {}
    }
  });
  return { ok: true, works: works, sheetUrl: sheet_().getUrl(), folderUrl: rootFolder_().getUrl() };
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
