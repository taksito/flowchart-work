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
| `Flowchart Work 作業/BMI/` | 每位學生一個 `班級-座號 姓名.json`（例如 `801-12 王小明.json`），重交會覆蓋成最新版本 |
| `Flowchart Work 作業/Pass or Fail/` | 同上 |
| `Flowchart Work 作業/Scratch Pass or Fail/` | Scratch Lab 的作業 |
| 試算表「繳交紀錄 Submissions」 | 每次繳交一列：時間、單元、班級、座號、姓名、自我批改分數、是否達成、英文使用率、檔案連結 |
| 試算表「成績 Scores」 | 批改台寫回的成績：班級、座號、姓名、總分、等第、各項分數、需要修正、評語、批改時間 |

## Student sign-in 學生用學校帳號登入（選用）

開啟後，學生繳交前要先用學校 Google 帳號（…@apps.ntpc.edu.tw）登入，班級、座號、姓名會從名單自動帶入，學生不能自己改。

1. **名單**：在「Flowchart Work 成績」試算表新增工作表「名單 Roster」，欄位是 `班級 Class｜座號 No.｜姓名 Name｜Email`（可用「檔案 → 匯入 → 插入新的工作表」匯入 Excel）。
2. **建立 OAuth 用戶端**（Google Cloud Console，免費）：
   1. 到 <https://console.cloud.google.com/>，左上角建立新專案，例如「Flowchart Work」。
   2. 左側選單 **「API 和服務 → OAuth 同意畫面」**（或「Google Auth Platform」）→ 開始：應用程式名稱 `Flowchart Work`、使用者支援電子郵件選自己；目標對象選 **「外部」**；聯絡資訊填自己的 Email → 建立。
   3. **「目標對象」→「發布應用程式」**，狀態改成「實際運作中」（只用到基本的登入資訊，不需要 Google 審查）。
   4. **「用戶端」→「建立用戶端」**：應用程式類型選 **「網頁應用程式」**，「已授權的 JavaScript 來源」新增 `https://taksito.github.io` → 建立。
   5. 複製 **用戶端 ID**（結尾是 `.apps.googleusercontent.com`）。用戶端 ID 不是密碼，可以公開；不需要「用戶端密鑰」。
3. **Apps Script**：貼上新版 `Code.gs`，改回自己的 `TEACHER_KEY`，把 `GOOGLE_CLIENT_ID` 填上用戶端 ID → 選 `setup` 按「執行」，允許「連線到外部服務」→ 部署 → 管理部署作業 → 編輯 → 新版本。
4. **config.js**：`googleClientId` 填同一個用戶端 ID。

注意：

- 學生的學校帳號如果被設定成「未滿 18 歲」，學校的 Google 管理員可能會擋掉第三方應用程式的登入。先找一位學生試登入；如果出現「已封鎖存取權」之類的訊息，請資訊組長在 Google 管理控制台把這個用戶端 ID 設為「信任」。
- 要關掉登入，把 `Code.gs` 的 `GOOGLE_CLIENT_ID` 和 `config.js` 的 `googleClientId` 都改回空白即可。
- 繳交紀錄會多一欄 Email；作業檔以名單上的「班級-座號 姓名」命名。

## Student sign-in with NTPC OpenID 學生用新北市 OpenID 登入（選用）

開啟後，學生繳交前要先用**新北市校務行政系統的帳號密碼**登入（新北市教育局 OpenID），班級、座號、姓名直接用校務行政系統的資料，學生不能自己改，也**不需要名單**。不用向教育局申請，也不需要 Google Cloud 設定。

1. **Apps Script**：貼上新版 `Code.gs`，改回自己的 `TEACHER_KEY`，再改 `CONFIG`：
   - `NTPC_OPENID: true`
   - `NTPC_SITE`：作業網站的網址，例如 `https://taksito.github.io/flowchart-work/`（登入完成後只會回到這個網站）
   - `NTPC_SCHOOL`：學校名稱，例如 `忠孝國中`（「新北市立忠孝國民中學」也對得上），只讓這所學校的師生登入；也可以填單位代碼
