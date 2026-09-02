/**
 * CDN Storage Utility
 * Fronts Appwrite Storage with CDN edge caching and image optimization parameters.
 */

export interface CDNImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  gravity?: 'center' | 'top' | 'bottom';
}

const CDN_BASE_URL = import.meta.env.VITE_CDN_BASE_URL || '';
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'http://localhost/v1';
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';

/**
 * Returns a CDN-cached URL for an Appwrite Storage file.
 * Falls back to direct Appwrite URL if CDN base URL is not configured.
 */
export function getCDNFileViewUrl(bucketId: string, fileId: string): string {
  if (!bucketId || !fileId) return '';
  
  if (CDN_BASE_URL) {
    const cleanCDN = CDN_BASE_URL.replace(/\/$/, '');
    return `${cleanCDN}/storage/buckets/${bucketId}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
  }

  const cleanEndpoint = APPWRITE_ENDPOINT.replace(/\/$/, '');
  return `${cleanEndpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

/**
 * Returns an image-optimized CDN preview URL.
 */
export function getCDNImagePreviewUrl(
  bucketId: string,
  fileId: string,
  options: CDNImageOptions = {}
): string {
  if (!bucketId || !fileId) return '';

  const { width, height, quality = 80, format = 'webp', gravity = 'center' } = options;
  const baseUrl = getCDNFileViewUrl(bucketId, fileId);

  const params = new URLSearchParams();
  if (width) params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  if (quality) params.append('quality', quality.toString());
  if (format) params.append('output', format);
  if (gravity) params.append('gravity', gravity);

  const queryString = params.toString();
  return queryString ? `${baseUrl}&${queryString}` : baseUrl;
}
