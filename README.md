# PDF 內容檢視工具

一個純前端的 PDF 解析器，能在瀏覽器中完成：

- 檔案上傳與步驟式指引
- 逐頁顯示 PDF 內建文字
- 當頁面僅有掃描影像時，透過 Tesseract.js 自動 OCR（支援繁中/英文）
- 標示每頁資料來源（PDF 文字或 OCR）

所有解析都在使用者瀏覽器進行，不會將檔案上傳到任何伺服器。

## 專案結構

```
.
├── index.html   # 頁面骨架與資源引用
├── styles.css   # UI/版面樣式
└── app.js       # PDF 解析、OCR 與互動邏輯
```

## 開始使用

1. 直接在瀏覽器裡打開 `index.html`（雙擊或拖曳至瀏覽器視窗即可）。
2. 依照頁面步驟：
   - Step 1：選擇要解析的 PDF。
   - Step 2：確認檔名/大小後按「開始上傳並解析」。
   - Step 3：等待狀態顯示成功並閱讀每頁結果。
3. 需要 OCR 時保持「自動使用影像 OCR」勾選；若取消勾選，純影像頁面會提示啟用 OCR 後重試。

> **提示**：第一次執行 OCR 會從 CDN 下載語言資料包，依網路速度可能需要數秒。

## 開發/自訂

- **樣式**：修改 `styles.css` 即可調整主題、排版或 RWD 行為。
- **行為邏輯**：`app.js` 內已模組化
  - `statusView`、`fileInfoView`、`resultsView` 操控 UI
  - `buildReadableText` 改善 PDF 文字分行
  - `renderPageToCanvas`、`enhanceCanvasForOcr`、`runOcr` 處理掃描影像
- **OCR 語言/品質**：更新 `pdfConfig`（例如改變 `ocrRenderScale` 或語言代碼）。

## 離線部署

如果需要完全離線或內網環境：

1. 從官方來源下載以下檔案並放到本機：
   - `pdf.min.js` 與 `pdf.worker.min.js`
   - `tesseract.min.js` 及對應語言資料包（`.traineddata`）
2. 修改 `index.html` / `app.js` 中的 CDN URL 為相對路徑，例如 `./vendor/pdf.min.js`。
3. 若使用語言包本地路徑，依 Tesseract.js 文件設定 `Tesseract.createWorker` 及 `corePath`/`langPath`。

## 已知限制

- 極低畫質的掃描件仍可能需要手動調整前處理參數或另行裁切。
- 目前未內建下載 Excel/CSV；此工具聚焦於檢視。若需要可在 `app.js` 補上匯出邏輯。

歡迎依需求擴充解析規則、內建欄位檢核或額外的匯出形式。只要更新 `styles.css` / `app.js` 即可保持結構清晰。***
