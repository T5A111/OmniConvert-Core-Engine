/// <reference lib="webworker" />

/**
 * Polyfill `window` and `document` environments.
 * External rasterization libraries (e.g. heic2any) natively assume DOM presence upon initialization.
 */
if (typeof self !== 'undefined') {
  Object.defineProperty(self, 'window', {
    value: self,
    writable: false,
    enumerable: true,
    configurable: true,
  });
  // Mock barebones document wrapper to prevent invocation ReferenceErrors
  if (!(self as any).document) {
    (self as any).document = {
      createElement: () => ({ getContext: () => null })
    };
  }
}

import { FileConversionTask, ConversionResult } from '../lib/types';

const ctx: Worker = self as any;

ctx.addEventListener('message', async (e: MessageEvent<FileConversionTask>) => {
  const task = e.data;
  const { id, file, targetFormat } = task;

  try {
    let resultBlob: Blob;
    
    // Normalize format identifiers
    const currentExt = file.name.split('.').pop()?.toLowerCase() || '';

    // ==========================================
    // 1. HEIC Decryption Pipeline
    // ==========================================
    if (currentExt === 'heic') {
      const mimeType = targetFormat === 'webp' ? 'image/webp' : 'image/jpeg';
      
      /**
       * Dynamically load HEIC decoder to bypass parsing-time Out-Of-Memory (OOM) errors.
       * @ts-ignore: heic2any typings might be inherently untyped.
       */
      const heic2anyModule = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;

      let converted = await heic2any({
        blob: file as Blob,
        toType: mimeType,
        quality: 0.8, // Balanced Web compression threshold
      });

      // Dereference sequential frames if origin format contains animation loops
      if (Array.isArray(converted)) {
        converted = converted[0];
      }
      
      resultBlob = converted as Blob;
    } else {
      // ==========================================
      // 2. Standard Image Encoding Pipeline (PNG / JPG / WEBP)
      // ==========================================
      /**
       * Offscreen Canvas Repainting:
       * Strip out deeply embedded EXIF Metadata (GPS, Camera Auth) systematically.
       * Aligns with the 100% Privacy & Zero-Track objective.
       */
      let mimeType = 'image/jpeg';
      if (targetFormat === 'webp') mimeType = 'image/webp';
      else if (targetFormat === 'png') mimeType = 'image/png';

      const imageBitmap = await createImageBitmap(file as Blob);
      const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) throw new Error('Unresolvable OffscreenCanvas 2D operational context');

      // Guarantee opaque backdrop for alpha-channel transcodings (e.g. PNG -> JPG)
      if (mimeType === 'image/jpeg') {
        ctx2d.fillStyle = '#ffffff';
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx2d.drawImage(imageBitmap, 0, 0);

      resultBlob = await canvas.convertToBlob({
        type: mimeType,
        quality: 0.8 
      });
      
      // Explicitly detach hardware acceleration bindings
      imageBitmap.close();
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
      error: error.message || 'Image engine fault failure'
    } as ConversionResult);
  }
});

export {}; // Isolate namespace boundary
