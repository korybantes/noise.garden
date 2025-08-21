import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';
import { generateChallenge, generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.NEON_DB);
const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || 'anonymous_social_secret_key_change_in_production');

// WebAuthn configuration
const rpName = 'noise.garden';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;

async function getAuthUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return { userId: String(payload.userId), username: String(payload.username), role: String(payload.role) };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'POST') {
      const { action, args } = req.body || {};

      switch (action) {
        case 'generateRegistrationOptions': {
          const { username } = args;
          if (!username) return res.status(400).json({ error: 'username_required' });

          // Check if user exists
          const existingUser = await sql`SELECT id FROM users WHERE username = ${username}`;
          if (existingUser.length > 0) return res.status(400).json({ error: 'username_taken' });

          const challenge = await generateChallenge();
          const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: username,
            userName: username,
            challenge,
            excludeCredentials: [],
            supportedAlgorithmIDs: [-7, -257], // ES256, RS256
            userVerification: 'preferred',
            attestation: 'none',
          });

          // Store challenge temporarily (in production, use Redis or similar)
          // For now, we'll use a simple in-memory store (not recommended for production)
          global.webauthnChallenges = global.webauthnChallenges || new Map();
          global.webauthnChallenges.set(username, {
            challenge: options.challenge,
            timestamp: Date.now(),
          });

          return res.status(200).json(options);
        }

        case 'verifyRegistration': {
          const { username, credential, passwordHash } = args;
          if (!username || !credential || !passwordHash) return res.status(400).json({ error: 'missing_params' });

          // Get stored challenge
          global.webauthnChallenges = global.webauthnChallenges || new Map();
          const stored = global.webauthnChallenges.get(username);
          if (!stored || Date.now() - stored.timestamp > 300000) { // 5 min expiry
            return res.status(400).json({ error: 'challenge_expired' });
          }

          try {
            const verification = await verifyRegistrationResponse({
              response: credential,
              expectedChallenge: stored.challenge,
              expectedOrigin: origin,
              expectedRPID: rpID,
            });

            if (verification.verified && verification.registrationInfo) {
              // Create user with both password and WebAuthn credential
              const user = await sql`
                INSERT INTO users (username, password_hash, webauthn_credential_id, webauthn_public_key, webauthn_sign_count) 
                VALUES (${username}, ${passwordHash}, ${verification.registrationInfo.credentialID}, ${verification.registrationInfo.credentialPublicKey}, ${verification.registrationInfo.signCount})
                RETURNING id, username, created_at, role
              `;

              // Clean up challenge
              global.webauthnChallenges.delete(username);

              return res.status(200).json({ 
                success: true, 
                user: user[0],
                message: 'WebAuthn credential registered successfully. You can now sign in with your passkey.'
              });
            } else {
              return res.status(400).json({ error: 'verification_failed' });
            }
          } catch (error) {
            console.error('WebAuthn verification error:', error);
            return res.status(400).json({ error: 'verification_error' });
          }
        }

        case 'generateAuthenticationOptions': {
          const { username } = args;
          if (!username) return res.status(400).json({ error: 'username_required' });

          // Get user's WebAuthn credentials
          const user = await sql`SELECT id, webauthn_credential_id FROM users WHERE username = ${username}`;
          if (user.length === 0) return res.status(400).json({ error: 'user_not_found' });

          if (!user[0].webauthn_credential_id) {
            return res.status(400).json({ error: 'no_webauthn_credential' });
          }

          const challenge = await generateChallenge();
          const options = await generateAuthenticationOptions({
            rpID,
            challenge,
            allowCredentials: [{
              id: user[0].webauthn_credential_id,
              type: 'public-key',
            }],
            userVerification: 'preferred',
          });

          // Store challenge
          global.webauthnChallenges = global.webauthnChallenges || new Map();
          global.webauthnChallenges.set(username, {
            challenge: options.challenge,
            timestamp: Date.now(),
          });

          return res.status(200).json(options);
        }

        case 'verifyAuthentication': {
          const { username, credential } = args;
          if (!username || !credential) return res.status(400).json({ error: 'missing_params' });

          // Get user and stored challenge
          const user = await sql`SELECT id, username, role, webauthn_credential_id, webauthn_public_key, webauthn_sign_count FROM users WHERE username = ${username}`;
          if (user.length === 0) return res.status(400).json({ error: 'user_not_found' });

          global.webauthnChallenges = global.webauthnChallenges || new Map();
          const stored = global.webauthnChallenges.get(username);
          if (!stored || Date.now() - stored.timestamp > 300000) {
            return res.status(400).json({ error: 'challenge_expired' });
          }

          try {
            const verification = await verifyAuthenticationResponse({
              response: credential,
              expectedChallenge: stored.challenge,
              expectedOrigin: origin,
              expectedRPID: rpID,
              authenticator: {
                credentialPublicKey: user[0].webauthn_public_key,
                credentialID: user[0].webauthn_credential_id,
                counter: user[0].webauthn_sign_count,
              },
            });

            if (verification.verified) {
              // Update sign count
              await sql`UPDATE users SET webauthn_sign_count = ${verification.authenticationInfo.newCounter} WHERE id = ${user[0].id}`;

              // Clean up challenge
              global.webauthnChallenges.delete(username);

              // Generate JWT token
              const { SignJWT } = await import('jose');
              const token = await new SignJWT({ 
                userId: user[0].id, 
                username: user[0].username, 
                role: user[0].role || 'user' 
              })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('7d')
                .sign(secretKey);

              return res.status(200).json({ 
                success: true, 
                token,
                user: { id: user[0].id, username: user[0].username, role: user[0].role }
              });
            } else {
              return res.status(400).json({ error: 'authentication_failed' });
            }
          } catch (error) {
            console.error('WebAuthn authentication error:', error);
            return res.status(400).json({ error: 'authentication_error' });
          }
        }

        default:
          return res.status(400).json({ error: 'unknown_action' });
      }
    } else {
      return res.status(405).json({ error: 'method_not_allowed' });
    }
  } catch (error) {
    console.error('WebAuthn API error:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
} 