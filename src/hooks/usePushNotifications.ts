import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

interface NotificationData {
  type: 'newMessage' | 'randomPost' | 'mention' | 'reply' | 'repost' | 'quarantine';
  title: string;
  body: string;
  data?: any;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  const registerForPushNotifications = async () => {
    try {
      // Check if we're on a native platform
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) {
        console.log('Not on native platform, skipping push notifications');
        return;
      }

      const { PushNotifications } = await import('@capacitor/push-notifications');
      
      // Request permission
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive === 'granted') {
        // Register with Apple / Google to receive push notifications
        await PushNotifications.register();
        setIsRegistered(true);
      } else {
        console.warn('Push notification permission not granted');
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  const sendTokenToServer = async (token: string) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'registerDeviceToken',
          args: { 
            deviceToken: token,
            platform: 'android' // or detect platform
          }
        })
      });

      if (response.ok) {
        console.log('Device token sent to server successfully');
        setDeviceToken(token);
      } else {
        console.error('Failed to send device token to server');
      }
    } catch (error) {
      console.error('Error sending device token:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    const setupPushNotifications = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) {
          return;
        }

        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Set up listeners
        PushNotifications.addListener('registration', (token) => {
          console.log('Registration token:', token.value);
          sendTokenToServer(token.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Registration error:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
          // Handle notification when app is in foreground
          // Trigger real-time notification event for web
          if (typeof window !== 'undefined') {
            const data = notification.data;
            if (data?.type) {
              window.dispatchEvent(new CustomEvent('newNotification', { 
                detail: { type: data.type } 
              }));
            }
          }
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed:', notification);
          // Handle notification when user taps on it
          const data = notification.notification.data;
          
          // Trigger real-time notification event for web
          if (typeof window !== 'undefined') {
            if (data?.type) {
              window.dispatchEvent(new CustomEvent('newNotification', { 
                detail: { type: data.type } 
              }));
            }
          }
          
          // Navigate based on notification type (if needed)
          if (data?.type === 'newMessage') {
            // Navigate to messages
            // setView('messages');
          } else if (data?.type === 'randomPost') {
            // Navigate to feed
            // setView('feed');
          } else if (data?.type === 'mention') {
            // Navigate to mentions
            // setView('mentions');
          }
        });

        // Register for notifications when user is logged in
        registerForPushNotifications();

        // Cleanup listeners on unmount
        return () => {
          PushNotifications.removeAllListeners();
        };
      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    };

    setupPushNotifications();
  }, [user]);

  return {
    isRegistered,
    deviceToken,
    registerForPushNotifications
  };
} 