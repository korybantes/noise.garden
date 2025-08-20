import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createChallenge } from 'altcha-lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST' && req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const hmacKey = process.env.ALTCHA_SECRET as string;
	if (!hmacKey) {
		return res.status(500).json({ error: 'ALTCHA_SECRET not set' });
	}
	try {
		const challenge = await createChallenge({ hmacKey });
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Content-Type', 'application/json');
		return res.status(200).send(JSON.stringify(challenge));
	} catch (err) {
		return res.status(500).json({ error: 'failed_to_create_challenge' });
	}
} 