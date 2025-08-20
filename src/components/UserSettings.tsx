import React, { useState } from 'react';
import { X, Trash2, Key, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { deleteUser, updatePassword } from '../lib/database';
import { hashPassword, verifyPassword } from '../lib/auth';
import { getUserByUsername } from '../lib/database';

interface UserSettingsProps {
  onClose: () => void;
}

export function UserSettings({ onClose }: UserSettingsProps) {
  const { user, logout } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await deleteUser(user.userId);
      logout();
    } catch (error) {
      setError('Failed to delete account');
    } finally {
      setLoading(false);
    }
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
      
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setShowChangePassword(false);
    } catch (error) {
      setError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-mono font-bold text-gray-900">account settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-red-600 mt-0.5" size={16} />
              <p className="text-sm font-mono text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
            <p className="text-sm font-mono text-green-700">{success}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="pb-4 border-b border-gray-200">
            <p className="font-mono text-sm text-gray-600 mb-1">username</p>
            <p className="font-mono text-gray-900">@{user?.username}</p>
          </div>

          <div className="space-y-3">
            {!showChangePassword ? (
              <button
                onClick={() => setShowChangePassword(true)}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-50 transition-colors"
              >
                <Key size={16} />
                change password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="current password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  required
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="new password (6+ chars)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  required
                  minLength={6}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {loading ? '...' : 'save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setError('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-mono text-sm transition-colors"
                  >
                    cancel
                  </button>
                </div>
              </form>
            )}

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-700 py-2 px-4 rounded-md font-mono text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 size={16} />
                delete account permanently
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="text-red-600 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-mono text-red-800 font-medium">permanent deletion</p>
                    <p className="text-xs font-mono text-red-600 mt-1">
                      This will immediately delete your account and all your posts. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md font-mono text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? '...' : 'yes, delete everything'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-mono text-sm transition-colors"
                  >
                    cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}