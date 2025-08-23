import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';
import admin from 'firebase-admin';
import { 
  setSecurityHeaders, 
  rateLimit, 
  getAuthUser, 
  validateInput, 
  usernameRules, 
  passwordRules, 
  contentRules, 
  inviteRules,
  sanitizeSQL,
  sanitizeHTML,
  logSecurityEvent,
  detectSuspiciousActivity
} from './security.mjs';

export const config = { runtime: 'nodejs' };

// Initialize Firebase Admin SDK
// You'll need to add your Firebase service account key as an environment variable
let firebaseApp;
try {
  // For development, you can use a service account key file
  // In production, use environment variables
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // For development without Firebase (will log warnings)
    console.log('Firebase not configured. Push notifications will be logged but not sent.');
  }
} catch (error) {
  console.log('Firebase initialization failed:', error.message);
  console.log('Push notifications will be logged but not sent.');
}

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
  
  // Set security headers
  setSecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  // Rate limiting for all requests
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  if (!rateLimit(req, res, `global:${clientIP}`)) {
    return;
  }

  const me = await getAuthUser(req, res);
  const { action, args } = req.body || {};

  // Detect suspicious activity
  const suspicious = detectSuspiciousActivity(req, me);
  if (suspicious.length > 0) {
    logSecurityEvent('suspicious_activity_detected', {
      ip: clientIP,
      userAgent: req.headers['user-agent'],
      action,
      suspicious
    });
  }

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
        await sql`CREATE TABLE IF NOT EXISTS user_mutes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, muted_by UUID REFERENCES users(id) ON DELETE SET NULL, reason TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id))`;
        await sql`CREATE TABLE IF NOT EXISTS reply_keys (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key_hash TEXT NOT NULL, post_id UUID REFERENCES posts(id) ON DELETE CASCADE, creator_id UUID REFERENCES users(id) ON DELETE CASCADE, recipient_id UUID REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;
        await sql`CREATE TABLE IF NOT EXISTS device_tokens (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, token TEXT UNIQUE NOT NULL, platform TEXT NOT NULL DEFAULT 'android', created_at TIMESTAMPTZ DEFAULT NOW(), last_used TIMESTAMPTZ DEFAULT NOW())`;
        await sql`CREATE TABLE IF NOT EXISTS news_posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, content TEXT NOT NULL, author_id UUID REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), is_published BOOLEAN DEFAULT TRUE, slug TEXT UNIQUE NOT NULL)`;
        await sql`CREATE TABLE IF NOT EXISTS feedback_tickets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
        return res.status(200).json({ ok: true });
      }

      case 'createUser': {
        // Rate limit signup attempts
        if (!rateLimit(req, res, `signup:${clientIP}`)) {
          return;
        }
        
        const { username, passwordHash } = args;
        
        // Validate input
        const validationErrors = validateInput({ username }, usernameRules);
        if (validationErrors.length > 0) {
          logSecurityEvent('validation_error', {
            ip: clientIP,
            action: 'createUser',
            errors: validationErrors
          });
          return res.status(400).json({ error: 'validation_error', details: validationErrors });
        }
        
        // Sanitize inputs
        const sanitizedUsername = sanitizeSQL(username.toLowerCase());
        
        // Check for existing user
        const existingUser = await sql`SELECT id FROM users WHERE username = ${sanitizedUsername}`;
        if (existingUser.length > 0) {
          logSecurityEvent('duplicate_username_attempt', {
            ip: clientIP,
            username: sanitizedUsername
          });
          return res.status(409).json({ error: 'username_exists' });
        }
        
        const rows = await sql`INSERT INTO users (username, password_hash) VALUES (${sanitizedUsername}, ${passwordHash}) RETURNING id, username, password_hash, created_at, role, avatar_url, bio`;
        
        logSecurityEvent('user_created', {
          ip: clientIP,
          userId: rows[0].id,
          username: sanitizedUsername
        });
        
        return res.status(200).json(rows[0]);
      }
      
      case 'getUserByUsername': {
        const { username } = args;
        
        // Validate input
        const validationErrors = validateInput({ username }, usernameRules);
        if (validationErrors.length > 0) {
          return res.status(400).json({ error: 'validation_error', details: validationErrors });
        }
        
        // Sanitize input
        const sanitizedUsername = sanitizeSQL(username.toLowerCase());
        
        const rows = await sql`SELECT id, username, password_hash, created_at, role, avatar_url, bio FROM users WHERE username = ${sanitizedUsername}`;
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
        
        // Rate limit post creation
        if (!rateLimit(req, res, `post:${me.userId}`)) {
          return;
        }
        
        const { content, parentId, repostOf, imageUrl, expiresAt } = args;
        
        // Validate content
        const validationErrors = validateInput({ content }, contentRules);
        if (validationErrors.length > 0) {
          logSecurityEvent('invalid_post_content', {
            ip: clientIP,
            userId: me.userId,
            errors: validationErrors
          });
          return res.status(400).json({ error: 'validation_error', details: validationErrors });
        }
        
        // Sanitize inputs
        const sanitizedContent = sanitizeHTML(sanitizeSQL(content));
        const sanitizedParentId = parentId ? sanitizeSQL(parentId) : null;
        const sanitizedRepostOf = repostOf ? sanitizeSQL(repostOf) : null;
        const sanitizedImageUrl = imageUrl ? sanitizeSQL(imageUrl) : null;
        
        // Check if parent post exists (if replying)
        if (sanitizedParentId) {
          const parentCheck = await sql`SELECT id FROM posts WHERE id = ${sanitizedParentId} AND expires_at > NOW()`;
          if (parentCheck.length === 0) {
            return res.status(404).json({ error: 'parent_post_not_found' });
          }
        }
        
        // Check if repost target exists (if reposting)
        if (sanitizedRepostOf) {
          const repostCheck = await sql`SELECT id FROM posts WHERE id = ${sanitizedRepostOf} AND expires_at > NOW()`;
          if (repostCheck.length === 0) {
            return res.status(404).json({ error: 'repost_target_not_found' });
          }
        }
        
        const rows = await sql`INSERT INTO posts (user_id, content, parent_id, repost_of, image_url, expires_at) VALUES (${me.userId}, ${sanitizedContent}, ${sanitizedParentId}, ${sanitizedRepostOf}, ${sanitizedImageUrl}, ${expiresAt || sql`DEFAULT`}) RETURNING id, user_id, content, created_at, expires_at, parent_id, repost_of, image_url`;
        const post = rows[0];
        const u = await sql`SELECT username, role, avatar_url FROM users WHERE id = ${me.userId}`;
        
        logSecurityEvent('post_created', {
          ip: clientIP,
          userId: me.userId,
          postId: post.id,
          hasParent: !!sanitizedParentId,
          hasRepost: !!sanitizedRepostOf
        });
        
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
        
        // Validate invite code format
        const validationErrors = validateInput({ invite: code }, inviteRules);
        if (validationErrors.length > 0) {
          logSecurityEvent('invalid_invite_code', {
            ip: clientIP,
            code: code?.substring(0, 10) + '...' // Log partial code for security
          });
          return res.status(400).json({ error: 'invalid_invite_code' });
        }
        
        // Sanitize input
        const sanitizedCode = sanitizeSQL(code.toUpperCase());
        
        const rows = await sql`SELECT code, created_by, created_at, used_by, used_at FROM invites WHERE code = ${sanitizedCode}`;
        return res.status(200).json(rows[0] || null);
      }
      
      case 'markInviteUsed': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        const { code, userId } = args;
        
        // Validate invite code format
        const validationErrors = validateInput({ invite: code }, inviteRules);
        if (validationErrors.length > 0) {
          logSecurityEvent('invalid_invite_usage', {
            ip: clientIP,
            userId: me.userId,
            code: code?.substring(0, 10) + '...'
          });
          return res.status(400).json({ error: 'invalid_invite_code' });
        }
        
        // Sanitize inputs
        const sanitizedCode = sanitizeSQL(code.toUpperCase());
        const sanitizedUserId = sanitizeSQL(userId);
        
        // Check if invite exists and is unused
        const inviteCheck = await sql`SELECT created_by, used_by FROM invites WHERE code = ${sanitizedCode}`;
        if (inviteCheck.length === 0) {
          logSecurityEvent('non_existent_invite', {
            ip: clientIP,
            userId: me.userId,
            code: sanitizedCode
          });
          return res.status(404).json({ error: 'invite_not_found' });
        }
        
        if (inviteCheck[0].used_by) {
          logSecurityEvent('already_used_invite', {
            ip: clientIP,
            userId: me.userId,
            code: sanitizedCode
          });
          return res.status(409).json({ error: 'invite_already_used' });
        }
        
        // Prevent self-invitation (security measure)
        if (inviteCheck[0].created_by === sanitizedUserId) {
          logSecurityEvent('self_invitation_attempt', {
            ip: clientIP,
            userId: me.userId,
            code: sanitizedCode
          });
          return res.status(403).json({ error: 'cannot_use_own_invite' });
        }
        
        // Mark invite as used
        const result = await sql`UPDATE invites SET used_by = ${sanitizedUserId}, used_at = NOW() WHERE code = ${sanitizedCode} AND used_by IS NULL RETURNING code`;
        
        if (result.length === 0) {
          return res.status(409).json({ error: 'invite_already_used' });
        }
        
        logSecurityEvent('invite_used', {
          ip: clientIP,
          userId: me.userId,
          code: sanitizedCode
        });
        
        return res.status(200).json({ success: true });
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
      // Banning functions
      case 'banUser': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        if (me.role !== 'admin' && me.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
        const { userId, reason } = args;
        
        // Check if user exists
        const user = await sql`SELECT id FROM users WHERE id = ${userId}`;
        if (user.length === 0) return res.status(404).json({ error: 'user_not_found' });
        
        await sql`
          INSERT INTO banned_users (user_id, banned_by, reason)
          VALUES (${userId}, ${me.userId}, ${reason})
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            banned_by = ${me.userId},
            reason = ${reason},
            banned_at = NOW()
        `;
        return res.status(200).json({ ok: true });
      }
      case 'unbanUser': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        if (me.role !== 'admin' && me.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
        const { userId } = args;
        await sql`DELETE FROM banned_users WHERE user_id = ${userId}`;
        return res.status(200).json({ ok: true });
      }
      case 'isUserBanned': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { userId } = args;
        const result = await sql`
          SELECT bu.reason, bu.banned_at, bu.banned_by, u.username as banner_username
          FROM banned_users bu
          LEFT JOIN users u ON u.id = bu.banned_by
          WHERE bu.user_id = ${userId}
        `;
        
        if (result.length === 0) {
          return res.status(200).json({ banned: false });
        }
        
        return res.status(200).json({
          banned: true,
          reason: result[0].reason,
          bannedAt: result[0].banned_at,
          bannedBy: result[0].banner_username
        });
      }
      case 'getBannedUsers': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        if (me.role !== 'admin' && me.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
        const result = await sql`
          SELECT 
            u.id,
            u.username,
            bu.reason,
            bu.banned_at,
            banner.username as banned_by
          FROM banned_users bu
          JOIN users u ON u.id = bu.user_id
          LEFT JOIN users banner ON banner.id = bu.banned_by
          ORDER BY bu.banned_at DESC
        `;
        return res.status(200).json(result);
      }

      // User muting functions
      case 'muteUser': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        if (me.role !== 'admin' && me.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
        const { userId, reason, durationHours } = args;
        
        // Check if user exists
        const user = await sql`SELECT id FROM users WHERE id = ${userId}`;
        if (user.length === 0) return res.status(404).json({ error: 'user_not_found' });
        
        // Calculate mute expiry
        const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
        
        // Insert or update mute
        await sql`
          INSERT INTO user_mutes (user_id, muted_by, reason, expires_at)
          VALUES (${userId}, ${me.userId}, ${reason}, ${expiresAt})
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            muted_by = ${me.userId},
            reason = ${reason},
            expires_at = ${expiresAt}
        `;
        return res.status(200).json({ ok: true });
      }
      case 'unmuteUser': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        if (me.role !== 'admin' && me.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
        const { userId } = args;
        await sql`DELETE FROM user_mutes WHERE user_id = ${userId}`;
        return res.status(200).json({ ok: true });
      }
      case 'isUserMuted': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { userId } = args;
        const result = await sql`
          SELECT um.reason, um.expires_at, um.muted_by, u.username as muter_username
          FROM user_mutes um
          LEFT JOIN users u ON u.id = um.muted_by
          WHERE um.user_id = ${userId} AND um.expires_at > NOW()
        `;
        
        if (result.length === 0) {
          return res.status(200).json({ muted: false });
        }
        
        return res.status(200).json({
          muted: true,
          reason: result[0].reason,
          expiresAt: result[0].expires_at,
          mutedBy: result[0].muted_by,
          mutedByUsername: result[0].muter_username
        });
      }
      case 'getMutedUsers': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        if (me.role !== 'admin' && me.role !== 'moderator') return res.status(403).json({ error: 'forbidden' });
        const result = await sql`
          SELECT 
            u.id,
            u.username,
            um.reason,
            um.expires_at,
            um.muted_by,
            muter.username as muted_by_username
          FROM user_mutes um
          JOIN users u ON u.id = um.user_id
          LEFT JOIN users muter ON muter.id = um.muted_by
          WHERE um.expires_at > NOW()
          ORDER BY um.expires_at ASC
        `;
        return res.status(200).json(result);
      }

      // Push notification endpoints
      case 'registerDeviceToken': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { deviceToken, platform = 'android' } = args;
        
        await sql`
          INSERT INTO device_tokens (user_id, token, platform)
          VALUES (${me.userId}, ${deviceToken}, ${platform})
          ON CONFLICT (token) 
          DO UPDATE SET 
            user_id = ${me.userId},
            platform = ${platform},
            last_used = NOW()
        `;
        return res.status(200).json({ ok: true });
      }

      case 'sendNotificationToUser': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { userId, payload } = args;
        
        // Get device tokens for the user
        const tokens = await sql`SELECT token FROM device_tokens WHERE user_id = ${userId}`;
        const deviceTokens = tokens.map(t => t.token);
        
        if (deviceTokens.length === 0) {
          return res.status(200).json({ ok: true, message: 'No device tokens found for user' });
        }
        
        if (firebaseApp) {
          try {
            const message = {
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: payload.data || {},
              tokens: deviceTokens,
            };
            
            const response = await admin.messaging().sendMulticast(message);
            console.log('Successfully sent notification:', response);
            return res.status(200).json({ 
              ok: true, 
              successCount: response.successCount,
              failureCount: response.failureCount 
            });
          } catch (error) {
            console.error('Error sending notification:', error);
            return res.status(500).json({ error: 'failed_to_send_notification' });
          }
        } else {
          // Log notification for development
          console.log('Notification would be sent:', { userId, payload, deviceTokens });
          return res.status(200).json({ ok: true, message: 'Notification logged (Firebase not configured)' });
        }
      }

      case 'sendNotificationToAllUsers': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { payload } = args;
        
        // Get all device tokens
        const tokens = await sql`SELECT token FROM device_tokens ORDER BY last_used DESC`;
        const deviceTokens = tokens.map(t => t.token);
        
        if (deviceTokens.length === 0) {
          return res.status(200).json({ ok: true, message: 'No device tokens found' });
        }
        
        if (firebaseApp) {
          try {
            const message = {
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: payload.data || {},
              tokens: deviceTokens,
            };
            
            const response = await admin.messaging().sendMulticast(message);
            console.log('Successfully sent notification to all users:', response);
            return res.status(200).json({ 
              ok: true, 
              successCount: response.successCount,
              failureCount: response.failureCount 
            });
          } catch (error) {
            console.error('Error sending notification to all users:', error);
            return res.status(500).json({ error: 'failed_to_send_notification' });
          }
        } else {
          // Log notification for development
          console.log('Notification to all users would be sent:', { payload, deviceTokens });
          return res.status(200).json({ ok: true, message: 'Notification logged (Firebase not configured)' });
        }
      }

      // Notifications
      case 'getNotifications': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { limit = 50, offset = 0 } = args || {};
        const rows = await sql`SELECT n.id, n.user_id, n.type, n.post_id, n.from_user_id, n.from_username, n.created_at, n.read, u.username as from_username, p.content, p.image_url FROM notifications n JOIN users u ON n.from_user_id = u.id LEFT JOIN posts p ON n.post_id = p.id WHERE n.user_id = ${me.userId} ORDER BY n.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        return res.status(200).json(rows);
      }
      case 'markNotificationsRead': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { notificationIds } = args;
        if (!Array.isArray(notificationIds)) return res.status(400).json({ error: 'invalid_notification_ids' });
        await sql`UPDATE notifications SET read = TRUE WHERE id = ANY(${notificationIds}) AND user_id = ${me.userId}`;
        return res.status(200).json({ ok: true });
      }
      case 'deleteNotification': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        const { notificationId } = args;
        const rows = await sql`DELETE FROM notifications WHERE id = ${notificationId} AND user_id = ${me.userId} RETURNING id`;
        return res.status(200).json({ ok: rows.length > 0 });
      }

      // News/Blog
      case 'createNewsPost': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        // Check if user is admin or moderator
        const user = await sql`SELECT role FROM users WHERE id = ${me.userId}`;
        if (!user[0] || !['admin', 'moderator'].includes(user[0].role)) {
          return res.status(403).json({ error: 'unauthorized' });
        }
        
        const { title, content, isPublished = true } = args;
        
        // Generate slug from title
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        
        const rows = await sql`
          INSERT INTO news_posts (title, content, author_id, is_published, slug)
          VALUES (${title}, ${content}, ${me.userId}, ${isPublished}, ${slug})
          RETURNING id, title, content, created_at, updated_at, author_id, is_published, slug
        `;
        
        const post = rows[0];
        const authorInfo = await sql`SELECT username, role FROM users WHERE id = ${me.userId}`;
        
        return res.status(200).json({
          id: post.id,
          title: post.title,
          content: post.content,
          created_at: post.created_at,
          updated_at: post.updated_at,
          author_id: post.author_id,
          is_published: post.is_published,
          slug: post.slug,
          author_username: authorInfo[0].username,
          author_role: authorInfo[0].role
        });
      }
      
      case 'getNewsPosts': {
        const { limit = 10, offset = 0, publishedOnly = true } = args || {};
        const whereClause = publishedOnly ? sql`WHERE is_published = true` : sql``;
        
        const rows = await sql`
          SELECT np.id, np.title, np.content, np.created_at, np.updated_at, np.author_id, np.is_published, np.slug,
                 u.username as author_username, u.role as author_role
          FROM news_posts np
          JOIN users u ON np.author_id = u.id
          ${whereClause}
          ORDER BY np.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        return res.status(200).json({ posts: rows });
      }
      
      case 'getNewsPostBySlug': {
        const { slug } = args;
        const rows = await sql`
          SELECT np.id, np.title, np.content, np.created_at, np.updated_at, np.author_id, np.is_published, np.slug,
                 u.username as author_username, u.role as author_role
          FROM news_posts np
          JOIN users u ON np.author_id = u.id
          WHERE np.slug = ${slug} AND np.is_published = true
          LIMIT 1
        `;
        
        return res.status(200).json(rows[0] || null);
      }
      
      case 'updateNewsPost': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        // Check if user is admin or moderator
        const user = await sql`SELECT role FROM users WHERE id = ${me.userId}`;
        if (!user[0] || !['admin', 'moderator'].includes(user[0].role)) {
          return res.status(403).json({ error: 'unauthorized' });
        }
        
        const { postId, title, content, isPublished } = args;
        
        // Generate new slug if title changed
        let slug;
        if (title) {
          slug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        }
        
        const rows = await sql`
          UPDATE news_posts 
          SET 
            title = COALESCE(${title || null}, title),
            content = COALESCE(${content || null}, content),
            is_published = COALESCE(${isPublished || null}, is_published),
            slug = COALESCE(${slug || null}, slug),
            updated_at = NOW()
          WHERE id = ${postId}
          RETURNING id, title, content, created_at, updated_at, author_id, is_published, slug
        `;
        
        const post = rows[0];
        const authorInfo = await sql`SELECT username, role FROM users WHERE id = ${post.author_id}`;
        
        return res.status(200).json({
          id: post.id,
          title: post.title,
          content: post.content,
          created_at: post.created_at,
          updated_at: post.updated_at,
          author_id: post.author_id,
          is_published: post.is_published,
          slug: post.slug,
          author_username: authorInfo[0].username,
          author_role: authorInfo[0].role
        });
      }
      
      case 'deleteNewsPost': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        // Check if user is admin or moderator
        const user = await sql`SELECT role FROM users WHERE id = ${me.userId}`;
        if (!user[0] || !['admin', 'moderator'].includes(user[0].role)) {
          return res.status(403).json({ error: 'unauthorized' });
        }
        
        const { postId } = args;
        const rows = await sql`DELETE FROM news_posts WHERE id = ${postId} RETURNING id`;
        return res.status(200).json({ ok: rows.length > 0 });
      }

      // Feedback
      case 'createFeedbackTicket': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        const { type, title, description, priority } = args;
        
        // Validate input
        if (!title || !description || !type || !priority) {
          return res.status(400).json({ error: 'missing_required_fields' });
        }
        
        const rows = await sql`
          INSERT INTO feedback_tickets (user_id, type, title, description, priority, status)
          VALUES (${me.userId}, ${type}, ${title}, ${description}, ${priority}, 'open')
          RETURNING id, created_at
        `;
        
        return res.status(200).json({ 
          ok: true, 
          ticketId: rows[0].id,
          createdAt: rows[0].created_at
        });
      }

      // Admin/Moderator endpoints
      case 'getFlaggedPosts': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        // Check if user is admin or moderator
        const user = await sql`SELECT role FROM users WHERE id = ${me.userId}`;
        if (!user[0] || !['admin', 'moderator'].includes(user[0].role)) {
          return res.status(403).json({ error: 'unauthorized' });
        }
        
        const rows = await sql`
          SELECT p.id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, p.is_whisper,
                 u.username, u.role,
                 COUNT(r.id) as reply_count,
                 COUNT(rp.id) as repost_count,
                 COUNT(f.id) as flag_count,
                 EXISTS(SELECT 1 FROM posts WHERE repost_of = p.id) as is_quarantined
          FROM posts p
          JOIN users u ON p.user_id = u.id
          LEFT JOIN posts r ON p.id = r.parent_id
          LEFT JOIN posts rp ON p.id = rp.repost_of
          LEFT JOIN flags f ON p.id = f.post_id
          WHERE EXISTS(SELECT 1 FROM flags WHERE post_id = p.id)
          GROUP BY p.id, u.username, u.role
          ORDER BY p.created_at DESC
        `;
        
        return res.status(200).json({ flaggedPosts: rows });
      }

      case 'getInvitesCreatedBy': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        const { userId } = args;
        const rows = await sql`
          SELECT i.code, i.created_at, i.used_by, i.used_at, u.username as used_by_username
          FROM invites i
          LEFT JOIN users u ON i.used_by = u.id
          WHERE i.created_by = ${userId}
          ORDER BY i.created_at DESC
        `;
        
        return res.status(200).json({ invites: rows });
      }

      case 'getFeedbackTickets': {
        if (!me) return res.status(401).json({ error: 'unauthorized' });
        
        // Check if user is admin or moderator
        const user = await sql`SELECT role FROM users WHERE id = ${me.userId}`;
        if (!user[0] || !['admin', 'moderator'].includes(user[0].role)) {
          return res.status(403).json({ error: 'unauthorized' });
        }
        
        const rows = await sql`
          SELECT ft.id, ft.type, ft.title, ft.description, ft.priority, ft.status, ft.created_at,
                 u.username, u.role as user_role
          FROM feedback_tickets ft
          JOIN users u ON ft.user_id = u.id
          ORDER BY ft.created_at DESC
        `;
        
        return res.status(200).json({ tickets: rows });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    console.error('API error', e);
    return res.status(500).json({ error: 'internal_error' });
  }
} 