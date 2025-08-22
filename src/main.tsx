import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.tsx';
import Welcome from './pages/Welcome.tsx';
import Privacy from './pages/Privacy.tsx';
import Terms from './pages/Terms.tsx';
import Cookies from './pages/Cookies.tsx';
import Docs from './pages/Docs.tsx';
import { AuthProvider } from './hooks/useAuth';
import { MobileLoading } from './components/MobileLoading.tsx';

function Root() {
  const [isNative, setIsNative] = useState<boolean | null>(null);
  const [welcomeCompleted, setWelcomeCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Try to import Capacitor, but provide fallback for web
        let Capacitor;
        try {
          const module = await import('@capacitor/core');
          Capacitor = module.Capacitor;
        } catch {
          // Fallback for web environment
          Capacitor = {
            isNativePlatform: () => false,
            getPlatform: () => 'web'
          };
        }
        
        const native = Capacitor.isNativePlatform();
        setIsNative(native);
        
        if (native) {
          try {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          SplashScreen.hide();
          } catch {
            // Ignore splash screen errors
          }
          
          // Check if welcome was completed on this device
          const completed = localStorage.getItem('welcome_completed') === 'true';
          setWelcomeCompleted(completed);
        }
      } catch {
        setIsNative(false);
        setWelcomeCompleted(true);
      }
    })();
  }, []);

  // Show loading while detecting platform
  if (isNative === null) {
    return <MobileLoading />;
  }

  // On mobile, show welcome first if not completed
  if (isNative && !welcomeCompleted) {
    return (
      <StrictMode>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/cookies" element={<Cookies />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/app" element={<App />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </StrictMode>
    );
  }

  // Web or mobile with completed welcome
  return (
    <StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={isNative ? <Navigate to="/app" replace /> : <Landing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/app" element={<App />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
