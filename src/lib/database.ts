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
      image_url TEXT
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
      from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      from_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read BOOLEAN DEFAULT FALSE
    )
  `;

  // Clean up expired posts
  await sql`DELETE FROM posts WHERE expires_at < NOW()`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT`;
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
  ttlSeconds?: number | null
): Promise<Post> {
  const expiresAt = computeExpiresAtFromTtlSeconds(ttlSeconds);
  const result = await sql`
    INSERT INTO posts (user_id, content, parent_id, repost_of, image_url, expires_at)
    VALUES (${userId}, ${content}, ${parentId || null}, ${repostOf || null}, ${imageUrl || null}, ${expiresAt || sql`DEFAULT`})
    RETURNING id, user_id, content, created_at, expires_at, parent_id, repost_of, image_url
  `;
  
  const post = result[0] as any;
  const user = await sql`SELECT username, role, avatar_url FROM users WHERE id = ${userId}`;
  
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
           u.username, u.role, u.avatar_url,
           (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.parent_id IS NULL AND p.expires_at > NOW()
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result as Post[];
}

export async function getPostReplies(postId: string): Promise<Post[]> {
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url,
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