import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.VITE_NEON_DB || process.env.NEON_DB!, { disableWarningInBrowsers: true });

export type UserRole = 'user' | 'moderator' | 'admin' | 'community_manager';

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
	is_pinned?: boolean;
	audio_url?: string | null;
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
	type: 'repost' | 'reply' | 'mention' | 'quarantine';
	post_id: string;
	from_user_id: string;
	from_username: string;
	created_at: Date;
	read: boolean;
	post_content?: string;
	post_created_at?: Date;
	post_avatar_url?: string;
}

export interface Flag {
	id: string;
	post_id: string;
	user_id: string;
	username: string;
	reason: string;
	created_at: Date;
}

// Mentions consent system
export interface Mention {
	id: string;
	post_id: string;
	mentioned_user_id: string;
	mentioned_username: string;
	from_user_id: string;
	from_username: string;
	status: 'pending' | 'accepted' | 'declined';
	created_at: Date;
	responded_at?: Date;
}

// Polls
export interface PollOption {
	index: number;
	text: string;
	votes: number;
}

export interface Poll {
	post_id: string;
	question: string;
	options: PollOption[];
	closes_at: Date | null;
	viewer_vote_index?: number | null;
}

export interface PopupThread {
	id: string;
	post_id: string;
	reply_limit: number;
	time_limit_minutes: number;
	closed_at?: Date;
	created_at: Date;
}

