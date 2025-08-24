import { createChallenge, verifySolution } from 'altcha-lib';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
	try {
		const hmacKey = process.env.ALTCHA_SECRET;
		if (!hmacKey) {
			return res.status(500).json({ error: 'altcha_env_missing' });
		}

		// Handle challenge creation (GET request)
		if (req.method === 'GET') {
			const challenge = await createChallenge({ hmacKey });
			res.setHeader('Cache-Control', 'no-store');
			return res.status(200).json(challenge);
		}

		// Handle solution verification (POST request)
		if (req.method === 'POST') {
			const { payload } = req.body || {};
			if (!payload) {
				return res.status(400).json({ verified: false, error: 'missing_payload' });
			}
			const verified = await verifySolution(payload, hmacKey);
			return res.status(200).json({ verified });
		}

		// Method not allowed
		return res.status(405).json({ error: 'method_not_allowed' });
	} catch (e) {
		if (req.method === 'GET') {
			return res.status(500).json({ error: 'challenge_failed' });
		} else {
			return res.status(500).json({ verified: false });
		}
	}
}
