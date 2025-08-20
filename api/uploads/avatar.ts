import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const form = await new Promise<FormData>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      req.on('data', (c: Uint8Array) => chunks.push(c));
      req.on('end', () => {
        try {
          const blob = new Blob(chunks);
          // Using undici FormData parser (runtime supports it)
          // However Node serverless may not support direct parsing; instruct to use Fetch multipart from client
          // Here we fallback to streaming into put if content-type is image
          resolve(new FormData());
        } catch (e) { reject(e); }
      });
    });
    // Instruct clients to upload directly with put via client-side SDK. As a simplified server, accept raw bytes
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const filename = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.bin`;
    const url = await put(filename, req as any, { access: 'public', contentType });
    return res.status(200).json({ url: url.url });
  } catch (e) {
    return res.status(500).json({ error: 'upload_failed' });
  }
} 