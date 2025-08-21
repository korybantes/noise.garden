import React, { useState, useEffect } from 'react';
import { X, Users, Shield, ShieldCheck, ShieldAlert, UserCheck, UserX, BarChart3, RefreshCw, Ban, Unlock, Flag, Eye, EyeOff, Key, Copy, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getAllUsers, updateUserRole, getUserStats, UserRole, banUser, unbanUser, getBannedUsers, createAdminInvite, getInvitesCreatedBy } from '../lib/database';

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

interface FlaggedPost {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: Date;
  expires_at: Date;
  parent_id?: string;
  reply_count: number;
  repost_of?: string | null;
  role?: UserRole;
  repost_count: number;
  image_url?: string | null;
  avatar_url?: string | null;
  is_whisper?: boolean;
  is_quarantined?: boolean;
  is_popup_thread?: boolean;
  popup_reply_limit?: number;
  popup_time_limit?: number;
  popup_closed_at?: Date;
  replies_disabled?: boolean;
  flag_count: number;
}

interface Invite {
  code: string;
  created_by: string;
  created_at: Date;
  used_by?: string | null;
  used_at?: Date | null;
  used_by_username?: string | null; // Optional field for display purposes
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPost[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stats, setStats] = useState<{ totalUsers: number; totalPosts: number; totalInvites: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [showBanModal, setShowBanModal] = useState<{ show: boolean; userId: string; username: string }>({ show: false, userId: '', username: '' });
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'banned' | 'invites'>('users');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [usersData, statsData, bannedData, flaggedData, invitesData] = await Promise.all([
        getAllUsers(user.userId),
        getUserStats(user.userId),
        getBannedUsers(user.userId),
        loadFlaggedPosts(),
        loadInvites()
      ]);
      setUsers(usersData);
      setStats(statsData);
      setBannedUsers(bannedData);
      setFlaggedPosts(flaggedData);
      setInvites(invitesData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFlaggedPosts = async () => {
    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'getFlaggedPosts',
          args: {}
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load flagged posts');
      }

      const result = await response.json();
      return result.flaggedPosts || [];
    } catch (error) {
      console.error('Error loading flagged posts:', error);
      return [];
    }
  };

  const loadInvites = async () => {
    if (!user) return [];
    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'getInvitesCreatedBy',
          args: { userId: user.userId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load invites');
      }

      const result = await response.json();
      return result.invites || [];
    } catch (error) {
      console.error('Error loading invites:', error);
      return [];
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

  const handleQuarantinePost = async (postId: string) => {
    if (!user) return;
    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'quarantinePost',
          args: { postId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to quarantine post');
      }

      // Update local state
      setFlaggedPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, is_quarantined: true } : p
      ));
    } catch (err) {
      setError('Failed to quarantine post');
      console.error(err);
    }
  };

  const handleUnquarantinePost = async (postId: string) => {
    if (!user) return;
    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'unquarantinePost',
          args: { postId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to unquarantine post');
      }

      // Update local state
      setFlaggedPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, is_quarantined: false } : p
      ));
    } catch (err) {
      setError('Failed to unquarantine post');
      console.error(err);
    }
  };

  const handleGenerateInvite = async () => {
    if (!user) return;
    setGeneratingInvite(true);
    try {
      const response = await createAdminInvite(user.userId);
      // Map the database response to our interface format
      const newInvite: Invite = {
        code: response.code,
        created_by: response.created_by,
        created_at: response.created_at,
        used_by: response.used_by,
        used_at: response.used_at,
        used_by_username: null
      };
      setInvites(prev => [...prev, newInvite]);
      setCopiedCode(response.code);
      // Auto-copy to clipboard
      navigator.clipboard.writeText(response.code);
      // Show success message
      setError(''); // Clear any previous errors
      setSuccessMessage('Invite generated successfully!');
      setTimeout(() => setSuccessMessage(''), 5000); // Hide after 5 seconds
    } catch (err) {
      setError('Failed to generate invite');
      console.error(err);
    } finally {
      setGeneratingInvite(false);
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
        <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow overflow-hidden">
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

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                activeTab === 'users'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                activeTab === 'reports'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Flag size={16} />
                Reports
                {flaggedPosts.length > 0 && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">
                    {flaggedPosts.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('banned')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                activeTab === 'banned'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Banned Users
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                activeTab === 'invites'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Key size={16} />
                Invites
                {invites.length > 0 && (
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                    {invites.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
                {successMessage}
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
            {activeTab === 'users' && (
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
            )}

            {/* Reports Section */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">Flagged Posts</h3>
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
                    loading reports...
                  </div>
                ) : flaggedPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
                    No flagged posts found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flaggedPosts.map((post) => (
                      <div
                        key={post.id}
                        className={`p-4 rounded-lg border ${
                          post.is_quarantined
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {post.avatar_url ? (
                              <img
                                src={post.avatar_url.replace('/upload/', '/upload/f_auto,q_auto,w_32,h_32,c_fill,g_face/')}
                                alt="avatar"
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800" />
                            )}
                            <div>
                              <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                                @{post.username}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(post.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                              {post.flag_count} flags
                            </span>
                            {post.is_quarantined ? (
                              <span className="text-xs font-mono bg-red-600 text-white px-2 py-1 rounded">
                                Quarantined
                              </span>
                            ) : (
                              <span className="text-xs font-mono bg-yellow-600 text-white px-2 py-1 rounded">
                                Under Review
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                            {post.content}
                          </div>
                          {post.parent_id && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Reply to post #{post.parent_id.slice(0, 8)}...
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {post.reply_count} replies • {post.repost_count} reposts
            </div>
                          
                          <div className="flex items-center gap-2">
                            {post.is_quarantined ? (
                              <button
                                onClick={() => handleUnquarantinePost(post.id)}
                                className="text-xs font-mono bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                title="Unquarantine post"
                              >
                                <Eye size={12} />
                                Unquarantine
                              </button>
                            ) : (
                              <button
                                onClick={() => handleQuarantinePost(post.id)}
                                className="text-xs font-mono bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                                title="Quarantine post"
                              >
                                <EyeOff size={12} />
                                Quarantine
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Banned Users Section */}
            {activeTab === 'banned' && bannedUsers.length > 0 && (
              <div className="space-y-4">
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

            {/* Invites Section */}
            {activeTab === 'invites' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Invites</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Generate unlimited invite codes to grow your community (Admin privilege)
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateInvite}
                    disabled={generatingInvite}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-mono text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Key size={16} />
                    {generatingInvite ? 'Generating...' : 'Generate New Invite'}
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
                    loading invites...
                  </div>
                ) : invites.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
                    No invites generated yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invites.map((invite) => (
                      <div
                        key={invite.code}
                        className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                              Invite Code: {invite.code}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              Created: {new Date(invite.created_at).toLocaleDateString()}
                            </div>
                            {invite.used_by && (
                              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Used by: @{invite.used_by_username || 'Unknown User'}
                              </div>
                            )}
                            {!invite.used_by && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Available for use
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!invite.used_by && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(invite.code);
                                  setCopiedCode(invite.code);
                                  setTimeout(() => setCopiedCode(null), 2000);
                                }}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                title="Copy invite code"
                              >
                                {copiedCode === invite.code ? (
                                  <Check size={16} className="text-green-600" />
                                ) : (
                                  <Copy size={16} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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