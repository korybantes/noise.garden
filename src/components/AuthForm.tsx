import React, { useState, useRef, useEffect } from 'react';
import { LogIn, UserPlus, AlertTriangle } from 'lucide-react';
import { createUser, getUserByUsername, updateUserProfile, getInviteByCode, markInviteUsed, isUserBanned } from '../lib/database';
import { hashPassword, verifyPassword, createToken, storeToken } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { generateBackupCode, storeBackupCodes, consumeBackupCode } from '../lib/backup';
import { OnboardingBackupCodes } from './OnboardingBackupCodes';
import { setPageMetadata } from '../lib/meta';

function generateRandomAvatarDataUrl(seed: string): string {
	const canvas = document.createElement('canvas');
	const size = 128;
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d')!;

	// Helper PRNG from seed
	function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0; return Math.abs(h); }
	const base = hash(seed);
	function rnd(n: number, m: number) { return (hash(seed + ':' + n) % 1000) / 1000 * (m - 0) + 0; }

	// Gradient background
	const h1 = (base % 360);
	const h2 = (base * 3 % 360);
	const grad = ctx.createLinearGradient(0, 0, size, size);
	grad.addColorStop(0, `hsl(${h1} 70% 55%)`);
	grad.addColorStop(1, `hsl(${h2} 70% 45%)`);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, size, size);

	// Soft translucent blobs
	for (let i = 0; i < 4; i++) {
		const cx = 16 + rnd(i, 1) * (size - 32);
		const cy = 16 + rnd(i + 1, 1) * (size - 32);
		const r = 18 + rnd(i + 2, 1) * 28;
		const hue = (h1 + i * 40) % 360;
		const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
		g.addColorStop(0, `hsla(${hue} 80% 90% / 0.6)`);
		g.addColorStop(1, `hsla(${hue} 80% 70% / 0)`);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
	}

	// Rounded mask (circle)
	const mask = document.createElement('canvas');
	mask.width = size; mask.height = size;
	const mctx = mask.getContext('2d')!;
	mctx.fillStyle = '#fff';
	mctx.beginPath();
	mctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
	mctx.fill();

	// Apply mask
	const out = document.createElement('canvas');
	out.width = size; out.height = size;
	const octx = out.getContext('2d')!;
	octx.save();
	octx.drawImage(mask, 0, 0);
	octx.globalCompositeOperation = 'source-in';
	octx.drawImage(canvas, 0, 0);
	octx.restore();

	return out.toDataURL('image/png');
}

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup' | 'backup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupCodes, setSignupCodes] = useState<string[] | null>(null);
  const [altchaPayload, setAltchaPayload] = useState<string>('');
  const altchaRef = useRef<HTMLDivElement | null>(null);
  const { login } = useAuth();

  useEffect(() => {
    const desc = mode === 'login' ? 'Log in to noise.garden' : mode === 'signup' ? 'Create your account on noise.garden' : 'Recover your account with a backup code';
    const title = mode === 'login' ? 'Log in — noise.garden' : mode === 'signup' ? 'Sign up — noise.garden' : 'Recover — noise.garden';
    setPageMetadata(title, desc);
  }, [mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get('invite');
    if (inv) {
      setMode('signup');
      setInvite(inv.toUpperCase());
      // clean the URL without reload
      params.delete('invite');
      const url = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
      window.history.replaceState({}, '', url);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'signup') return;
    const mount = async () => {
      if (import.meta.env.DEV) {
        if (altchaRef.current) {
          altchaRef.current.innerHTML = '';
          const wrap = document.createElement('div');
          const label = document.createElement('label');
          label.className = 'inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 font-mono';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.addEventListener('change', () => setAltchaPayload(cb.checked ? 'ok' : ''));
          label.appendChild(cb);
          label.appendChild(document.createTextNode(" I'm human (dev)"));
          wrap.appendChild(label);
          altchaRef.current.appendChild(wrap);
        }
      } else {
        await import('altcha');
        const el = document.createElement('altcha-widget');
        const setTheme = () => {
          const dark = document.documentElement.classList.contains('dark');
          el.setAttribute('theme', dark ? 'dark' : 'light');
          el.style.setProperty('--altcha-color-border', dark ? '#374151' : '#d1d5db');
          el.style.setProperty('--altcha-color-base', dark ? '#111827' : '#ffffff');
        };
        el.setAttribute('challengeurl', '/api/altcha/challenge');
        el.setAttribute('endpoint', '/api/altcha/verify');
        el.style.setProperty('--altcha-border-radius', '6px');
        el.style.setProperty('--altcha-max-width', '100%');
        setTheme();
        el.id = 'altcha';
        el.addEventListener('statechange', (ev: any) => {
          if (ev?.detail?.state === 'verified') {
            setAltchaPayload(ev.detail.payload || 'ok');
          }
        });
        if (altchaRef.current) {
          altchaRef.current.innerHTML = '';
          altchaRef.current.appendChild(el);
        }
        // Observe theme changes
        const obs = new MutationObserver(() => setTheme());
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      }
    };
    mount();
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) { setError('Username must be 3+ chars'); return; }

    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        if (!altchaPayload) { setError('Please complete the captcha'); return; }
        const existingUser = await getUserByUsername(username);
        if (existingUser) { setError('Username already exists'); return; }
        if (password.length < 6) { setError('Password must be 6+ chars'); return; }
        if (!invite.trim()) { setError('Invite code required'); return; }
        const inv = await getInviteByCode(invite.trim().toUpperCase());
        if (!inv || inv.used_by) { setError('Invalid or used invite code'); return; }

        const passwordHash = await hashPassword(password);
        const user = await createUser(username, passwordHash);
        const marked = await markInviteUsed(invite.trim().toUpperCase(), user.id);
        if (!marked) { setError('Invite could not be used'); return; }
        const avatarDataUrl = generateRandomAvatarDataUrl(username);
        await updateUserProfile(user.id, avatarDataUrl, null);
        const codes = Array.from({ length: 5 }, () => generateBackupCode());
        await storeBackupCodes(user.id, codes);
        setSignupCodes(codes);
        localStorage.setItem('onboarding_backup_codes', JSON.stringify(codes));
        const token = await createToken(user.id, user.username, user.role || 'user');
        storeToken(token);
        await login(token);
      } else if (mode === 'login') {
        const user = await getUserByUsername(username);
        if (!user) { setError('User not found'); return; }
        
        // Check if user is banned
        const banInfo = await isUserBanned(user.id);
        if (banInfo.banned) {
          setError(`Your account has been banned by @${banInfo.bannedBy}: ${banInfo.reason}`);
          return;
        }
        
        if (!(await verifyPassword(password, user.password_hash))) {
          setError('Invalid username or password');
          return;
        }
        const token = await createToken(user.id, user.username, user.role || 'user');
        storeToken(token);
        await login(token);
      } else if (mode === 'backup') {
        const user = await getUserByUsername(username);
        if (!user) { setError('User not found'); return; }
        
        // Check if user is banned
        const banInfo = await isUserBanned(user.id);
        if (banInfo.banned) {
          setError(`Your account has been banned by @${banInfo.bannedBy}: ${banInfo.reason}`);
          return;
        }
        
        const ok = await consumeBackupCode(user.id, backupCode.trim().toUpperCase());
        if (!ok) { setError('Invalid or used backup code'); return; }
        const token = await createToken(user.id, user.username, user.role || 'user');
        storeToken(token);
        await login(token);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow rounded-lg p-6 space-y-4">
        <div className="text-center">
          <div className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">noise.garden</div>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Recover account'}</h1>
          <div className="flex items-center space-x-2">
            <button type="button" className={`inline-flex items-center px-3 py-1.5 rounded text-sm border ${mode === 'login' ? 'bg-gray-900 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200'}`} onClick={() => setMode('login')}>
              <LogIn className="w-4 h-4 mr-1" /> Login
            </button>
            <button type="button" className={`inline-flex items-center px-3 py-1.5 rounded text-sm border ${mode === 'signup' ? 'bg-gray-900 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200'}`} onClick={() => setMode('signup')}>
              <UserPlus className="w-4 h-4 mr-1" /> Sign Up
            </button>
          </div>
            </div>

            {error && (
          <div className="flex items-center text-sm text-red-700 bg-red-50 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900 rounded p-2">
            <AlertTriangle className="w-4 h-4 mr-2" />
                {error}
              </div>
            )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
          <input value={username} onChange={e => setUsername(e.target.value.toLowerCase())} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200" placeholder="yourname" />
        </div>

        {mode !== 'backup' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200" placeholder="••••••" />
          </div>
        )}

            {mode === 'signup' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invite code</label>
              <input value={invite} onChange={e => setInvite(e.target.value.toUpperCase())} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200" placeholder="XXXX-XXXX-XXXX" />
            </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Captcha</label>
            <div ref={altchaRef} />
          </div>
          </>
        )}

        {mode === 'backup' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Backup code</label>
              <input value={backupCode} onChange={e => setBackupCode(e.target.value.toUpperCase())} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-200" placeholder="XXXX-XXXX-XXXX-XXXX" />
                </div>
            <div className="font-mono text-xs text-gray-600 dark:text-gray-400">Use your one-time backup code displayed at signup to recover your account.</div>
              </div>
            )}

        <button type="submit" disabled={loading || (mode==='signup' && !altchaPayload)} className="w-full inline-flex items-center justify-center px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60">
          {loading ? 'Please wait…' : (mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Recover')}
            </button>

        {mode === 'login' && (
          <div className="text-center">
            <button type="button" onClick={() => setMode('backup')} className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400 underline">Recover your account</button>
          </div>
        )}
      </form>
      {signupCodes && (
        <OnboardingBackupCodes
          codes={signupCodes}
          onClose={() => setSignupCodes(null)}
        />
      )}
    </div>
  );
}