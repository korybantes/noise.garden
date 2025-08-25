import { neon } from '@neondatabase/serverless';
import { getAuthUser } from './security.mjs';
import crypto from 'crypto';

export const config = { runtime: 'nodejs' };

const dbUrl = process.env.NEON_DB || process.env.VITE_NEON_DB || process.env.DATABASE_URL;
const sql = dbUrl ? neon(dbUrl) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Check authentication
  const user = await getAuthUser(req, res);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    // Expect raw binary body (application/octet-stream)
    const filename = req.headers['x-filename'] || `audio_${Date.now()}.webm`;
    const fileType = String(req.headers['x-file-type'] || 'audio/webm');

    const maxSize = 10 * 1024 * 1024; // 10MB
    const chunks = [];
    let total = 0;

    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxSize) {
          reject(new Error('file_too_large'));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', resolve);
      req.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'no_file_provided' });
    }
    if (!fileType.startsWith('audio/')) {
      return res.status(400).json({ error: 'invalid_file_type' });
    }

    // If Cloudinary configured, upload there and return URL directly
    const cloudinaryUrl = process.env.CLOUDINARY_URL || process.env.VITE_CLOUDINARY_URL;
    if (cloudinaryUrl) {
      const parsed = new URL(cloudinaryUrl);
      const apiKey = parsed.username;
      const apiSecret = parsed.password;
      const cloudName = parsed.hostname;
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = 'audios';
      // Build signature string
      const toSign = `folder=${folder}&timestamp=${timestamp}`;
      const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

      // Use global FormData/Blob available in Node 18+
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: fileType }), filename);
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);
      form.append('folder', folder);

      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
      const uploadResp = await fetch(endpoint, { method: 'POST', body: form });
      if (!uploadResp.ok) {
        const errTxt = await uploadResp.text();
        console.error('Cloudinary upload failed:', errTxt);
        return res.status(502).json({ error: 'cloudinary_upload_failed' });
      }
      const data = await uploadResp.json();
      const fileUrl = data.secure_url || data.url;
      return res.status(200).json({ url: fileUrl, filename, size: buffer.length, type: fileType, provider: 'cloudinary' });
    }

    // Fallback: store in Postgres if configured
    if (!sql) {
      return res.status(500).json({ error: 'storage_not_configured' });
    }

    // Ensure table exists
    await sql`CREATE TABLE IF NOT EXISTS uploaded_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const result = await sql`
      INSERT INTO uploaded_files (user_id, filename, file_type, file_size, file_data, created_at)
      VALUES (${user.userId}, ${String(filename)}, ${fileType}, ${buffer.length}, ${buffer}, NOW())
      RETURNING id, filename
    `;

    const id = result[0].id;
    const fileUrl = `/api/files?id=${id}`; // files endpoint expects query param

    return res.status(200).json({ 
      url: fileUrl,
      filename: result[0].filename,
      size: buffer.length,
      type: fileType,
      provider: 'db'
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (String(error.message) === 'file_too_large') {
      return res.status(400).json({ error: 'file_too_large' });
    }
    return res.status(500).json({ error: 'upload_failed' });
  }
}
