import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.VITE_NEON_DB || process.env.NEON_DB!);

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
  role: UserRole;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: Date;
  expires_at: Date;
  parent_id?: string;
  reply_count?: number;
  repost_of?: string | null;
  role?: UserRole;
  repost_count?: number;
  image_url?: string | null;
  avatar_url?: string | null;
  is_whisper?: boolean;
  is_quarantined?: boolean;
  is_popup_thread?: boolean;
  popup_reply_limit?: number;
  popup_time_limit?: number;
  popup_closed_at?: Date;
  replies_disabled?: boolean;
}

export interface Reply {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: Date;
  expires_at: Date;
}

export interface Invite {
  code: string;
  created_by: string;
  created_at: Date;
  used_by?: string | null;
  used_at?: Date | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'repost' | 'reply' | 'mention';
  post_id: string;
  from_user_id: string;
  from_username: string;
  created_at: Date;
  read: boolean;
}

export interface Flag {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  reason: string;
  created_at: Date;
}

export interface PopupThread {
  id: string;
  post_id: string;
  reply_limit: number;
  time_limit_minutes: number;
  closed_at?: Date;
  created_at: Date;
}

function generateInviteCode(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${part()}-${part()}-${part()}`;
}

// Initialize database tables
export async function initDatabase() {
  await sql`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      role TEXT NOT NULL DEFAULT 'user',
      avatar_url TEXT,
      bio TEXT
    )
  `;

  // Backfill columns for existing deployments
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
      parent_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      repost_of UUID REFERENCES posts(id) ON DELETE SET NULL,
      image_url TEXT,
      is_whisper BOOLEAN DEFAULT FALSE,
      is_quarantined BOOLEAN DEFAULT FALSE,
      is_popup_thread BOOLEAN DEFAULT FALSE,
      popup_reply_limit INTEGER,
      popup_time_limit INTEGER,
      popup_closed_at TIMESTAMPTZ,
      replies_disabled BOOLEAN DEFAULT FALSE
    )
  `;

  // Invites (one invite per account; single-use)
  await sql`
    CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY,
      created_by UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      used_by UUID REFERENCES users(id) ON DELETE SET NULL,
      used_at TIMESTAMPTZ
    )
  `;

  // Banned users table
  await sql`
    CREATE TABLE IF NOT EXISTS banned_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      banned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    )
  `;

  // Notifications
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      from_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read BOOLEAN DEFAULT FALSE
    )
  `;

  // Community flags table
  await sql`
    CREATE TABLE IF NOT EXISTS flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    )
  `;

  // Popup threads table
  await sql`
    CREATE TABLE IF NOT EXISTS popup_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      reply_limit INTEGER NOT NULL,
      time_limit_minutes INTEGER NOT NULL,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Clean up expired posts
  await sql`DELETE FROM posts WHERE expires_at < NOW()`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_whisper BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_popup_thread BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS popup_reply_limit INTEGER`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS popup_time_limit INTEGER`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS popup_closed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS replies_disabled BOOLEAN DEFAULT FALSE`;
}

export async function createUser(username: string, passwordHash: string): Promise<User> {
  const result = await sql`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username, password_hash, created_at, role, avatar_url, bio
  `;
  return result[0] as User;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await sql`
    SELECT id, username, password_hash, created_at, role, avatar_url, bio
    FROM users
    WHERE username = ${username}
  `;
  return (result[0] as User) || null;
}

export async function updateUserProfile(userId: string, avatarUrl: string | null, bio: string | null): Promise<void> {
  await sql`UPDATE users SET avatar_url = ${avatarUrl}, bio = ${bio} WHERE id = ${userId}`;
}

export function computeExpiresAtFromTtlSeconds(ttlSeconds?: number | null): string | null {
  if (!ttlSeconds || ttlSeconds <= 0) return null;
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

export async function createPost(
  userId: string,
  content: string,
  parentId?: string,
  repostOf?: string | null,
  imageUrl?: string | null,
  ttlSeconds?: number | null,
  isWhisper: boolean = false,
  repliesDisabled: boolean = false,
  isPopupThread: boolean = false,
  popupReplyLimit?: number,
  popupTimeLimit?: number
): Promise<Post> {
  const expiresAt = computeExpiresAtFromTtlSeconds(ttlSeconds);
  const result = await sql`
    INSERT INTO posts (
      user_id, content, parent_id, repost_of, image_url, expires_at, 
      is_whisper, replies_disabled, is_popup_thread, popup_reply_limit, popup_time_limit
    )
    VALUES (
      ${userId}, ${content}, ${parentId || null}, ${repostOf || null}, ${imageUrl || null}, ${expiresAt || sql`DEFAULT`},
      ${isWhisper}, ${repliesDisabled}, ${isPopupThread}, ${popupReplyLimit || null}, ${popupTimeLimit || null}
    )
    RETURNING id, user_id, content, created_at, expires_at, parent_id, repost_of, image_url,
              is_whisper, replies_disabled, is_popup_thread, popup_reply_limit, popup_time_limit
  `;
  
  const post = result[0] as any;
  const user = await sql`SELECT username, role, avatar_url FROM users WHERE id = ${userId}`;
  
  // Create popup thread record if needed
  if (isPopupThread && popupReplyLimit && popupTimeLimit) {
    await sql`
      INSERT INTO popup_threads (post_id, reply_limit, time_limit_minutes)
      VALUES (${post.id}, ${popupReplyLimit}, ${popupTimeLimit})
    `;
  }
  
  // Create notification for repost
  if (repostOf) {
    const originalPost = await sql`SELECT user_id FROM posts WHERE id = ${repostOf}`;
    if (originalPost[0] && originalPost[0].user_id !== userId) {
      await sql`
        INSERT INTO notifications (user_id, type, post_id, from_user_id, from_username)
        VALUES (${originalPost[0].user_id}, 'repost', ${post.id}, ${userId}, ${user[0].username})
      `;
    }
  }
  
  return {
    ...post,
    username: user[0].username,
    role: user[0].role as UserRole,
    avatar_url: user[0].avatar_url,
    reply_count: 0,
    repost_count: 0
  } as Post;
}

export async function getRandomPosts(limit: number = 20, offset: number = 0, sortBy: 'newest' | 'oldest' = 'newest'): Promise<Post[]> {
  // Clean up expired posts first
  await sql`DELETE FROM posts WHERE expires_at < NOW()`;
  
  const orderBy = sortBy === 'newest' ? sql`p.created_at DESC` : sql`p.created_at ASC`;
  
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url,
           p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
           u.username, u.role, u.avatar_url,
           (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.parent_id IS NULL AND p.expires_at > NOW()
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  return result.map(row => ({
    ...row,
    reply_count: Number(row.reply_count) || 0,
    repost_count: 0
  })) as Post[];
}

export async function getPostReplies(postId: string): Promise<Post[]> {
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url,
           p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
           u.username, u.role, u.avatar_url,
           0 as reply_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.parent_id = ${postId} AND p.expires_at > NOW()
    ORDER BY p.created_at ASC
  `;
  return result as Post[];
}

