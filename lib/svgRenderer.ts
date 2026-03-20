export async function svgToImage(file: File, format: 'jpg' | 'png' = 'png'): Promise<{ name: string; blob: Blob }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width || 800; // Fallback dimensions
            canvas.height = img.height || 800;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Failed to acquire canvas 2D rendering context'));
            
            // Hardcode opaque white background for non-transparent JPEG exports
            if (format === 'jpg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
                    resolve({ name: `${originalName}.${format}`, blob });
                } else {
                    reject(new Error('Canvas rasterization to Blob failed'));
                }
            }, `image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.95);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('SVG Parsing Error. Ensure the payload is a valid scalable vector graphics structure.'));
        }
        img.src = url;
    });
}

/**
 * Executes a deterministic auto-tracing algorithm to vectorize a raster image.
 * Dynamically loaded to prevent Next.js SSR crashes against legacy DOM-bound modules.
 */
export async function imageToSvg(file: File): Promise<{ name: string; blob: Blob }> {
    // @ts-ignore: imagetracerjs does not guarantee valid TypeScript type definitions
    const ImageTracerModule = await import('imagetracerjs');
    const ImageTracer = ImageTracerModule.default || ImageTracerModule as any;
    
    return new Promise((resolve, reject) => {
        try {
            const url = URL.createObjectURL(file);
            ImageTracer.imageToSVG(url, (svgString: string) => {
                URL.revokeObjectURL(url);
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8;' });
                const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
                resolve({ name: `${originalName}.svg`, blob });
            }, 'default');
        } catch (error: any) {
            reject(new Error(`Raster to Vector Tracing Engine Failure: ${error.message}`));
        }
    });
}
