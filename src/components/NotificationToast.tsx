import { useState, useEffect } from 'react';
import { Bell, X, Reply, Repeat, AtSign, EyeOff } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { loadFeedSettings } from '../lib/settings';

interface NotificationToastProps {
  onClose: () => void;
}

export function NotificationToast({ onClose }: NotificationToastProps) {
  const { language } = useLanguage();
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'reply' | 'repost' | 'mention' | 'quarantine';
    from_username: string;
    message: string;
  }>>([]);
  const [popupsMuted, setPopupsMuted] = useState(false);

  useEffect(() => {
    // Check privacy settings
    const checkPrivacySettings = () => {
      try {
        const settings = loadFeedSettings();
        const privacy = (settings as any).privacy || {};
        setPopupsMuted(!!privacy.muteNotificationPopups);
      } catch (error) {
        console.error('Failed to load privacy settings:', error);
      }
    };

    checkPrivacySettings();

    // Listen for privacy setting changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feed_settings') {
        checkPrivacySettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for changes
    const interval = setInterval(checkPrivacySettings, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleNewNotification = (event: CustomEvent) => {
      // Don't show popups if they're muted
      if (popupsMuted) return;
      
      const type = event.detail?.type;
      if (!type) return;

      const newNotification = {
        id: Date.now().toString(),
        type,
        from_username: 'Someone',
        message: getNotificationMessage(type, 'Someone')
      };

      setNotifications(prev => [newNotification, ...prev.slice(0, 2)]); // Keep only last 3

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, 5000);
    };

    window.addEventListener('newNotification', handleNewNotification as EventListener);

    return () => {
      window.removeEventListener('newNotification', handleNewNotification as EventListener);
    };
  }, [popupsMuted]);

  const getNotificationMessage = (type: string, username: string) => {
    switch (type) {
      case 'reply':
        return language === 'tr' 
          ? `${username} gönderinize yanıt verdi`
          : `${username} replied to your post`;
      case 'repost':
        return language === 'tr'
          ? `${username} gönderinizi yeniden paylaştı`
          : `${username} reposted your post`;
      case 'mention':
        return language === 'tr'
          ? `${username} sizi etiketledi`
          : `${username} mentioned you`;
      case 'quarantine':
        return language === 'tr'
          ? 'Gönderiniz moderasyon tarafından inceleniyor'
          : 'Your post is under review by moderation';
      default:
        return language === 'tr' ? 'Yeni bildirim' : 'New notification';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reply': return <Reply size={16} />;
      case 'repost': return <Repeat size={16} />;
      case 'mention': return <AtSign size={16} />;
      case 'quarantine': return <EyeOff size={16} />;
      default: return <Bell size={16} />;
    }
  };

  // Don't render anything if popups are muted
  if (popupsMuted || notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-4 max-w-sm animate-in slide-in-from-right-2 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