export async function getUserPostsByUsername(username: string): Promise<Post[]> {
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url,
           p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
           u.username, u.role, u.avatar_url,
           (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE u.username = ${username} AND p.expires_at > NOW()
    ORDER BY p.created_at DESC
  `;
  return result as Post[];
}

export async function getPostById(id: string): Promise<Post | null> {
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url,
           p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
           u.username, u.role, u.avatar_url,
           (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count,
           (SELECT COUNT(*) FROM posts rp WHERE rp.repost_of = p.id) as repost_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  return (result[0] as Post) || null;
}

export async function deletePost(postId: string, requesterId: string): Promise<boolean> {
  const result = await sql`
    WITH req AS (
      SELECT role FROM users WHERE id = ${requesterId}
    )
    DELETE FROM posts p
    USING req
    WHERE p.id = ${postId}
      AND (p.user_id = ${requesterId} OR req.role IN ('admin','moderator'))
    RETURNING p.id
  `;
  return result.length > 0;
}

export async function repostPost(userId: string, originalPostId: string): Promise<Post> {
  const original = await sql`SELECT content, image_url FROM posts WHERE id = ${originalPostId}`;
  const content = original[0]?.content || '';
  const imageUrl = original[0]?.image_url || null;
  return createPost(userId, content, undefined, originalPostId, imageUrl);
}

export async function deleteUser(userId: string): Promise<void> {
  // This will cascade delete all posts due to foreign key constraint
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

export async function updatePassword(userId: string, newPasswordHash: string): Promise<void> {
  await sql`
    UPDATE users 
    SET password_hash = ${newPasswordHash}
    WHERE id = ${userId}
  `;
}

// Admin functions
export async function getAllUsers(requesterId: string): Promise<Omit<User, 'password_hash'>[]> {
  // Check if requester is admin or moderator
  const requester = await sql`SELECT role FROM users WHERE id = ${requesterId}`;
  if (!requester[0] || !['admin', 'moderator'].includes(requester[0].role)) {
    throw new Error('Unauthorized');
  }
  
  const result = await sql`
    SELECT id, username, created_at, role, avatar_url, bio
    FROM users
    ORDER BY created_at DESC
  `;
  return result as Omit<User, 'password_hash'>[];
}

export async function updateUserRole(userId: string, newRole: UserRole, requesterId: string): Promise<void> {
  // Only admins can change roles
  const requester = await sql`SELECT role FROM users WHERE id = ${requesterId}`;
  if (!requester[0] || requester[0].role !== 'admin') {
    throw new Error('Unauthorized');
  }
  
  await sql`
    UPDATE users 
    SET role = ${newRole}
    WHERE id = ${userId}
  `;
}

export async function getUserStats(requesterId: string): Promise<{ totalUsers: number; totalPosts: number; totalInvites: number }> {
  // Check if requester is admin or moderator
  const requester = await sql`SELECT role FROM users WHERE id = ${requesterId}`;
  if (!requester[0] || !['admin', 'moderator'].includes(requester[0].role)) {
    throw new Error('Unauthorized');
  }
  
  const [usersResult, postsResult, invitesResult] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM users`,
    sql`SELECT COUNT(*) as count FROM posts`,
    sql`SELECT COUNT(*) as count FROM invites`
  ]);
  
  return {
    totalUsers: Number(usersResult[0]?.count || 0),
    totalPosts: Number(postsResult[0]?.count || 0),
    totalInvites: Number(invitesResult[0]?.count || 0)
  };
}

