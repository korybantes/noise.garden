import { neon } from '@neondatabase/serverless';
import { getAuthUser } from './security.mjs';

export const config = { runtime: 'nodejs' };

const dbUrl = process.env.NEON_DB || process.env.VITE_NEON_DB || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('No database connection string provided.');
}

const sql = neon(dbUrl);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // Check authentication
  const user = await getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    // For now, we'll use a simple approach - store the file in a cloud storage service
    // In production, you'd want to use AWS S3, Google Cloud Storage, or similar
    
    // For development, we'll create a simple file storage system
    // This is a basic implementation - in production, use proper cloud storage
    
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return res.status(400).json({ error: 'no_file_provided' });
    }

    // Check file type
    if (!file.type.startsWith('audio/')) {
      return res.status(400).json({ error: 'invalid_file_type' });
    }

    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return res.status(400).json({ error: 'file_too_large' });
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    
    // Generate a unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop() || 'webm';
    const filename = `audio_${timestamp}_${randomId}.${extension}`;
    
    // For now, we'll store the file data in the database
    // In production, you'd upload to cloud storage and store the URL
    const fileData = Buffer.from(buffer);
    
    // Store file metadata in database
    const result = await sql`
      INSERT INTO uploaded_files (user_id, filename, file_type, file_size, file_data, created_at)
      VALUES (${user.userId}, ${filename}, ${file.type}, ${file.size}, ${fileData}, NOW())
      RETURNING id, filename
    `;
    
    // Return a URL that can be used to access the file
    // In production, this would be a cloud storage URL
    const fileUrl = `/api/files/${result[0].id}`;
    
    return res.status(200).json({ 
      url: fileUrl,
      filename: result[0].filename,
      size: file.size,
      type: file.type
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'upload_failed' });
  }
}
