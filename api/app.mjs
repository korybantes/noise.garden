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
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const me = await getAuthUser(req);
  const { action, args } = req.body || {};

  try {
    switch (action) {
      case 'initDatabase': {
        await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
        await sql`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), role TEXT NOT NULL DEFAULT 'user', avatar_url TEXT, bio TEXT, webauthn_credential_id TEXT, webauthn_public_key TEXT, webauthn_sign_count INTEGER DEFAULT 0)`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS webauthn_credential_id TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS webauthn_public_key TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS webauthn_sign_count INTEGER DEFAULT 0`;
        await sql`CREATE TABLE IF NOT EXISTS posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), parent_id UUID REFERENCES posts(id) ON DELETE CASCADE, repost_of UUID REFERENCES posts(id) ON DELETE SET NULL, image_url TEXT, is_whisper BOOLEAN DEFAULT FALSE)`;
        await sql`CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, created_by UUID REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW(), used_by UUID REFERENCES users(id) ON DELETE SET NULL, used_at TIMESTAMPTZ)`;
        await sql`CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, post_id UUID REFERENCES posts(id) ON DELETE CASCADE, from_user_id UUID REFERENCES users(id) ON DELETE CASCADE, from_username TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), read BOOLEAN DEFAULT FALSE)`;
        await sql`DELETE FROM posts WHERE expires_at < NOW()`;
        await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT`;
        await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_whisper BOOLEAN DEFAULT FALSE`;
        await sql`CREATE TABLE IF NOT EXISTS banned_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, banned_by UUID REFERENCES users(id) ON DELETE SET NULL, reason TEXT NOT NULL, banned_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id))`;
        await sql`CREATE TABLE IF NOT EXISTS reply_keys (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key_hash TEXT NOT NULL, post_id UUID REFERENCES posts(id) ON DELETE CASCADE, creator_id UUID REFERENCES users(id) ON DELETE CASCADE, recipient_id UUID REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;
        return res.status(200).json({ ok: true });
      }

      case 'createUser': {
        const { username, passwordHash } = args;
        const rows = await sql`INSERT INTO users (username, password_hash) VALUES (${username}, ${passwordHash}) RETURNING id, username, password_hash, created_at, role, avatar_url, bio`;
        return res.status(200).json(rows[0]);
      }
      case 'getUserByUsername': {
        const { username } = args;
        const rows = await sql`SELECT id, username, password_hash, created_at, role, avatar_url, bio FROM users WHERE username = ${username}`;
        return res.status(200).json(rows[0] || null);
      }
      case 'updateUserProfile': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { avatarUrl, bio } = args;
        await sql`UPDATE users SET avatar_url = ${avatarUrl}, bio = ${bio} WHERE id = ${me.userId}`;
        return res.status(200).json({ ok: true });
      }

      case 'updatePostRepliesDisabled': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { postId, repliesDisabled } = args;
        
        // Check if post exists and user owns it
        const post = await sql`SELECT user_id FROM posts WHERE id = ${postId}`;
        if (post.length === 0) return res.status(404).json({ error: 'post_not_found' });
        if (post[0].user_id !== me.userId) return res.status(403).json({ error: 'not_authorized' });
        
        await sql`UPDATE posts SET replies_disabled = ${repliesDisabled} WHERE id = ${postId}`;
        return res.status(200).json({ ok: true });
      }

      case 'createPost': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { content, parentId, repostOf, imageUrl, expiresAt } = args;
        const rows = await sql`INSERT INTO posts (user_id, content, parent_id, repost_of, image_url, expires_at) VALUES (${me.userId}, ${content}, ${parentId || null}, ${repostOf || null}, ${imageUrl || null}, ${expiresAt || sql`DEFAULT`}) RETURNING id, user_id, content, created_at, expires_at, parent_id, repost_of, image_url`;
        const post = rows[0];
        const u = await sql`SELECT username, role, avatar_url FROM users WHERE id = ${me.userId}`;
        return res.status(200).json({ ...post, username: u[0].username, role: u[0].role, avatar_url: u[0].avatar_url, reply_count: 0, repost_count: 0 });
      }
      case 'getRandomPosts': {
        const { limit = 20, offset = 0, sortBy = 'newest' } = args || {};
        await sql`DELETE FROM posts WHERE expires_at < NOW()`;
        const orderBy = sortBy === 'newest' ? sql`p.created_at DESC` : sql`p.created_at ASC`;
        const rows = await sql`SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, u.username, u.role, u.avatar_url, (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count FROM posts p JOIN users u ON p.user_id = u.id WHERE p.parent_id IS NULL AND p.expires_at > NOW() ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
        return res.status(200).json(rows);
      }
      case 'getPostReplies': {
        const { postId } = args;
        const rows = await sql`SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, u.username, u.role, u.avatar_url, 0 as reply_count FROM posts p JOIN users u ON p.user_id = u.id WHERE p.parent_id = ${postId} AND p.expires_at > NOW() ORDER BY p.created_at ASC`;
        return res.status(200).json(rows);
      }
      case 'getPostById': {
        const { id } = args;
        const rows = await sql`SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, u.username, u.role, u.avatar_url, (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count, (SELECT COUNT(*) FROM posts rp WHERE rp.repost_of = p.id) as repost_count FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ${id} LIMIT 1`;
        return res.status(200).json(rows[0] || null);
      }
      case 'getUserPostsByUsername': {
        const { username } = args;
        const rows = await sql`SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, u.username, u.role, u.avatar_url, (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count FROM posts p JOIN users u ON p.user_id = u.id WHERE u.username = ${username} AND p.expires_at > NOW() ORDER BY p.created_at DESC`;
        return res.status(200).json(rows);
      }
      case 'deletePost': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { postId } = args;
        const rows = await sql`WITH req AS (SELECT role FROM users WHERE id = ${me.userId}) DELETE FROM posts p USING req WHERE p.id = ${postId} AND (p.user_id = ${me.userId} OR req.role IN ('admin','moderator')) RETURNING p.id`;
        return res.status(200).json({ ok: rows.length > 0 });
      }
      case 'repostPost': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { originalPostId } = args;
        const orig = await sql`SELECT content, image_url FROM posts WHERE id = ${originalPostId}`;
        const content = orig[0]?.content || '';
        const imageUrl = orig[0]?.image_url || null;
        const rows = await sql`INSERT INTO posts (user_id, content, repost_of, image_url) VALUES (${me.userId}, ${content}, ${originalPostId}, ${imageUrl}) RETURNING id, user_id, content, created_at, expires_at, parent_id, repost_of, image_url`;
        const u = await sql`SELECT username, role, avatar_url FROM users WHERE id = ${me.userId}`;
        return res.status(200).json({ ...rows[0], username: u[0].username, role: u[0].role, avatar_url: u[0].avatar_url, reply_count: 0, repost_count: 0 });
      }

      // Invites and onboarding
      case 'getInviteByCode': {
        const { code } = args;
        const rows = await sql`SELECT code, created_by, created_at, used_by, used_at FROM invites WHERE code = ${code}`;
        return res.status(200).json(rows[0] || null);
      }
      case 'markInviteUsed': {
        const { code, usedByUserId } = args;
        const rows = await sql`UPDATE invites SET used_by = ${usedByUserId}, used_at = NOW() WHERE code = ${code} AND used_by IS NULL RETURNING code`;
        return res.status(200).json({ ok: rows.length > 0 });
      }
      case 'createInviteForUser': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
        const code = `${part()}-${part()}-${part()}`;
        const rows = await sql`INSERT INTO invites (code, created_by) VALUES (${code}, ${me.userId}) RETURNING code, created_by, created_at, used_by, used_at`;
        return res.status(200).json(rows[0]);
      }

      // Admin & moderation
      case 'getAllUsers': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        if (me.role !== 'admin' && me.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
        const rows = await sql`SELECT id, username, created_at, role, avatar_url, bio FROM users ORDER BY created_at DESC`;
        return res.status(200).json(rows);
      }
      case 'updateUserRole': {
        if (!me || me.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
        const { userId, newRole } = args;
        await sql`UPDATE users SET role = ${newRole} WHERE id = ${userId}`;
        return res.status(200).json({ ok: true });
      }
      case 'getUserStats': {
        if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return res.status(403).json({ error: 'forbidden' });
        const [usersResult, postsResult, invitesResult] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM users`,
          sql`SELECT COUNT(*) as count FROM posts`,
          sql`SELECT COUNT(*) as count FROM invites`,
        ]);
        return res.status(200).json({ totalUsers: Number(usersResult[0]?.count || 0), totalPosts: Number(postsResult[0]?.count || 0), totalInvites: Number(invitesResult[0]?.count || 0) });
      }
      case 'banUser': {
        if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return res.status(403).json({ error: 'forbidden' });
        const { userId, reason } = args;
        await sql`INSERT INTO banned_users (user_id, banned_by, reason) VALUES (${userId}, ${me.userId}, ${reason}) ON CONFLICT (user_id) DO UPDATE SET banned_by = ${me.userId}, reason = ${reason}, banned_at = NOW()`;
        return res.status(200).json({ ok: true });
      }
      case 'unbanUser': {
        if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return res.status(403).json({ error: 'forbidden' });
        const { userId } = args;
        await sql`DELETE FROM banned_users WHERE user_id = ${userId}`;
        return res.status(200).json({ ok: true });
      }
      case 'isUserBanned': {
        const { userId } = args;
        const rows = await sql`SELECT bu.reason, bu.banned_at, bu.banned_by, u.username as banner_username FROM banned_users bu LEFT JOIN users u ON u.id = bu.banned_by WHERE bu.user_id = ${userId}`;
        if (!rows[0]) return res.status(200).json({ banned: false });
        return res.status(200).json({ banned: true, reason: rows[0].reason, bannedAt: rows[0].banned_at, bannedBy: rows[0].banner_username });
      }
      case 'getBannedUsers': {
        if (!me || (me.role !== 'admin' && me.role !== 'moderator')) return res.status(403).json({ error: 'forbidden' });
        const rows = await sql`SELECT u.id, u.username, bu.reason, bu.banned_at, banner.username as banned_by FROM banned_users bu JOIN users u ON u.id = bu.user_id LEFT JOIN users banner ON banner.id = bu.banned_by ORDER BY bu.banned_at DESC`;
        return res.status(200).json(rows);
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    console.error('API error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
} 