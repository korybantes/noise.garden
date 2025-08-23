import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

const sql = neon(process.env.NEON_DB);

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    const userId = payload.userId;

    if (req.method === 'GET') {
      const notifications = await sql`
        SELECT id, user_id, type, post_id, from_user_id, from_username, created_at, read
        FROM notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      `;
      
      return res.status(200).json(notifications);
    }

    if (req.method === 'PUT') {
      const { action, notificationId } = req.body;
      
      if (action === 'mark_read' && notificationId) {
        await sql`UPDATE notifications SET read = TRUE WHERE id = ${notificationId} AND user_id = ${userId}`;
      } else if (action === 'mark_all_read') {
        await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${userId}`;
      }
      
      return res.status(200).json({ success: true });
    }

  } catch (error) {
    console.error('Notifications API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 