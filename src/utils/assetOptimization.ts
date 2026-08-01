/**
 * Media Asset Optimization and CDN Preview Pipeline for Truck-Trip-Tracker
 * Handles image compression, WebP canvas rendering, and Appwrite CDN transformation URLs.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
}

/**
 * Compress client-side image files before upload (reducing 5MB photos down to ~200KB WebP)
 */
export async function compressImageFile(file: File, options: CompressImageOptions = {}): Promise<Blob> {
  const maxWidth = options.maxWidth || 1600;
  const maxHeight = options.maxHeight || 1600;
  const quality = options.quality || 0.8;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File reading error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Build CDN media thumbnail and preview transformation URL
 */
export function getCDNPreviewUrl(originalUrl: string, width = 300, height = 300): string {
  if (!originalUrl) return '';
  if (originalUrl.includes('appwrite')) {
    const joinChar = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${joinChar}width=${width}&height=${height}&mode=admin&output=webp`;
  }
  return originalUrl;
}