// Banning functions
export async function banUser(userId: string, reason: string, bannedBy: string): Promise<void> {
  // Check if banner is admin or moderator
  const banner = await sql`SELECT role FROM users WHERE id = ${bannedBy}`;
  if (!banner[0] || !['admin', 'moderator'].includes(banner[0].role)) {
    throw new Error('Unauthorized');
  }
  
  // Check if user exists and is not already banned
  const user = await sql`SELECT id FROM users WHERE id = ${userId}`;
  if (!user[0]) {
    throw new Error('User not found');
  }
  
  // Insert or update ban
  await sql`
    INSERT INTO banned_users (user_id, banned_by, reason)
    VALUES (${userId}, ${bannedBy}, ${reason})
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      banned_by = ${bannedBy},
      reason = ${reason},
      banned_at = NOW()
  `;
}

export async function unbanUser(userId: string, unbannedBy: string): Promise<void> {
  // Check if unbanner is admin or moderator
  const unbanner = await sql`SELECT role FROM users WHERE id = ${unbannedBy}`;
  if (!unbanner[0] || !['admin', 'moderator'].includes(unbanner[0].role)) {
    throw new Error('Unauthorized');
  }
  
  await sql`DELETE FROM banned_users WHERE user_id = ${userId}`;
}

export async function isUserBanned(userId: string): Promise<{ banned: boolean; reason?: string; bannedAt?: Date; bannedBy?: string }> {
  const result = await sql`
    SELECT bu.reason, bu.banned_at, bu.banned_by, u.username as banner_username
    FROM banned_users bu
    LEFT JOIN users u ON u.id = bu.banned_by
    WHERE bu.user_id = ${userId}
  `;
  
  if (result.length === 0) {
    return { banned: false };
  }
  
  return {
    banned: true,
    reason: result[0].reason,
    bannedAt: result[0].banned_at,
    bannedBy: result[0].banner_username
  };
}

export async function getBannedUsers(requesterId: string): Promise<Array<{
  id: string;
  username: string;
  reason: string;
  bannedAt: Date;
  bannedBy: string;
}>> {
  // Check if requester is admin or moderator
  const requester = await sql`SELECT role FROM users WHERE id = ${requesterId}`;
  if (!requester[0] || !['admin', 'moderator'].includes(requester[0].role)) {
    throw new Error('Unauthorized');
  }
  
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
  
  return result as any;
}

