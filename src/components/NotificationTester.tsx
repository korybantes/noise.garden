import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useLocalNotifications } from '../hooks/useLocalNotifications';
import { Bell, MessageSquare, AtSign, Link2, Smartphone, Globe, AlertCircle, CheckCircle } from 'lucide-react';
import { FCM } from '@capacitor-community/fcm';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export function NotificationTester() {
  const { user } = useAuth();
  const { isRegistered, deviceToken, registerForPushNotifications } = usePushNotifications();
  const { sendTestNotification, sendMessageNotification, sendPostNotification, sendMentionNotification } = useLocalNotifications();
  
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<string>('');
  const [notificationPermission, setNotificationPermission] = useState<string>('');
  const [fcmToken, setFcmToken] = useState<string>('');
  const [testResults, setTestResults] = useState<Array<{ type: string; success: boolean; message: string; timestamp: Date }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Immediate Android detection
  useEffect(() => {
    console.log('🔍 DEBUG: Component mounted');
    console.log('🔍 DEBUG: navigator.userAgent:', navigator.userAgent);
    console.log('🔍 DEBUG: Capacitor.isNativePlatform():', Capacitor.isNativePlatform?.());
    console.log('🔍 DEBUG: Capacitor.getPlatform():', Capacitor.getPlatform?.());
    
    // Check if we're in a native Android environment
    const isNativePlatform = Capacitor.isNativePlatform?.() ?? false;
    const currentPlatform = Capacitor.getPlatform?.() ?? 'web';
    const isAndroidUserAgent = navigator.userAgent.includes('Android');
    
    if (isNativePlatform || currentPlatform === 'android' || isAndroidUserAgent) {
      console.log('🚀 Native Android platform detected');
      setIsNative(true);
      setPlatform('android');
      
      // Auto-request permission for Android
      setTimeout(() => {
        console.log('🔍 DEBUG: Auto-requesting permission...');
        requestPermission();
      }, 1000);
    } else {
      console.log('🌐 Web platform detected');
      setIsNative(false);
      setPlatform('web');
      
      // Check web notification permission
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  // Force native detection function
  const forceNativeDetection = async () => {
    console.log('🔧 FORCE NATIVE DETECTION TRIGGERED');
    
    try {
      // Force platform detection
      const isNativePlatform = Capacitor.isNativePlatform?.() ?? false;
      const currentPlatform = Capacitor.getPlatform?.() ?? 'web';
      
      console.log('🔍 DEBUG: Capacitor.isNativePlatform():', isNativePlatform);
      console.log('🔍 DEBUG: Capacitor.getPlatform():', currentPlatform);
      console.log('🔍 DEBUG: User Agent:', navigator.userAgent);
      
      // Force Android detection if we're in Android environment
      if (navigator.userAgent.includes('Android') || currentPlatform === 'android' || isNativePlatform) {
        setIsNative(true);
        setPlatform('android');
        
        // Force permission request
        console.log('🔍 DEBUG: Forcing permission request...');
        await requestPermission();
      } else {
        setIsNative(false);
        setPlatform('web');
      }
      
    } catch (error) {
      console.error('🔍 DEBUG: Error in force detection:', error);
      addTestResult('Debug', false, `Force detection error: ${error}`);
    }
  };

  useEffect(() => {
    // Update FCM token when deviceToken changes
    if (deviceToken) {
      setFcmToken(deviceToken);
      console.log('🔍 DEBUG: FCM token updated:', deviceToken);
    }
  }, [deviceToken]);

  const addTestResult = (type: string, success: boolean, message: string) => {
    setTestResults(prev => [{
      type,
      success,
      message,
      timestamp: new Date()
    }, ...prev.slice(0, 9)]); // Keep only last 10 results
  };

  const testWebNotification = async () => {
    if (!('Notification' in window)) {
      addTestResult('Web Notification', false, 'Notifications not supported in this browser');
      return;
    }

    if (Notification.permission !== 'granted') {
      addTestResult('Web Notification', false, 'Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification('Test Notification', {
        body: 'This is a test notification from Noise Garden!',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'test-notification',
        requireInteraction: false
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      addTestResult('Web Notification', true, 'Test notification sent successfully');
    } catch (error) {
      addTestResult('Web Notification', false, `Error: ${error}`);
    }
  };

  const testPushNotification = async () => {
    if (!isNative) {
      addTestResult('Push Notification', false, 'Not on native platform');
      return;
    }

    if (!fcmToken && !deviceToken) {
      addTestResult('Push Notification', false, 'No FCM token available');
      return;
    }

    setIsLoading(true);
    try {
      const tokenToUse = fcmToken || deviceToken;
      console.log('🔍 DEBUG: Sending test push with token:', tokenToUse);
      
      // This would send a real FCM notification to the device
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'sendTestPushNotification',
          args: { 
            deviceToken: tokenToUse,
            platform: platform
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔍 DEBUG: Push notification response:', result);
        addTestResult('Push Notification', true, `Test push notification sent: ${result.message}`);
      } else {
        const error = await response.text();
        console.error('🔍 DEBUG: Push notification error:', error);
        addTestResult('Push Notification', false, `Server error: ${error}`);
      }
    } catch (error) {
      console.error('🔍 DEBUG: Push notification network error:', error);
      addTestResult('Push Notification', false, `Network error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testLocalNotification = async (type: 'test' | 'message' | 'post' | 'mention') => {
    try {
      switch (type) {
        case 'test':
          await sendTestNotification();
          addTestResult('Local Notification', true, 'Test notification sent');
          break;
        case 'message':
          await sendMessageNotification('John Doe');
          addTestResult('Local Notification', true, 'Message notification sent');
          break;
        case 'post':
          await sendPostNotification('Jane Smith');
          addTestResult('Local Notification', true, 'Post notification sent');
          break;
        case 'mention':
          await sendMentionNotification('Bob Wilson');
          addTestResult('Local Notification', true, 'Mention notification sent');
          break;
      }
    } catch (error) {
      addTestResult('Local Notification', false, `Error: ${error}`);
    }
  };

  // Request permission and get FCM token
  const requestPermission = async () => {
    try {
      console.log('🔍 DEBUG: Requesting FCM permission...');
      
      // First try to get the token directly
      const result = await FCM.getToken();
      console.log('🔍 DEBUG: FCM token result:', result);
      
      if (result.token) {
        setFcmToken(result.token);
        setNotificationPermission('granted');
        addTestResult('Permission', true, 'Android notification permission granted');
        addTestResult('Permission', true, 'Registered for Android push notifications');
        console.log('🔍 DEBUG: FCM token set successfully:', result.token);
      } else {
        throw new Error('No token received from FCM');
      }
    } catch (error) {
      console.error('🔍 DEBUG: FCM permission error:', error);
      setNotificationPermission('denied');
      addTestResult('Permission', false, `Android permission error: ${error}`);
      
      // Try alternative approach - register for push notifications
      try {
        console.log('🔍 DEBUG: Trying alternative registration...');
        await registerForPushNotifications();
      } catch (regError) {
        console.error('🔍 DEBUG: Alternative registration failed:', regError);
      }
    }
  };

  // Enhanced FCM token check
  const checkFCMToken = async () => {
    try {
      console.log('🔍 DEBUG: Checking FCM token...');
      
      // Try multiple ways to get the token
      let token = null;
      
      // Method 1: Direct FCM getToken
      try {
        const fcmResult = await FCM.getToken();
        if (fcmResult.token) {
          token = fcmResult.token;
          console.log('🔍 DEBUG: Got token from FCM.getToken():', token);
        }
      } catch (e) {
        console.log('🔍 DEBUG: FCM.getToken() failed:', e);
      }
      
      // Method 2: Check if we already have a token
      if (!token && deviceToken) {
        token = deviceToken;
        console.log('🔍 DEBUG: Using existing deviceToken:', token);
      }
      
      // Method 3: Try to register and get token
      if (!token) {
        try {
          console.log('🔍 DEBUG: Trying to register for push notifications...');
          await PushNotifications.register();
          const fcmResult = await FCM.getToken();
          if (fcmResult.token) {
            token = fcmResult.token;
            console.log('🔍 DEBUG: Got token after registration:', token);
          }
        } catch (e) {
          console.log('🔍 DEBUG: Registration failed:', e);
        }
      }
      
      if (token) {
        setFcmToken(token);
        addTestResult('FCM Token', true, 'FCM token retrieved successfully');
        console.log('🔍 DEBUG: Final FCM token set:', token);
      } else {
        addTestResult('FCM Token', false, 'Could not retrieve FCM token');
        console.log('🔍 DEBUG: No FCM token available');
      }
      
    } catch (error) {
      console.error('🔍 DEBUG: FCM token check error:', error);
      addTestResult('FCM Token', false, `Token check error: ${error}`);
    }
  };

  // Test FCM directly without backend
  const testFCMDirectly = async () => {
    if (!isNative) {
      addTestResult('FCM Direct', false, 'Not on native platform');
      return;
    }

    if (!fcmToken && !deviceToken) {
      addTestResult('FCM Direct', false, 'No FCM token available');
      return;
    }

    try {
      console.log('🔍 DEBUG: Testing FCM directly...');
      
      // Try to subscribe to a topic for testing
      await FCM.subscribeTo({ topic: 'test' });
      addTestResult('FCM Direct', true, 'Successfully subscribed to test topic');
      
      // Try to unsubscribe from the topic
      await FCM.unsubscribeFrom({ topic: 'test' });
      addTestResult('FCM Direct', true, 'Successfully unsubscribed from test topic');
      
    } catch (error) {
      console.error('🔍 DEBUG: FCM direct test error:', error);
      addTestResult('FCM Direct', false, `FCM test error: ${error}`);
    }
  };

  // Test notification permissions directly
  const testNotificationPermissions = async () => {
    try {
      console.log('🔍 DEBUG: Testing notification permissions...');
      
      // Check if we can request permissions using PushNotifications instead
      const permission = await PushNotifications.requestPermissions();
      console.log('🔍 DEBUG: Permission result:', permission);
      
      if (permission.receive === 'granted') {
        addTestResult('Permissions', true, 'Notification permissions granted');
      } else {
        addTestResult('Permissions', false, `Notification permissions: ${permission.receive}`);
      }
      
    } catch (error) {
      console.error('🔍 DEBUG: Permission test error:', error);
      addTestResult('Permissions', false, `Permission test error: ${error}`);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="ng-card p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-mono font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This page is only available to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="ng-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">
              Notification Testing Center
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Test and debug notifications for both web and Android platforms
            </p>
          </div>
        </div>

        {/* Debug Section */}
        <div className="mb-6">
          <button
            onClick={forceNativeDetection}
            className="px-4 py-2 bg-red-600 text-white rounded-md font-mono text-sm hover:bg-red-700 transition-colors"
          >
            🔧 FORCE NATIVE DETECTION & DEBUG
          </button>
        </div>

        {/* Platform Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                     <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
             <div className="flex items-center gap-2 mb-2">
               {isNative ? <Smartphone className="w-5 h-5 text-purple-500" /> : <Globe className="w-5 h-5 text-blue-500" />}
               <span className="font-mono font-medium">Platform</span>
             </div>
             <p className="text-sm text-gray-600 dark:text-gray-400">
               {isNative ? `${platform} (Native)` : 'Web Browser'}
             </p>
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
               User Agent: {navigator.userAgent.includes('Android') ? '✅ Android' : '❌ Not Android'}
             </p>
           </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5 text-green-500" />
              <span className="font-mono font-medium">Web Permission</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm px-2 py-1 rounded ${
                notificationPermission === 'granted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                notificationPermission === 'denied' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}>
                {notificationPermission || 'default'}
              </span>
              {notificationPermission !== 'granted' && (
                <button
                  onClick={requestPermission}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  Request
                </button>
              )}
            </div>
          </div>

          {isNative && (
            <>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-purple-500" />
                  <span className="font-mono font-medium">Push Registration</span>
                </div>
                <div className="flex items-center gap-2">
                  {isRegistered ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {isRegistered ? 'Registered' : 'Not Registered'}
                  </span>
                  <button
                    onClick={requestPermission}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Force Request
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-5 h-5 text-orange-500" />
                  <span className="font-mono font-medium">FCM Token</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                  {fcmToken || deviceToken || 'No token available'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Test Buttons */}
        <div className="space-y-4">
          <h3 className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
            Test Notifications
          </h3>

          {/* Web Notifications */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-mono font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Web Browser Notifications
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={testWebNotification}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md font-mono text-xs hover:bg-blue-700 transition-colors"
              >
                <Bell size={12} />
                Test Web
              </button>
            </div>
          </div>

          {/* Local Notifications (Capacitor) */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-mono font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Local Notifications (Capacitor)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => testLocalNotification('test')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-mono text-xs hover:bg-green-700 transition-colors"
              >
                <Bell size={12} />
                Test
              </button>
              <button
                onClick={() => testLocalNotification('message')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-mono text-xs hover:bg-green-700 transition-colors"
              >
                <MessageSquare size={12} />
                Message
              </button>
              <button
                onClick={() => testLocalNotification('post')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-mono text-xs hover:bg-green-700 transition-colors"
              >
                <Link2 size={12} />
                New Post
              </button>
              <button
                onClick={() => testLocalNotification('mention')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-mono text-xs hover:bg-green-700 transition-colors"
              >
                <AtSign size={12} />
                Mention
              </button>
            </div>
          </div>

          {/* Push Notifications (FCM) */}
          {isNative && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-mono font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Push Notifications (FCM)
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={testPushNotification}
                    disabled={isLoading || !fcmToken}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md font-mono text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Bell size={14} />
                    {isLoading ? 'Sending...' : 'Send Test Push'}
                  </button>
                  {!fcmToken && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">
                      No FCM token available
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={testFCMDirectly}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md font-mono text-xs hover:bg-blue-700 transition-colors"
                  >
                    <Smartphone size={12} />
                    Test FCM Direct
                  </button>
                  <button
                    onClick={testNotificationPermissions}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md font-mono text-xs hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={12} />
                    Test Permissions
                  </button>
                  <button
                    onClick={checkFCMToken}
                    className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-md font-mono text-xs hover:bg-orange-700 transition-colors"
                  >
                    <Link2 size={12} />
                    Check FCM Token
                  </button>
                </div>
                <button
                  onClick={registerForPushNotifications}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 underline"
                >
                  Re-register for push notifications
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div className="ng-card p-6">
        <h3 className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Test Results
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No tests run yet. Run some tests above to see results.
            </p>
          ) : (
            testResults.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                    {result.type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {result.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {result.message}
                </p>
              </div>
            ))
          )}
        </div>
        {testResults.length > 0 && (
          <button
            onClick={() => setTestResults([])}
            className="mt-4 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
          >
            Clear results
          </button>
        )}
      </div>
    </div>
  );
}
