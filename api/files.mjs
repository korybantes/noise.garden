import { neon } from '@neondatabase/serverless';

export const config = { runtime: 'nodejs' };

const dbUrl = process.env.NEON_DB || process.env.VITE_NEON_DB || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('No database connection string provided.');
}

const sql = neon(dbUrl);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'file_id_required' });
    }

    // Get file from database
    const result = await sql`
      SELECT filename, file_type, file_size, file_data 
      FROM uploaded_files 
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'file_not_found' });
    }

    const file = result[0];
    
    // Set appropriate headers
    res.setHeader('Content-Type', file.file_type);
    res.setHeader('Content-Length', file.file_size);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Send the file data
    res.send(file.file_data);
    
  } catch (error) {
    console.error('File serving error:', error);
    return res.status(500).json({ error: 'file_serve_failed' });
  }
}