2. 選 `setup` 按「執行」，允許「連線到外部服務」。
3. **部署 → 管理部署作業 → ✏️ 編輯 → 版本選「新版本」→ 部署**（網址不變）。
4. **config.js**：`ntpcOpenId: false` 改成 `ntpcOpenId: true`。

### 我的成績 My Scores

首頁的 **My Scores 我的成績**（`me/`）：學生用新北市 OpenID 登入後，只看得到自己的資料：

- 每個作業是「已繳交」還是「缺交」，缺交的排在最上面，按 **去補交** 直接打開那個作業。
- 自我批改分數；老師在批改台按「寫回成績」之後，也會看到成績、等第、評語與需要修正的地方。
- 依「班級＋座號」比對作業檔名、繳交紀錄和成績表，所以以前學生自己打名字交的作業也算得到（班級座號要對）。
- `config.js` 的 `assignments` 決定列出哪些作業、缺交怎麼算；`Code.gs` 的 `SHOW_SCORES: false` 可以先不讓學生看到老師的分數。
- 老師帳號登入這一頁會提示改用批改台。

學生按 **Submit 繳交** → **新北市 OpenID 登入** → 在跳出的視窗輸入校務行政帳號密碼 → 第一次會出現授權畫面，按「同意」→ 視窗自動關閉，就能繳交。同一個分頁裡換別的作業不用再登入；登入 4 小時後過期。

注意：

- 授權畫面上顯示的網站是 Apps Script 的網址（script.google.com/…），這是正常的：登入結果由它向教育局伺服器確認。
- 只有「學生」「教師」「管理員」身分可以登入（家長、志工不行）。老師登入繳交的作業會放在「其他 Other」，可以用來測試。
- 瀏覽器擋掉彈出視窗時，會改成在同一頁登入；登入完按「回到作業」即可（作品存在瀏覽器裡，不會不見）。
- 要關掉，把 `Code.gs` 的 `NTPC_OPENID` 和 `config.js` 的 `ntpcOpenId` 都改回 `false`。和 Google 登入二選一，兩個都開時用新北市 OpenID。

## Updating the script 之後修改程式

> 新增 Scratch 單元後，`Code.gs` 多了 `scratch` 單元。之前部署過的人要貼上新版 `Code.gs`（記得改回自己的 `TEACHER_KEY`），再部署新版本，學生才能從 Scratch Lab 繳交。

改了 `Code.gs`（例如換教師密碼或班級代碼）之後，要到 **部署 → 管理部署作業 → ✏️ 編輯 → 版本選「新版本」→ 部署**，網址不會變。

## Troubleshooting 常見問題

- **學生按 Submit 出現「連不上雲端」**：確認 `config.js` 的網址結尾是 `/exec`，部署存取權是「任何人」。學生也可以先用「下載作業檔」交檔案。
- **批改台說「教師密碼不對」**：密碼要和 `Code.gs` 的 `TEACHER_KEY` 一模一樣；改過密碼要重新部署新版本。
- **想清空重來**：把 Drive 裡的資料夾刪掉，再執行一次 `setup`（會建立新的資料夾和試算表）。若找不到新資料夾，到 Apps Script 的「專案設定 → 指令碼屬性」刪掉 `FOLDER_ID` 和 `SHEET_ID` 後再執行。

## Security 安全性

- 繳交網址是公開的（寫在 `config.js`），知道網址的人都能送作業進來。如果遇到亂送的情況，可以設定 `CLASS_CODE` 並把 `needCode` 改成 `true`。
- 只有知道教師密碼的人才能讀取全班作業或寫入成績。
- 程式以你的身分執行，只會動到它自己建立的資料夾和試算表。
