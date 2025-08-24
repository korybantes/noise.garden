import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useLocalNotifications } from '../hooks/useLocalNotifications';
import { Bell, MessageSquare, AtSign, Link2, Smartphone, Globe, AlertCircle, CheckCircle } from 'lucide-react';
import { FCM } from '@capacitor-community/fcm';
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
    console.log('🔍 DEBUG: window.location.href:', window.location.href);
    console.log('🔍 DEBUG: window.location.hostname:', window.location.hostname);
    
    if (navigator.userAgent.includes('Android')) {
      console.log('🚀 Immediate Android detection');
      setIsNative(true);
      setPlatform('android');
      
      // Auto-request permission for Android
      setTimeout(() => {
        console.log('🔍 DEBUG: Auto-requesting permission...');
        requestPermission();
      }, 1000);
    }
  }, []);

  // Force native detection function
  const forceNativeDetection = async () => {
    console.log('🔧 FORCE NATIVE DETECTION TRIGGERED');
    
    try {
      // Force Capacitor import
      const { Capacitor } = await import('@capacitor/core');
      console.log('🔍 DEBUG: Capacitor imported successfully:', !!Capacitor);
      console.log('🔍 DEBUG: Capacitor.isNativePlatform():', Capacitor.isNativePlatform?.());
      console.log('🔍 DEBUG: Capacitor.getPlatform():', Capacitor.getPlatform?.());
      
      // Force platform detection
      setIsNative(true);
      setPlatform('android');
      
      // Force permission request
      console.log('🔍 DEBUG: Forcing permission request...');
      await requestPermission();
      
    } catch (error) {
      console.error('🔍 DEBUG: Error in force detection:', error);
      addTestResult('Debug', false, `Force detection error: ${error}`);
    }
  };

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const isNativePlatform = Capacitor.isNativePlatform?.() ?? false;
        const currentPlatform = Capacitor.getPlatform?.() ?? 'web';
        
        console.log('🔍 Platform Detection:', {
          isNativePlatform,
          currentPlatform,
          userAgent: navigator.userAgent,
          hasCapacitor: !!Capacitor
        });
        
        setIsNative(isNativePlatform);
        setPlatform(currentPlatform);
        
        // Check notification permission
        if ('Notification' in window) {
          setNotificationPermission(Notification.permission);
        }
        
        // Get FCM token if available
        if (deviceToken) {
          setFcmToken(deviceToken);
        }
        
        // Force Android detection if we're in Android environment
        if (navigator.userAgent.includes('Android') || 
            currentPlatform === 'android' || 
            window.location.hostname === 'localhost' && navigator.userAgent.includes('Android')) {
          console.log('🔧 Forcing Android detection');
          setIsNative(true);
          setPlatform('android');
        }
        
        // Debug info
        console.log('🔍 Final Platform State:', {
          isNative,
          platform,
          userAgent: navigator.userAgent,
          hostname: window.location.hostname
        });
      } catch (error) {
        console.error('Error checking platform:', error);
      }
    };
    
    // Delay platform check to ensure Capacitor is fully loaded
    const timer = setTimeout(checkPlatform, 1000);
    return () => clearTimeout(timer);
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

    setIsLoading(true);
    try {
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
            deviceToken: fcmToken || deviceToken,
            platform: platform
          }
        })
      });

      if (response.ok) {
        addTestResult('Push Notification', true, 'Test push notification sent to device');
      } else {
        const error = await response.text();
        addTestResult('Push Notification', false, `Server error: ${error}`);
      }
    } catch (error) {
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

  // Replace the requestPermission function with a direct call to getToken
  const requestPermission = async () => {
    try {
      const result = await FCM.getToken();
      setFcmToken(result.token);
      setNotificationPermission('granted');
      addTestResult('Permission', true, 'Android notification permission granted');
      addTestResult('Permission', true, 'Registered for Android push notifications');
    } catch (error) {
      setNotificationPermission('denied');
      addTestResult('Permission', false, `Android permission error: ${error}`);
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
