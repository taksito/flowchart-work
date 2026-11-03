# Flowchart Drawing Tool 流程圖繪製工具

A bilingual (English / 中文) flowchart assignment for junior-high students: draw a BMI flowchart, get step-by-step hints, check your own work, and hand in a file the teacher can grade automatically.

雙語（英文／中文）的國中流程圖作業：學生畫出 BMI 流程圖，小幫手一步步提示，學生可以自己提交批改，再繳交作業檔讓老師自動批改。

## Pages 頁面

| Page 頁面 | Path 路徑 | For 使用者 |
|---|---|---|
| Home 首頁 | `index.html` | Everyone 所有人 |
| Free Draw 自由繪製 | `free/` | Anyone 任何人 |
| BMI Drawing Tool BMI 繪製工具 | `bmi/` | Students 學生 |
| Pass or Fail Tool 成績及格判斷工具 | `score/` | Students 學生 |
| Scratch Lab: Pass or Fail 積木程式 | `scratch/` | Students 學生 |
| Scratch Lab: BMI 積木程式 | `scratch-bmi/` | Students 學生 |
| Grading Desk 批改台 | `grader/` | Teachers 教師 |

Live site 網址：https://taksito.github.io/flowchart-work/

All pages are single, self-contained HTML files. No build step and no server are needed.
每個頁面都是單一 HTML 檔，不需要編譯或伺服器。

## The BMI task BMI 題目

Input height and weight, compute `BMI = weight ÷ height²` (height in metres), then output:
輸入身高與體重，計算 BMI（身高用公尺），再輸出：

| BMI | Output 輸出 |
|---|---|
| BMI < 18.5 | thin |
| 18.5 ≤ BMI < 24 | normal |
| 24 ≤ BMI < 27 | overweight |
| BMI ≥ 27 | obesity |

## Free Draw 自由繪製

The same board without the BMI helper or Check button. Drawings are saved separately from the BMI task. 和 BMI 畫板相同，但沒有小幫手與提交批改；作品和 BMI 作業分開儲存。

## BMI Drawing Tool BMI 繪製工具

- Shapes: START, END, INPUT, OUTPUT, PROCESS, DECISION, LOOP, DOCUMENT, CONNECTOR.
- INPUT / OUTPUT add the prefix automatically (type `height` → `input height`). INPUT／OUTPUT 會自動加上前綴。
- Helper 小幫手: rule-based hints from START to the last line, highlighting the shape to fix. 依規則一步步提示，並框出要修改的圖形（不使用 AI，不耗額度）。
- Select 框選: drag on empty space to select; Copy / Paste / Duplicate / Delete; Ctrl+C, Ctrl+V, Ctrl+A, arrow keys. Hold Space or switch to Pan to move the canvas.
- Check 提交批改: shows the score, bilingual feedback and the 8 BMI tests. A fully correct chart unlocks a PNG certificate (完成圖), with a Bilingual Star badge for all-English charts.
- Files 檔案: download / open `.json` work files; “我的作品” keeps several drawings in the browser.

## Pass or Fail Tool 成績及格判斷工具

Input four scores, compute the total and the average (total ÷ 4), then output `pass` if the average is 60 or more, otherwise `fail` (exactly 60 passes).
輸入四個成績，算出總分與平均（總分 ÷ 4），平均 ≥ 60 輸出 pass，否則輸出 fail（剛好 60 算 pass）。

- Any variable names work: s1–s4, a–d, score1–score4, or Chinese names. One INPUT per score, or `input s1, s2, s3, s4`. 變數名稱不限，可以一個 INPUT 一個成績，也可以寫在同一個 INPUT。
- The helper checks the inputs, the total, the average (÷ 4, not ÷ 3), the `>= 60` boundary and the Yes/No lines. 小幫手會檢查輸入、總分、平均、>= 60 的邊界和 Yes/No 接線。
- Rubric (100): Structure 20, Input 10, Process 20, Decision 15, Output 10, Test run 25 (8 sets of scores, including averages of exactly 60 and 59.75).

## Scratch Lab 積木程式

