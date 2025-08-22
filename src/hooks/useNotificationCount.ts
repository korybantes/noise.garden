import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getUnreadNotificationCount } from '../lib/database';

export function useNotificationCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const loadCount = async () => {
      try {
        const count = await getUnreadNotificationCount(user.userId);
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to load notification count:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(loadCount, 30000);
    
    // Listen for notification count changes
    const handleNotificationCountChanged = () => {
      loadCount();
    };
    window.addEventListener('notificationCountChanged', handleNotificationCountChanged);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationCountChanged', handleNotificationCountChanged);
    };
  }, [user]);

  const refreshCount = async () => {
    if (!user) return;
    
    try {
      const count = await getUnreadNotificationCount(user.userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to refresh notification count:', error);
    }
  };

  return {
    unreadCount,
    loading,
    refreshCount
  };
} 