// This service will handle sending notifications
// In a real app, you'd use Firebase Cloud Messaging (FCM) from your backend

export interface NotificationPayload {
  title: string;
  body: string;
  data?: {
    type: 'newMessage' | 'randomPost' | 'mention' | 'reply' | 'repost' | 'quarantine';
    [key: string]: any;
  };
}

export class NotificationService {
  // Send notification to specific user
  static async sendToUser(userId: string, payload: NotificationPayload) {
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'sendNotificationToUser',
          args: { userId, payload }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      // Trigger real-time notification event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('newNotification', { 
          detail: { type: payload.data?.type || 'notification' } 
        }));
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Send notification to all users (for random posts)
  static async sendToAllUsers(payload: NotificationPayload) {
    try {
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'sendNotificationToAllUsers',
          args: { payload }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      // Trigger real-time notification event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('newNotification', { 
          detail: { type: payload.data?.type || 'notification' } 
        }));
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Test notification (for development)
  static async sendTestNotification() {
    return this.sendToAllUsers({
      title: 'Test Notification',
      body: 'This is a test notification from Noise Garden!',
      data: {
        type: 'randomPost',
        test: true
      }
    });
  }

  // Real-time notification helpers
  static triggerRealTimeNotification(type: 'reply' | 'repost' | 'mention' | 'quarantine') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('newNotification', { detail: { type } }));
    }
  }

  // Update notification count in real-time
  static updateNotificationCount() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notificationCountChanged'));
    }
  }
} 