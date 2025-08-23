import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '../hooks/useNavigation';
import { getUnreadNotificationCount } from '../lib/database';

export function NotificationCenter() {
  const { user } = useAuth();
  const { setView } = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      // Real-time updates every 5 seconds
      const interval = setInterval(loadUnreadCount, 5000);
      
      // Listen for real-time notification events
      const handleNewNotification = () => {
        loadUnreadCount();
      };
      
      window.addEventListener('newNotification', handleNewNotification);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('newNotification', handleNewNotification);
      };
    }
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;
    
    try {
      const count = await getUnreadNotificationCount(user.userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleBellClick = () => {
    setView('notifications');
  };

  return (
    <button
      onClick={handleBellClick}
      className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
    >
      <Bell size={16} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-mono">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
} 