A Scratch-style block editor built with [Blockly](https://developers.google.com/blockly) (loaded from unpkg). 用 Blockly 做的 Scratch 風格積木編輯器。

- Blocks 積木：when ⚑ clicked, ask and wait / answer, say, variables (set, change), + − × ÷, > < =, and / or / not, join, round, if then (else), repeat, wait.
- Stage 舞台：press **Run 執行** to run the program; the robot asks questions and says the result. Click a variable or **answer** block (in the palette or the code) to watch its value on the stage; click again to hide it.
- Duplicate 複製：right-click → Duplicate copies the block together with every block attached below it, like Scratch.
- Tasks 題目：**BMI** (`scratch-bmi/`) — ask height and weight, set bmi to weight / (height * height), and say thin / normal / overweight / obesity; tests answer height 1.5 m (or 150 cm) with 8 weights. Rubric: Structure 15, Input 15, Process 20, Decision 20, Output 10, Test run 20.
- **Pass or Fail** — ask four scores, store them in variables, compute total and average, then say `pass` (average ≥ 60) or `fail`.
- Helper 小幫手 walks through Flag → Ask → Save → Total → Average → If → Say → Test. Check runs the program with 8 sets of scores and unlocks the certificate.
- Rubric (100): Structure 15, Input 15, Process 20, Decision 15, Output 10, Test run 25.
- Submit 繳交 uses unit `scratch` in the Apps Script (see GOOGLE-DRIVE.md; update the script if it was deployed before this unit existed).

## Summation 1 加到 n

- Flowchart (`sum/`): input n, set sum = 0 and i = 1, decision i <= n, Yes → sum = sum + i → i = i + 1 → back to the decision, No → output sum. 流程圖：輸入 n，用迴圈把 1 加到 n，輸出總和。
- Scratch (`scratch-sum/`): ask n, set n to answer, set sum and i to 0, repeat (n) { change i by 1, change sum by (i) }, say (sum). A **repeat until** block was added for this unit. 積木：新增「repeat until 重複直到」積木。
- Tests 測試：n = 1, 2, 3, 4, 5, 10, 20, 100 → 1, 3, 6, 10, 15, 55, 210, 5050.
- Rubric (flowchart): Structure 20, Input 10, Process 25 (start values 5, add 10, count 10), Loop 15, Output 5, Test run 25. Scratch: Structure 10, Input 15, Process 20, Loop 20, Output 10, Test run 25.
- Any correct approach gets full marks: sum += i, i++, counting down, i > n with Yes/No swapped, or the formula sum = n × (n + 1) / 2. 不同的正確寫法都給滿分，直接用公式也算對。
- The INPUT / OUTPUT / PROCESS / DECISION boxes show n, sum, sum = sum + i and i <= n as hints. 圖形的提示文字是 n、sum、sum = sum + i、i <= n。
- Common mistakes get a direct hint: i < n misses the last number, outputting i instead of sum, a loop with no i = i + 1 never stops. 常見錯誤會直接提示。
- In this unit a loop through a decision is correct, so red lines only mark loops with no decision (they never stop). 這個單元的迴圈是正確的，只有沒有判斷、停不下來的迴圈才標紅線。

## Grading Desk 批改台

- Units 單元：switch between **BMI**, **Pass or Fail**, **Scratch**, **Scratch BMI**, **Summation** and **Scratch Sum** at the top. Uploaded files go to the right unit automatically. 上方切換單元，上傳的檔案會自動分到對應單元。

- **Class 班級**: Google Drive → choose a class (701, 702, …) to load just that class, which is much faster. The Class menu at the top filters the list; with the 名單 Roster tab in the score sheet, the desk lists who has **not submitted 未繳交** yet (matched by class and seat number). 可以一次只載入一個班；選了班級會列出還沒繳交的學生（依名單的班級座號比對）。
- Upload many `.json` files at once (or drag them in). 一次上傳多份作業檔。
- Rubric (100 points): Structure 20, Input 10, Process 10, Decision 20, Output 10, Test run 30.
- The test run actually executes each chart with BMI 16, 18.4, 18.5, 22, 24, 25.5, 27, 32, so different correct layouts (small → large, large → small, ranges, cm or m) all score full marks. 實際執行學生的流程圖，各種正確寫法都能拿滿分。
- English is encouraged, not scored: the desk shows each student's English usage and suggests English words. 英文只鼓勵、不計分。
- Bilingual comments are generated by rules; you can also copy a prompt into any free AI and paste the replies back for the whole class. 評語預設由規則產生，也可以複製提示詞給免費 AI，再整班貼回。
- Export a CSV score sheet. 可匯出 CSV 成績表。
- **Re-check 重新審核**: re-grade every work in the current unit (or one work from its detail page) with the latest rules, and see which scores changed. 用最新規則重新批改整個單元或單份作業，顯示哪些分數有變。
- **Red lines 紅色線**: in the flowchart preview, a line drawn the wrong way (into START, out of END, a loop, or a line whose start can't be reached from START) or a Yes/No line that leads to the wrong output is drawn as a red dashed line and listed under the picture. 方向拉反、形成迴圈或接到錯的方塊的線，會用紅色虛線標出並列在圖下方。
- **Edit name 修改班級座號姓名**: fix a student's class, seat number or name when they typed it wrong. The fix is remembered in this browser, so re-loading the same file keeps the corrected name; saving to the Sheet updates the old row instead of adding a new one (needs the latest `apps-script/Code.gs`). The file in Drive keeps its original name. 修正學生打錯的班級座號姓名；同一台電腦會記住，寫回試算表時會更新原本那一列。
- **Adjust 調整分數**: the teacher can set a final score with a note; the roster marks it with *, and the CSV and Google Sheet use the adjusted score. 老師可以手動調整分數並寫原因，成績表與試算表會用調整後的分數。
- Pass or Fail (flowchart and Scratch): any correct approach gets full marks — an extra variable, no avg variable, or comparing total with 240 all count, as long as all 8 tests pass. 只要八組測試全對，不同寫法都給滿分。

> Note 注意：the Grading Desk opens empty (no sample work). The repository is public, so the grading rules in the source code can still be read by anyone. 批改台打開是空的，不含範例作業；不過本專案公開，原始碼裡的評分規則任何人都看得到。

## Google Drive 雲端繳交與成績登記

Optional. Students press **Submit 繳交** to send their work to the teacher's Google Drive, and the Grading Desk can load the whole class from Drive and write scores back to a Google Sheet. It runs on a free Google Apps Script that the teacher deploys once.
選用功能：學生按「Submit 繳交」，作業直接存進老師的 Google Drive；批改台可以從雲端一次載入全班作業，再把成績寫回 Google 試算表。

Setup 設定步驟：[GOOGLE-DRIVE.md](GOOGLE-DRIVE.md) · Script：[`apps-script/Code.gs`](apps-script/Code.gs) · Settings：[`config.js`](config.js)

## Privacy 隱私

Everything runs in the browser. Unless the teacher sets up Google Drive, drawings and uploaded work stay in that browser's local storage. With Google Drive, submitted work goes only to the teacher's own Drive.
所有功能都在瀏覽器裡執行。沒有設定 Google Drive 時，作品只存在該瀏覽器；設定後，繳交的作業只會送到老師自己的 Google Drive。