// Notifications
export async function getNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
  const result = await sql`
    SELECT id, user_id, type, post_id, from_user_id, from_username, created_at, read
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result as Notification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await sql`UPDATE notifications SET read = TRUE WHERE id = ${notificationId}`;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${userId}`;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_id = ${userId} AND read = FALSE
  `;
  return parseInt(result[0].count);
}

// Invites
export async function getInviteByCode(code: string): Promise<Invite | null> {
  const rows = await sql`SELECT code, created_by, created_at, used_by, used_at FROM invites WHERE code = ${code}`;
  return (rows[0] as Invite) || null;
}

export async function getInviteForCreator(userId: string): Promise<Invite | null> {
  const rows = await sql`SELECT code, created_by, created_at, used_by, used_at FROM invites WHERE created_by = ${userId} AND used_by IS NULL LIMIT 1`;
  return (rows[0] as Invite) || null;
}

export async function getAnyInviteForCreator(userId: string): Promise<Invite | null> {
  const rows = await sql`SELECT code, created_by, created_at, used_by, used_at FROM invites WHERE created_by = ${userId} ORDER BY created_at ASC LIMIT 1`;
  return (rows[0] as Invite) || null;
}

export async function createInviteForUser(userId: string): Promise<Invite> {
  const existingAny = await getAnyInviteForCreator(userId);
  if (existingAny) return existingAny; // enforce one-time generation regardless of usage
  const code = generateInviteCode();
  const rows = await sql`INSERT INTO invites (code, created_by) VALUES (${code}, ${userId}) RETURNING code, created_by, created_at, used_by, used_at`;
  return rows[0] as Invite;
}

export async function markInviteUsed(code: string, usedByUserId: string): Promise<boolean> {
  const rows = await sql`UPDATE invites SET used_by = ${usedByUserId}, used_at = NOW() WHERE code = ${code} AND used_by IS NULL RETURNING code`;
  return rows.length > 0;
}

export async function getInvitesCreatedBy(userId: string): Promise<Array<{ code: string; used_by: string | null; used_by_username: string | null }>> {
  const rows = await sql`
    SELECT i.code, i.used_by, u.username as used_by_username
    FROM invites i
    LEFT JOIN users u ON u.id = i.used_by
    WHERE i.created_by = ${userId}
  `;
  return rows as any;
}

export async function getInviterForUser(userId: string): Promise<{ inviter_id: string; inviter_username: string } | null> {
  const rows = await sql`
    SELECT i.created_by as inviter_id, u.username as inviter_username
    FROM invites i
    JOIN users u ON u.id = i.created_by
    WHERE i.used_by = ${userId}
    LIMIT 1
  `;
  return (rows[0] as any) || null;
}

export async function createAdminInvite(adminId: string): Promise<Invite> {
  // Admins can generate unlimited invites
  const code = generateInviteCode();
  const rows = await sql`INSERT INTO invites (code, created_by) VALUES (${code}, ${adminId}) RETURNING code, created_by, created_at, used_by, used_at`;
  return rows[0] as Invite;
}

// Community health functions
export async function flagPost(postId: string, userId: string, reason: string): Promise<void> {
  await sql`
    INSERT INTO flags (post_id, user_id, reason)
    VALUES (${postId}, ${userId}, ${reason})
    ON CONFLICT (post_id, user_id) DO UPDATE SET reason = ${reason}
  `;
}

export async function getPostFlags(postId: string): Promise<Flag[]> {
  const result = await sql`
    SELECT f.id, f.post_id, f.user_id, f.reason, f.created_at, u.username
    FROM flags f
    JOIN users u ON f.user_id = u.id
    WHERE f.post_id = ${postId}
    ORDER BY f.created_at DESC
  `;
  return result.map(row => ({
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    username: row.username,
    reason: row.reason,
    created_at: row.created_at
  }));
}

export async function getFlaggedPosts(): Promise<Post[]> {
  const result = await sql`
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
  
  return result.map(row => ({
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
    role: row.role as UserRole,
    is_whisper: row.is_whisper || false,
    is_quarantined: row.is_quarantined || false,
    is_popup_thread: row.is_popup_thread || false,
    popup_reply_limit: row.popup_reply_limit,
    popup_time_limit: row.popup_time_limit,
    popup_closed_at: row.popup_closed_at,
    replies_disabled: row.replies_disabled || false,
    reply_count: Number(row.reply_count) || 0,
    repost_count: Number(row.repost_count) || 0
  })) as Post[];
}

