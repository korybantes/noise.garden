import { useState, useEffect } from 'react';
import { Bell, X, MessageSquare, Reply, Repeat, AtSign, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigation } from '../hooks/useNavigation';
import { useRouter } from '../hooks/useRouter';
import { hapticLight } from '../lib/haptics';
import { getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount } from '../lib/database';

interface Notification {
  id: string;
  type: 'reply' | 'repost' | 'mention';
  post_id: string;
  from_user_id: string;
  from_username: string;
  created_at: Date;
  read: boolean;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { setView } = useNavigation();
  const { navigateToPost } = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Poll for new notifications every 10 seconds (more responsive)
      const interval = setInterval(loadNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      const [notificationsData, unreadCountData] = await Promise.all([
        getNotifications(user.userId, 50),
        getUnreadNotificationCount(user.userId)
      ]);
      
      setNotifications(notificationsData);
      setUnreadCount(unreadCountData);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
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
    
    // Navigate to the post
    navigateToPost(notification.post_id);
    
    // Haptic feedback
    await hapticLight();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reply': return <Reply size={16} />;
      case 'repost': return <Repeat size={16} />;
      case 'mention': return <AtSign size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'reply':
        return language === 'tr' 
          ? `@${notification.from_username} gönderinize yanıt verdi`
          : `@${notification.from_username} replied to your post`;
      case 'repost':
        return language === 'tr'
          ? `@${notification.from_username} gönderinizi yeniden paylaştı`
          : `@${notification.from_username} reposted your post`;
      case 'mention':
        return language === 'tr'
          ? `@${notification.from_username} sizi etiketledi`
          : `@${notification.from_username} mentioned you`;
      default:
        return '';
    }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
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

      {/* Content */}
      <div className="w-full max-w-2xl mx-auto px-4 py-4">
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
          <div className="space-y-2">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full p-4 text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  !notification.read ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                }`}
              >
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
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 