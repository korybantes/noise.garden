import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.NEON_DB);
const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || 'anonymous_social_secret_key_change_in_production');

export default async function handler(req, res) {
	try {
		if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
		const auth = req.headers.authorization || '';
		const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
		if (!token) return res.status(401).json({ error: 'unauthorized' });
		let userId = null;
		try {
			const { payload } = await jwtVerify(token, secretKey);
			userId = String(payload.userId || '');
		} catch {
			return res.status(401).json({ error: 'invalid_token' });
		}
		if (!userId) return res.status(401).json({ error: 'invalid_token' });
		const user = (await sql`SELECT id, username, created_at, role, avatar_url, bio FROM users WHERE id = ${userId}`)[0] || null;
		const posts = await sql`SELECT id, content, created_at, expires_at, parent_id, repost_of, image_url FROM posts WHERE user_id = ${userId} ORDER BY created_at DESC`;
		const replies = await sql`SELECT id, content, created_at, expires_at, parent_id FROM posts WHERE user_id = ${userId} AND parent_id IS NOT NULL ORDER BY created_at DESC`;
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Cache-Control', 'no-store');
		return res.status(200).send(JSON.stringify({ user, posts, replies }, null, 2));
	} catch (e) {
		return res.status(500).json({ error: 'export_failed' });
	}
} 