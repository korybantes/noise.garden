import React, { useState, useRef, useEffect } from 'react';
import { LogIn, UserPlus, AlertTriangle } from 'lucide-react';
import { createUser, getUserByUsername } from '../lib/database';
import { hashPassword, verifyPassword, createToken, storeToken } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { generateBackupCode, storeBackupCodes, consumeBackupCode } from '../lib/backup';
import { OnboardingBackupCodes } from './OnboardingBackupCodes';

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup' | 'backup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupCodes, setSignupCodes] = useState<string[] | null>(null);
  const [altchaPayload, setAltchaPayload] = useState<string>('');
  const altchaRef = useRef<HTMLDivElement | null>(null);
  const { login } = useAuth();

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
        el.setAttribute('challengeurl', '/api/altcha/challenge');
        el.setAttribute('endpoint', '/api/altcha/verify');
        el.setAttribute('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        el.style.setProperty('--altcha-border-radius', '6px');
        el.style.setProperty('--altcha-max-width', '100%');
        el.style.setProperty('--altcha-color-border', document.documentElement.classList.contains('dark') ? '#374151' : '#d1d5db');
        el.style.setProperty('--altcha-color-base', document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff');
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
        const passwordHash = await hashPassword(password);
        const user = await createUser(username, passwordHash);
        const codes = Array.from({ length: 5 }, () => generateBackupCode());
        await storeBackupCodes(user.id, codes);
        setSignupCodes(codes);
        localStorage.setItem('onboarding_backup_codes', JSON.stringify(codes));
        const token = await createToken(user.id, user.username, user.role || 'user');
        storeToken(token);
        await login(token);
      } else if (mode === 'login') {
        const user = await getUserByUsername(username);
        if (!user || !(await verifyPassword(password, user.password_hash))) {
          setError('Invalid username or password');
          return;
        }
        const token = await createToken(user.id, user.username, user.role || 'user');
        storeToken(token);
        await login(token);
      } else if (mode === 'backup') {
        const user = await getUserByUsername(username);
        if (!user) { setError('User not found'); return; }
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Captcha</label>
            <div ref={altchaRef} />
          </div>
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