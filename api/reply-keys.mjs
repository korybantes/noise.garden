import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';
import { randomBytes } from 'crypto';

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
        case 'createReplyKey': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { postId, recipientId } = args;
          if (!postId || !recipientId) return res.status(400).json({ error: 'missing_params' });

          // Verify the post exists and user has permission
          const post = await sql`SELECT user_id, parent_id FROM posts WHERE id = ${postId} AND expires_at > NOW()`;
          if (post.length === 0) return res.status(404).json({ error: 'post_not_found' });

          // Only allow reply keys for replies (posts with parent_id)
          if (!post[0].parent_id) return res.status(400).json({ error: 'only_replies_allowed' });

          // Generate a secure random key
          const key = randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          // Store the reply key
          await sql`
            INSERT INTO reply_keys (key_hash, post_id, creator_id, recipient_id, expires_at) 
            VALUES (crypt(${key}, gen_salt('bf')), ${postId}, ${me.userId}, ${recipientId}, ${expiresAt})
          `;

          return res.status(200).json({ 
            success: true, 
            replyKey: key,
            expiresAt: expiresAt.toISOString(),
            message: 'Reply key created. Share this key with the recipient to continue the conversation.'
          });
        }

        case 'validateReplyKey': {
          const { replyKey, postId } = args;
          if (!replyKey || !postId) return res.status(400).json({ error: 'missing_params' });

          // Find and validate the reply key
          const keyRecord = await sql`
            SELECT rk.id, rk.creator_id, rk.recipient_id, rk.expires_at, 
                   c.username as creator_username, r.username as recipient_username
            FROM reply_keys rk
            JOIN users c ON c.id = rk.creator_id
            JOIN users r ON r.id = rk.recipient_id
            WHERE crypt(${replyKey}, rk.key_hash) = rk.key_hash 
              AND rk.post_id = ${postId} 
              AND rk.expires_at > NOW()
          `;

          if (keyRecord.length === 0) {
            return res.status(400).json({ error: 'invalid_or_expired_key' });
          }

          return res.status(200).json({ 
            success: true, 
            creatorUsername: keyRecord[0].creator_username,
            recipientUsername: keyRecord[0].recipient_username,
            expiresAt: keyRecord[0].expires_at,
            message: 'Reply key is valid. You can now continue this conversation.'
          });
        }

        case 'getActiveReplyKeys': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          // Get all active reply keys for the user (as creator or recipient)
          const keys = await sql`
            SELECT rk.id, rk.post_id, rk.creator_id, rk.recipient_id, rk.expires_at,
                   c.username as creator_username, r.username as recipient_username,
                   p.content as post_content
            FROM reply_keys rk
            JOIN users c ON c.id = rk.creator_id
            JOIN users r ON r.id = rk.recipient_id
            JOIN posts p ON p.id = rk.post_id
            WHERE (rk.creator_id = ${me.userId} OR rk.recipient_id = ${me.userId})
              AND rk.expires_at > NOW()
            ORDER BY rk.expires_at ASC
          `;

          return res.status(200).json({ 
            success: true, 
            replyKeys: keys.map(k => ({
              id: k.id,
              postId: k.post_id,
              creatorUsername: k.creator_username,
              recipientUsername: k.recipient_username,
              expiresAt: k.expires_at,
              postContent: k.post_content
            }))
          });
        }

        case 'revokeReplyKey': {
          const me = await getAuthUser(req);
          if (!me) return res.status(401).json({ error: 'unauthorized' });

          const { keyId } = args;
          if (!keyId) return res.status(400).json({ error: 'missing_params' });

          // Only allow creator to revoke
          const result = await sql`
            DELETE FROM reply_keys 
            WHERE id = ${keyId} AND creator_id = ${me.userId}
            RETURNING id
          `;

          if (result.length === 0) {
            return res.status(403).json({ error: 'not_authorized' });
          }

          return res.status(200).json({ 
            success: true, 
            message: 'Reply key revoked successfully.'
          });
        }

        default:
          return res.status(400).json({ error: 'unknown_action' });
      }
    } else {
      return res.status(405).json({ error: 'method_not_allowed' });
    }
  } catch (error) {
    console.error('Reply keys API error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
} 