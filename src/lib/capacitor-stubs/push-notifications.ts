// Stub implementation for @capacitor/push-notifications in web environment
export const PushNotifications = {
  requestPermissions: async () => {
    console.log('PushNotifications.requestPermissions() called in web environment');
    return { receive: 'granted' };
  },
  register: async () => {
    console.log('PushNotifications.register() called in web environment');
  },
  addListener: (eventName: string, callback: Function) => {
    console.log(`PushNotifications.addListener(${eventName}) called in web environment`);
    // Return a dummy listener ID
    return { remove: () => {} };
  },
  removeAllListeners: () => {
    console.log('PushNotifications.removeAllListeners() called in web environment');
  }
}; 