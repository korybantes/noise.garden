import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.tsx';
import Privacy from './pages/Privacy.tsx';
import Terms from './pages/Terms.tsx';
import Cookies from './pages/Cookies.tsx';
import Invite from './pages/Invite.tsx';
import Docs from './pages/Docs.tsx';
import { AuthProvider } from './hooks/useAuth';
import { NavigationProvider } from './hooks/useNavigation';

function ConsentBanner() {
  const accepted = typeof localStorage !== 'undefined' && localStorage.getItem('consent_banner') === '1';
  if (accepted) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="font-mono text-xs text-gray-700 dark:text-gray-300">We use essential cookies to run this site. Optional analytics (if enabled) will be opt‑in.</div>
        <div className="flex items-center gap-2">
          <a href="/cookies" className="font-mono text-xs underline text-gray-700 dark:text-gray-300">learn more</a>
          <button onClick={() => { localStorage.setItem('consent_banner', '1'); location.reload(); }} className="px-3 py-1.5 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-mono text-xs">ok</button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/cookies" element={<Cookies />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/docs" element={<Docs />} />
        <Route path="/app" element={<><App /><ConsentBanner /></>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
