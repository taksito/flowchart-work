/*
 * Flowchart Work 設定檔 Settings
 * submitUrl：Google Apps Script 的部署網址（…/exec）。留空 = 不顯示「Submit 繳交」按鈕。
 * needCode：Apps Script 的 CLASS_CODE 有填時改成 true，學生繳交時會多一格「班級代碼」。
 * googleClientId：學生用學校 Google 帳號登入的 OAuth 用戶端 ID；留空 = 學生自己填班級座號姓名。
 * ntpcOpenId：true = 學生用新北市 OpenID（校務行政帳號）登入後繳交；Code.gs 的 NTPC_OPENID 也要改成 true。
 * emailDomain：學校帳號的網域。
 * assignments：「我的成績」頁要列出、計算缺交的作業（順序就是顯示順序）；留空 [] = 全部列出。
 * classPrefix：批改台只顯示這個年級的班級（'7' = 七年級）；留空 = 全部班級。
 * 設定步驟請看 GOOGLE-DRIVE.md。
 */
window.FLOW_CONFIG = {
  submitUrl: 'https://script.google.com/macros/s/AKfycby7YY7rN7IuE-C9Yx4--0uBNkOb-p77yHbu06Xxyp_D4B0UgbpE4UQ6-gP6PVG4jFl9/exec',
  needCode: false,
  googleClientId: '',
  ntpcOpenId: true,
  emailDomain: 'apps.ntpc.edu.tw',
  classPrefix: '7',
  assignments: ['bmi', 'score', 'sum', 'scratch', 'scratch-bmi', 'scratch-sum', 'scratch-pw']
};
