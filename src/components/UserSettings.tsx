import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Key, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile, deleteUser, updatePassword, getUserByUsername } from '../lib/database';
import { hashPassword, verifyPassword } from '../lib/auth';

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

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const fresh = await getUserByUsername(user.username);
        if (fresh?.avatar_url) setAvatarUrl(fresh.avatar_url);
        if (typeof fresh?.bio === 'string') setBio(fresh.bio);
      } catch {
        // ignore
      }
    })();
  }, [user]);

  const uploadAvatar = async (file: File) => {
    const sig = await fetch('/api/cloudinary/sign?folder=avatars').then(r => r.json());
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(sig.timestamp));
    form.append('signature', sig.signature);
    form.append('folder', sig.folder);
    const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: form });
    const data = await up.json();
    if (data?.secure_url) setAvatarUrl(data.secure_url);
  };

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateUserProfile(user.userId, avatarUrl || null, bio || null);
      onClose();
    } catch (e) {
      setError('Failed to save profile');
    } finally { setLoading(false); }
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
          <h2 className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100">account settings</h2>
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
            <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-1">username</p>
            <p className="font-mono text-gray-900 dark:text-gray-100">@{user?.username}</p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-2">avatar</p>
              <div className="flex items-center gap-3">
                {avatarUrl && <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />}
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 font-mono text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Upload size={16} /> upload image
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
                </label>
              </div>
            </div>
            <div>
              <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mb-1">bio</p>
              <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" rows={3} maxLength={200} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={loading} className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50">
                {loading ? 'saving…' : 'save profile'}
              </button>
            </div>
          </div>

          {!showChangePassword ? (
            <button onClick={() => setShowChangePassword(true)} className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Key size={16} /> change password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="current password" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900" required />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="new password (6+ chars)" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-600 bg-white dark:bg-gray-900" required minLength={6} />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50">{loading ? '...' : 'save'}</button>
                <button type="button" onClick={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setError(''); }} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono text-sm transition-colors">cancel</button>
              </div>
            </form>
          )}

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-700 py-2 px-4 rounded-md font-mono text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 size={16} /> delete account permanently
            </button>
          ) : (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                <div>
                  <p className="text-sm font-mono text-red-800 dark:text-red-300 font-medium">permanent deletion</p>
                  <p className="text-xs font-mono text-red-600 dark:text-red-400 mt-1">This will immediately delete your account and all your posts. This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleDeleteAccount} disabled={loading} className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-mono text-sm hover:bg-red-700 transition-colors disabled:opacity-50">{loading ? '...' : 'yes, delete everything'}</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono text-sm transition-colors">cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}