// Helper function to notify UI of notification count changes
function notifyNotificationCountChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notificationCountChanged'));
  }
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
			replies_disabled BOOLEAN DEFAULT FALSE,
			is_pinned BOOLEAN DEFAULT FALSE
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

	// User mutes table
	await sql`
		CREATE TABLE IF NOT EXISTS user_mutes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			muted_by UUID REFERENCES users(id) ON DELETE SET NULL,
			reason TEXT NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id)
		)
	`;

	// Device tokens for push notifications
	await sql`
		CREATE TABLE IF NOT EXISTS device_tokens (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			token TEXT UNIQUE NOT NULL,
			platform TEXT NOT NULL DEFAULT 'android',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			last_used TIMESTAMPTZ DEFAULT NOW()
		)
	`;

	// Notifications - handle schema migration
	try {
		// Check if the table exists and has the correct structure
		const tableInfo = await sql`
			SELECT column_name, data_type 
			FROM information_schema.columns 
			WHERE table_name = 'notifications' AND column_name = 'to_user_id'
		`;
		
		if (tableInfo.length === 0) {
			// Table doesn't exist or has wrong structure, recreate it
			await sql`DROP TABLE IF EXISTS notifications CASCADE`;
			await sql`
				CREATE TABLE notifications (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
					type TEXT NOT NULL,
					post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
					from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
					from_username TEXT NOT NULL,
					created_at TIMESTAMPTZ DEFAULT NOW(),
					updated_at TIMESTAMPTZ DEFAULT NOW(),
					read BOOLEAN DEFAULT FALSE
				)
			`;
			
			// Create trigger to update updated_at timestamp
			await sql`
				CREATE OR REPLACE FUNCTION update_notifications_updated_at()
				RETURNS TRIGGER AS $$
				BEGIN
					NEW.updated_at = NOW();
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql
			`;
			
			await sql`
				CREATE TRIGGER trigger_update_notifications_updated_at
					BEFORE UPDATE ON notifications
					FOR EACH ROW
					EXECUTE FUNCTION update_notifications_updated_at()
			`;
		}
	} catch (error) {
		// If there's any error, try to create the table fresh
		await sql`DROP TABLE IF EXISTS notifications CASCADE`;
		await sql`
			CREATE TABLE notifications (
				id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
				type TEXT NOT NULL,
				post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
				from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
				from_username TEXT NOT NULL,
				created_at TIMESTAMPTZ DEFAULT NOW(),
				updated_at TIMESTAMPTZ DEFAULT NOW(),
				read BOOLEAN DEFAULT FALSE
			)
		`;
		
		// Create trigger to update updated_at timestamp
		await sql`
			CREATE OR REPLACE FUNCTION update_notifications_updated_at()
			RETURNS TRIGGER AS $$
			BEGIN
				NEW.updated_at = NOW();
				RETURN NEW;
			END;
			$$ LANGUAGE plpgsql
		`;
		
		await sql`
			CREATE TRIGGER trigger_update_notifications_updated_at
				BEFORE UPDATE ON notifications
				FOR EACH ROW
				EXECUTE FUNCTION update_notifications_updated_at()
		`;
	}

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

	// Polls tables
	await sql`
		CREATE TABLE IF NOT EXISTS polls (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			post_id UUID UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
			question TEXT NOT NULL,
			closes_at TIMESTAMPTZ
		)
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS poll_options (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
			idx INTEGER NOT NULL,
			text TEXT NOT NULL,
			UNIQUE(poll_id, idx)
		)
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS poll_votes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			option_idx INTEGER NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(poll_id, user_id)
		)
	`;

	// Mentions table
	await sql`
		CREATE TABLE IF NOT EXISTS mentions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
			mentioned_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			mentioned_username TEXT NOT NULL,
			from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			from_username TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
			created_at TIMESTAMPTZ DEFAULT NOW(),
			responded_at TIMESTAMPTZ
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
	await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS audio_url TEXT`;
	await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`;
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
	audioUrl?: string | null,
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
			is_whisper, replies_disabled, is_popup_thread, popup_reply_limit, popup_time_limit, audio_url
		)
		VALUES (
			${userId}, ${content}, ${parentId || null}, ${repostOf || null}, ${imageUrl || null}, ${expiresAt || sql`DEFAULT`},
			${isWhisper}, ${repliesDisabled}, ${isPopupThread}, ${popupReplyLimit || null}, ${popupTimeLimit || null}, ${audioUrl || null}
		)
		RETURNING id, user_id, content, created_at, expires_at, parent_id, repost_of, image_url,
					is_whisper, replies_disabled, is_popup_thread, popup_reply_limit, popup_time_limit, audio_url,
					is_quarantined, is_pinned
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
	
			// Create notification for reply
	if (parentId) {
		const parent = await sql`SELECT user_id FROM posts WHERE id = ${parentId}`;
		if (parent[0] && parent[0].user_id !== userId) {
			await sql`
				INSERT INTO notifications (to_user_id, type, post_id, from_user_id, from_username)
				VALUES (${parent[0].user_id}, 'reply', ${post.id}, ${userId}, ${user[0].username})
			`;
			notifyNotificationCountChanged();
			// Trigger real-time notification event
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('newNotification'));
			}
		}
	}
	
	// Create notification for repost
	if (repostOf) {
		const originalPost = await sql`SELECT user_id FROM posts WHERE id = ${repostOf}`;
		if (originalPost[0] && originalPost[0].user_id !== userId) {
			await sql`
				INSERT INTO notifications (to_user_id, type, post_id, from_user_id, from_username)
				VALUES (${originalPost[0].user_id}, 'repost', ${post.id}, ${userId}, ${user[0].username})
			`;
			notifyNotificationCountChanged();
			// Trigger real-time notification event
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('newNotification'));
			}
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

// Create a poll post (top-level only)
export async function createPollPost(
	userId: string,
	question: string,
	options: string[],
	ttlSeconds?: number | null,
	closesAt?: Date | null
): Promise<Post> {
	if (!question.trim()) throw new Error('Question required');
	const cleanOptions = options.map(o => o.trim()).filter(o => o).slice(0, 5);
	if (cleanOptions.length < 2) throw new Error('At least two options');
	// store question also as post content for discoverability
	const post = await createPost(userId, question, undefined, undefined, null, null, ttlSeconds, false, false, false);
	const pollRows = await sql`
		INSERT INTO polls (post_id, question, closes_at)
		VALUES (${post.id}, ${question}, ${closesAt || null})
		RETURNING id
	`;
	const pollId = pollRows[0].id as string;
	for (let i = 0; i < cleanOptions.length; i++) {
		await sql`INSERT INTO poll_options (poll_id, idx, text) VALUES (${pollId}, ${i}, ${cleanOptions[i]})`;
	}
	return post;
}

export async function getPollForViewer(postId: string, viewerUserId?: string | null): Promise<Poll | null> {
	const poll = await sql`SELECT id, question, closes_at FROM polls WHERE post_id = ${postId}`;
	if (poll.length === 0) return null;
	const pollId = poll[0].id as string;
	const options = await sql`SELECT idx, text FROM poll_options WHERE poll_id = ${pollId} ORDER BY idx ASC`;
	const counts = await sql`SELECT option_idx, COUNT(*)::int as c FROM poll_votes WHERE poll_id = ${pollId} GROUP BY option_idx`;
	const countMap = new Map<number, number>();
	counts.forEach((r: any) => countMap.set(Number(r.option_idx), Number(r.c)));
	let viewerVote: number | null = null;
	if (viewerUserId) {
		const vv = await sql`SELECT option_idx FROM poll_votes WHERE poll_id = ${pollId} AND user_id = ${viewerUserId} LIMIT 1`;
		if (vv[0]) viewerVote = Number(vv[0].option_idx);
	}
	return {
		post_id: postId,
		question: poll[0].question,
		closes_at: poll[0].closes_at || null,
		options: options.map((o: any) => ({ index: Number(o.idx), text: o.text, votes: countMap.get(Number(o.idx)) || 0 })),
		viewer_vote_index: viewerVote
	};
}

export async function voteInPoll(postId: string, optionIndex: number, userId: string): Promise<Poll> {
	const poll = await sql`SELECT id FROM polls WHERE post_id = ${postId}`;
	if (poll.length === 0) throw new Error('Poll not found');
	const pollId = poll[0].id as string;
	// Upsert vote (allow change)
	await sql`
		INSERT INTO poll_votes (poll_id, user_id, option_idx)
		VALUES (${pollId}, ${userId}, ${optionIndex})
		ON CONFLICT (poll_id, user_id) DO UPDATE SET option_idx = EXCLUDED.option_idx, created_at = NOW()
	`;
	return getPollForViewer(postId, userId) as unknown as Poll;
}

export async function getRandomPosts(limit: number = 20, offset: number = 0, sortBy: 'newest' | 'oldest' | 'random' = 'newest'): Promise<Post[]> {
	// Clean up expired posts first
	await sql`DELETE FROM posts WHERE expires_at < NOW()`;
	
	let orderBy;
	if (sortBy === 'random') {
		orderBy = sql`RANDOM()`;
	} else {
		orderBy = sortBy === 'newest' ? sql`p.created_at DESC` : sql`p.created_at ASC`;
	}
	
	const result = await sql`
		SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, p.audio_url,
				 p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
				 p.is_pinned,
				 u.username, u.role, u.avatar_url,
				 (SELECT COUNT(*) FROM posts replies WHERE replies.parent_id = p.id) as reply_count
		FROM posts p
		JOIN users u ON p.user_id = u.id
		WHERE p.parent_id IS NULL AND p.expires_at > NOW()
		ORDER BY p.is_pinned DESC, ${orderBy}
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
		SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, p.audio_url,
				 p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
				 p.is_pinned,
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
		SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, p.audio_url,
				 p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
				 p.is_pinned,
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
		SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, p.audio_url,
				 p.is_whisper, p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
				 p.is_pinned,
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

