import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.NEON_DB);
const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || 'anonymous_social_secret_key_change_in_production');

async function getAuthUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return { userId: String(payload.userId), username: String(payload.username), role: String(payload.role) };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'POST') {
      const { action, args } = req.body || {};

      switch (action) {
        case 'createWhisper': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { content, parentId, imageUrl, expiresAt } = args;
          if (!content || !parentId) return res.status(400).json({ error: 'missing_params' });

          // Verify the parent post exists and get the original poster
          const parentPost = await sql`SELECT user_id FROM posts WHERE id = ${parentId} AND expires_at > NOW()`;
          if (parentPost.length === 0) return res.status(404).json({ error: 'parent_post_not_found' });

          // Create the whisper post with is_whisper flag
          const whisper = await sql`
            INSERT INTO posts (user_id, content, parent_id, image_url, expires_at, is_whisper) 
            VALUES (${me.userId}, ${content}, ${parentId}, ${imageUrl || null}, ${expiresAt || sql`DEFAULT`}, TRUE)
            RETURNING id, user_id, content, created_at, expires_at, parent_id, image_url, is_whisper
          `;

          // Get user info for the response
          const user = await sql`SELECT username, role, avatar_url FROM users WHERE id = ${me.userId}`;
          
          return res.status(200).json({ 
            success: true, 
            whisper: {
              ...whisper[0],
              username: user[0].username,
              role: user[0].role,
              avatar_url: user[0].avatar_url,
              reply_count: 0,
              repost_count: 0
            },
            message: 'Whisper created. Only the original poster can see this reply.'
          });
        }

        case 'getWhispersForPost': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { postId } = args;
          if (!postId) return res.status(400).json({ error: 'missing_params' });

          // Get the original post to check if user is the poster
          const originalPost = await sql`SELECT user_id FROM posts WHERE id = ${postId}`;
          if (originalPost.length === 0) return res.status(404).json({ error: 'post_not_found' });

          // Only show whispers if user is the original poster or a moderator/admin
          if (originalPost[0].user_id !== me.userId && me.role !== 'admin' && me.role !== 'moderator') {
            return res.status(403).json({ error: 'not_authorized' });
          }

          // Get all whispers for this post
          const whispers = await sql`
            SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.image_url, p.is_whisper,
                   u.username, u.role, u.avatar_url
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.parent_id = ${postId} AND p.is_whisper = TRUE AND p.expires_at > NOW()
            ORDER BY p.created_at ASC
          `;

          return res.status(200).json({ 
            success: true, 
            whispers: whispers.map(w => ({
              ...w,
              reply_count: 0,
              repost_count: 0
            }))
          });
        }

        case 'getUserWhispers': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          // Get all whispers created by the user
          const whispers = await sql`
            SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.image_url, p.is_whisper,
                   u.username, u.role, u.avatar_url,
                   op.content as parent_content, op.user_id as parent_user_id
            FROM posts p
            JOIN users u ON p.user_id = u.id
            JOIN posts op ON p.parent_id = op.id
            WHERE p.user_id = ${me.userId} AND p.is_whisper = TRUE AND p.expires_at > NOW()
            ORDER BY p.created_at DESC
          `;

          return res.status(200).json({ 
            success: true, 
            whispers: whispers.map(w => ({
              ...w,
              reply_count: 0,
              repost_count: 0
            }))
          });
        }

        case 'deleteWhisper': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { whisperId } = args;
          if (!whisperId) return res.status(400).json({ error: 'missing_params' });

          // Only allow creator or moderators to delete whispers
          const result = await sql`
            DELETE FROM posts 
            WHERE id = ${whisperId} AND is_whisper = TRUE 
              AND (user_id = ${me.userId} OR ${me.role} IN ('admin', 'moderator'))
            RETURNING id
          `;

          if (result.length === 0) {
            return res.status(403).json({ error: 'not_authorized' });
          }

          return res.status(200).json({ 
            success: true, 
            message: 'Whisper deleted successfully.'
          });
        }

        default:
          return res.status(400).json({ error: 'unknown_action' });
      }
    } else {
      return res.status(405).json({ error: 'method_not_allowed' });
    }
  } catch (error) {
    console.error('Whispers API error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
} 