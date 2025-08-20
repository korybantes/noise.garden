# Future Updates: Anonymous Social App

- Ephemeral by default; per-post TTL options (1h/24h/3d/7d/30d)
- Metricless reactions: resonate/agree/challenge/care (no public counts)
- Rotating pseudonyms; session-based presence; privacy-first streaks
- Topic rooms by tags; rooms auto-expire; pop-up threads with caps
- Safety controls: mute words/tags, quiet hours, do-not-reply posts, block/mute
- Community moderation: flags, consensus thresholds, small rotating review jury
- Creation: prompt seeds, anonymous polls (no public counts), short audio snippets w/ expiry
- Discovery: daily “seeds” lanes; serendipity mode (fixed set of random posts)
- Lightweight private threads: reply keys valid for 24h; whispers to OP
- Identity: passkeys/WebAuthn; existing backup codes; printable recovery sheet
- Data: one-click export; clean slate reset; no server analytics (opt-in on-device stats)
- Accessibility/Perf: PWA/offline, low-data mode, high-contrast/reduced motion
- Transparency: minimal policy + public safety log
- Crypto (optional): client-signed posts (MAC), E2E small group threads 



Detailed:

- Ephemeral by default (and user‑controlled TTL)
    Let users pick post lifetime (e.g., 1h, 24h, 3d, 7d, 30d) per post
    Auto-trim replies with the parent; show remaining time on each post
- Feed without metrics
    No likes/followers; use lightweight signals: “resonate,” “agree,” “challenge,” “care”
    Shuffle/randomized feed with topic tags; no public counts, only private feedback
- Pseudonymous presence
    Session-based handles that rotate periodically
    Optional “personhood streak” that resets with inactivity (no public rating)
