import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

export function useRealTimeNotifications() {
  const { user } = useAuth();

  const triggerNotification = useCallback((type: 'reply' | 'repost' | 'mention' | 'quarantine') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('newNotification', { detail: { type } }));
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const handleNewNotification = (event: CustomEvent) => {
      // You can add custom logic here for different notification types
      console.log('New notification received:', event.detail);
    };

    window.addEventListener('newNotification', handleNewNotification as EventListener);

    return () => {
      window.removeEventListener('newNotification', handleNewNotification as EventListener);
    };
  }, [user]);

  return { triggerNotification };
}

