import { describe, it, expect } from 'vitest';
import { getCDNFileViewUrl, getCDNImagePreviewUrl } from './cdnStorage';

describe('cdnStorage Utility', () => {
  it('returns empty string if bucketId or fileId is missing', () => {
    expect(getCDNFileViewUrl('', 'file123')).toBe('');
    expect(getCDNFileViewUrl('bucket123', '')).toBe('');
    expect(getCDNImagePreviewUrl('', '')).toBe('');
  });

  it('constructs correct file view URL using default endpoint', () => {
    const url = getCDNFileViewUrl('pod-bucket', 'pod-file-1');
    expect(url).toContain('/storage/buckets/pod-bucket/files/pod-file-1/view');
  });

  it('applies image optimization query parameters in preview URL', () => {
    const previewUrl = getCDNImagePreviewUrl('tyre-bucket', 'tyre-photo-1', {
      width: 400,
      height: 300,
      quality: 85,
      format: 'webp'
    });

    expect(previewUrl).toContain('width=400');
    expect(previewUrl).toContain('height=300');
    expect(previewUrl).toContain('quality=85');
    expect(previewUrl).toContain('output=webp');
  });
});