- Topics/rooms that expire
    Ad-hoc rooms created by tags (e.g., #music), auto-expiring weekly
    “Pop-up” threads that close after N replies or T minutes to prevent dogpiles
- Privacy/safety controls
    Mute words/tags; quiet hours; “do-not-reply” posts
    One-tap block/mute per pseudonym; optional “hide sensitive content”
    Client-side text redaction (PII hints before posting)
- Lightweight moderation (community-first)
    Community flags with consensus thresholds; temporary quarantines
    Small rotating “jury” to review flagged items; clear, minimal rules
    Rate-limits + proof-of-human (already have CAPTCHA) that ramps up under abuse
- Creation extras (non-influencer)
    Text-first; emoji/reaction palette; prompt seeds (“what’s a tiny joy today?”)
    Anonymous polls with single-vote device tokens; no public vote counts (only outcome)
    Audio snippets (under 15s) that auto-expire; transcription client-side toggle
- Discovery without “performing”
    Daily “seeds” (3 rotating themes); join one, see only that lane for a while
    Serendipity mode: see 10 random posts across tags, then it resets
- Connections without profiles
    One-time “reply keys” to continue a private thread for 24h without DMs
    “Whispers” (reply visible only to OP), auto-disappearing
- Device-first identity
    Passkeys/WebAuthn to go passwordless (no email required)
    Backup codes (you have them) + optional printable “recovery sheet”
- Export/cleanup
    One-click “export my data” JSON
    “Clean slate” resets content and pseudonym without deleting account
- Accessibility/perf
    PWA install + offline read, low-data mode
    High-contrast, reduced motion, dyslexia-friendly font toggle
- Transparency
    Public minimal policy doc (already have), plus a tiny “safety log” summarizing actions
    On-device, opt-in private stats (no server analytics)
- Optional cryptography
    End-to-end encrypted “reply keys” or small group threads using per-thread secrets
    Client-side signed posts (MAC) for integrity without revealing identity


## Unique, privacy-first differentiators
- Zero-reading servers by default
  - End-to-end encrypted whispers/threads; server stores only ciphertext + metadata caps
  - Client-side MAC on posts for integrity without identity
- Traffic privacy
  - Batched outbound requests on a schedule (jittered) to reduce timing leakage
  - Optional “post later within next N minutes” window for plausible deniability
- Anti-fingerprinting UX
  - Deterministic CSS-only theming and simple fonts; minimal canvas/webGL surfaces
  - No third-party fonts; no external trackers; strict CSP and referrer policy
- Pseudonym rotation & proof of personhood (non-PII)
  - Rotating handle per time window; continuity via short-lived reply keys
  - Optional on-device ML signal (entropy/click cadence) used locally to adjust rate limits
- Local-first safety
  - On-device PII redaction hints; toxicity prompt preflight all client-side
  - Per-device rate-limit buckets to avoid server correlation
- Consent-first conversations
  - Do-not-reply posts; OP-approve first reply; auto-close threads on dogpiles


## Design/brand overhaul (match our style)
- Design tokens
  - Colors (dark-first), radii, spacing scale, font stacks, motion durations
- Components (custom, no default browser look)
  - Buttons, Inputs, Textarea, Select, Switch, Modal, Tooltip, Toast
  - Accessible, keyboard-first, with our tokens and micro-interactions
- Layout & motion
  - Subtle transitions; no parallax; deterministic easing; reduced motion path
- Typography
  - Monospace-first brand but tuned sizes/weights for legibility
- Theming
  - Dark mode default; light mode parity; no FOUT; no web fonts


## Roadmap (next 4 sprints)

Sprint 1 — Foundations and safety (1–2 weeks)
- Per-post TTL selector in composer
  - UI: dropdown with 1h / 24h / 3d / 7d / 30d
  - Data: use existing expires_at; pass TTL to createPost; show remaining time on cards
  - AC: new posts reflect chosen TTL; feed hides expired; countdown visible
- Mute words/tags and quiet hours
  - Local settings persisted (localStorage); filter feed client-side
  - AC: muted content hidden; quiet hours dims composer and reduces refresh
- Topic rooms (basic)
  - Route: /rooms/:tag → filtered feed by tag; create via typing #tag in composer
  - AC: entering a tag shows only that room; back to All resets filter
- Data export (account only)
  - API: GET /api/export (Node) returns user, posts, replies JSON
  - AC: download works; auth via token in header
- Tech/perf: code-splitting and chunk reduction
  - Configure manualChunks; lazy load heavy libs

Sprint 1.5 — Brand & UI polish (1 week)
- Introduce design tokens and a minimal UI kit (Button/Input/Select/Modal)
- Replace native selects with custom component (accessibility + style)
- Align spacing/typography to tokens; audit dark/light contrast

Sprint 2 — Identity and private continuity (1–2 weeks)
- Passkeys/WebAuthn (passwordless option)
  - Client: register/login flows; fallback to current auth
  - API: /api/webauthn/register, /api/webauthn/login (Node)
  - AC: can enroll and sign-in without password; backup codes still valid
- Reply keys (24h continuity without DMs)
  - Generate per-thread key; show “continue thread” link for recipient
  - AC: private back-and-forth for 24h max; no global inbox
- Whispers (reply visible only to OP)
  - Composer flag; server stores but only joins OP’s view
  - AC: whisper not visible in public thread

Sprint 3 — Community health (1–2 weeks)
- Community flags with thresholds
  - Client: flag UI; Server: tally + quarantine when threshold reached
  - AC: quarantined posts hidden by default; OP notified client-side
- Pop-up threads (auto-close caps)
  - Create threads with caps (N replies or T minutes)
  - AC: composer disabled after cap; thread shows closed state
- Do-not-reply posts
  - Composer option to post with replies disabled
  - AC: reply actions hidden, enforced server-side

Sprint 4 — Experience and transparency (1–2 weeks)
- PWA + offline read, low-data mode
  - Service worker cache for latest feed; toggle to reduce images/fonts
  - AC: installable, basic offline reading
- Daily seeds and serendipity mode
  - Three rotating prompts; serendipity fetch of 10 random posts
  - AC: clear entry points; resets after batch
- Safety log (public minimal transparency)
  - Static page with weekly counts; updated via scheduled job


## Technical notes
- Auth
  - Keep `jose` for JWT; consider rotating secrets; add token revocation via short TTL + refresh
  - WebAuthn requires RPID config and server nonce storage (KV or Neon)
- Database
  - Ensure indexes: posts(expires_at), posts(user_id), users(username)
  - Add tables if needed: flags(post_id,user_id,reason,created_at)
- API
  - All new endpoints should be Node runtime and ESM to match project type
  - Rate-limit per IP/UA (basic sliding window); escalate CAPTCHA on abuse
- Client
  - Settings persisted in localStorage; export/import settings JSON
  - Feature flags via `import.meta.env` for gradual rollout
- Headers/Security
  - Strict CSP, Referrer-Policy no-referrer, Permissions-Policy minimal
  - Avoid third-party fonts/scripts where possible


## Non-goals (for now)
- Follower graphs, public like counts, or creator leaderboards
- Long-lived private messaging; only ephemeral continuity via reply keys
- Third-party tracking or server-side analytics


## Open questions
- Should TTL apply to replies independently or inherit from parent?
- How to scope topic rooms list (top N tags vs user-entered only)?
- What is an appropriate flag threshold/quarantine duration?