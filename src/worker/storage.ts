import { Env } from './types.js';
import { generateId } from './crypto.js';

export async function handleStorage(request: Request, env: Env, pathname: string): Promise<Response> {
  // Upload file: POST /api/storage/upload
  if (pathname === '/api/storage/upload' && request.method === 'POST') {
    try {
      const contentType = request.headers.get('Content-Type') || '';
      
      let fileId = generateId('fil_');
      let fileName = 'file.bin';
      let mimeType = 'application/octet-stream';
      let fileData = '';
      let fileSize = 0;
      let orgId = 'org_default';

      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const customId = formData.get('fileId') as string;
        const formOrgId = formData.get('organizationId') as string;
        if (customId) fileId = customId;
        if (formOrgId) orgId = formOrgId;

        if (!file) {
          return Response.json({ error: 'No file provided in form data' }, { status: 400 });
        }

        fileName = file.name;
        mimeType = file.type || 'application/octet-stream';
        fileSize = file.size;

        const arrayBuffer = await file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileData = btoa(binary);
      } else {
        const body = await request.json() as any;
        if (body.fileId) fileId = body.fileId;
        if (body.organizationId) orgId = body.organizationId;
        fileName = body.name || 'file.bin';
        mimeType = body.mimeType || 'application/octet-stream';
        fileData = body.data || '';
        fileSize = body.size || fileData.length;
      }

      await env.DB.prepare(`
        INSERT INTO files (id, organizationId, name, mimeType, size, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          organizationId = excluded.organizationId,
          name = excluded.name,
          mimeType = excluded.mimeType,
          size = excluded.size,
          data = excluded.data
      `).bind(fileId, orgId, fileName, mimeType, fileSize, fileData).run();

      return Response.json({
        $id: fileId,
        id: fileId,
        name: fileName,
        mimeType,
        sizeOriginal: fileSize,
        success: true
      });
    } catch (err: any) {
      console.error('File upload error:', err);
      return Response.json({ error: err.message || 'File upload failed' }, { status: 500 });
    }
  }

  // View / Download file: GET /api/storage/file/:fileId or GET /api/storage/view/:fileId
  if ((pathname.startsWith('/api/storage/file/') || pathname.startsWith('/api/storage/view/') || pathname.startsWith('/api/storage/download/')) && request.method === 'GET') {
    const fileId = pathname.split('/').pop();
    if (!fileId) return Response.json({ error: 'File ID missing' }, { status: 400 });

    const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first() as any;
    if (!file || !file.data) {
      return new Response('File not found', { status: 404 });
    }

    const binary = atob(file.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const isDownload = pathname.includes('/download/');
    const headers = new Headers();
    headers.set('Content-Type', file.mimeType || 'application/octet-stream');
    headers.set('Content-Length', String(bytes.byteLength));
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (isDownload) {
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name || 'download')}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.name || 'view')}"`);
    }

    return new Response(bytes.buffer, {
      status: 200,
      headers
    });
  }

  // Delete file: DELETE /api/storage/file/:fileId
  if (pathname.startsWith('/api/storage/file/') && request.method === 'DELETE') {
    const fileId = pathname.split('/').pop();
    if (fileId) {
      await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