export async function pinPost(postId: string, adminId: string): Promise<void> {
	const requester = await sql`SELECT role FROM users WHERE id = ${adminId}`;
	if (!requester[0] || requester[0].role !== 'admin') {
		throw new Error('Unauthorized');
	}
	await sql`UPDATE posts SET is_pinned = TRUE WHERE id = ${postId}`;
}

export async function unpinPost(postId: string, adminId: string): Promise<void> {
	const requester = await sql`SELECT role FROM users WHERE id = ${adminId}`;
	if (!requester[0] || requester[0].role !== 'admin') {
		throw new Error('Unauthorized');
	}
	await sql`UPDATE posts SET is_pinned = FALSE WHERE id = ${postId}`;
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
		SELECT 
			n.id, 
			n.to_user_id as user_id, 
			n.type, 
			n.post_id, 
			n.from_user_id, 
			n.from_username, 
			n.created_at, 
			n.read,
			p.content as post_content,
			p.created_at as post_created_at,
			u.avatar_url as post_avatar_url,
			u.username as post_username,
			-- Get original post info for context (only for replies)
			CASE 
				WHEN n.type = 'reply' AND p.parent_id IS NOT NULL THEN op.content
				ELSE NULL
			END as original_post_content,
			CASE 
				WHEN n.type = 'reply' AND p.parent_id IS NOT NULL THEN op.created_at
				ELSE NULL
			END as original_post_created_at,
			CASE 
				WHEN n.type = 'reply' AND p.parent_id IS NOT NULL THEN ou.username
				ELSE NULL
			END as original_post_username
		FROM notifications n
		LEFT JOIN posts p ON n.post_id = p.id
		LEFT JOIN users u ON p.user_id = u.id
		-- Join to get the original post that was replied to
		LEFT JOIN posts op ON p.parent_id = op.id
		LEFT JOIN users ou ON op.user_id = ou.id
		WHERE n.to_user_id = ${userId}
		ORDER BY n.created_at DESC
		LIMIT ${limit}
	`;
	return result.map(row => ({
		id: row.id,
		user_id: row.user_id,
		type: row.type,
		post_id: row.post_id,
		from_user_id: row.from_user_id,
		from_username: row.from_username,
		created_at: new Date(row.created_at),
		read: row.read,
		post_content: row.post_content,
		post_created_at: row.post_created_at ? new Date(row.post_created_at) : undefined,
		post_avatar_url: row.post_avatar_url,
		post_username: row.post_username,
		original_post_content: row.original_post_content,
		original_post_created_at: row.original_post_created_at ? new Date(row.original_post_created_at) : undefined,
		original_post_username: row.original_post_username
	}));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
	await sql`UPDATE notifications SET read = TRUE WHERE id = ${notificationId}`;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
	await sql`UPDATE notifications SET read = TRUE WHERE to_user_id = ${userId}`;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
	const result = await sql`
		SELECT COUNT(*) as count
		FROM notifications
		WHERE to_user_id = ${userId} AND read = FALSE
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
		SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.repost_of, p.image_url, p.audio_url,
				 p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
				 p.is_pinned,
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
				INSERT INTO notifications (to_user_id, type, post_id, from_user_id, from_username)
				VALUES (${post[0].user_id}, 'quarantine', ${postId}, ${adminId}, ${admin[0].username})
			`;
			notifyNotificationCountChanged();
			// Trigger real-time notification event
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('newNotification'));
			}
		}
}

export async function unquarantinePost(postId: string, _adminId: string): Promise<void> {
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

// Mentions consent system functions
export async function createMention(postId: string, mentionedUsername: string, fromUserId: string): Promise<Mention> {
	const mentionedUser = await sql`SELECT id FROM users WHERE username = ${mentionedUsername}`;
	if (!mentionedUser[0]) throw new Error('Mentioned user not found');
	
	const fromUser = await sql`SELECT username FROM users WHERE id = ${fromUserId}`;
	if (!fromUser[0]) throw new Error('From user not found');
	
	const result = await sql`
		INSERT INTO mentions (post_id, mentioned_user_id, mentioned_username, from_user_id, from_username)
		VALUES (${postId}, ${mentionedUser[0].id}, ${mentionedUsername}, ${fromUserId}, ${fromUser[0].username})
		RETURNING id, post_id, mentioned_user_id, mentioned_username, from_user_id, from_username, status, created_at, responded_at
	`;
	
	return result[0] as Mention;
}

export async function getPendingMentions(userId: string): Promise<Mention[]> {
	const result = await sql`
		SELECT m.id, m.post_id, m.mentioned_user_id, m.mentioned_username, m.from_user_id, m.from_username, m.status, m.created_at, m.responded_at
		FROM mentions m
		WHERE m.mentioned_user_id = ${userId} AND m.status = 'pending'
		ORDER BY m.created_at DESC
	`;
	return result as Mention[];
}

export async function respondToMention(mentionId: string, status: 'accepted' | 'declined'): Promise<void> {
	await sql`
		UPDATE mentions 
		SET status = ${status}, responded_at = NOW() 
		WHERE id = ${mentionId}
	`;
}

export async function getMentionsForPost(postId: string): Promise<Mention[]> {
	const result = await sql`
		SELECT m.id, m.post_id, m.mentioned_user_id, m.mentioned_username, m.from_user_id, m.from_username, m.status, m.created_at, m.responded_at
		FROM mentions m
		WHERE m.post_id = ${postId}
		ORDER BY m.created_at ASC
	`;
	return result as Mention[];
}

export async function getAcceptedMentionsForPost(postId: string): Promise<Mention[]> {
	const result = await sql`
		SELECT m.id, m.post_id, m.mentioned_user_id, m.mentioned_username, m.from_user_id, m.from_username, m.status, m.created_at, m.responded_at
		FROM mentions m
		WHERE m.post_id = ${postId} AND m.status = 'accepted'
		ORDER BY m.created_at ASC
	`;
	return result as Mention[];
}

// Whisper thread system
export async function createWhisperReply(
	userId: string,
	content: string,
	parentWhisperId: string,
	ttlSeconds?: number | null
): Promise<Post> {
	// Get the parent whisper to ensure it's a whisper
	const parentWhisper = await sql`
		SELECT id, user_id, parent_id, is_whisper FROM posts WHERE id = ${parentWhisperId} AND is_whisper = TRUE
	`;
	
	if (!parentWhisper[0]) {
		throw new Error('Parent whisper not found');
	}
	
	// Create the whisper reply
	const expiresAt = computeExpiresAtFromTtlSeconds(ttlSeconds);
	const result = await sql`
		INSERT INTO posts (
			user_id, content, parent_id, expires_at, is_whisper
		)
		VALUES (
			${userId}, ${content}, ${parentWhisperId}, ${expiresAt || sql`DEFAULT`}, TRUE
		)
		RETURNING id, user_id, content, created_at, expires_at, parent_id, is_whisper,
					is_quarantined, is_popup_thread, popup_reply_limit, popup_time_limit, popup_closed_at, replies_disabled,
					is_pinned, image_url, audio_url
	`;
	
	const whisper = result[0] as any;
	const user = await sql`SELECT username, role, avatar_url FROM users WHERE id = ${userId}`;
	
	return {
		...whisper,
		username: user[0].username,
		role: user[0].role as UserRole,
		avatar_url: user[0].avatar_url,
		reply_count: 0,
		repost_count: 0
	} as Post;
}

export async function getWhisperThread(parentPostId: string): Promise<Post[]> {
	// Get all whispers in the thread (original post + all whisper replies)
	const result = await sql`
		WITH RECURSIVE whisper_chain AS (
			-- Start with the parent post
			SELECT id, user_id, content, created_at, expires_at, parent_id, is_whisper, 0 as level
			FROM posts 
			WHERE id = ${parentPostId}
			
			UNION ALL
			
			-- Get all whisper replies
			SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.is_whisper, wc.level + 1
			FROM posts p
			JOIN whisper_chain wc ON p.parent_id = wc.id
			WHERE p.is_whisper = TRUE AND p.expires_at > NOW()
		)
		SELECT p.id, p.user_id, p.content, p.created_at, p.expires_at, p.parent_id, p.is_whisper,
			   p.is_quarantined, p.is_popup_thread, p.popup_reply_limit, p.popup_time_limit, p.popup_closed_at, p.replies_disabled,
			   p.is_pinned, p.image_url, p.audio_url,
			   u.username, u.role, u.avatar_url,
			   0 as reply_count, 0 as repost_count
		FROM whisper_chain p
		JOIN users u ON p.user_id = u.id
		WHERE p.expires_at > NOW()
		ORDER BY p.created_at ASC
	`;
	
	return result as Post[];
}

// User muting functions
export async function muteUser(userId: string, reason: string, mutedBy: string, durationHours: number): Promise<void> {
	// Check if muter is admin or moderator
	const muter = await sql`SELECT role FROM users WHERE id = ${mutedBy}`;
	if (!muter[0] || !['admin', 'moderator'].includes(muter[0].role)) {
		throw new Error('Unauthorized');
	}
	
	// Check if user exists and is not already muted
	const user = await sql`SELECT id FROM users WHERE id = ${userId}`;
	if (!user[0]) {
		throw new Error('User not found');
	}
	
	// Calculate mute expiry
	const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
	
	// Insert or update mute
	await sql`
		INSERT INTO user_mutes (user_id, muted_by, reason, expires_at)
		VALUES (${userId}, ${mutedBy}, ${reason}, ${expiresAt})
		ON CONFLICT (user_id) 
		DO UPDATE SET 
			muted_by = ${mutedBy},
			reason = ${reason},
			expires_at = ${expiresAt}
	`;
}

export async function unmuteUser(userId: string, unmutedBy: string): Promise<void> {
	// Check if unmuter is admin or moderator
	const unmuter = await sql`SELECT role FROM users WHERE id = ${unmutedBy}`;
	if (!unmuter[0] || !['admin', 'moderator'].includes(unmuter[0].role)) {
		throw new Error('Unauthorized');
	}
	
	await sql`DELETE FROM user_mutes WHERE user_id = ${userId}`;
}

export async function isUserMuted(userId: string): Promise<{ muted: boolean; reason?: string; expiresAt?: Date; mutedBy?: string; mutedByUsername?: string }> {
	const result = await sql`
		SELECT um.reason, um.expires_at, um.muted_by, u.username as muter_username
		FROM user_mutes um
		LEFT JOIN users u ON u.id = um.muted_by
		WHERE um.user_id = ${userId} AND um.expires_at > NOW()
	`;
	
	if (result.length === 0) {
		return { muted: false };
	}
	
	return {
		muted: true,
		reason: result[0].reason,
		expiresAt: result[0].expires_at,
		mutedBy: result[0].muted_by,
		mutedByUsername: result[0].muter_username
	};
}

export async function getMutedUsers(requesterId: string): Promise<Array<{
	id: string;
	username: string;
	reason: string;
	expiresAt: Date;
	mutedBy: string;
	mutedByUsername: string;
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
	
	return result as any;
}

// Push notification functions
export async function registerDeviceToken(userId: string, token: string, platform: string = 'android'): Promise<void> {
	await sql`
		INSERT INTO device_tokens (user_id, token, platform)
		VALUES (${userId}, ${token}, ${platform})
		ON CONFLICT (token) 
		DO UPDATE SET 
			user_id = ${userId},
			platform = ${platform},
			last_used = NOW()
	`;
}

export async function getDeviceTokensForUser(userId: string): Promise<string[]> {
	const result = await sql`
		SELECT token FROM device_tokens 
		WHERE user_id = ${userId}
		ORDER BY last_used DESC
	`;
	return result.map(row => row.token);
}

export async function removeDeviceToken(token: string): Promise<void> {
	await sql`DELETE FROM device_tokens WHERE token = ${token}`;
}

export async function getAllDeviceTokens(): Promise<Array<{ userId: string; token: string; platform: string }>> {
	const result = await sql`
		SELECT user_id, token, platform 
		FROM device_tokens 
		ORDER BY last_used DESC
	`;
	return result as any;
}

// News/Blog functions
export interface NewsPost {
	id: string;
	title: string;
	content: string;
	created_at: Date;
	updated_at: Date;
	author_id: string;
	author_username: string;
	author_role: string;
	is_published: boolean;
	slug: string;
}

export async function createNewsPost(
	title: string, 
	content: string, 
	isPublished: boolean = true
): Promise<NewsPost> {
	const response = await fetch('/api/app.mjs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'createNewsPost',
			args: { title, content, isPublished }
		})
	});
	
	if (!response.ok) {
		throw new Error('Failed to create news post');
	}
	
	return response.json();
}

export async function getNewsPosts(limit: number = 10, offset: number = 0, publishedOnly: boolean = true): Promise<NewsPost[]> {
	const response = await fetch('/api/app.mjs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'getNewsPosts',
			args: { limit, offset, publishedOnly }
		})
	});
	
	if (!response.ok) {
		throw new Error('Failed to get news posts');
	}
	
	return response.json();
}

export async function getNewsPostBySlug(slug: string): Promise<NewsPost | null> {
	const response = await fetch('/api/app.mjs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'getNewsPostBySlug',
			args: { slug }
		})
	});
	
	if (!response.ok) {
		throw new Error('Failed to get news post');
	}
	
	return response.json();
}

export async function updateNewsPost(
	postId: string, 
	updates: { title?: string; content?: string; isPublished?: boolean }
): Promise<NewsPost> {
	const response = await fetch('/api/app.mjs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'updateNewsPost',
			args: { postId, title: updates.title, content: updates.content, isPublished: updates.isPublished }
		})
	});
	
	if (!response.ok) {
		throw new Error('Failed to update news post');
	}
	
	return response.json();
}

export async function deleteNewsPost(postId: string): Promise<boolean> {
	const response = await fetch('/api/app.mjs', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'deleteNewsPost',
			args: { postId }
		})
	});
	
	if (!response.ok) {
		throw new Error('Failed to delete news post');
	}
	
	const result = await response.json();
	return result.ok;
}