export async function quarantinePost(postId: string, adminId: string): Promise<void> {
  await sql`UPDATE posts SET is_quarantined = TRUE WHERE id = ${postId}`;
  
  // Notify the original poster
  const post = await sql`SELECT user_id FROM posts WHERE id = ${postId}`;
  if (post.length > 0) {
    const admin = await sql`SELECT username FROM users WHERE id = ${adminId}`;
    await sql`
      INSERT INTO notifications (user_id, type, post_id, from_user_id, from_username)
      VALUES (${post[0].user_id}, 'quarantine', ${postId}, ${adminId}, ${admin[0].username})
    `;
  }
}

export async function unquarantinePost(postId: string, adminId: string): Promise<void> {
  await sql`UPDATE posts SET is_quarantined = FALSE WHERE id = ${postId}`;
}

export async function createPopupThread(
  postId: string, 
  replyLimit: number, 
  timeLimitMinutes: number
): Promise<void> {
  await sql`
    UPDATE posts 
    SET is_popup_thread = TRUE, popup_reply_limit = ${replyLimit}, popup_time_limit = ${timeLimitMinutes}
    WHERE id = ${postId}
  `;
  
  await sql`
    INSERT INTO popup_threads (post_id, reply_limit, time_limit_minutes)
    VALUES (${postId}, ${replyLimit}, ${timeLimitMinutes})
  `;
}

export async function closePopupThread(postId: string): Promise<void> {
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
}

export async function checkPopupThreadStatus(postId: string): Promise<{
  isClosed: boolean;
  reason: 'time' | 'replies' | 'manual' | null;
  remainingReplies?: number;
  remainingTime?: number;
}> {
  const post = await sql`
    SELECT p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at,
           pt.closed_at, pt.created_at,
           (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count
    FROM posts p
    LEFT JOIN popup_threads pt ON p.id = pt.post_id
    WHERE p.id = ${postId}
  `;
  
  if (post.length === 0 || !post[0].is_popup_thread) {
    return { isClosed: false, reason: null };
  }
  
  const row = post[0];
  const replyCount = Number(row.reply_count) || 0;
  const timeLimitMs = (row.popup_time_limit || 0) * 60 * 1000;
  const createdAt = new Date(row.created_at);
  const now = new Date();
  
  // Check if closed by replies limit
  if (row.popup_reply_limit && replyCount >= row.popup_reply_limit) {
    return { isClosed: true, reason: 'replies', remainingReplies: 0 };
  }
  
  // Check if closed by time limit
  if (timeLimitMs > 0 && (now.getTime() - createdAt.getTime()) >= timeLimitMs) {
    return { isClosed: true, reason: 'time', remainingTime: 0 };
  }
  
  // Check if manually closed
  if (row.popup_closed_at || row.closed_at) {
    return { isClosed: true, reason: 'manual' };
  }
  
  // Calculate remaining
  const remainingReplies = row.popup_reply_limit ? Math.max(0, row.popup_reply_limit - replyCount) : undefined;
  const remainingTime = timeLimitMs > 0 ? Math.max(0, timeLimitMs - (now.getTime() - createdAt.getTime())) : undefined;
  
  return { 
    isClosed: false, 
    reason: null, 
    remainingReplies, 
    remainingTime 
  };
}

export async function getFlaggedPostsForAdmin(adminId: string): Promise<Post[]> {
  const requester = await sql`SELECT role FROM users WHERE id = ${adminId}`;
  if (requester.length === 0 || !['admin', 'moderator'].includes(requester[0].role)) {
    throw new Error('Unauthorized');
  }

  return getFlaggedPosts();
}

export async function getFlagCountsForPost(postId: string): Promise<{ total: number; reasons: { reason: string; count: number }[] }> {
  const result = await sql`
    SELECT reason, COUNT(*) as count
    FROM flags
    WHERE post_id = ${postId}
    GROUP BY reason
    ORDER BY count DESC
  `;

  const total = result.reduce((sum, row) => sum + Number(row.count), 0);
  const reasons = result.map(row => ({
    reason: row.reason,
    count: Number(row.count)
  }));

  return { total, reasons };
}

export async function shouldQuarantinePost(postId: string, threshold: number = 3): Promise<boolean> {
  const flagCount = await sql`
    SELECT COUNT(*) as count
    FROM flags
    WHERE post_id = ${postId}
  `;
  
  return Number(flagCount[0].count) >= threshold;
}