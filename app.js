'use strict';

(function () {
  const pdfConfig = Object.freeze({
    defaultRenderScale: 2,
    ocrRenderScale: 3,
    ocrLanguages: 'chi_tra+eng'
  });

  const statusVariants = ['error', 'loading', 'success'];

  const ui = {
    fileInput: document.getElementById('pdf-input'),
    results: document.getElementById('results'),
    status: document.getElementById('status'),
    fileInfo: document.getElementById('file-info'),
    processBtn: document.getElementById('process-btn'),
    clearBtn: document.getElementById('clear-btn'),
    ocrToggle: document.getElementById('enable-ocr')
  };

  const state = {
    selectedFile: null
  };

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const statusView = {
    set(message, variant = 'info') {
      ui.status.textContent = message;
      statusVariants.forEach((name) => ui.status.classList.remove(name));
      if (variant !== 'info' && statusVariants.includes(variant)) {
        ui.status.classList.add(variant);
      }
    }
  };

  const fileInfoView = {
    show(file) {
      ui.fileInfo.textContent = `檔名：${file.name}｜大小：${formatSize(file.size)}`;
      ui.fileInfo.style.display = 'block';
    },
    hide() {
      ui.fileInfo.textContent = '';
      ui.fileInfo.style.display = 'none';
    }
  };

  const resultsView = {
    clear() {
      ui.results.innerHTML = '';
    },
    append({ pageNumber, text, source, ocrEnabled }) {
      const pageBlock = document.createElement('article');
      pageBlock.className = 'page-block';

      const title = document.createElement('div');
      title.className = 'page-title';
      title.textContent = `第 ${pageNumber} 頁`;

      if (source === 'pdf' || source === 'ocr') {
        const badge = document.createElement('span');
        badge.className = `source-badge ${source}`;
        badge.textContent = source === 'ocr' ? 'OCR' : 'PDF 文字';
        title.appendChild(badge);
      }

      const body = document.createElement('pre');
      body.textContent = text || getFallbackMessage(ocrEnabled);

      pageBlock.appendChild(title);
      pageBlock.appendChild(body);
      ui.results.appendChild(pageBlock);
    }
  };

  const formatSize = (bytes) => {
    if (!Number.isFinite(bytes)) {
      return '未知大小';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getFallbackMessage = (ocrEnabled) => (ocrEnabled
    ? '(此頁沒有偵測到文字，可能是掃描影像或影像品質不足)'
    : '(此頁沒有偵測到文字，建議啟用 OCR 後再試一次)');

  const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();

  const buildReadableText = (items) => {
    const lines = [];
    let currentLine = [];
    let lastY = null;
    const tolerance = 4;

    items.forEach((item) => {
      const value = item?.str;
      if (!value || !value.trim()) {
        return;
      }

      const transform = Array.isArray(item.transform) ? item.transform : [];
      const y = typeof transform[5] === 'number' ? transform[5] : null;
      const shouldBreak =
        lastY !== null &&
        y !== null &&
        Math.abs(y - lastY) > tolerance &&
        currentLine.length > 0;

      if (shouldBreak) {
        lines.push(normalizeLine(currentLine.join('')));
        currentLine = [];
      }

      currentLine.push(value);
      lastY = y;

      if (item.hasEOL) {
        lines.push(normalizeLine(currentLine.join('')));
        currentLine = [];
        lastY = null;
      }
    });

    if (currentLine.length) {
      lines.push(normalizeLine(currentLine.join('')));
    }

    return lines.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const renderPageToCanvas = async (page, scale = pdfConfig.defaultRenderScale) => {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  };

  const enhanceCanvasForOcr = (canvas) => {
    const context = canvas.getContext('2d');
    const { width, height } = canvas;
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;
    const contrast = 1.25;
    const threshold = 175;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const adjusted = ((gray - 128) * contrast) + 128;
      const value = adjusted > threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    }

    context.putImageData(imageData, 0, 0);
  };

  const runOcr = async (canvas, pageNumber) => {
    if (typeof Tesseract === 'undefined') {
      console.warn('Tesseract.js 尚未載入，無法執行 OCR');
      return '';
    }

    try {
      const { data } = await Tesseract.recognize(canvas, pdfConfig.ocrLanguages, {
        logger: ({ status, progress }) => {
          const percent = Number.isFinite(progress) ? ` ${Math.round(progress * 100)}%` : '';
          statusView.set(`[OCR] 第 ${pageNumber} 頁 ${status}${percent}`, 'loading');
        }
      });
      return (data?.text || '').trim();
    } catch (error) {
      console.error('OCR 失敗', error);
      return '';
    }
  };

  const extractTextFromPage = async (page, pageNumber) => {
    const textContent = await page.getTextContent();
    const pdfText = buildReadableText(textContent.items);
    if (pdfText) {
      return { text: pdfText, source: 'pdf' };
    }

    if (!ui.ocrToggle.checked) {
      return { text: '', source: 'none' };
    }

    statusView.set(`[OCR] 渲染第 ${pageNumber} 頁影像...`, 'loading');
    const canvas = await renderPageToCanvas(page, pdfConfig.ocrRenderScale);
    enhanceCanvasForOcr(canvas);
    const ocrText = await runOcr(canvas, pageNumber);
    canvas.width = 0;
    canvas.height = 0;
    return { text: ocrText, source: ocrText ? 'ocr' : 'none' };
  };

  const resetUi = () => {
    state.selectedFile = null;
    ui.fileInput.value = '';
    ui.fileInput.disabled = false;
    ui.processBtn.disabled = true;
    fileInfoView.hide();
    resultsView.clear();
    statusView.set('尚未選擇檔案');
  };

  const handleFileSelection = (event) => {
    const [file] = event.target.files;
    resultsView.clear();

    if (!file) {
      resetUi();
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      resetUi();
      statusView.set('請選擇 PDF 檔案', 'error');
      return;
    }

    state.selectedFile = file;
    ui.processBtn.disabled = false;
    fileInfoView.show(file);
    statusView.set('檔案已選擇，請按「開始上傳並解析」');
  };

  const handleProcess = async () => {
    if (!state.selectedFile) {
      statusView.set('尚未選擇檔案', 'error');
      return;
    }

    ui.processBtn.disabled = true;
    ui.fileInput.disabled = true;
    resultsView.clear();

    const file = state.selectedFile;
    statusView.set(`上傳中：${file.name}`, 'loading');

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      statusView.set(`上傳成功，開始解析共 ${pdf.numPages} 頁`, 'success');

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        statusView.set(`解析第 ${pageNumber} / ${pdf.numPages} 頁...`, 'loading');
        const page = await pdf.getPage(pageNumber);
        const extraction = await extractTextFromPage(page, pageNumber);
        resultsView.append({
          pageNumber,
          text: extraction.text,
          source: extraction.source,
          ocrEnabled: ui.ocrToggle.checked
        });
      }

      statusView.set(`完成：共 ${pdf.numPages} 頁`, 'success');
    } catch (error) {
      console.error(error);
      statusView.set('讀取或解析失敗：' + error.message, 'error');
    } finally {
      ui.fileInput.disabled = false;
      ui.processBtn.disabled = !state.selectedFile;
    }
  };

  ui.fileInput.addEventListener('change', handleFileSelection);
  ui.processBtn.addEventListener('click', handleProcess);
  ui.clearBtn.addEventListener('click', resetUi);

  resetUi();
})();
