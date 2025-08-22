import { useState } from 'react';
import { Bell, X, MessageSquare, AtSign, Link2, Clock } from 'lucide-react';
import { useLocalNotifications } from '../hooks/useLocalNotifications';
import { useLanguage } from '../hooks/useLanguage';

export function NotificationCenter() {
  const { notifications, clearNotifications, removeNotification } = useLocalNotifications();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  if (notifications.length === 0) return null;

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'newMessage':
        return <MessageSquare size={16} className="text-green-600" />;
      case 'randomPost':
        return <Link2 size={16} className="text-purple-600" />;
      case 'mention':
        return <AtSign size={16} className="text-orange-600" />;
      default:
        return <Bell size={16} className="text-blue-600" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <>
      {/* Notification Bell with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-mono">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-96 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-mono font-medium text-gray-900 dark:text-gray-100">
                {language === 'tr' ? 'Bildirimler' : 'Notifications'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearNotifications}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {language === 'tr' ? 'Temizle' : 'Clear all'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-80">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-3 p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.data?.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                          {notification.title}
                        </p>
                        <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {notifications.length === 0 && (
              <div className="p-8 text-center">
                <Bell size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                  {language === 'tr' ? 'Henüz bildirim yok' : 'No notifications yet'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
} 