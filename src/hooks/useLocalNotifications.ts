import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

interface LocalNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: number;
}

export function useLocalNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Request notification permission
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  // Send a local notification
  const sendNotification = async (title: string, body: string, data?: any) => {
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      // Create notification
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data,
        requireInteraction: false,
        silent: false
      });

      // Add to our list
      const newNotification: LocalNotification = {
        id: Date.now().toString(),
        title,
        body,
        data,
        timestamp: Date.now()
      };

      setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep last 10

      // Auto-remove after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Handle navigation based on data
        if (data?.type === 'newMessage') {
          // Navigate to messages
          console.log('Navigate to messages');
        } else if (data?.type === 'randomPost') {
          // Navigate to feed
          console.log('Navigate to feed');
        }
      };

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  // Test notification function
  const sendTestNotification = () => {
    sendNotification(
      'Test Notification', 
      'This is a test notification from Noise Garden!',
      { type: 'test', timestamp: Date.now() }
    );
  };

  // Send different types of notifications
  const sendMessageNotification = (senderName: string) => {
    sendNotification(
      'New Message', 
      `${senderName} sent you a message`,
      { type: 'newMessage', sender: senderName }
    );
  };

  const sendPostNotification = (authorName: string) => {
    sendNotification(
      'New Post', 
      `${authorName} posted something new`,
      { type: 'randomPost', author: authorName }
    );
  };

  const sendMentionNotification = (mentionerName: string) => {
    sendNotification(
      'You were mentioned', 
      `${mentionerName} mentioned you in a post`,
      { type: 'mention', mentioner: mentionerName }
    );
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  // Remove specific notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    // Check permission on mount
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  return {
    notifications,
    permission,
    requestPermission,
    sendNotification,
    sendTestNotification,
    sendMessageNotification,
    sendPostNotification,
    sendMentionNotification,
    clearNotifications,
    removeNotification
  };
} 