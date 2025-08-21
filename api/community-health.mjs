import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

export const config = { runtime: 'nodejs' };

// Handle different environment variable names for Vercel
const dbUrl = process.env.NEON_DB || process.env.VITE_NEON_DB || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('No database connection string provided. Please set NEON_DB, VITE_NEON_DB, or DATABASE_URL environment variable.');
}

const sql = neon(dbUrl);
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
    if (req.method === 'GET') {
      // Health check endpoint
      try {
        await sql`SELECT 1 as test`;
        return res.status(200).json({ 
          success: true, 
          message: 'Database connection successful',
          timestamp: new Date().toISOString()
        });
      } catch (dbError) {
        console.error('Database connection failed:', dbError);
        return res.status(500).json({ 
          success: false, 
          error: 'Database connection failed',
          details: dbError.message
        });
      }
    }

    if (req.method === 'POST') {
      const { action, args } = req.body || {};

      switch (action) {
        case 'flagPost': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { postId, reason } = args;
          if (!postId || !reason) return res.status(400).json({ error: 'missing_params' });

          // Check if post exists
          const post = await sql`SELECT id FROM posts WHERE id = ${postId} AND expires_at > NOW()`;
          if (post.length === 0) return res.status(404).json({ error: 'post_not_found' });

          // Check if user already flagged this post
          const existingFlag = await sql`SELECT id FROM flags WHERE post_id = ${postId} AND user_id = ${me.userId}`;
          if (existingFlag.length > 0) {
            // Update existing flag
            await sql`UPDATE flags SET reason = ${reason} WHERE post_id = ${postId} AND user_id = ${me.userId}`;
          } else {
            // Create new flag
            await sql`INSERT INTO flags (post_id, user_id, reason) VALUES (${postId}, ${me.userId}, ${reason})`;
          }

          // Check if post should be quarantined (threshold = 3 flags)
          const flagCount = await sql`SELECT COUNT(*) as count FROM flags WHERE post_id = ${postId}`;
          if (Number(flagCount[0].count) >= 3) {
            await sql`UPDATE posts SET is_quarantined = TRUE WHERE id = ${postId}`;
            
            // Notify the original poster
            const originalPost = await sql`SELECT user_id FROM posts WHERE id = ${postId}`;
            if (originalPost.length > 0) {
              await sql`
                INSERT INTO notifications (user_id, type, post_id, from_user_id, from_username)
                VALUES (${originalPost[0].user_id}, 'quarantine', ${postId}, ${me.userId}, ${me.username})
              `;
            }
          }

          return res.status(200).json({ 
            success: true, 
            message: 'Post flagged successfully',
            quarantined: Number(flagCount[0].count) >= 3
          });
        }

        case 'getPostFlags': {
          const { postId } = args;
          if (!postId) return res.status(400).json({ error: 'missing_params' });

          const flags = await sql`
            SELECT f.id, f.post_id, f.user_id, f.reason, f.created_at, u.username
            FROM flags f
            JOIN users u ON f.user_id = u.id
            WHERE f.post_id = ${postId}
            ORDER BY f.created_at DESC
          `;

          return res.status(200).json({ 
            success: true, 
            flags: flags.map(f => ({
              id: f.id,
              post_id: f.post_id,
              user_id: f.user_id,
              username: f.username,
              reason: f.reason,
              created_at: f.created_at
            }))
          });
        }

        case 'getFlaggedPosts': {
          const me = await getAuthUser(req);
          if (!me || !['admin', 'moderator'].includes(me.role)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }

          const flaggedPosts = await sql`
            SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url,
                   p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
                   u.username, u.role, u.avatar_url,
                   (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count,
                   (SELECT COUNT(*) FROM posts rp WHERE rp.repost_of = p.id) as repost_count,
                   (SELECT COUNT(*) FROM flags WHERE flags.post_id = p.id) as flag_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE EXISTS (SELECT 1 FROM flags WHERE flags.post_id = p.id)
            ORDER BY p.created_at DESC
          `;

          return res.status(200).json({ 
            success: true, 
            flaggedPosts: flaggedPosts.map(row => ({
              id: row.id,
              user_id: row.user_id,
              username: row.username,
              content: row.content,
              created_at: row.created_at,
              expires_at: row.expires_at,
              parent_id: row.parent_id,
              repost_of: row.repost_of,
              image_url: row.image_url,
              avatar_url: row.avatar_url,
              role: row.role,
              is_quarantined: row.is_quarantined || false,
              is_popup_thread: row.is_popup_thread || false,
              popup_reply_limit: row.popup_reply_limit,
              popup_time_limit: row.popup_time_limit,
              popup_closed_at: row.popup_closed_at,
              replies_disabled: row.replies_disabled || false,
              reply_count: Number(row.reply_count) || 0,
              repost_count: Number(row.repost_count) || 0,
              flag_count: Number(row.flag_count) || 0
            }))
          });
        }

        case 'quarantinePost': {
          const me = await getAuthUser(req);
          if (!me || !['admin', 'moderator'].includes(me.role)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }

          const { postId } = args;
          if (!postId) return res.status(400).json({ error: 'missing_params' });

          await sql`UPDATE posts SET is_quarantined = TRUE WHERE id = ${postId}`;
          
          // Notify the original poster
          const post = await sql`SELECT user_id FROM posts WHERE id = ${postId}`;
          if (post.length > 0) {
            await sql`
              INSERT INTO notifications (user_id, type, post_id, from_user_id, from_username)
              VALUES (${post[0].user_id}, 'quarantine', ${postId}, ${me.userId}, ${me.username})
            `;
          }

          return res.status(200).json({ 
            success: true, 
            message: 'Post quarantined successfully'
          });
        }

        case 'unquarantinePost': {
          const me = await getAuthUser(req);
          if (!me || !['admin', 'moderator'].includes(me.role)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }

          const { postId } = args;
          if (!postId) return res.status(400).json({ error: 'missing_params' });

          await sql`UPDATE posts SET is_quarantined = FALSE WHERE id = ${postId}`;

          return res.status(200).json({ 
            success: true, 
            message: 'Post unquarantined successfully'
          });
        }

        case 'createPopupThread': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { postId, replyLimit, timeLimitMinutes } = args;
          if (!postId || !replyLimit || !timeLimitMinutes) return res.status(400).json({ error: 'missing_params' });

          // Check if post exists and user owns it
          const post = await sql`SELECT user_id FROM posts WHERE id = ${postId} AND expires_at > NOW()`;
          if (post.length === 0) return res.status(404).json({ error: 'post_not_found' });
          if (post[0].user_id !== me.userId) return res.status(403).json({ error: 'not_authorized' });

          await sql`
            UPDATE posts 
            SET is_popup_thread = TRUE, popup_reply_limit = ${replyLimit}, popup_time_limit = ${timeLimitMinutes}
            WHERE id = ${postId}
          `;
          
          await sql`
            INSERT INTO popup_threads (post_id, reply_limit, time_limit_minutes)
            VALUES (${postId}, ${replyLimit}, ${timeLimitMinutes})
          `;

          return res.status(200).json({ 
            success: true, 
            message: 'Popup thread created successfully'
          });
        }

        case 'closePopupThread': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { postId } = args;
          if (!postId) return res.status(400).json({ error: 'missing_params' });

          // Check if post exists and user owns it
          const post = await sql`SELECT user_id FROM posts WHERE id = ${postId}`;
          if (post.length === 0) return res.status(404).json({ error: 'post_not_found' });
          if (post[0].user_id !== me.userId) return res.status(403).json({ error: 'not_authorized' });

          await sql`
            UPDATE posts 
            SET popup_closed_at = NOW()
            WHERE id = ${postId}
          `;
          
          await sql`
            UPDATE popup_threads 
            SET closed_at = NOW()
            WHERE post_id = ${postId}
          `;

          return res.status(200).json({ 
            success: true, 
            message: 'Popup thread closed successfully'
          });
        }

        case 'checkPopupThreadStatus': {
          const { postId } = args;
          if (!postId) return res.status(400).json({ error: 'missing_params' });

          const post = await sql`
            SELECT p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at,
                   pt.closed_at, pt.created_at,
                   (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count
            FROM posts p
            LEFT JOIN popup_threads pt ON p.id = pt.post_id
            WHERE p.id = ${postId}
          `;
          
          if (post.length === 0 || !post[0].is_popup_thread) {
            return res.status(200).json({ 
              success: true, 
              isClosed: false, 
              reason: null 
            });
          }
          
          const row = post[0];
          const replyCount = Number(row.reply_count) || 0;
          const timeLimitMs = (row.popup_time_limit || 0) * 60 * 1000;
          const createdAt = new Date(row.created_at);
          const now = new Date();
          
          // Check if closed by replies limit
          if (row.popup_reply_limit && replyCount >= row.popup_reply_limit) {
            return res.status(200).json({ 
              success: true, 
              isClosed: true, 
              reason: 'replies', 
              remainingReplies: 0 
            });
          }
          
          // Check if closed by time limit
          if (timeLimitMs > 0 && (now.getTime() - createdAt.getTime()) >= timeLimitMs) {
            return res.status(200).json({ 
              success: true, 
              isClosed: true, 
              reason: 'time', 
              remainingTime: 0 
            });
          }
          
          // Check if manually closed
          if (row.popup_closed_at || row.closed_at) {
            return res.status(200).json({ 
              success: true, 
              isClosed: true, 
              reason: 'manual' 
            });
          }
          
          // Calculate remaining
          const remainingReplies = row.popup_reply_limit ? Math.max(0, row.popup_reply_limit - replyCount) : undefined;
          const remainingTime = timeLimitMs > 0 ? Math.max(0, timeLimitMs - (now.getTime() - createdAt.getTime())) : undefined;
          
          return res.status(200).json({ 
            success: true, 
            isClosed: false, 
            reason: null, 
            remainingReplies, 
            remainingTime 
          });
        }

        default:
          return res.status(400).json({ error: 'unknown_action' });
      }
    } else {
      return res.status(405).json({ error: 'method_not_allowed' });
    }
  } catch (error) {
    console.error('Community health API error:', error);
    
    // Check if it's a database connection error
    if (error.message.includes('database connection') || error.message.includes('neon')) {
      return res.status(500).json({ 
        error: 'database_connection_failed',
        message: 'Database connection failed. Please check your environment variables.',
        details: error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'internal_server_error',
      message: 'An unexpected error occurred',
      details: error.message
    });
  }
} 