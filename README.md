# OmniConvert Core Engine ⚡
*100% Local, Air-gapped, WebAssembly-powered Universal File Converter Engine.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform: Browser](https://img.shields.io/badge/Platform-Browser-green.svg)]()
![Zero Uploads](https://img.shields.io/badge/Privacy-Zero%20Uploads-red)

> 💡 **Experience the full, beautifully designed GUI with batch ZIP execution directly at [Omni-Convert.com](https://omni-convert.com)**

## Introduction
This repository contains the **unobfuscated core conversion algorithms** of OmniConvert. 
OmniConvert's philosophy is absolute privacy—no backend servers, no cloud subscriptions, no data exfiltration. Every single conversion is securely routed to internal Browser APIs, Web Workers, or WebAssembly (WASM) instances. 

By open-sourcing the "brain" of the converter, we aim to:
1. **Prove our privacy claim**: Inspect the codebase yourself. There are zero outbound `fetch` or `XMLHttpRequest` calls for payload processing.
2. **Help the developer community**: Implementing Client-side FFmpeg, PDF.js, and JSZip simultaneously can be a nightmare due to DOM restrictions, Cross-Origin Isolation (COOP/COEP) limitations, and Main-Thread UI blocking. Feel free to borrow our architectural design patterns!

## Architecture Details
- **`workers/videoWorker.ts`**: Implements `@ffmpeg/ffmpeg` inside a dedicated Web Worker mapping virtual file systems (VFS), allowing fast MP4/MP3/GIF transcodings.
- **`workers/pdfWorker.ts` & `lib/pdfRenderer.ts`**: Bypasses Worker DOM restrictions by intelligently routing PDF page rendering (which requires `<canvas>`) to the Main Thread, while PDF merging (`pdf-lib`) is kept securely in the background.
- **`workers/documentWorker.ts`**: Safely parses `xlsx`, `csv`, `json`, and bridges Markdown natively purely locally using `xlsx` and native ArrayBuffers.
- **`lib/svgRenderer.ts`**: Incorporates `imagetracerjs` to execute high-fidelity raster-to-vector auto-tracing locally in the browser memory.
- **`lib/ConverterFactory.ts`**: The central dispatcher that guarantees thread safety by determining whether a file belongs in a threaded Web Worker sandbox or requires strict Main Thread DOM access.

## Why keep the React / Next.js implementation closed-source?
Creating the core functionality is hard, but building a seamless multi-file batch processor with complex ZIP compressions, robust drag-and-drop state management, i18n dictionaries, and tailored frontend layouts takes an immense amount of time. Providing this backend engine validates our security integrity, while reserving the UI blocks malicious entities from direct clone-and-deploy copying. 

## Contribution & Self-Hosting
Since the engine relies entirely on client-side JS and WASM binaries, you don't need Docker, Node.js, or complex backends to execute these conversions. Any standard HTTP server or static hosting (like GitHub Pages or Vercel) serving these assets will inherently work offline without explicit backend configurations.

---

### 繁體中文版本 (Traditional Chinese)
這份儲存庫包含 **OmniConvert 萬用轉換器** 最核心的引擎演算法原始碼。

我們的核心理念是「終極隱私」——沒有伺服器、不用上傳、沒有資料外洩。藉由開放源始碼，我們希望：
1. **證明我們的資安承諾**：您可以親自審查這份程式碼，裡面完全不包含任何向外傳送實體檔案 Payload 的 `fetch` 或後門。
2. **技術社群交流**：要在純前端無痛整合 FFmpeg WASM、PDF 與 SVG 渲染是非常困難的工程（特別是多執行緒的 DOM 崩潰與嚴格的 COOP/COEP 安全黑屏）。這裡提供了經過市場驗證的防禦性架構參考。

如果你剛好有檔案互切壓縮的需求，想要體驗具備多線程自動打包、完美視覺互動的完整系統，非常歡迎造訪 👉 **[OmniConvert 官方網站](https://omni-convert.com)**。
