/// <reference lib="webworker" />

import * as XLSX from 'xlsx';
import { marked } from 'marked';
import { FileConversionTask, ConversionResult } from '../lib/types';

const ctx: Worker = self as any;

ctx.addEventListener('message', async (e: MessageEvent<FileConversionTask>) => {
  const task = e.data;
  const { id, file, targetFormat } = task;

  try {
    let resultBlob: Blob;
    const currentExt = file.name.split('.').pop()?.toLowerCase() || '';
    const arrayBuffer = await file.arrayBuffer();
    
    // ==========================================
    // 1. Spreadsheet Data Module (Excel, CSV, JSON)
    // ==========================================
    if (['xlsx', 'xls', 'csv', 'json'].includes(currentExt) && ['xlsx', 'csv', 'json'].includes(targetFormat)) {
      let workbook;
      
      // Parse raw payload
      if (currentExt === 'json') {
        const text = new TextDecoder().decode(arrayBuffer);
        const json = JSON.parse(text);
        const worksheet = XLSX.utils.json_to_sheet(Array.isArray(json) ? json : [json]);
        workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      } else {
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }

      // Format exportation
      if (targetFormat === 'csv') {
        const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        // Apply UTF-8 BOM (\uFEFF) to ensure wide compatibility with legacy MS Excel ANSI decoders
        resultBlob = new Blob(['\uFEFF', csvText], { type: 'text/csv;charset=utf-8;' });
      } else if (targetFormat === 'json') {
        const jsonObj = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        resultBlob = new Blob([JSON.stringify(jsonObj, null, 2)], { type: 'application/json' });
      } else {
        // Fallback to strict OOXML (.xlsx) wrapper
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        resultBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }
    } 
    // ==========================================
    // 2. Document Parsing Module (Markdown -> HTML)
    //    Note: HTML -> Markdown is handled concurrently in Main Thread (ConverterFactory) due to DOM deps.
    // ==========================================
    else if (currentExt === 'md' && (targetFormat === 'html' || targetFormat === 'htm')) {
      const text = new TextDecoder().decode(arrayBuffer);
      const htmlContent = marked.parse(text) as string;
      
      // Inject standard HTML5 scaffolding with fallback web-safe CSS styling
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${file.name}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
  pre { background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
  code { font-family: monospace; background: #eee; padding: 2px 5px; border-radius: 4px; }
  blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #666; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
      
      resultBlob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    }
    else {
      throw new Error(`Operation unsupported: Conversion from ${currentExt} to ${targetFormat}`);
    }

    const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
    const finalFilename = `${originalName}.${targetFormat}`;

    ctx.postMessage({
      id,
      blob: resultBlob,
      filename: finalFilename,
      success: true
    } as ConversionResult);

  } catch (error: any) {
    ctx.postMessage({
      id,
      success: false,
      error: error.message || 'Document conversion failure encountered.'
    } as ConversionResult);
  }
});

export {};
