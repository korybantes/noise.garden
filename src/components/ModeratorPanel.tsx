import { useState, useEffect } from 'react';
import { X, Flag, Eye, EyeOff, Unlock, RefreshCw, ShieldAlert, MicOff, Mic } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getBannedUsers, banUser, unbanUser, muteUser, unmuteUser, getMutedUsers } from '../lib/database';
import { useLanguage } from '../hooks/useLanguage';

interface ModeratorPanelProps {
  onClose: () => void;
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
  role?: string;
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

export function ModeratorPanel({ onClose }: ModeratorPanelProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'reports' | 'banned' | 'muted'>('reports');
  const [showBanModal, setShowBanModal] = useState<{ show: boolean; userId: string; username: string }>({ show: false, userId: '', username: '' });
  const [banReason, setBanReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [mutedUsers, setMutedUsers] = useState<Array<{
    id: string;
    username: string;
    reason: string;
    expiresAt: Date;
    mutedBy: string;
    mutedByUsername: string;
  }>>([]);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [muteTarget, setMuteTarget] = useState<{ id: string; username: string } | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(24);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [bannedData, mutedData, flaggedData] = await Promise.all([
        getBannedUsers(user.userId),
        getMutedUsers(user.userId),
        loadFlaggedPosts()
      ]);
      setBannedUsers(bannedData);
      setMutedUsers(mutedData);
      setFlaggedPosts(flaggedData);
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

  const handleBanUser = async () => {
    if (!user || !banReason.trim()) return;
    setBanning(true);
    try {
      await banUser(showBanModal.userId, banReason.trim(), user.userId);
      // Refresh data
      await loadData();
      setShowBanModal({ show: false, userId: '', username: '' });
      setBanReason('');
      setSuccessMessage('User banned successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
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
      setSuccessMessage('User unbanned successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
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

  const openMuteModal = (userItem: { id: string; username: string }) => {
    setMuteTarget(userItem);
    setShowMuteModal(true);
  };

  if (!user || user.role !== 'moderator') {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
        <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="font-mono text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                {language === 'tr' ? 'Moderatör Paneli' : 'Moderator Panel'}
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

            {/* Reports Section */}
            {activeTab === 'reports' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-mono text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {language === 'tr' ? 'İşaretlenen Gönderiler' : 'Flagged Posts'}
                  </h3>
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-xs sm:text-sm transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={`sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                    {language === 'tr' ? 'yenile' : 'refresh'}
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">
                    {language === 'tr' ? 'raporlar yükleniyor...' : 'loading reports...'}
                  </div>
                ) : flaggedPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">
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
                              {post.flag_count} {language === 'tr' ? 'işaret' : 'flags'}
                            </span>
                            {post.is_quarantined ? (
                              <span className="text-xs font-mono bg-red-600 text-white px-2 py-1 rounded">
                                {language === 'tr' ? 'Karantinada' : 'Quarantined'}
                              </span>
                            ) : (
                              <span className="text-xs font-mono bg-yellow-600 text-white px-2 py-1 rounded">
                                {language === 'tr' ? 'İncelemede' : 'Under Review'}
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
                              {language === 'tr' ? 'Gönderiye yanıt' : 'Reply to post'} #{post.parent_id.slice(0, 8)}...
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {post.reply_count > 0 ? `${post.reply_count} ${language === 'tr' ? 'yanıt' : 'replies'}` : ''} {post.reply_count > 0 && post.repost_count > 0 ? '•' : ''} {post.repost_count > 0 ? `${post.repost_count} ${language === 'tr' ? 'yeniden paylaşım' : 'reposts'}` : ''}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {post.is_quarantined ? (
                              <button
                                onClick={() => handleUnquarantinePost(post.id)}
                                className="text-xs font-mono bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                title={language === 'tr' ? 'Gönderiyi karantinadan çıkar' : 'Unquarantine post'}
                              >
                                <Eye size={12} />
                                {language === 'tr' ? 'Karantinadan Çıkar' : 'Unquarantine'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleQuarantinePost(post.id)}
                                className="text-xs font-mono bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                                title={language === 'tr' ? 'Gönderiyi karantinaya al' : 'Quarantine post'}
                              >
                                <EyeOff size={12} />
                                {language === 'tr' ? 'Karantinaya Al' : 'Quarantine'}
                              </button>
                            )}
                            
                            <button
                              onClick={() => openMuteModal({ id: post.user_id, username: post.username })}
                              className="text-xs font-mono bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700 transition-colors"
                              title={language === 'tr' ? 'Kullanıcıyı sustur' : 'Mute user'}
                            >
                              <MicOff size={12} />
                              {language === 'tr' ? 'Sustur' : 'Mute'}
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
                <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {language === 'tr' ? 'Yasaklı Kullanıcılar' : 'Banned Users'}
                </h3>
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
                            {language === 'tr' ? 'yasaklandı' : 'banned'} {new Date(bannedUser.bannedAt).toLocaleDateString()} {language === 'tr' ? 'tarafından' : 'by'} @{bannedUser.bannedBy}
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

            {activeTab === 'banned' && bannedUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">
                {language === 'tr' ? 'Yasaklı kullanıcı bulunamadı' : 'No banned users found'}
              </div>
            )}

            {/* Muted Users Section */}
            {activeTab === 'muted' && mutedUsers.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {language === 'tr' ? 'Susturulmuş Kullanıcılar' : 'Muted Users'}
                </h3>
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