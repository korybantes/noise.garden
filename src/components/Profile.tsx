import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserPostsByUsername, Post as PostType, getUserByUsername, getInviterForUser, isUserBanned, getPostById, muteUser, unmuteUser, isUserMuted } from '../lib/database';
import { useNavigation } from '../hooks/useNavigation';
import { Post } from './Post';
import { ShieldCheck, ShieldAlert, Link2, MicOff, Mic, Bell, MessageSquare, AtSign } from 'lucide-react';
import { useRouter } from '../hooks/useRouter';
import { useLanguage } from '../hooks/useLanguage';
import { useLocalNotifications } from '../hooks/useLocalNotifications';
import { ENABLE_PULL_TO_REFRESH } from '../lib/flags';

export function Profile() {
  const { user } = useAuth();
  const { profileUsername, setProfileUsername, setView } = useNavigation();
  const { navigateToPost } = useRouter();
  const { language } = useLanguage();
  const { sendTestNotification, sendMessageNotification, sendPostNotification, sendMentionNotification } = useLocalNotifications();
  const username = profileUsername || user?.username;
  const viewingOwn = username === user?.username;

  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [banned, setBanned] = useState<{ banned: boolean; reason?: string; bannedBy?: string } | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [muted, setMuted] = useState<{ muted: boolean; reason?: string; expiresAt?: Date; mutedBy?: string; mutedByUsername?: string } | null>(null);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(24);
  const [muting, setMuting] = useState(false);
  const [pullToRefresh, setPullToRefresh] = useState({ isPulling: false, distance: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);

  // Detect mobile device and platform
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || 
                           ('ontouchstart' in window) || 
                           (navigator.maxTouchPoints > 0);
      
      // Detect iOS specifically
      const ios = /iphone|ipad|ipod/i.test(userAgent);
      
      setIsMobile(isMobileDevice);
      setIsIOS(ios);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const isNative = Capacitor.isNativePlatform?.() ?? false;
        const platform = Capacitor.getPlatform?.();
        setIsNativeAndroid(isNative && platform === 'android');
      } catch {
        setIsNativeAndroid(false);
      }
    })();
  }, []);

  const load = async (opts?: { silent?: boolean }) => {
    if (!username) return;
    if (!opts?.silent) setLoading(true);
    try {
      const data = await getUserPostsByUsername(username);
      setPosts(data);
      const u = await getUserByUsername(username);
      setAvatarUrl(u?.avatar_url ?? null);
      setBio(u?.bio ?? null);
      setUserRole(u?.role ?? null);
      setJoinedAt(u?.created_at ? new Date(u.created_at).toLocaleDateString() : null);
      if (u?.id) {
        const iv = await getInviterForUser(u.id);
        if (iv?.inviter_username) setInvitedBy(iv.inviter_username);
        const banInfo = await isUserBanned(u.id);
        setBanned(banInfo);
        const muteInfo = await isUserMuted(u.id);
        setMuted(muteInfo);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load({ silent: true });
    const onVis = () => { if (!document.hidden) onFocus(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [username]);

  // Pull-to-refresh functionality (mobile only)
  useEffect(() => {
    if (!isMobile || !ENABLE_PULL_TO_REFRESH) return; // Only enable on mobile devices
    
    let startY = 0;
    let currentY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && window.pageYOffset === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || window.scrollY > 0) return;
      currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY);
      if (distance > 0) {
        setPullToRefresh({ isPulling: true, distance: Math.min(distance, 100) });
      }
    };

    const handleTouchEnd = () => {
      if (pullToRefresh.isPulling && pullToRefresh.distance > 50) {
        load({ silent: false });
      }
      setPullToRefresh({ isPulling: false, distance: 0 });
      isPulling = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart as any);
      document.removeEventListener('touchmove', handleTouchMove as any);
      document.removeEventListener('touchend', handleTouchEnd as any);
    };
  }, [isMobile, pullToRefresh.isPulling, pullToRefresh.distance]);

  const handleDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleMute = async () => {
    if (!user || !username || !muteReason.trim()) return;
    setMuting(true);
    try {
      const targetUser = await getUserByUsername(username);
      if (!targetUser) return;
      
      await muteUser(targetUser.id, muteReason.trim(), user.userId, muteDuration);
      setShowMuteModal(false);
      setMuteReason('');
      setMuteDuration(24);
      
      // Refresh mute status
      const muteInfo = await isUserMuted(targetUser.id);
      setMuted(muteInfo);
    } catch (error) {
      console.error('Failed to mute user:', error);
    } finally {
      setMuting(false);
    }
  };

  const handleUnmute = async () => {
    if (!user || !username) return;
    try {
      const targetUser = await getUserByUsername(username);
      if (!targetUser) return;
      
      await unmuteUser(targetUser.id, user.userId);
      
      // Refresh mute status
      const muteInfo = await isUserMuted(targetUser.id);
      setMuted(muteInfo);
    } catch (error) {
      console.error('Failed to unmute user:', error);
    }
  };

  const RoleBadge = () => {
    if (userRole === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono text-red-600 dark:text-red-400">
          <ShieldCheck size={12} />
          admin
        </span>
      );
    }
    if (userRole === 'moderator') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400">
          <ShieldAlert size={12} />
          moderator
        </span>
      );
    }
    return null;
  };

  if (!username) return null;

  const isSuspended = !!banned?.banned;
  const postCount = posts.length;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 dark:bg-gray-950 pb-20 md:pb-0">
      
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Pull to refresh hint - only show on mobile */}
        {isMobile && (
          <div className="text-center py-2 text-xs text-gray-400 dark:text-gray-500 font-mono">
            {pullToRefresh.isPulling 
              ? pullToRefresh.distance > 50 
                ? 'Release to refresh' 
                : 'Keep pulling...'
              : '↓ Pull down to refresh'
            }
          </div>
        )}
        
        <div className="ng-card p-6">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
            ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
              <div className="font-mono text-lg text-gray-900 dark:text-gray-100">@{username}</div>
                <RoleBadge />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
                <span>{viewingOwn ? 'your posts' : 'public profile'}</span>
                <span>•</span>
                <span>{postCount} posts</span>
                {joinedAt && (
                  <>
                    <span>•</span>
                    <span>joined {joinedAt}</span>
                  </>
                )}
              </div>
              {invitedBy && (
                <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">invited by <button className="underline" onClick={() => { setProfileUsername(invitedBy!); setView('profile'); }}>@{invitedBy}</button></div>
              )}
            </div>
          </div>
          {bio && (
            <div className="mt-3 font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{bio}</div>
          )}
          
          {/* Mobile App Hint */}
          {isMobile && !isNativeAndroid && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <span className="text-sm">📱</span>
                <span className="font-mono text-xs">
                  {isIOS 
                    ? "You're on iOS! We're working on bringing the native app experience to iPhone and iPad. Stay tuned!"
                    : "You're on Android! Get the native app for better experience with push notifications and haptic feedback."
                  }
                </span>
              </div>
              {!isIOS && (
                <button 
                  onClick={() => setView('settings')}
                  className="mt-2 text-xs font-mono text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 underline"
                >
                  Go to Settings → Mobile tab
                </button>
               )}
            </div>
          )}
          
          {/* Notification Testing Section (only show for admins) */}
          {viewingOwn && user?.role === 'admin' && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="font-mono text-sm font-medium text-blue-800 dark:text-blue-200">
                  Test Notifications (Admin Only)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={sendTestNotification}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md font-mono text-xs hover:bg-blue-700 transition-colors"
                >
                  <Bell size={12} />
                  Test
                </button>
                <button
                  onClick={() => sendMessageNotification('John Doe')}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-mono text-xs hover:bg-green-700 transition-colors"
                >
                  <MessageSquare size={12} />
                  Message
                </button>
                <button
                  onClick={() => sendPostNotification('Jane Smith')}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md font-mono text-xs hover:bg-purple-700 transition-colors"
                >
                  <Link2 size={12} />
                  New Post
                </button>
                <button
                  onClick={() => sendMentionNotification('Bob Wilson')}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-md font-mono text-xs hover:bg-orange-700 transition-colors"
                >
                  <AtSign size={12} />
                  Mention
                </button>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                Admin-only: Test different notification types
              </p>
            </div>
          )}
        </div>

        {isSuspended && (
          <div className="p-4 border border-red-200 dark:border-red-900 rounded bg-red-50 dark:bg-red-900/20">
            <div className="text-sm font-mono text-red-700 dark:text-red-300">
              This account has been suspended for breaching community guidelines.
            </div>
            {banned?.reason && (
              <div className="mt-1 text-xs font-mono text-red-600 dark:text-red-400">Reason: {banned.reason}</div>
            )}
          </div>
        )}

        {muted?.muted && (
          <div className="p-4 border border-yellow-200 dark:border-yellow-900 rounded bg-yellow-50 dark:bg-yellow-900/20">
            <div className="text-sm font-mono text-yellow-700 dark:text-yellow-300">
              This user is currently muted.
            </div>
            {muted.reason && (
              <div className="mt-1 text-xs font-mono text-yellow-600 dark:text-yellow-400">Reason: {muted.reason}</div>
            )}
            {muted.expiresAt && (
              <div className="mt-1 text-xs font-mono text-yellow-600 dark:text-yellow-400">Expires: {new Date(muted.expiresAt).toLocaleString()}</div>
            )}
            {muted.mutedByUsername && (
              <div className="mt-1 text-xs font-mono text-yellow-600 dark:text-yellow-400">Muted by: @{muted.mutedByUsername}</div>
            )}
          </div>
        )}

        {/* Mute/Unmute Button for Admins/Mods */}
        {!viewingOwn && user && ['admin', 'moderator'].includes(user.role) && (
          <div className="flex justify-end">
            {muted?.muted ? (
              <button
                onClick={handleUnmute}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-mono text-sm hover:bg-green-700 transition-colors"
              >
                <Mic size={14} />
                {language === 'tr' ? 'Susturmayı Kaldır' : 'Unmute User'}
              </button>
            ) : (
              <button
                onClick={() => setShowMuteModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-md font-mono text-sm hover:bg-yellow-700 transition-colors"
              >
                <MicOff size={14} />
                {language === 'tr' ? 'Kullanıcıyı Sustur' : 'Mute User'}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">loading…</div>
        ) : isSuspended ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">posts are hidden</div>
        ) : posts.length === 0 ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">no posts yet</div>
        ) : (
          <div className="space-y-4">
            {posts.map(p => (
              <div key={p.id} className="space-y-2">
                {/* Show quote of parent if this is a reply */}
                {p.parent_id && (
                  <ParentQuote parentId={p.parent_id} onView={(id) => { setView('feed'); navigateToPost(id); }} />
                )}
                <Post post={p} onReply={() => {}} onDeleted={handleDeleted} isReply={!!p.parent_id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mute Modal */}
      {showMuteModal && (
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
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {language === 'tr' ? 'Susturuluyor' : 'Muting'} @{username}
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
                onClick={handleMute}
                disabled={!muteReason.trim() || muting}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md font-mono text-sm hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {muting ? (language === 'tr' ? 'Susturuluyor...' : 'Muting...') : (language === 'tr' ? 'Kullanıcıyı Sustur' : 'Mute User')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ParentQuote({ parentId, onView }: { parentId: string; onView: (id: string) => void }) {
  const [parent, setParent] = useState<PostType | null>(null);
  useEffect(() => { (async () => { setParent(await getPostById(parentId)); })(); }, [parentId]);
  if (!parent) return null;
  return (
    <div className="p-2 border border-gray-200 dark:border-gray-800 rounded bg-gray-50 dark:bg-gray-900 flex items-start gap-2">
      <div className="text-xs font-mono text-gray-500 dark:text-gray-400 flex-1 truncate">
        <span className="mr-2">replying to @{parent.username}</span>
        <span className="block text-gray-700 dark:text-gray-300 truncate">{parent.content}</span>
      </div>
      <button onClick={() => onView(parent.id)} className="inline-flex items-center gap-1 text-xs font-mono underline text-gray-700 dark:text-gray-300">
        <Link2 size={12} /> view
      </button>
    </div>
  );
} 