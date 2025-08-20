import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySolution } from 'altcha-lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const hmacKey = process.env.ALTCHA_SECRET as string;
	if (!hmacKey) {
		return res.status(500).json({ error: 'ALTCHA_SECRET not set' });
	}
	try {
		const { payload } = req.body || {};
		if (!payload) return res.status(400).json({ verified: false, error: 'missing_payload' });
		const verified = await verifySolution(payload, hmacKey);
		return res.status(200).json({ verified });
	} catch (err) {
		return res.status(200).json({ verified: false });
	}
} 