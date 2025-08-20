import { createChallenge } from 'altcha-lib';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
	try {
		if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
		const hmacKey = process.env.ALTCHA_SECRET;
		if (!hmacKey) {
			return res.status(500).json({ error: 'altcha_env_missing' });
		}
		const challenge = await createChallenge({ hmacKey });
		res.setHeader('Cache-Control', 'no-store');
		return res.status(200).json(challenge);
	} catch (e) {
		return res.status(500).json({ error: 'challenge_failed' });
	}
} 