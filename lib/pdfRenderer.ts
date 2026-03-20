import * as pdfjsLib from 'pdfjs-dist';

/**
 * Utilizing locally hosted unbundled Web Worker execution.
 * Guaranteed 100% offline air-gapped conversion, completely avoiding external CDN tracking or blocking.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

export async function pdfToImages(file: File, format: 'jpg' | 'png' = 'png'): Promise<{ name: string; blob: Blob }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const results = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Explicitly amplify viewport resolution matrix 2x to guarantee crisp readable extraction
    const viewport = page.getViewport({ scale: 2.0 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    if (context) {
        // Enforce solid opaque background rendering before paint instructions for JPG exports
        if (format === 'jpg') {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvasContext: context, viewport } as any).promise;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.9));
        if (blob) {
            results.push({
                name: `${file.name.replace(/\.pdf$/i, '')}_page_${i}.${format}`,
                blob
            });
        }
    }
  }
  return results;
}
