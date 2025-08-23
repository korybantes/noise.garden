# Android Push Notifications Setup Guide

This guide will help you set up real Android push notifications for your Noise Garden app.

## Prerequisites

- Android Studio installed
- Firebase project created
- Google Services configuration file (`google-services.json`)
- Capacitor project with push notifications plugin

## Step 1: Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Add Android app to your Firebase project:
   - Package name: `com.noisegarden.app`
   - App nickname: `Noise Garden`
   - Debug signing certificate SHA-1 (optional for development)

4. Download the `google-services.json` file and place it in `android/app/`

## Step 2: Verify google-services.json

Your current `google-services.json` is actually **correct** for Android FCM. You do NOT need to add FCM server keys to this file. The Android app will automatically get FCM tokens when it registers.

**Important**: The `google-services.json` file is for **client-side Android configuration only**. It should contain:
- Project information
- Package name
- API keys
- App ID

## Step 3: Firebase Service Account Setup (Backend)

For your backend to send FCM notifications, you need a **Firebase Service Account key**, not the web push certificate:

1. In Firebase Console, go to **Project Settings** → **Service Accounts**
2. Click **"Generate new private key"**
3. Download the JSON file (this contains the service account credentials)
4. Add the **entire JSON content** as an environment variable `FIREBASE_SERVICE_ACCOUNT_KEY` in your Vercel deployment

**Example environment variable:**
```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"noisegarden-305c5","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@noisegarden-305c5.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

## Step 4: Web Push Certificates (Optional - for Web Notifications)

If you want web push notifications to work in browsers, you can use the web push certificate you found:

1. In Firebase Console, go to **Project Settings** → **Cloud Messaging**
2. Scroll down to **Web Push certificates**
3. The certificate you have (`BL3OX9gQzqdNRU0nae9oDjA4o7mGDMW407jRLF_ik0xxGljkzBY1g9qJbAsIYCCftzj_lS-ko2x13zkxymBmLjY`) should already be there
4. This is used automatically by Firebase for web push notifications

## Step 5: Build and Test

1. Clean and rebuild your Android project:
```bash
cd android
./gradlew clean
./gradlew build
```

2. Install the app on your device:
```bash
npx cap run android
```

## Step 6: Testing Notifications

1. Open the app and log in as an admin user
2. Go to Profile → "Open Notification Testing Center"
3. Test different notification types:
   - **Web Notifications**: Test browser notifications
   - **Local Notifications**: Test Capacitor local notifications
   - **Push Notifications**: Test real FCM push notifications

## Troubleshooting

### Notifications not showing on Android

1. **Check FCM Token**: In the Notification Testing Center, verify that an FCM token is displayed
2. **Check Permissions**: Ensure notification permissions are granted in Android Settings
3. **Check Firebase Console**: Verify that the FCM token is registered in Firebase Console
4. **Check Logs**: Use `adb logcat` to see FCM registration and message delivery logs

### Common Issues

1. **"No FCM token available"**
   - The app hasn't registered with FCM yet
   - Click "Re-register for push notifications"
   - Check that the device has internet connection

2. **"Firebase not configured"**
   - The `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable is missing or incorrect
   - Check your Vercel deployment environment variables
   - Ensure the entire JSON content is set as the environment variable

3. **"Registration error"**
   - Check that `google-services.json` is properly configured
   - Verify the package name matches your app
   - Ensure the SHA-1 fingerprint is correct (for release builds)

### Debug Commands

```bash
# Check FCM registration
adb logcat | grep "AppFCMService"

# Check notification delivery
adb logcat | grep "NotificationManager"

# Check Capacitor plugin logs
adb logcat | grep "Capacitor"
```

## Production Considerations

1. **Release Build**: Use a release keystore and update SHA-1 in Firebase
2. **Environment Variables**: Ensure all Firebase credentials are properly set in production
3. **Rate Limiting**: Implement proper rate limiting for notification sending
4. **Error Handling**: Add proper error handling for failed notification deliveries
5. **Analytics**: Track notification delivery and engagement rates

## Testing Different Notification Types

The Notification Testing Center allows you to test:

- **Test Notification**: Basic notification with title and body
- **Message Notification**: Simulates a new message
- **New Post Notification**: Simulates a new post from another user
- **Mention Notification**: Simulates being mentioned in a post

Each notification type can be tested for:
- Web browser notifications
- Local Capacitor notifications
- Real FCM push notifications (Android only)

## Next Steps

Once push notifications are working:

1. Implement real notification triggers (new posts, mentions, etc.)
2. Add notification preferences in user settings
3. Implement notification grouping and threading
4. Add rich notifications with images and actions
5. Implement notification analytics and A/B testing

## Support

If you encounter issues:

1. Check the Firebase Console for FCM delivery status
2. Review Android logs using `adb logcat`
3. Verify all configuration files are properly set up
4. Test with a fresh device/emulator installation
