# Google Drive setup 雲端繳交與成績登記設定

設定好之後：

- 學生在 **BMI Drawing Tool** 和 **Pass or Fail Tool** 按 **Submit 繳交**，作業會直接存進你的 Google Drive，並在試算表記下一筆繳交紀錄。
- 你在 **Grading Desk 批改台** 按 **Google Drive → Load from Drive 從雲端載入**，一次載入全班作業；批改完按 **Save scores 寫回成績**，分數、等第和評語會寫進同一張試算表。

全部免費，只需要你的 Google 帳號。整個設定大約 10 分鐘，只要做一次。

---

## 1. Create the script 建立 Apps Script

1. 用你的 Google 帳號打開 <https://script.google.com>，按 **新專案**。
2. 把編輯器裡原本的內容全部刪掉，貼上本專案的 [`apps-script/Code.gs`](apps-script/Code.gs)。
3. 修改最上面的 `CONFIG`：
   - `TEACHER_KEY`：**一定要改**，改成只有你知道的教師密碼。批改台載入作業和寫回成績時要用。
   - `CLASS_CODE`：想擋掉亂送的檔案就填一個班級代碼，例如 `801`；不需要就留空 `''`。
4. 按 💾 儲存，專案名稱可以取「Flowchart Work」。

## 2. Run setup once 執行一次 setup

1. 上方函式選單選 **setup**，按 **執行**。
2. 第一次會要求授權：選你的帳號 → 若出現「Google 尚未驗證這個應用程式」，按 **進階** → **前往 Flowchart Work（不安全）** → **允許**。這是你自己寫的程式，所以 Google 會這樣提醒。
3. 執行完，你的 Drive 會出現資料夾 **Flowchart Work 作業**，裡面有試算表 **Flowchart Work 成績**。

## 3. Deploy as a web app 部署成網頁應用程式

1. 右上角 **部署 → 新增部署作業**。
2. 齒輪選 **網頁應用程式**。
3. **執行身分**：我（你的帳號）。
4. **具有存取權的使用者**：**任何人**。
5. 按 **部署**，複製「網頁應用程式網址」，長得像 `https://script.google.com/macros/s/……/exec`。

> 學校帳號注意：如果選不到「任何人」，代表學校的 Google Workspace 管理員關掉了這個選項。可以請管理員開放，或改用個人 Gmail 帳號做這份 Apps Script（作業會存到那個帳號的 Drive）。選「僅限學校網域」的話，網頁沒辦法從 GitHub 連進來，所以不能用。

## 4. Put the URL into config.js 把網址填進 config.js

1. 在 GitHub 打開本專案的 [`config.js`](config.js)，按右上角鉛筆 ✏️ 編輯。
2. 把網址貼到 `submitUrl: ''` 的引號中間。
3. 如果第 1 步有填 `CLASS_CODE`，把 `needCode: false` 改成 `needCode: true`。
4. 按 **Commit changes**。等一兩分鐘 GitHub Pages 更新後，BMI 和 Pass or Fail 頁面就會出現 **Submit 繳交** 按鈕。

```js
window.FLOW_CONFIG = {
  submitUrl: 'https://script.google.com/macros/s/……/exec',
  needCode: true
};
```

## 5. Connect the grading desk 連接批改台

1. 打開 **Grading Desk 批改台**，按上方 **Google Drive**。
2. 部署網址會自動帶入；輸入你的 **教師密碼**（只存在這台電腦的瀏覽器）。
3. 選好單元（BMI 或 Pass or Fail），按 **Load from Drive 從雲端載入**。
4. 批改、看評語，最後按 **Save scores 寫回成績**。同一位學生再寫回一次，會更新原本那一列，不會重複。

---

## What goes where 資料放在哪裡

| 位置 | 內容 |
|---|---|
| `Flowchart Work 作業/BMI/` | 每位學生一個 `座號姓名.json`，重交會覆蓋成最新版本 |
| `Flowchart Work 作業/Pass or Fail/` | 同上 |
| 試算表「繳交紀錄 Submissions」 | 每次繳交一列：時間、單元、姓名、自我批改分數、是否達成、英文使用率、檔案連結 |
| 試算表「成績 Scores」 | 批改台寫回的成績：總分、等第、各項分數、需要修正、評語、批改時間 |

## Updating the script 之後修改程式

改了 `Code.gs`（例如換教師密碼或班級代碼）之後，要到 **部署 → 管理部署作業 → ✏️ 編輯 → 版本選「新版本」→ 部署**，網址不會變。

## Troubleshooting 常見問題

- **學生按 Submit 出現「連不上雲端」**：確認 `config.js` 的網址結尾是 `/exec`，部署存取權是「任何人」。學生也可以先用「下載作業檔」交檔案。
- **批改台說「教師密碼不對」**：密碼要和 `Code.gs` 的 `TEACHER_KEY` 一模一樣；改過密碼要重新部署新版本。
- **想清空重來**：把 Drive 裡的資料夾刪掉，再執行一次 `setup`（會建立新的資料夾和試算表）。若找不到新資料夾，到 Apps Script 的「專案設定 → 指令碼屬性」刪掉 `FOLDER_ID` 和 `SHEET_ID` 後再執行。

## Security 安全性

- 繳交網址是公開的（寫在 `config.js`），知道網址的人都能送作業進來，所以建議設定班級代碼。
- 只有知道教師密碼的人才能讀取全班作業或寫入成績。
- 程式以你的身分執行，只會動到它自己建立的資料夾和試算表。
