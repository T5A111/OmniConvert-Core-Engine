import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[setup-assets] Copied: ${path.basename(dest)}`);
    return true;
  }
  return false;
}

async function setup() {
  console.log('[setup-assets] Setting up local WebAssembly and Worker assets for air-gapped conversion...');

  const publicDir = path.join(rootDir, 'public');
  const ffmpegDir = path.join(publicDir, 'ffmpeg');
  const pdfjsDir = path.join(publicDir, 'pdfjs');

  ensureDir(ffmpegDir);
  ensureDir(pdfjsDir);

  // 1. Copy FFmpeg core assets
  const ffmpegDist = path.join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
  const ffmpegJs = path.join(ffmpegDist, 'ffmpeg-core.js');
  const ffmpegWasm = path.join(ffmpegDist, 'ffmpeg-core.wasm');

  if (fs.existsSync(ffmpegJs) && fs.existsSync(ffmpegWasm)) {
    copyFileSafe(ffmpegJs, path.join(ffmpegDir, 'ffmpeg-core.js'));
    copyFileSafe(ffmpegWasm, path.join(ffmpegDir, 'ffmpeg-core.wasm'));
    console.log('[setup-assets] FFmpeg WASM assets ready in public/ffmpeg/');
  } else {
    console.log('[setup-assets] Note: @ffmpeg/core not installed yet. videoWorker will fallback to CDN if not found.');
  }

  // 2. Copy PDF.js worker
  const pdfWorkerSrc = path.join(rootDir, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
  if (fs.existsSync(pdfWorkerSrc)) {
    copyFileSafe(pdfWorkerSrc, path.join(pdfjsDir, 'pdf.worker.min.mjs'));
    console.log('[setup-assets] PDF.js worker asset ready in public/pdfjs/');
  } else {
    console.log('[setup-assets] Note: pdfjs-dist not found yet in node_modules.');
  }

  console.log('[setup-assets] Assets setup process completed successfully.');
}

setup().catch((err) => {
  console.error('[setup-assets] Error during asset setup:', err);
});
