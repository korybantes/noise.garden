import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { Header } from './components/Header';
import { Feed } from './components/Feed';
import { initDatabase } from './lib/database';
import { NavigationProvider, useNavigation } from './hooks/useNavigation';
import { BottomNav } from './components/BottomNav';
import { Profile } from './components/Profile';
import { ChatWindow } from './components/ChatWindow';
import { Footer } from './components/Footer';
import { RouterProvider } from './hooks/useRouter';
import { OnboardingBackupCodes } from './components/OnboardingBackupCodes';

function AppContent() {
  const { user, isLoading } = useAuth();
  const { view, showChat, setShowChat } = useNavigation();
  const [onboardingCodes, setOnboardingCodes] = useState<string[] | null>(null);

  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-16 md:pb-0 flex flex-col">
      <Header />
      <div className="flex-1">
        {view === 'feed' ? <Feed /> : <Profile />}
      </div>
      <Footer />
      <BottomNav />
      {showChat && <ChatWindow onClose={() => setShowChat(false)} />}
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