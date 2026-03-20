import { ConversionType, FileConversionTask, ConversionResult } from './types';

export class ConverterFactory {
  // Web Worker singletons (initialized lazily to respect Next.js SSR boundaries)
  private static imageWorker: Worker | null = null;
  private static videoWorker: Worker | null = null;
  private static documentWorker: Worker | null = null;
  private static pdfWorker: Worker | null = null;

  static initWorkers() {
    if (typeof window === 'undefined') return;
    
    if (!this.imageWorker) {
      this.imageWorker = new Worker(new URL('../workers/imageWorker.ts', import.meta.url));
    }
    
    if (!this.videoWorker) {
      this.videoWorker = new Worker(new URL('../workers/videoWorker.ts', import.meta.url));
    }
    
    if (!this.documentWorker) {
      this.documentWorker = new Worker(new URL('../workers/documentWorker.ts', import.meta.url));
    }

    if (!this.pdfWorker) {
      this.pdfWorker = new Worker(new URL('../workers/pdfWorker.ts', import.meta.url));
    }
  }

  static getConversionCategory(targetFormat: string, ext: string): ConversionType {
    // Identify targeted PDF-specific combinatorial executions
    if (['merge_pdf', 'images_to_pdf', 'pdf'].includes(targetFormat) || ext === 'pdf') {
       return 'pdf';
    }
    
    if (['heic', 'webp', 'png', 'jpg', 'jpeg', 'jfif', 'bmp', 'tiff', 'ico', 'gif'].includes(ext)) {
      return 'image';
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'aac', 'flac'].includes(ext)) {
      return 'video';
    }
    if (['xlsx', 'xls', 'csv', 'json', 'md', 'docx', 'html', 'htm'].includes(ext)) {
      return 'document';
    }
    
    return 'document';
  }

  static async convert(fileOrFiles: File | File[], targetFormat: string, options?: any): Promise<ConversionResult> {
    this.initWorkers();
    
    /**
     * DOM-dependent Main Thread interceptors:
     * PDF and HTML manipulations strictly require Main Thread `document` / `canvas` API accesses.
     */
    if (targetFormat === 'pdf_to_jpg' || targetFormat === 'pdf_to_png') {
       try {
           const format = targetFormat === 'pdf_to_jpg' ? 'jpg' : 'png';
           const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
           const { pdfToImages } = await import('./pdfRenderer');
           const blobs = await pdfToImages(file, format);
           return { id: 'inline', success: true, blobs };
       } catch (err: any) {
           return { id: 'inline', success: false, error: err.message };
       }
    }

    const isArray = Array.isArray(fileOrFiles);
    const firstExt = isArray ? fileOrFiles[0].name.split('.').pop()?.toLowerCase() || '' : (fileOrFiles as File).name.split('.').pop()?.toLowerCase() || '';

    // Delegate HTML->Markdown directly to main thread's TurndownService
    if ((firstExt === 'html' || firstExt === 'htm') && targetFormat === 'md') {
        try {
            const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
            const text = await file.text();
            const TurndownModule = await import('turndown');
            const TurndownService = TurndownModule.default || TurndownModule as any;
            const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
            const markdown = turndownService.turndown(text);
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
            const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
            return { id: 'inline', success: true, blob, filename: `${originalName}.md` };
        } catch (err: any) {
            return { id: 'inline', success: false, error: err.message };
        }
    }

    // Delegate SVG rasterization pipeline to canvas render engine
    if (firstExt === 'svg' && (targetFormat === 'jpg' || targetFormat === 'png' || targetFormat === 'jpeg')) {
        try {
            const format = targetFormat === 'png' ? 'png' : 'jpg';
            const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
            const { svgToImage } = await import('./svgRenderer');
            const result = await svgToImage(file, format);
            return { id: 'inline', success: true, blob: result.blob, filename: result.name };
        } catch (err: any) {
            return { id: 'inline', success: false, error: err.message };
        }
    }

    // Delegate auto-tracer vectorization to imageTracerjs
    if (targetFormat === 'svg') {
        try {
            const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
            const { imageToSvg } = await import('./svgRenderer');
            const result = await imageToSvg(file);
            return { id: 'inline', success: true, blob: result.blob, filename: result.name };
        } catch (err: any) {
            return { id: 'inline', success: false, error: err.message };
        }
    }

    // Process background Worker threads
    const type = this.getConversionCategory(targetFormat, firstExt);
    const taskId = Math.random().toString(36).substring(2, 9);
    
    const task: FileConversionTask = {
      id: taskId,
      file: isArray ? null : (fileOrFiles as File),
      targetFormat,
      options
    };

    if (isArray) {
       task.files = fileOrFiles as File[];
       task.type = targetFormat; // 'merge_pdf' or 'images_to_pdf'
    }
    
    return new Promise((resolve, reject) => {
      let worker: Worker | null = null;

      switch (type) {
        case 'image':
          worker = this.imageWorker;
          break;
        case 'video':
        case 'audio':
          worker = this.videoWorker;
          break;
        case 'document':
          worker = this.documentWorker;
          break;
        case 'pdf':
          worker = this.pdfWorker;
          break;
      }

      if (!worker) {
        return reject(new Error(`Unresolved Worker dispatch module lookup: ${type}`));
      }

      const onMessage = (e: MessageEvent) => {
        const result = e.data as ConversionResult;
        
        if (result.id === task.id) {
          worker?.removeEventListener('message', onMessage);
          worker?.removeEventListener('error', onError);
          
          if (result.status === 'done' || result.success) { // Backward compatibility
            resolve({ ...result, success: true });
          } else {
            reject(new Error(result.error || 'Worker execution failed silently'));
          }
        }
      };

      const onError = (e: ErrorEvent) => {
        worker?.removeEventListener('message', onMessage);
        worker?.removeEventListener('error', onError);
        reject(new Error(`Fatal worker isolation termination: ${e.message}`));
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);

      worker.postMessage(task);
    });
  }
}
