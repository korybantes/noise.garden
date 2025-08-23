import { useState, useEffect, useRef } from 'react';
import { Bell, MessageSquare, Reply, Repeat, AtSign, ArrowLeft, Eye, EyeOff, Lock, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigation } from '../hooks/useNavigation';
import { hapticLight } from '../lib/haptics';
import { getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount } from '../lib/database';
import { ENABLE_PULL_TO_REFRESH } from '../lib/flags';

interface Notification {
  id: string;
  type: 'reply' | 'repost' | 'mention' | 'quarantine' | 'whisper';
  post_id: string;
  from_user_id: string;
  from_username: string;
  created_at: Date;
  read: boolean;
  post_content?: string;
  post_avatar_url?: string;
  post_created_at?: Date;
  post_username?: string; // Add post author username
  repost_count?: number;
  reply_count?: number;
  // Original post fields for context
  original_post_content?: string;
  original_post_username?: string;
  original_post_created_at?: Date;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { setView } = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set());
  const [pullToRefresh, setPullToRefresh] = useState({ isPulling: false, distance: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [seenNotifications, setSeenNotifications] = useState<Set<string>>(new Set());
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || 
                           ('ontouchstart' in window) || 
                           (navigator.maxTouchPoints > 0);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Auto-mark all notifications as read when opening the page
      // markAllAsRead(); // Temporarily disabled for debugging
      
      // Real-time updates every 5 seconds
      const interval = setInterval(loadNotifications, 5000);
      
      // Listen for real-time notification events
      const handleNewNotification = () => {
        loadNotifications();
      };
      
      window.addEventListener('newNotification', handleNewNotification);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('newNotification', handleNewNotification);
      };
    }
  }, [user]);

  // Pull-to-refresh via downward swipe at top (mobile only)
  useEffect(() => {
    if (!isMobile || !ENABLE_PULL_TO_REFRESH) return;
    
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    let pullTimeout: number | null = null;

    const pullStateRef = { get: () => pullToRefresh, set: (v: any) => setPullToRefresh(v) };

    const resetPullState = () => {
      pullStateRef.set({ isPulling: false, distance: 0 });
      isPulling = false;
      if (pullTimeout) {
        window.clearTimeout(pullTimeout);
        pullTimeout = null;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger when at the very top of the page
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
        // Add resistance to the pull (make it feel more natural)
        const resistedDistance = distance * 0.6;
        pullStateRef.set({ isPulling: true, distance: Math.min(resistedDistance, 120) });
      }
    };

    const handleTouchEnd = () => {
      const state = pullStateRef.get();
      if (state.isPulling && state.distance > 60) {
        // Trigger refresh with haptic feedback
        hapticLight();
        loadNotifications();
      }
      resetPullState();
    };

    // Touch events for mobile only
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart as any);
      document.removeEventListener('touchmove', handleTouchMove as any);
      document.removeEventListener('touchend', handleTouchEnd as any);
      resetPullState();
    };
  }, [isMobile]);

  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      const [notificationsData, unreadCountData] = await Promise.all([
        getNotifications(user.userId, 50),
        getUnreadNotificationCount(user.userId)
      ]);
      
      // Group notifications by type and post_id for stacking
      const groupedNotifications = groupNotifications(notificationsData);
      
      // Track which notifications are new (not seen before)
      const newNotifications = new Set<string>();
      groupedNotifications.forEach(notification => {
        if (!seenNotifications.has(notification.id)) {
          newNotifications.add(notification.id);
        }
      });
      
      setNotifications(groupedNotifications);
      setUnreadCount(unreadCountData);
      
      // Update seen notifications
      setSeenNotifications(prev => new Set([...prev, ...newNotifications]));
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupNotifications = (notifications: Notification[]): Notification[] => {
    const grouped = new Map<string, Notification>();
    
    notifications.forEach(notification => {
      const key = `${notification.type}_${notification.post_id}`;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        if (notification.type === 'repost') {
          existing.repost_count = (existing.repost_count || 1) + 1;
        } else if (notification.type === 'reply') {
          existing.reply_count = (existing.reply_count || 1) + 1;
        } else if (notification.type === 'whisper') {
          existing.reply_count = (existing.reply_count || 1) + 1;
        }
        // Keep the most recent notification
        if (new Date(notification.created_at) > new Date(existing.created_at)) {
          existing.created_at = notification.created_at;
          existing.from_username = notification.from_username;
        }
      } else {
        grouped.set(key, { ...notification, repost_count: 1, reply_count: 1 });
      }
    });
    
    return Array.from(grouped.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);

      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Notify header to refresh notification count
      window.dispatchEvent(new CustomEvent('notificationCountChanged'));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await markAllNotificationsRead(user.userId);

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      
      // Notify header to refresh notification count
      window.dispatchEvent(new CustomEvent('notificationCountChanged'));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Toggle expansion for post preview
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notification.id)) {
        newSet.delete(notification.id);
      } else {
        newSet.add(notification.id);
      }
      return newSet;
    });
    
    // Haptic feedback
    await hapticLight();
  };

  const toggleExpanded = (notificationId: string) => {
    setExpandedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const handleQuickReply = (notification: Notification) => {
    // Navigate to the post to reply
    if (notification.post_id) {
      // For now, we'll navigate to the feed and scroll to the post
      // You can implement a more direct navigation later
      setView('feed');
      // Dispatch event to scroll to specific post
      window.dispatchEvent(new CustomEvent('scrollToPost', { 
        detail: { postId: notification.post_id } 
      }));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reply': return <Reply size={16} />;
      case 'repost': return <Repeat size={16} />;
      case 'mention': return <AtSign size={16} />;
      case 'quarantine': return <EyeOff size={16} />;
      case 'whisper': return <Lock size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    const baseText = (() => {
      switch (notification.type) {
        case 'reply':
          return language === 'tr' 
            ? `@${notification.from_username} gönderinize yanıt verdi`
            : `@${notification.from_username} replied to your post`;
        case 'repost':
          if (notification.repost_count && notification.repost_count > 1) {
            return language === 'tr'
              ? `${notification.repost_count} kişi gönderinizi yeniden paylaştı`
              : `${notification.repost_count} people reposted your post`;
          }
          return language === 'tr'
            ? `@${notification.from_username} gönderinizi yeniden paylaştı`
            : `@${notification.from_username} reposted your post`;
        case 'mention':
          return language === 'tr'
            ? `@${notification.from_username} sizi etiketledi`
            : `@${notification.from_username} mentioned you`;
        case 'whisper':
          return language === 'tr'
            ? `@${notification.from_username} gönderinize fısıldadı`
            : `@${notification.from_username} whispered to your post`;
        case 'quarantine':
          return language === 'tr'
            ? `Gönderiniz moderasyon tarafından inceleniyor`
            : `Your post is under review by moderation`;
        default:
          return '';
      }
    })();

    // Add count indicators
    if (notification.reply_count && notification.reply_count > 1) {
      const replyText = language === 'tr' 
        ? ` (${notification.reply_count} yanıt)`
        : ` (${notification.reply_count} replies)`;
      return baseText + replyText;
    }

    return baseText;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return language === 'tr' ? 'az önce' : 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return language === 'tr' ? `${minutes} dakika önce` : `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return language === 'tr' ? `${hours} saat önce` : `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return language === 'tr' ? `${days} gün önce` : `${days}d ago`;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 md:pb-0">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="w-full max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setView('feed')}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-blue-600" />
                <h1 className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {language === 'tr' ? 'Bildirimler' : 'Notifications'}
                </h1>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-mono font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="flex items-center gap-2 text-xs font-mono text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {language === 'tr' ? 'Yenile' : 'Refresh'}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  {language === 'tr' ? 'Tümünü okundu işaretle' : 'Mark all read'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-2xl mx-auto px-4 py-4" ref={containerRef}>
        {/* Enhanced Pull to refresh indicator - only show on mobile */}
        {isMobile && (
          <div className={`text-center py-3 transition-all duration-200 ease-out ${
            pullToRefresh.isPulling ? 'opacity-100' : 'opacity-60'
          }`}>
            <div className="flex items-center justify-center gap-2 text-sm font-mono">
              <RefreshCw 
                size={16} 
                className={`transition-transform duration-200 ${
                  pullToRefresh.isPulling 
                    ? pullToRefresh.distance > 60 
                      ? 'text-green-600 dark:text-green-400 rotate-180' 
                      : 'text-gray-600 dark:text-gray-400'
                    : 'text-gray-400 dark:text-gray-500'
                } ${loading ? 'animate-spin' : ''}`}
              />
              <span className={`transition-colors duration-200 ${
                pullToRefresh.isPulling 
                  ? pullToRefresh.distance > 60 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                {pullToRefresh.isPulling 
                  ? pullToRefresh.distance > 60 
                    ? 'Release to refresh' 
                    : 'Keep pulling...'
                  : '↓ Pull down to refresh'
                }
              </span>
            </div>
            {/* Progress bar */}
            {pullToRefresh.isPulling && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-blue-500 dark:bg-blue-400 h-1 rounded-full transition-all duration-200 ease-out"
                  style={{ 
                    width: `${Math.min((pullToRefresh.distance / 60) * 100, 100)}%`,
                    backgroundColor: pullToRefresh.distance > 60 ? '#10b981' : '#3b82f6'
                  }}
                />
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
            <span className="ml-3 font-mono text-gray-600 dark:text-gray-400">
              {language === 'tr' ? 'Yükleniyor...' : 'Loading...'}
            </span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <p className="font-mono text-gray-500 dark:text-gray-400">
              {language === 'tr' ? 'Henüz bildiriminiz yok' : 'No notifications yet'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              {language === 'tr' 
                ? 'Yeni bildirimler geldiğinde burada görünecek'
                : 'New notifications will appear here'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden transition-all duration-300 ${
                  !notification.read ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                } ${
                  seenNotifications.has(notification.id) && !notification.read 
                    ? 'ring-2 ring-green-500 dark:ring-green-400 shadow-lg' 
                    : ''
                }`}
              >
                {/* Notification Header */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 p-2 rounded-full ${
                      !notification.read 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {getNotificationText(notification)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                </div>

                {/* Post Preview (Expandable) */}
                {notification.post_content && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => toggleExpanded(notification.id)}
                      className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          {language === 'tr' ? 'Yanıtı ve gönderiyi göster' : 'Show reply & post'}
                        </span>
                        {expandedNotifications.has(notification.id) ? (
                          <EyeOff size={14} className="text-gray-500" />
                        ) : (
                          <Eye size={14} className="text-gray-500" />
                        )}
                      </div>
                    </button>
                    
                    {expandedNotifications.has(notification.id) && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 space-y-4">
                        {/* Original Post (What was replied to) */}
                        {notification.original_post_content && (
                          <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                {language === 'tr' ? 'Orijinal gönderi:' : 'Original post:'}
                              </span>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    @{notification.original_post_username || user.username}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {notification.original_post_created_at && formatTimeAgo(notification.original_post_created_at)}
                                  </span>
                                </div>
                                <p className="font-mono text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                  {notification.original_post_content}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Reply Content */}
                        <div className="flex items-start gap-3">
                          {notification.post_avatar_url ? (
                            <img
                              src={notification.post_avatar_url.replace('/upload/', '/upload/f_auto,q_auto,w_32,h_32,c_fill,g_face/')}
                              alt="avatar"
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                                @{notification.post_username || user.username}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {notification.post_created_at && formatTimeAgo(notification.post_created_at)}
                              </span>
                            </div>
                            <p className="font-mono text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                              {notification.post_content}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Action buttons */}
                <div className="flex gap-2 p-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className="flex-1 px-3 py-2 text-xs font-mono font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {language === 'tr' ? 'Okundu' : 'Mark Read'}
                  </button>
                  {notification.post_content && (
                    <button
                      onClick={() => toggleExpanded(notification.id)}
                      className="flex-1 px-3 py-2 text-xs font-mono font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {expandedNotifications.has(notification.id) 
                        ? (language === 'tr' ? 'Gizle' : 'Hide')
                        : (language === 'tr' ? 'Göster' : 'Show')
                      }
                    </button>
                  )}
                  {/* Quick Reply Button */}
                  <button
                    onClick={() => handleQuickReply(notification)}
                    className="flex-1 px-3 py-2 text-xs font-mono font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                  >
                    {language === 'tr' ? 'Yanıtla' : 'Reply'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 