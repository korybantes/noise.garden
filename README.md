# Noise Garden – Anonymous Social

A lightweight, anonymous social app built with React + Vite, Tailwind, Neon (Postgres), and Ably Chat for realtime anonymous pairing.

## Features

- Anonymous accounts with username + password (no email)
- JWT auth (browser-safe via `jose`)
- Neon Postgres for users and posts
- Randomized feed with replies and reposts (with comments)
- Dark mode + responsive UI
- Anonymous chat with random pairing using Ably Chat
  - Presence-based online count
  - Typing indicators
  - Emoji reaction bubbles
  - Find new pair / disconnect
- Security & account recovery
  - CAPTCHA on registration (built-in math challenge)
  - One-time backup codes (16-char, 4-4-4-4) that can be used to log in if password is lost
- Mobile-ready UI
- Legal pages (Privacy Policy, Terms)

## Quick start

Requirements:
- Node.js 18+
- A Neon Postgres project
- An Ably account (for chat)

### 1) Install

```bash
npm install
```

### 2) Environment

Create `.env` in project root:

```env
VITE_NEON_DB=<your-neon-postgres-connection-string>
VITE_JWT_SECRET=<a-secure-base64-secret>
VITE_ABLY_KEY=<your-ably-key>
```

Notes:
- Generate a `VITE_JWT_SECRET` with 256-bit random base64. Example (PowerShell):
  ```pwsh
  $bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
  ```
- Neon connection string example: `postgres://user:pass@host/db?sslmode=require`.

### 3) Run

```bash
npm run dev
```

Open `http://localhost:5173`.

### 4) Build

```bash
npm run build
npm run preview
```

## Database

We initialize tables on app start (client side) using Neon serverless:
- `users(id, username, password_hash, role, created_at)`
- `posts(id, user_id, content, created_at, expires_at, parent_id, repost_of)`
- `backup_codes(id, user_id, code_hash, used, created_at)`

If you prefer, you can run SQL manually in the Neon console:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  parent_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  repost_of UUID REFERENCES posts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Ably Chat

We use Ably Chat for anonymous pairing. Provide `VITE_ABLY_KEY` (development uses a direct key; for production, switch to token auth).

- Presence shows online count
- Lobby invites for pairing
- Private room per pair
- Typing indicators & room reactions per Ably docs

## Security

- JWT signed with HS256 (via `jose`), secret from `VITE_JWT_SECRET`
- Passwords & backup codes hashed with `bcryptjs`
- Built-in math CAPTCHA at signup (you can swap to hCaptcha/reCAPTCHA)

## Backup Codes

- Shown once after signup
- 16 chars in 4-4-4-4 groups (letters + digits)
- Stored as hashes in `backup_codes`
- One-time: consumed on use
- Login flow supports “Use backup code” instead of password

## Legal Pages

- Landing page
- Privacy Policy
- Terms & Conditions

All pages are responsive and accessible from the footer.

## Deployment (Vercel)

- Framework preset: Vite
- Environment variables:
  - `VITE_NEON_DB`
  - `VITE_JWT_SECRET`
  - `VITE_ABLY_KEY`
- Build command: `npm run build`
- Output: `dist/`

For production, use Ably token auth instead of a raw key.

## Scripts

- `npm run dev` – start Vite dev server
- `npm run build` – production build
- `npm run preview` – preview production build

## Contributing

Issues and PRs welcome.

## License

MIT 