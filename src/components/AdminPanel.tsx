import React, { useState, useEffect } from 'react';
import { X, Users, Shield, ShieldCheck, ShieldAlert, UserCheck, UserX, BarChart3, RefreshCw, Ban, Unlock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getAllUsers, updateUserRole, getUserStats, UserRole, banUser, unbanUser, getBannedUsers } from '../lib/database';

interface AdminPanelProps {
  onClose: () => void;
}

interface User {
  id: string;
  username: string;
  created_at: Date;
  role: UserRole;
  avatar_url?: string | null;
  bio?: string | null;
}

interface BannedUser {
  id: string;
  username: string;
  reason: string;
  bannedAt: Date;
  bannedBy: string;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [stats, setStats] = useState<{ totalUsers: number; totalPosts: number; totalInvites: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [showBanModal, setShowBanModal] = useState<{ show: boolean; userId: string; username: string }>({ show: false, userId: '', username: '' });
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [usersData, statsData, bannedData] = await Promise.all([
        getAllUsers(user.userId),
        getUserStats(user.userId),
        getBannedUsers(user.userId)
      ]);
      setUsers(usersData);
      setStats(statsData);
      setBannedUsers(bannedData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: UserRole) => {
    if (!user) return;
    setUpdatingRole(userId);
    try {
      await updateUserRole(userId, newRole, user.userId);
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      setError('Failed to update user role');
      console.error(err);
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleBanUser = async () => {
    if (!user || !banReason.trim()) return;
    setBanning(true);
    try {
      await banUser(showBanModal.userId, banReason.trim(), user.userId);
      // Refresh data
      await loadData();
      setShowBanModal({ show: false, userId: '', username: '' });
      setBanReason('');
    } catch (err) {
      setError('Failed to ban user');
      console.error(err);
    } finally {
      setBanning(false);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    if (!user) return;
    try {
      await unbanUser(userId, user.userId);
      // Refresh data
      await loadData();
    } catch (err) {
      setError('Failed to unban user');
      console.error(err);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-red-600 dark:text-red-400">
            <ShieldCheck size={12} />
            admin
          </span>
        );
      case 'moderator':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400">
            <ShieldAlert size={12} />
            moderator
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-600 dark:text-gray-400">
            <UserCheck size={12} />
            user
          </span>
        );
    }
  };

  const canChangeRole = (targetRole: UserRole, currentRole: UserRole) => {
    if (user?.role !== 'admin') return false;
    if (targetRole === 'admin' && currentRole === 'admin') return false; // Can't demote yourself
    return true;
  };

  if (!user || !['admin', 'moderator'].includes(user.role)) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
                {user.role === 'admin' ? 'Admin Panel' : 'Moderator Panel'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Stats Section */}
            {stats && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Users size={16} />
                    <span className="font-mono text-sm">Total Users</span>
                  </div>
                  <div className="font-mono text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalUsers}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <BarChart3 size={16} />
                    <span className="font-mono text-sm">Total Posts</span>
                  </div>
                  <div className="font-mono text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalPosts}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Shield size={16} />
                    <span className="font-mono text-sm">Total Invites</span>
                  </div>
                  <div className="font-mono text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalInvites}
                  </div>
                </div>
              </div>
            )}

            {/* Users Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">User Management</h3>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  refresh
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
                  loading users...
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((userItem) => (
                    <div
                      key={userItem.id}
                      className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {userItem.avatar_url ? (
                            <img
                              src={userItem.avatar_url.replace('/upload/', '/upload/f_auto,q_auto,w_32,h_32,c_fill,g_face/')}
                              alt="avatar"
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800" />
                          )}
                          <div>
                            <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                              @{userItem.username}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              joined {new Date(userItem.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {getRoleBadge(userItem.role)}
                          
                          <div className="flex items-center gap-2">
                            {user?.role === 'admin' && (
                              <select
                                value={userItem.role}
                                onChange={(e) => handleRoleUpdate(userItem.id, e.target.value as UserRole)}
                                disabled={updatingRole === userItem.id || !canChangeRole(userItem.role, userItem.role)}
                                className="text-xs font-mono bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                              >
                                <option value="user">user</option>
                                <option value="moderator">moderator</option>
                                <option value="admin">admin</option>
                              </select>
                            )}
                            
                            <button
                              onClick={() => setShowBanModal({ show: true, userId: userItem.id, username: userItem.username })}
                              className="text-xs font-mono bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                              title="Ban user"
                            >
                              <Ban size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {userItem.bio && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {userItem.bio}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Banned Users Section */}
            {bannedUsers.length > 0 && (
              <div className="mt-8 space-y-4">
                <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">Banned Users</h3>
                <div className="space-y-3">
                  {bannedUsers.map((bannedUser) => (
                    <div
                      key={bannedUser.id}
                      className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                            @{bannedUser.username}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            banned {new Date(bannedUser.bannedAt).toLocaleDateString()} by @{bannedUser.bannedBy}
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Reason: {bannedUser.reason}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleUnbanUser(bannedUser.id)}
                          className="text-xs font-mono bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                          title="Unban user"
                        >
                          <Unlock size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ban Modal */}
      {showBanModal.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
                Ban User
              </h3>
              <button
                onClick={() => setShowBanModal({ show: false, userId: '', username: '' })}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Banning @{showBanModal.username}
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for ban
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for ban..."
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
                rows={3}
                maxLength={500}
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBanModal({ show: false, userId: '', username: '' })}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBanUser}
                disabled={!banReason.trim() || banning}
                className="px-4 py-2 bg-red-600 text-white rounded-md font-mono text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {banning ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 