import React, { useState, useRef, useEffect } from 'react';
import { LogIn, UserPlus, AlertTriangle, Eye, EyeOff } from 'lucide-react';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupCodes, setSignupCodes] = useState<string[] | null>(null);
  const [altchaPayload, setAltchaPayload] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
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
        el.setAttribute('challengeurl', '/api/altcha');
        el.setAttribute('endpoint', '/api/altcha');
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

  const handleModeChange = (newMode: 'login' | 'signup' | 'backup') => {
    setMode(newMode);
    setError('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAcceptTerms(false);
    setAcceptPrivacy(false);
    setAcceptAge(false);
  };

  const getPasswordStrength = (pass: string) => {
    if (pass.length < 6) return { strength: 'weak', color: 'text-red-500', text: 'Too short' };
    if (pass.length < 8) return { strength: 'weak', color: 'text-red-500', text: 'Weak' };
    if (pass.length < 10) return { strength: 'medium', color: 'text-yellow-500', text: 'Medium' };
    if (pass.length < 12) return { strength: 'strong', color: 'text-green-500', text: 'Strong' };
    return { strength: 'very-strong', color: 'text-green-600', text: 'Very strong' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) { setError('Username must be 3+ chars'); return; }

    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        if (!altchaPayload) { setError('Please complete the captcha'); return; }
        if (!acceptTerms || !acceptPrivacy || !acceptAge) { 
          setError('Please accept all terms and conditions to continue'); 
          return; 
        }
        const existingUser = await getUserByUsername(username);
        if (existingUser) { setError('Username already exists'); return; }
        if (password.length < 6) { setError('Password must be 6+ chars'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        
        // Enhanced password strength validation
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
          setError('Password must contain uppercase, lowercase, and numbers');
          return;
        }
        
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
            <button type="button" className={`inline-flex items-center px-3 py-1.5 rounded text-sm border ${mode === 'login' ? 'bg-gray-900 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200'}`} onClick={() => handleModeChange('login')}>
              <LogIn className="w-4 h-4 mr-1" /> Login
            </button>
            <button type="button" className={`inline-flex items-center px-3 py-1.5 rounded text-sm border ${mode === 'signup' ? 'bg-gray-900 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200'}`} onClick={() => handleModeChange('signup')}>
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
          <input value={username} onChange={e => {
            const v = e.target.value.toLowerCase();
            // Allow only a-z, 0-9, underscore, hyphen
            const sanitized = v.replace(/[^a-z0-9_-]/g, '');
            setUsername(sanitized);
          }} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono text-base" placeholder="username" maxLength={20} />
          <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
            Please avoid using your real name. Usernames may contain only letters, numbers, '_' or '-'.
          </div>
        </div>

        {mode !== 'backup' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 font-mono text-base" 
                placeholder="password" 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'signup' && password && (
              <div className="mt-1 text-xs font-mono">
                <span className={getPasswordStrength(password).color}>
                  {getPasswordStrength(password).text}
                </span>
                {password.length >= 6 && (
                  <div className="mt-1 flex gap-1">
                    <div className={`h-1 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`h-1 flex-1 rounded ${password.length >= 10 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`h-1 flex-1 rounded ${password.length >= 12 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

            {mode === 'signup' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 pr-10 font-mono text-base" 
                  placeholder="confirm password" 
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invite code</label>
              <input value={invite} onChange={e => setInvite(e.target.value.toUpperCase())} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono text-base" placeholder="XXX-XXX-XXX" maxLength={11} />
            </div>
            
            {/* Terms and Conditions */}
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Before creating your account, please review and accept:
              </div>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={acceptAge} 
                    onChange={(e) => setAcceptAge(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-mono">
                    I confirm that I am at least 13 years old and legally able to agree to these terms.
                  </span>
                </label>
                
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={acceptTerms} 
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-mono">
                    I agree to the{' '}
                    <button 
                      type="button" 
                      onClick={() => window.open('/terms', '_blank')}
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      Terms of Service
                    </button>
                    {' '}and understand that this platform is ephemeral (posts expire automatically).
                  </span>
                </label>
                
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={acceptPrivacy} 
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-mono">
                    I have read and accept the{' '}
                    <button 
                      type="button" 
                      onClick={() => window.open('/privacy', '_blank')}
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      Privacy Policy
                    </button>
                    {' '}and understand how my data will be handled.
                  </span>
                </label>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="text-xs text-blue-800 dark:text-blue-200 font-mono space-y-1">
                  <div className="font-semibold">Key Points:</div>
                  <div>• Posts and messages automatically expire (ephemeral)</div>
                  <div>• Invitation-only platform with community guidelines</div>
                  <div>• No personal data is sold or shared with third parties</div>
                  <div>• Account deletion removes all associated data permanently</div>
                  <div>• Moderation is enforced to maintain a safe environment</div>
                </div>
              </div>
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
              <input value={backupCode} onChange={e => setBackupCode(e.target.value.toUpperCase())} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono text-base" placeholder="XXXX-XXXX-XXXX" maxLength={19} />
                </div>
            <div className="font-mono text-xs text-gray-600 dark:text-gray-400">Use your one-time backup code displayed at signup to recover your account.</div>
              </div>
            )}

        <button type="submit" disabled={loading || (mode==='signup' && (!altchaPayload || !acceptTerms || !acceptPrivacy || !acceptAge))} className="w-full inline-flex items-center justify-center px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60">
          {loading ? 'Please wait…' : (mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Recover')}
            </button>

        {mode === 'login' && (
          <div className="text-center">
            <button type="button" onClick={() => handleModeChange('backup')} className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400 underline">Recover your account</button>
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