/// <reference lib="webworker" />

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { FileConversionTask, ConversionResult } from '../lib/types';

/**
 * Singleton FFmpeg instance. 
 * Prevents redundant loading of the 30MB+ WebAssembly core across multiple tasks.
 */
let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

const ctx: Worker = self as any;

ctx.addEventListener('message', async (e: MessageEvent<FileConversionTask>) => {
  const task = e.data;
  const { id, file, targetFormat } = task;

  try {
    if (!ffmpeg) {
      ffmpeg = new FFmpeg();
      // Optional: ffmpeg.on('log', ({ message }) => console.log('[FFmpeg]', message));
    }

    if (!isLoaded) {
      /**
       * Load pre-fetched WASM binaries from local public assets.
       * Eliminates external CDN dependencies to ensure strict air-gapped privacy.
       */
      const baseURL = self.location.origin;
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg/ffmpeg-core.wasm`,
      });
      isLoaded = true;
    }

    // Extract base metadata for Virtual File System (VFS) operations
    const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
    const inputExt = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const inputFileName = `input.${inputExt}`;
    const outputFileName = `output.${targetFormat}`;

    // Stream physical File blob into FFmpeg's isolated WebAssembly memory
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));

    let ffmpegArgs: string[] = [];

    if (targetFormat === 'gif') {
      /**
       * GIF Generation Pipeline:
       * Utilizes comprehensive palettegen/paletteuse filters for high-fidelity color mapping.
       * Capped at 15fps and 480w to mitigate exponential VRAM bloat.
       */
      ffmpegArgs = [
        '-i', inputFileName,
        '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        outputFileName
      ];
    } else if (targetFormat === 'mp3' || targetFormat === 'wav' || targetFormat === 'aac') {
      // Audio Extraction/Transcoding Pipeline: disables video stream (-vn)
      let codec = 'libmp3lame';
      if (targetFormat === 'wav') codec = 'pcm_s16le';
      else if (targetFormat === 'aac') codec = 'aac';
      
      ffmpegArgs = ['-i', inputFileName, '-vn', '-c:a', codec, '-q:a', '2', outputFileName];
    } else {
      // Standard multiplexing/transcoding fallback
      ffmpegArgs = ['-i', inputFileName, outputFileName];
    }

    // Execute blocking FFmpeg computational task
    await ffmpeg.exec(ffmpegArgs);

    // Retrieve serialized buffer from VFS
    const data = await ffmpeg.readFile(outputFileName);

    let mimeType = 'video/mp4';
    if (targetFormat === 'gif') mimeType = 'image/gif';
    else if (targetFormat === 'mp3') mimeType = 'audio/mpeg';
    else if (targetFormat === 'wav') mimeType = 'audio/wav';
    else if (targetFormat === 'aac') mimeType = 'audio/aac';

    const resultBlob = new Blob([data as any], { type: mimeType });

    // Enforce aggressive garbage collection to prevent WebWorker OOM crashes
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

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
      error: error.message || 'FFmpeg engine execution failed.'
    } as ConversionResult);
  }
});

export {}; // Module scope enforcement
