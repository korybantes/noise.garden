import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { LocalNotifications } from '@capacitor/local-notifications';

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
    try {
      // Use Capacitor LocalNotifications for Android
      const result = await LocalNotifications.requestPermissions();
      if (result.display === 'granted') {
        setPermission('granted');
        return true;
      } else {
        setPermission('denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  // Send a local notification using Capacitor
  const sendNotification = async (title: string, body: string, data?: any) => {
    try {
      // Request permission if not granted
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return;
      }

      // Create notification using Capacitor
      const notification = await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: title,
            body: body,
            data: data,
            sound: 'default',
            schedule: { at: new Date(Date.now() + 100) } // Send in 100ms
          }
        ]
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

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  // Test notification function
  const sendTestNotification = async () => {
    await sendNotification(
      'Test Notification', 
      'This is a test notification from Noise Garden!',
      { type: 'test', timestamp: Date.now() }
    );
  };

  // Send different types of notifications
  const sendMessageNotification = async (senderName: string) => {
    await sendNotification(
      'New Message', 
      `${senderName} sent you a message`,
      { type: 'newMessage', sender: senderName }
    );
  };

  const sendPostNotification = async (authorName: string) => {
    await sendNotification(
      'New Post', 
      `${authorName} posted something new`,
      { type: 'randomPost', author: authorName }
    );
  };

  const sendMentionNotification = async (mentionerName: string) => {
    await sendNotification(
      'You were mentioned', 
      `${mentionerName} mentioned you in a post`,
      { type: 'mention', mentioner: mentionerName }
    );
  };

  // Clear all notifications
  const clearNotifications = async () => {
    try {
      await LocalNotifications.clear();
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Remove specific notification
  const removeNotification = async (id: string) => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: parseInt(id) }] });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  };

  useEffect(() => {
    // Check permission on mount
    const checkPermission = async () => {
      try {
        const result = await LocalNotifications.checkPermissions();
        if (result.display === 'granted') {
          setPermission('granted');
        } else if (result.display === 'denied') {
          setPermission('denied');
        } else {
          setPermission('default');
        }
      } catch (error) {
        console.error('Error checking notification permission:', error);
      }
    };

    checkPermission();
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