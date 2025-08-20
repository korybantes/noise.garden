import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.VITE_NEON_DB || process.env.NEON_DB!);

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
  role: UserRole;
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
      role TEXT NOT NULL DEFAULT 'user'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
      parent_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      repost_of UUID REFERENCES posts(id) ON DELETE SET NULL
    )
  `;

  // Clean up expired posts
  await sql`DELETE FROM posts WHERE expires_at < NOW()`;
}

export async function createUser(username: string, passwordHash: string): Promise<User> {
  const result = await sql`
    INSERT INTO users (username, password_hash)
    VALUES (${username}, ${passwordHash})
    RETURNING id, username, password_hash, created_at, role
  `;
  return result[0] as User;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await sql`
    SELECT id, username, password_hash, created_at, role
    FROM users
    WHERE username = ${username}
  `;
  return (result[0] as User) || null;
}

export async function createPost(userId: string, content: string, parentId?: string, repostOf?: string | null): Promise<Post> {
  const result = await sql`
    INSERT INTO posts (user_id, content, parent_id, repost_of)
    VALUES (${userId}, ${content}, ${parentId || null}, ${repostOf || null})
    RETURNING id, user_id, content, created_at, expires_at, parent_id, repost_of
  `;
  
  const post = result[0] as any;
  const user = await sql`SELECT username, role FROM users WHERE id = ${userId}`;
  
  return {
    ...post,
    username: user[0].username,
    role: user[0].role as UserRole,
    reply_count: 0,
    repost_count: 0
  };
}

export async function getRandomPosts(limit: number = 50): Promise<Post[]> {
  // Clean up expired posts first
  await sql`DELETE FROM posts WHERE expires_at < NOW()`;
  
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of,
           u.username, u.role,
           (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count,
           (SELECT COUNT(*) FROM posts rp WHERE rp.repost_of = p.id) as repost_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.parent_id IS NULL AND p.expires_at > NOW()
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;
  return result as Post[];
}

export async function getPostReplies(postId: string): Promise<Post[]> {
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of,
           u.username, u.role,
           0 as reply_count,
           (SELECT COUNT(*) FROM posts rp WHERE rp.repost_of = p.id) as repost_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.parent_id = ${postId} AND p.expires_at > NOW()
    ORDER BY p.created_at ASC
  `;
  return result as Post[];
}

export async function getUserPostsByUsername(username: string): Promise<Post[]> {
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of,
           u.username, u.role,
           (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count,
           (SELECT COUNT(*) FROM posts rp WHERE rp.repost_of = p.id) as repost_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE u.username = ${username} AND p.expires_at > NOW()
    ORDER BY p.created_at DESC
  `;
  return result as Post[];
}

export async function getPostById(id: string): Promise<Post | null> {
  const result = await sql`
    SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of,
           u.username, u.role,
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
  const original = await sql`SELECT content FROM posts WHERE id = ${originalPostId}`;
  const content = original[0]?.content || '';
  return createPost(userId, content, undefined, originalPostId);
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