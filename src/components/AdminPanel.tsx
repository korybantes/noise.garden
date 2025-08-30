import { useState, useEffect } from 'react';
import { X, Users, Shield, ShieldCheck, ShieldAlert, UserCheck, BarChart3, RefreshCw, Ban, Unlock, Flag, Eye, EyeOff, Key, Copy, Check, MicOff, Mic, Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getAllUsers, updateUserRole, getUserStats, UserRole, banUser, unbanUser, getBannedUsers, createAdminInvite, muteUser, unmuteUser, getMutedUsers } from '../lib/database';
import { useLanguage } from '../hooks/useLanguage';
import { NotificationService } from '../services/notificationService';
import { NewsPage } from './NewsPage';

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
  const { language } = useLanguage();
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
  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'banned' | 'muted' | 'invites' | 'feedback' | 'news'>('users');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [mutedUsers, setMutedUsers] = useState<Array<{
    id: string;
    username: string;
    reason: string;
    expiresAt: Date;
    mutedBy: string;
    mutedByUsername: string;
  }>>([]);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [muteTarget, setMuteTarget] = useState<User | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(24);
  const [feedbackTickets, setFeedbackTickets] = useState<Array<{
    id: string;
    user_id: string;
    username: string;
    type: 'feedback' | 'bug_report' | 'support' | 'feature_request';
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    created_at: Date;
    updated_at: Date;
    assigned_to?: string;
    assigned_username?: string;
  }>>([]);
  const [customNotification, setCustomNotification] = useState({ title: '', body: '', targetToken: '' });
  const [sendingCustom, setSendingCustom] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [usersData, statsData, bannedData, mutedData, flaggedData, invitesData, feedbackData] = await Promise.all([
        getAllUsers(user.userId),
        getUserStats(user.userId),
        getBannedUsers(user.userId),
        getMutedUsers(user.userId),
        loadFlaggedPosts(),
        loadInvites(),
        loadFeedbackTickets()
      ]);
      setUsers(usersData);
      setStats(statsData);
      setBannedUsers(bannedData);
      setMutedUsers(mutedData);
      setFlaggedPosts(flaggedData);
      setInvites(invitesData);
      setFeedbackTickets(feedbackData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFlaggedPosts = async () => {
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      return Array.isArray(result.flaggedPosts) ? result.flaggedPosts : [];
    } catch (error) {
      console.error('Error loading flagged posts:', error);
      return [];
    }
  };

  const loadInvites = async () => {
    if (!user) return [];
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      return Array.isArray(result.invites) ? result.invites : [];
    } catch (error) {
      console.error('Error loading invites:', error);
      return [];
    }
  };

  const loadFeedbackTickets = async () => {
    if (!user) return [];
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getFeedbackTickets',
          args: {}
        })
      });
      if (!response.ok) {
        throw new Error('Failed to load feedback tickets');
      }

      const result = await response.json();
      return Array.isArray(result.tickets) ? result.tickets : [];
    } catch (error) {
      console.error('Error loading feedback tickets:', error);
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
      setSuccessMessage('Post quarantined successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
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
      setSuccessMessage('Post unquarantined successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to unquarantine post');
      console.error(err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'deletePost',
          args: { postId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      // Remove from local state
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
      setSuccessMessage('Post deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to delete post');
      console.error(err);
    }
  };

  const handleDismissReport = async (postId: string) => {
    if (!user) return;
    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'dismissReport',
          args: { postId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss report');
      }

      // Remove from local state
      setFlaggedPosts(prev => prev.filter(p => p.id !== postId));
      setSuccessMessage('Report dismissed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to dismiss report');
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

  const handleUnban = async (userId: string) => {
    if (!user) return;
    try {
      await unbanUser(userId, user.userId);
      await loadData();
      setSuccessMessage('User unbanned successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const handleMute = async (userId: string, reason: string, durationHours: number) => {
    if (!user) return;
    try {
      await muteUser(userId, reason, user.userId, durationHours);
      await loadData();
      setShowMuteModal(false);
      setMuteTarget(null);
      setMuteReason('');
      setMuteDuration(24);
      setSuccessMessage('User muted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to mute user:', error);
    }
  };

  const handleUnmute = async (userId: string) => {
    if (!user) return;
    try {
      await unmuteUser(userId, user.userId);
      await loadData();
      setSuccessMessage('User unmuted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to unmute user:', error);
    }
  };

  const handleTestNotification = async () => {
    try {
      await NotificationService.sendTestNotification();
      setSuccessMessage('Test notification sent successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setError('Failed to send test notification');
      console.error('Test notification error:', error);
    }
  };

  const handleSendCustomNotification = async () => {
    setSendingCustom(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'sendTestPushNotification',
          args: {
            deviceToken: customNotification.targetToken,
            title: customNotification.title,
            body: customNotification.body,
            platform: 'android'
          }
        })
      });
      if (response.ok) {
        setSuccessMessage('Custom notification sent!');
      } else {
        setError('Failed to send custom notification');
      }
    } catch (err) {
      setError('Failed to send custom notification');
    } finally {
      setSendingCustom(false);
    }
  };

  const openMuteModal = (userItem: User) => {
    setMuteTarget(userItem);
    setShowMuteModal(true);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-red-600 dark:text-red-400">
            <ShieldCheck size={12} />
            Admin
          </span>
        );
      case 'moderator':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400">
            <ShieldAlert size={12} />
            Moderator
          </span>
        );
      case 'community_manager':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-blue-600 dark:text-blue-400">
            <Users size={12} />
            Community Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-600 dark:text-gray-400">
            <UserCheck size={12} />
            User
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
        <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="font-mono text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                {user?.role === 'admin' ? (language === 'tr' ? 'Admin Paneli' : 'Admin Panel') : (language === 'tr' ? 'Moderatör Paneli' : 'Moderator Panel')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Tab Navigation - Mobile Responsive */}
          <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-2 sm:px-4 py-2 font-mono text-xs sm:text-sm transition-colors ${
                activeTab === 'users'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {language === 'tr' ? 'Kullanıcılar' : 'Users'}
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-2 sm:px-4 py-2 font-mono text-xs sm:text-sm transition-colors ${
                activeTab === 'reports'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Flag size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{language === 'tr' ? 'Raporlar' : 'Reports'}</span>
                <span className="sm:hidden">{language === 'tr' ? 'Raporlar' : 'Reports'}</span>
                {flaggedPosts.length > 0 && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {flaggedPosts.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('banned')}
              className={`px-2 sm:px-4 py-2 font-mono text-xs sm:text-sm transition-colors ${
                activeTab === 'banned'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <span className="hidden sm:inline">{language === 'tr' ? 'Yasaklı Kullanıcılar' : 'Banned Users'}</span>
              <span className="sm:hidden">{language === 'tr' ? 'Yasaklı' : 'Banned'}</span>
            </button>
            <button
              onClick={() => setActiveTab('muted')}
              className={`px-2 sm:px-4 py-2 font-mono text-xs sm:text-sm transition-colors ${
                activeTab === 'muted'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <span className="hidden sm:inline">{language === 'tr' ? 'Susturulmuş Kullanıcılar' : 'Muted Users'}</span>
              <span className="sm:hidden">{language === 'tr' ? 'Susturulmuş' : 'Muted'}</span>
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-2 sm:px-4 py-2 font-mono text-xs sm:text-sm transition-colors ${
                activeTab === 'invites'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Key size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{language === 'tr' ? 'Davetler' : 'Invites'}</span>
                <span className="sm:hidden">{language === 'tr' ? 'Davetler' : 'Invites'}</span>
                {invites.length > 0 && (
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {invites.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-2 sm:px-4 py-2 font-mono text-xs sm:text-sm transition-colors ${
                activeTab === 'feedback'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Bell size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{language === 'tr' ? 'Geri Bildirimler' : 'Feedback'}</span>
                <span className="sm:hidden">{language === 'tr' ? 'Geri Bildirimler' : 'Feedback'}</span>
                {feedbackTickets.filter(t => t.status === 'open').length > 0 && (
                  <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {feedbackTickets.filter(t => t.status === 'open').length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className={`px-2 sm:px-4 py-2 font-mono text-xs sm:text-sm transition-colors ${
                activeTab === 'news'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-lg">📰</span>
                <span className="hidden sm:inline">{language === 'tr' ? 'Haberler' : 'News'}</span>
                <span className="sm:hidden">{language === 'tr' ? 'Haberler' : 'News'}</span>
              </div>
            </button>
          </div>

          <div className="p-2 sm:p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
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

            {/* Stats Section - Mobile Responsive */}
            {stats && (
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Users size={14} className="sm:w-4 sm:h-4" />
                    <span className="font-mono text-xs sm:text-sm">{language === 'tr' ? 'Toplam Kullanıcı' : 'Total Users'}</span>
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalUsers}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <BarChart3 size={14} className="sm:w-4 sm:h-4" />
                    <span className="font-mono text-xs sm:text-sm">{language === 'tr' ? 'Toplam Gönderi' : 'Total Posts'}</span>
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalPosts}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Shield size={14} className="sm:w-4 sm:h-4" />
                    <span className="font-mono text-xs sm:text-sm">{language === 'tr' ? 'Toplam Davet' : 'Total Invites'}</span>
                  </div>
                  <div className="font-mono text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.totalInvites}
                  </div>
                </div>
              </div>
            )}

            {/* Test Notification Button */}
            <div className="mb-6">
              <button
                onClick={handleTestNotification}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-mono text-sm hover:bg-blue-700 transition-colors"
              >
                <Bell size={16} />
                {language === 'tr' ? 'Test Bildirimi Gönder' : 'Send Test Notification'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {language === 'tr' ? 'Tüm kullanıcılara test bildirimi gönderir' : 'Sends a test notification to all users'}
              </p>
              
              {/* Real-time Notification Test Buttons */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('newNotification', { detail: { type: 'reply' } }))}
                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                >
                  Test Reply
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('newNotification', { detail: { type: 'repost' } }))}
                  className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                >
                  Test Repost
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('newNotification', { detail: { type: 'mention' } }))}
                  className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition-colors"
                >
                  Test Mention
                </button>
              </div>
            </div>

            {/* Users Section */}
            {activeTab === 'users' && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="font-mono text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {language === 'tr' ? 'Kullanıcı Yönetimi' : 'User Management'}
                </h3>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-xs sm:text-sm transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={`sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                  refresh
                </button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">
                  {language === 'tr' ? 'kullanıcılar yükleniyor...' : 'loading users...'}
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((userItem) => (
                    <div
                      key={userItem.id}
                      className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {userItem.avatar_url ? (
                            <img
                              src={userItem.avatar_url.replace('/upload/', '/upload/f_auto,q_auto,w_32,h_32,c_fill,g_face/')}
                              alt="avatar"
                              className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-200 dark:bg-gray-800" />
                          )}
                          <div>
                            <div className="font-mono text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                              @{userItem.username}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {language === 'tr' ? 'katıldı' : 'joined'} {new Date(userItem.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
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
                                <option value="community_manager">community manager</option>
                                <option value="admin">admin</option>
                              </select>
                            )}
                            
                            <button
                              onClick={() => setShowBanModal({ show: true, userId: userItem.id, username: userItem.username })}
                              className="text-xs font-mono bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                              title="Ban User"
                            >
                              <Ban size={12} />
                            </button>
                            
                            <button
                              onClick={() => openMuteModal(userItem)}
                              className="text-xs font-mono bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700 transition-colors"
                              title="Mute User"
                            >
                              <MicOff size={12} />
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
                    {language === 'tr' ? 'İşaretlenen gönderi bulunamadı' : 'No flagged posts found'}
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
                            {post.reply_count > 0 ? `${post.reply_count} replies` : ''} {post.reply_count > 0 && post.repost_count > 0 ? '•' : ''} {post.repost_count > 0 ? `${post.repost_count} reposts` : ''}
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
                            
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="text-xs font-mono bg-red-800 text-white px-2 py-1 rounded hover:bg-red-900 transition-colors"
                              title="Delete post permanently"
                            >
                              <X size={12} />
                              Delete
                            </button>
                            
                            <button
                              onClick={() => handleDismissReport(post.id)}
                              className="text-xs font-mono bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                              title="Dismiss report"
                            >
                              <Check size={12} />
                              Dismiss
                            </button>
                            
                            <button
                              onClick={() => openMuteModal({ 
                                id: post.user_id, 
                                username: post.username, 
                                created_at: post.created_at, 
                                role: post.role || 'user', 
                                avatar_url: post.avatar_url,
                                bio: null
                              })}
                              className="text-xs font-mono bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700 transition-colors"
                              title="Mute user"
                            >
                              <MicOff size={12} />
                              Mute
                            </button>
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
                            {language === 'tr' ? 'Yasaklandı' : 'banned'} {new Date(bannedUser.bannedAt).toLocaleDateString()} {language === 'tr' ? 'tarafından' : 'by'} @{bannedUser.bannedBy}
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {language === 'tr' ? 'Sebep' : 'Reason'}: {bannedUser.reason}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleUnbanUser(bannedUser.id)}
                          className="text-xs font-mono bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                          title={language === 'tr' ? 'Kullanıcının yasağını kaldır' : 'Unban user'}
                        >
                          <Unlock size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Muted Users Section */}
            {activeTab === 'muted' && mutedUsers.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">Muted Users</h3>
                <div className="space-y-3">
                  {mutedUsers.map((mutedUser) => (
                    <div
                      key={mutedUser.id}
                      className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                            @{mutedUser.username}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Muted {new Date(mutedUser.expiresAt).toLocaleDateString()} {language === 'tr' ? 'tarafından' : 'by'} @{mutedUser.mutedByUsername}
                          </div>
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                            Reason: {mutedUser.reason}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleUnmute(mutedUser.id)}
                          className="text-xs font-mono bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                          title={language === 'tr' ? 'Kullanıcının susturmasını kaldır' : 'Unmute user'}
                        >
                          <Mic size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'muted' && mutedUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">
                {language === 'tr' ? 'Susturulmuş kullanıcı bulunamadı' : 'No muted users found'}
              </div>
            )}

            {/* Invites Section */}
            {activeTab === 'invites' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">{language === 'tr' ? 'Davetleri Yönet' : 'Manage Invites'}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {language === 'tr' ? 'Sınırsız davet kodu oluşturarak topluluğunuzu büyütün (Admin ayrıcalığı)' : 'Generate unlimited invite codes to grow your community (Admin privilege)'}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateInvite}
                    disabled={generatingInvite}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-mono text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Key size={16} />
                    {generatingInvite ? (language === 'tr' ? 'Oluşturuluyor...' : 'Generating...') : (language === 'tr' ? 'Yeni Davet Oluştur' : 'Generate New Invite')}
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
                    {language === 'tr' ? 'davetler yükleniyor...' : 'loading invites...'}
                  </div>
                ) : invites.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
                    {language === 'tr' ? 'Henüz davet oluşturulmadı.' : 'No invites generated yet.'}
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
                              {language === 'tr' ? 'Davet Kodu' : 'Invite Code'}: {invite.code}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {language === 'tr' ? 'Oluşturuldu' : 'Created'}: {new Date(invite.created_at).toLocaleDateString()}
                            </div>
                            {invite.used_by && (
                              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                {language === 'tr' ? 'Kullanan' : 'Used by'}: @{invite.used_by_username || (language === 'tr' ? 'Bilinmeyen Kullanıcı' : 'Unknown User')}
                              </div>
                            )}
                            {!invite.used_by && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                {language === 'tr' ? 'Kullanıma hazır' : 'Available for use'}
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
                                title={language === 'tr' ? 'Davet kodunu kopyala' : 'Copy invite code'}
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

            {/* News Section */}
            {activeTab === 'news' && (
              <NewsPage />
            )}

            {/* Feedback Section */}
            {activeTab === 'feedback' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">Feedback Tickets</h3>
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
                    loading feedback tickets...
                  </div>
                ) : feedbackTickets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono">
                    {language === 'tr' ? 'Henüz geri bildirim alınmadı.' : 'No feedback tickets yet.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feedbackTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                            {ticket.title}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                          {ticket.description}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {ticket.type === 'bug_report' ? 'Bug Report' : ticket.type === 'feature_request' ? 'Feature Request' : ticket.type}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Status: {ticket.status}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Priority: {ticket.priority}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Assigned to: {ticket.assigned_username || 'Unassigned'}
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
                {language === 'tr' ? 'Kullanıcıyı Yasakla' : 'Ban User'}
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
                {language === 'tr' ? 'Yasaklanıyor' : 'Banning'} @{showBanModal.username}
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'tr' ? 'Yasaklama sebebi' : 'Reason for ban'}
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder={language === 'tr' ? 'Yasaklama sebebini girin...' : 'Enter reason for ban...'}
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
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={handleBanUser}
                disabled={!banReason.trim() || banning}
                className="px-4 py-2 bg-red-600 text-white rounded-md font-mono text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {banning ? (language === 'tr' ? 'Yasaklanıyor...' : 'Banning...') : (language === 'tr' ? 'Kullanıcıyı Yasakla' : 'Ban User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mute Modal */}
      {showMuteModal && muteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
                {language === 'tr' ? 'Kullanıcıyı Sustur' : 'Mute User'}
              </h3>
              <button
                onClick={() => setShowMuteModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {language === 'tr' ? 'Susturuluyor' : 'Muting'} @{muteTarget.username}
              </p>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'tr' ? 'Susturma sebebi' : 'Reason for mute'}
                </label>
                <textarea
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  placeholder={language === 'tr' ? 'Susturma sebebini girin...' : 'Enter reason for mute...'}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'tr' ? 'Susturma süresi (saat)' : 'Mute duration (hours)'}
                </label>
                <select
                  value={muteDuration}
                  onChange={(e) => setMuteDuration(Number(e.target.value))}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowMuteModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
              >
                {language === 'tr' ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={() => handleMute(muteTarget.id, muteReason, muteDuration)}
                disabled={!muteReason.trim()}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md font-mono text-sm hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {language === 'tr' ? 'Kullanıcıyı Sustur' : 'Mute User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 