import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { Header } from './components/Header';
import { Feed } from './components/Feed';
import { initDatabase } from './lib/database';
import { NavigationProvider, useNavigation } from './hooks/useNavigation';
import { BottomNav } from './components/BottomNav';
import { Profile } from './components/Profile';
import { ChatWindow } from './components/ChatWindow';
import { InvitePage } from './components/InvitePage';
import { Footer } from './components/Footer';
import { RouterProvider, useRouter } from './hooks/useRouter';
import { OnboardingBackupCodes } from './components/OnboardingBackupCodes';
import { UserSettings } from './components/UserSettings';
import { usePushNotifications } from './hooks/usePushNotifications';

function AppContent() {
  const { user, isLoading } = useAuth();
  const { view, setView, swipeProgress, isSwiping } = useNavigation();
  const { route } = useRouter();
  const [onboardingCodes, setOnboardingCodes] = useState<string[] | null>(null);
  
  // Initialize push notifications (hook handles platform detection internally)
  usePushNotifications();

  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

  // Sync route with view
  useEffect(() => {
    if (route.name === 'feed') {
      setView('feed');
    } else if (route.name === 'profile') {
      setView('profile');
    } else if (route.name === 'chat') {
      setView('chat');
    } else if (route.name === 'invite') {
      setView('invite');
    }
  }, [route.name, setView]);

  useEffect(() => {
    if (!user) return;
    // After login, check if onboarding backup codes exist
    try {
      const raw = localStorage.getItem('onboarding_backup_codes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          setOnboardingCodes(parsed as string[]);
        } else {
          localStorage.removeItem('onboarding_backup_codes');
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="font-mono text-gray-500 dark:text-gray-300">loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  // Add swipe indicator overlay
  const SwipeIndicator = () => (
    <div 
      className={`fixed inset-0 pointer-events-none z-50 transition-opacity duration-200 ${
        isSwiping ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="bg-black/20 backdrop-blur-sm rounded-full px-6 py-3 text-white text-sm font-medium">
          {swipeProgress > 0.5 ? 'Release to switch' : 'Swipe to navigate'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-0 flex flex-col">
      <Header />
      <div className="flex-1 relative overflow-hidden">
        {/* Main content with smooth transitions */}
        <div 
          className={`absolute inset-0 transition-transform duration-300 ease-out ${
            isSwiping ? 'scale-95' : 'scale-100'
          }`}
        >
        {view === 'feed' ? <Feed /> : 
         view === 'profile' ? <Profile /> : 
         view === 'chat' ? <ChatWindow onClose={() => {}} /> :
         view === 'invite' ? <InvitePage /> :
         view === 'settings' ? <UserSettings /> : <Feed />}
        </div>
        
        {/* Swipe indicator */}
        <SwipeIndicator />
      </div>
      <Footer />
      <BottomNav />
      {onboardingCodes && (
        <OnboardingBackupCodes
          codes={onboardingCodes}
          onClose={() => {
            setOnboardingCodes(null);
            localStorage.removeItem('onboarding_backup_codes');
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </RouterProvider>
    </AuthProvider>
  );
}

export default App;