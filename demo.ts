import { ConverterFactory } from './lib/ConverterFactory';

// DOM Elements
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const targetFormatSelect = document.getElementById('targetFormat') as HTMLSelectElement;
const convertBtn = document.getElementById('convertBtn') as HTMLButtonElement;
const terminalLog = document.getElementById('terminalLog') as HTMLElement;
const perfTimer = document.getElementById('perfTimer') as HTMLElement;
const downloadArea = document.getElementById('downloadArea') as HTMLElement;
const downloadLink = document.getElementById('downloadLink') as HTMLAnchorElement;
const downloadMsg = document.getElementById('downloadMsg') as HTMLElement;

const dotCoop = document.getElementById('dot-coop') as HTMLElement;
const labelCoop = document.getElementById('label-coop') as HTMLElement;
const dotWasm = document.getElementById('dot-wasm') as HTMLElement;
const labelWasm = document.getElementById('label-wasm') as HTMLElement;
const dotWorker = document.getElementById('dot-worker') as HTMLElement;
const labelWorker = document.getElementById('label-worker') as HTMLElement;

function log(msg: string) {
  const timestamp = new Date().toLocaleTimeString();
  terminalLog.textContent += `\n[${timestamp}] ${msg}`;
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

// Check Cross-Origin Isolation status
const isIsolated = window.crossOriginIsolated;
if (isIsolated) {
  dotCoop.classList.add('active');
  labelCoop.textContent = 'Cross-Origin Isolated (SharedArrayBuffer Enabled)';
} else {
  dotCoop.classList.add('inactive');
  labelCoop.textContent = 'Not Isolated (SharedArrayBuffer Disabled - Check COOP/COEP headers)';
}

// Check WebAssembly support
if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
  dotWasm.classList.add('active');
  labelWasm.textContent = 'WebAssembly Supported';
} else {
  dotWasm.classList.add('inactive');
  labelWasm.textContent = 'WebAssembly Not Supported';
}

// Check Web Worker support
if (typeof Worker !== 'undefined') {
  dotWorker.classList.add('active');
  labelWorker.textContent = 'Web Workers Supported';
} else {
  dotWorker.classList.add('inactive');
  labelWorker.textContent = 'Web Workers Not Supported';
}

// Auto-select smart default target format on file change
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  log(`Selected file: "${file.name}" (${(file.size / 1024).toFixed(1)} KB, detected extension: .${ext})`);

  // Suggest relevant target format
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    targetFormatSelect.value = ext === 'png' ? 'webp' : 'png';
  } else if (['mp4', 'mov', 'webm'].includes(ext)) {
    targetFormatSelect.value = 'mp3';
  } else if (['mp3', 'wav'].includes(ext)) {
    targetFormatSelect.value = ext === 'mp3' ? 'wav' : 'mp3';
  } else if (ext === 'pdf') {
    targetFormatSelect.value = 'pdf_to_png';
  } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
    targetFormatSelect.value = ext === 'csv' ? 'xlsx' : 'csv';
  } else if (ext === 'md') {
    targetFormatSelect.value = 'html';
  }
});

let startTime = 0;
let timerInterval: any = null;

convertBtn.addEventListener('click', async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    alert('Please choose a file to convert first.');
    return;
  }

  const targetFormat = targetFormatSelect.value;
  convertBtn.disabled = true;
  downloadArea.style.display = 'none';

  startTime = performance.now();
  timerInterval = setInterval(() => {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    perfTimer.textContent = `${elapsed}s`;
  }, 100);

  log(`--- Starting Core Conversion: ${file.name} -> .${targetFormat} ---`);
  log(`Dispatching task via ConverterFactory.convert()...`);

  try {
    const result = await ConverterFactory.convert(file, targetFormat);

    clearInterval(timerInterval);
    const finalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    perfTimer.textContent = `${finalElapsed}s`;

    if (result.success) {
      log(`✅ Conversion successful! (Elapsed: ${finalElapsed}s)`);

      if (result.blob) {
        const url = URL.createObjectURL(result.blob);
        const filename = result.filename || `converted_${file.name.substring(0, file.name.lastIndexOf('.'))}.${targetFormat}`;
        
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.textContent = `Download ${filename} (${(result.blob.size / 1024).toFixed(1)} KB)`;
        downloadMsg.textContent = '✅ Conversion Complete!';
        downloadArea.style.display = 'flex';
      } else if (result.blobs && result.blobs.length > 0) {
        // Multi-page result (e.g. PDF to images)
        log(`Multi-page output generated (${result.blobs.length} files). Triggering first page download.`);
        const first = result.blobs[0];
        const url = URL.createObjectURL(first.blob);
        downloadLink.href = url;
        downloadLink.download = first.name;
        downloadLink.textContent = `Download ${first.name} (+${result.blobs.length - 1} more)`;
        downloadMsg.textContent = `✅ Rendered ${result.blobs.length} pages!`;
        downloadArea.style.display = 'flex';
      }
    } else {
      log(`❌ Conversion failed: ${result.error || 'Unknown error'}`);
      alert(`Conversion failed: ${result.error || 'Unknown error'}`);
    }
  } catch (err: any) {
    clearInterval(timerInterval);
    log(`❌ Uncaught exception during conversion: ${err.message}`);
    console.error(err);
  } finally {
    convertBtn.disabled = false;
  }
});
