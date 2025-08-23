import { useEffect, useState } from 'react';
import { FCM } from '@capacitor-community/fcm';
import { PushNotifications } from '@capacitor/push-notifications';

export function usePushNotifications() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  const registerForPushNotifications = async () => {
    try {
      // Register for push notifications (Capacitor API)
      await PushNotifications.requestPermissions();
      await PushNotifications.register();

      // Get FCM token
      const result = await FCM.getToken();
      setDeviceToken(result.token);
      setIsRegistered(true);
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  useEffect(() => {
    let receivedListener: any;
    let actionListener: any;

    const setupListeners = async () => {
      try {
        // Listen for notifications - await the Promise to get the listener handle
        receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          console.log('Notification received:', notification);
          // handle notification
        });

        actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
          console.log('Notification action performed:', notification);
          // handle notification tap
        });

        // Register for push notifications on mount
        await registerForPushNotifications();
      } catch (error) {
        console.error('Error setting up push notification listeners:', error);
      }
    };

    setupListeners();

    // Cleanup
    return () => {
      if (receivedListener?.remove) {
        receivedListener.remove();
      }
      if (actionListener?.remove) {
        actionListener.remove();
      }
    };
  }, []);

  return {
    isRegistered,
    deviceToken,
    registerForPushNotifications
  };
}