import { PDFDocument } from 'pdf-lib';

const ctx: Worker = self as any;

ctx.addEventListener('message', async (e) => {
  const { id, type, files } = e.data;
  
  try {
    /**
     * PDF Consolidation Architecture
     * Synchronously joins contiguous sequential PDFs into a singular wrapper ArrayBuffer.
     */
    if (type === 'merge_pdf') {
       const mergedPdf = await PDFDocument.create();
       for (const file of files) {
           const arrayBuffer = await file.arrayBuffer();
           const pdf = await PDFDocument.load(arrayBuffer);
           const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
           copiedPages.forEach((page) => mergedPdf.addPage(page));
       }
       const pdfBytes = await mergedPdf.save();
       ctx.postMessage({ id, success: true, blob: new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }) });
       return;
    }
    
    /**
     * Image to PDF Packing Protocol
     * Implements non-destructive direct embedding to generate an locally accessible PDF file.
     */
    if (type === 'images_to_pdf') {
       const pdf = await PDFDocument.create();
       for (const file of files) {
           const arrayBuffer = await file.arrayBuffer();
           let image;
           const mime = file.type || file.name.toLowerCase();
           if (mime.includes('jpeg') || mime.includes('jpg')) {
               image = await pdf.embedJpg(arrayBuffer);
           } else if (mime.includes('png')) {
               image = await pdf.embedPng(arrayBuffer);
           } else {
               throw new Error(`MIME compatibility rejection: ${file.name}. Only JPG/PNG blobs can be natively sealed inside a PDF struct.`);
           }
           // Dynamically configure canvas viewport strictly matching the ingested graphical dimensions
           const page = pdf.addPage([image.width, image.height]);
           page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
       }
       const pdfBytes = await pdf.save();
       ctx.postMessage({ id, success: true, blob: new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }) });
       return;
    }

    throw new Error(`Unrecognized internal execution format: ${type}`);
  } catch (err: any) {
    ctx.postMessage({ id, success: false, error: err.message });
  }
});
