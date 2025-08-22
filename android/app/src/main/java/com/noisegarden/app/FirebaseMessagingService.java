package com.noisegarden.app;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class FirebaseMessagingService extends FirebaseMessagingService {
    
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        // Handle foreground messages here
        // The Capacitor plugin will handle most of this automatically
    }
    
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        
        // Send token to your server
        // This will be handled by the Capacitor plugin
    }
} 