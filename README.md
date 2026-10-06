# OmniConvert Core Engine ⚡
*100% Local, Air-gapped, WebAssembly & Web Worker Universal Conversion Engine.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform: Browser](https://img.shields.io/badge/Platform-Browser-green.svg)]()
![Zero Uploads](https://img.shields.io/badge/Privacy-Zero%20Uploads-red)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)

> 💡 **Looking for the complete production application?**  
> Experience multi-file batch conversions, automatic ZIP compression, drag-and-drop queues, and localized UI directly at **[Omni-Convert.com](https://omni-convert.com)**.

---

## 📖 Introduction

This repository contains the **standalone, unobfuscated core conversion engine** that powers OmniConvert.

Every conversion takes place **100% client-side** inside the user's browser using WebAssembly (WASM), Web Workers, and native HTML5 APIs. Zero bytes of payload data ever leave the machine.

By open-sourcing the engine with a runnable testbench, we aim to:
1. **Prove our Zero-Uploads Privacy Claim**: Audit the code yourself—there are zero outbound network requests for file payloads.
2. **Empower Developers to Self-Host**: Provide a plug-and-play architecture that overcomes common browser bottlenecks (such as Web Worker DOM restrictions, SharedArrayBuffer security isolation, and FFmpeg memory leaks).

---

## 🚀 Quickstart: Run in 30 Seconds

Clone this repo, install dependencies, and launch the local testbench:

```bash
# 1. Clone repository
git clone https://github.com/T5A111/OmniConvert-Core-Engine.git
cd OmniConvert-Core-Engine

# 2. Install dependencies (automatically sets up local WASM & worker assets)
npm install

# 3. Start the local development testbench
npm run dev
```

Open your browser at **`http://localhost:5173`**. You can immediately pick files, test format transcodings, and watch real-time execution logs!

---

## 🛠️ Architecture Overview

The engine divides work between background Web Workers and Main Thread DOM contexts to avoid UI freezing while strictly adhering to browser security boundaries:

| Path | Primary Technology | Responsibility |
| :--- | :--- | :--- |
| **`lib/ConverterFactory.ts`** | TypeScript Singleton | Central dispatcher. Manages Worker singletons and routes tasks between threads. |
| **`workers/videoWorker.ts`** | `@ffmpeg/ffmpeg` (WASM) | Isolated Virtual File System (VFS). Executes MP4, MP3, WAV, and palette-optimized GIF encoding. |
| **`workers/pdfWorker.ts`** | `pdf-lib` | Headless PDF merging (`merge_pdf`) and direct image-to-PDF packing (`images_to_pdf`). |
| **`lib/pdfRenderer.ts`** | `pdfjs-dist` + `<canvas>` | Extracts PDF pages to high-res PNG/JPG images (routed to Main Thread to bypass Worker DOM limits). |
| **`workers/documentWorker.ts`**| `xlsx` + `marked` | Bidirectional data conversion for Excel (XLSX), CSV, JSON, and Markdown parsing. |
| **`workers/imageWorker.ts`** | `OffscreenCanvas` + `heic2any` | Metadata-stripping image re-encoding (PNG, JPG, WEBP) and HEIC photo decoding. |
| **`lib/svgRenderer.ts`** | `imagetracerjs` | High-fidelity deterministic raster-to-vector auto-tracing. |

---

## 🌐 Self-Hosting & Deployment Guide

### Critical Requirement: Cross-Origin Isolation (COOP & COEP)
FFmpeg WASM and multi-threaded WebAssembly require `SharedArrayBuffer`, which modern browsers strictly gate behind **Cross-Origin Isolation**. 

Your web server **MUST** serve pages with these two HTTP response headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

#### 1. Nginx
Add to your `server` or `location` block:
```nginx
location / {
    add_header Cross-Origin-Opener-Policy "same-origin";
    add_header Cross-Origin-Embedder-Policy "require-corp";
}
```

#### 2. Vercel (`vercel.json`)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

#### 3. Cloudflare Pages (`_headers`)
Create a `public/_headers` file:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

---

## 💻 How to Use as an In-App Library

You can easily integrate `ConverterFactory` into your own React, Vue, Svelte, or vanilla web application:

```typescript
import { ConverterFactory } from './lib/ConverterFactory';

async function handleConversion(userFile: File) {
  // Convert an MP4 video to an animated GIF
  const result = await ConverterFactory.convert(userFile, 'gif');

  if (result.success && result.blob) {
    const downloadUrl = URL.createObjectURL(result.blob);
    console.log('Conversion completed! Download from:', downloadUrl);
  } else {
    console.error('Conversion failed:', result.error);
  }
}
```

---

## 📜 License

This core engine is released under the **MIT License**. You are free to inspect, modify, fork, and integrate it into your own open-source or commercial projects.

---

### 繁體中文版本 (Traditional Chinese Guide)

### 這是什麼？
這是 **OmniConvert 萬用轉換器** 的核心純前端離線轉檔引擎。我們將核心運算邏輯完整開放，讓有技術能力的開發者可以直接參考、研究，或架設屬於自己的純前端轉檔服務。

### 核心特性
- **100% 純前端離線轉換**：無伺服器後端、不消耗頻寬、完全杜絕資料外洩風險。
- **FFmpeg WebAssembly 獨立執行緒**：在 Web Worker 內建立虛擬檔案系統（VFS），轉檔不卡頓主畫面。
- **解決跨執行緒限制**：自動將依賴 DOM 的 PDF 頁面渲染與 ImageTracer 分流至主執行緒，其餘大量運算保持在背景 Worker。

### 30 秒快速在本地啟動測試環境
```bash
# 1. 複製專案
git clone https://github.com/T5A111/OmniConvert-Core-Engine.git
cd OmniConvert-Core-Engine

# 2. 安裝套件（自動複製 WASM 靜態資源至 public/ 目錄）
npm install

# 3. 啟動 Vite 本地測試工作台
npm run dev
```
瀏覽器開啟 `http://localhost:5173` 即可立即選檔進行轉檔測試！

### 自架伺服器重要設定 (COOP / COEP)
瀏覽器為了保護 WebAssembly 多線程與 `SharedArrayBuffer`，要求伺服器必須回應以下兩項安全標頭：
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
本專案的 `vite.config.ts` 已在本地端配置好上述標頭。若部署至 Nginx、Vercel 或 Cloudflare Pages，請參閱上方英文說明配置相關標頭。

### 體驗完整生產環境
如果您需要完整的體驗，歡迎造訪 👉 **[OmniConvert 官方網站](https://omni-convert.com)**。
