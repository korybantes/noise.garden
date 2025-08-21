import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Key, Trash2, SlidersHorizontal, Globe } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile, deleteUser, updatePassword, getUserByUsername, createInviteForUser, getInviteForCreator } from '../lib/database';
import { hashPassword, verifyPassword } from '../lib/auth';
import { containsLink } from '../lib/validation';
import { FeedSettings as FS, loadFeedSettings, saveFeedSettings } from '../lib/settings';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';

interface UserSettingsProps {
  onClose: () => void;
}

export function UserSettings({ onClose }: UserSettingsProps) {
  const { user, logout } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [feedSettingsOpen, setFeedSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<FS>(() => loadFeedSettings());
  const [mutedInput, setMutedInput] = useState('');
  const [language, setLanguage] = useState<'en' | 'tr'>(settings.language);
  const { language: currentLanguage } = useLanguage();

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const fresh = await getUserByUsername(user.username);
        if (fresh?.avatar_url) setAvatarUrl(fresh.avatar_url);
        if (typeof fresh?.bio === 'string') setBio(fresh.bio);
        const inv = await getInviteForCreator(user.userId);
        if (inv?.code) setInviteCode(inv.code);
      } catch {
      }
    })();
  }, [user]);

  useEffect(() => { saveFeedSettings(settings); }, [settings]);

  const handleLanguageChange = (newLanguage: 'en' | 'tr') => {
    setLanguage(newLanguage);
    const newSettings = { ...settings, language: newLanguage };
    setSettings(newSettings);
    saveFeedSettings(newSettings);
  };

  const saveProfile = async () => {
    if (!user) return;
    if (bio && containsLink(bio)) { setError('Links are not allowed in bio'); return; }
    setLoading(true);
    try {
      await updateUserProfile(user.userId, avatarUrl || null, bio || null);
      onClose();
    } catch (e) {
      setError('Failed to save profile');
    } finally { setLoading(false); }
  };

  const createInvite = async () => {
    if (!user) return;
    const inv = await createInviteForUser(user.userId);
    setInviteCode(inv.code);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const dbUser = await getUserByUsername(user.username);
      if (!dbUser || !(await verifyPassword(currentPassword, dbUser.password_hash))) {
        setError('Current password is incorrect');
        return;
      }
      const newPasswordHash = await hashPassword(newPassword);
      await updatePassword(user.userId, newPasswordHash);
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setError('Failed to change password');
    } finally { setLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await deleteUser(user.userId);
      logout();
    } catch {
      setError('Failed to delete account');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100">{t('accountSettings', currentLanguage)}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-red-600 mt-0.5" size={16} />
              <p className="text-sm font-mono text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
            <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-1">{t('username', currentLanguage)}</p>
            <p className="font-mono text-gray-900 dark:text-gray-100">@{user?.username}</p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-2">{t('avatar', currentLanguage)}</p>
              <div className="flex items-center gap-3">
                {avatarUrl && <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />}
                <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="flex-1 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm" />
              </div>
            </div>
            <div>
              <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-1">{t('bio', currentLanguage)}</p>
              <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" rows={3} maxLength={200} placeholder={t('sayHelloNoLinks', currentLanguage)} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={loading} className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50">
                {loading ? t('saving', currentLanguage) : t('saveProfile', currentLanguage)}
              </button>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-gray-700 dark:text-gray-300">{t('inviteFriend', currentLanguage)}</p>
                <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{t('eachAccountHasOneInviteCode', currentLanguage)}</p>
              </div>
              {inviteCode ? (
                <div className="font-mono text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-700">{inviteCode}</div>
              ) : (
                <button onClick={createInvite} className="ng-btn">{t('generateInvite', currentLanguage)}</button>
              )}
            </div>
          </div>

          {/* Feed settings section */}
          <div className="rounded-md border border-gray-200 dark:border-gray-800">
            <button onClick={() => setFeedSettingsOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2">
              <span className="flex items-center gap-2 font-mono text-sm text-gray-700 dark:text-gray-300"><SlidersHorizontal size={16} /> {t('feedSettings', currentLanguage)}</span>
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{feedSettingsOpen ? t('hide', currentLanguage) : t('show', currentLanguage)}</span>
            </button>
            {feedSettingsOpen && (
              <div className="p-3 space-y-3 border-t border-gray-200 dark:border-gray-800">
                {/* Language Selection */}
                <div>
                  <label className="font-mono text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Globe size={16} />
                    {t('language', currentLanguage)} / {t('dil', currentLanguage)}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleLanguageChange('en')}
                      className={`px-3 py-2 rounded text-sm font-mono transition-colors ${
                        language === 'en'
                          ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                          : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {t('english', currentLanguage)}
                    </button>
                    <button
                      onClick={() => handleLanguageChange('tr')}
                      className={`px-3 py-2 rounded text-sm font-mono transition-colors ${
                        language === 'tr'
                          ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                          : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {t('turkish', currentLanguage)}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="font-mono text-sm text-gray-600 dark:text-gray-400">{t('mutedWordsTags', currentLanguage)}</label>
                  <div className="mt-2 flex gap-2">
                    <input value={mutedInput} onChange={(e) => setMutedInput(e.target.value)} placeholder={t('wordOrTag', currentLanguage)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
                    <button type="button" onClick={() => { if (!mutedInput.trim()) return; setSettings(s => ({ ...s, mutedWords: Array.from(new Set([...(s.mutedWords||[]), mutedInput.trim()])) })); setMutedInput(''); }} className="ng-btn">{t('add', currentLanguage)}</button>
                  </div>
                  {settings.mutedWords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {settings.mutedWords.map((w) => (
                        <button key={w} onClick={() => setSettings(s => ({ ...s, mutedWords: s.mutedWords.filter(x => x !== w) }))} className="text-xs font-mono px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">{w} ×</button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="font-mono text-sm text-gray-600 dark:text-gray-400">{t('quietHours', currentLanguage)}</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" min={0} max={23} value={settings.quietHours?.startHour ?? ''} onChange={(e) => setSettings(s => ({ ...s, quietHours: { startHour: Number(e.target.value||0), endHour: s.quietHours?.endHour ?? 0 } }))} placeholder={t('startHour', currentLanguage)} className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
                    <span className="text-gray-500">{t('to', currentLanguage)}</span>
                    <input type="number" min={0} max={23} value={settings.quietHours?.endHour ?? ''} onChange={(e) => setSettings(s => ({ ...s, quietHours: { startHour: s.quietHours?.startHour ?? 0, endHour: Number(e.target.value||0) } }))} placeholder={t('endHour', currentLanguage)} className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
                    <button type="button" onClick={() => setSettings(s => ({ ...s, quietHours: null }))} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 font-mono text-sm">{t('clear', currentLanguage)}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

            {!showChangePassword ? (
            <button onClick={() => setShowChangePassword(true)} className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Key size={16} /> {t('changePassword', currentLanguage)}
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t('currentPassword', currentLanguage)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900" required />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('newPasswordMin6Chars', currentLanguage)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900" required minLength={6} />
                <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50">{loading ? '...' : t('save', currentLanguage)}</button>
                <button type="button" onClick={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setError(''); }} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono text-sm transition-colors">{t('cancel', currentLanguage)}</button>
                </div>
              </form>
            )}

            {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-700 py-2 px-4 rounded-md font-mono text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 size={16} /> {t('deleteAccountPermanently', currentLanguage)}
              </button>
            ) : (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                  <div>
                  <p className="text-sm font-mono text-red-800 dark:text-red-300 font-medium">{t('permanentDeletion', currentLanguage)}</p>
                  <p className="text-xs font-mono text-red-600 dark:text-red-400 mt-1">{t('permanentDeletionDescription', currentLanguage)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                <button onClick={handleDeleteAccount} disabled={loading} className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-mono text-sm hover:bg-red-700 transition-colors disabled:opacity-50">{loading ? '...' : t('yesDeleteEverything', currentLanguage)}</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono text-sm transition-colors">{t('cancel', currentLanguage)}</button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}