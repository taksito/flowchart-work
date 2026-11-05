/*
 * Flowchart Work 設定檔 Settings
 * submitUrl：Google Apps Script 的部署網址（…/exec）。留空 = 不顯示「Submit 繳交」按鈕。
 * needCode：Apps Script 的 CLASS_CODE 有填時改成 true，學生繳交時會多一格「班級代碼」。
 * googleClientId：學生用學校 Google 帳號登入的 OAuth 用戶端 ID；留空 = 學生自己填班級座號姓名。
 * emailDomain：學校帳號的網域。
 * classPrefix：批改台只顯示這個年級的班級（'7' = 七年級）；留空 = 全部班級。
 * 設定步驟請看 GOOGLE-DRIVE.md。
 */
window.FLOW_CONFIG = {
  submitUrl: 'https://script.google.com/macros/s/AKfycbwVsZ9SD4eh5X7R-FsiieqgIfns-XlEDMxqXiZAoR9JOLqYzL_PPi5LvCBwfGMj6Gcj/exec',
  needCode: false,
  googleClientId: '',
  emailDomain: 'apps.ntpc.edu.tw',
  classPrefix: '7'
};
