import { verifySolution } from 'altcha-lib';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
	try {
		if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
		const hmacKey = process.env.ALTCHA_SECRET;
		if (!hmacKey) {
			return res.status(500).json({ error: 'altcha_env_missing' });
		}
		const { payload } = req.body || {};
		if (!payload) {
			return res.status(400).json({ verified: false, error: 'missing_payload' });
		}
		const verified = await verifySolution(payload, hmacKey);
		return res.status(200).json({ verified });
	} catch (e) {
		return res.status(500).json({ verified: false });
	}
} 