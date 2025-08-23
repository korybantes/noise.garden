import { useState, useContext } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AdminPanel } from './AdminPanel';

// Create a safe navigation hook
function useSafeNavigation() {
  try {
    const { useNavigation } = require('../hooks/useNavigation');
    return useNavigation();
  } catch (error) {
    return { setView: null };
  }
}

export function Footer() {
  const { user } = useAuth();
  const { setView } = useSafeNavigation();
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  return (
    <>
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-xs">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          <div className="font-mono">© {new Date().getFullYear()} noise garden</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono">
            {setView ? (
              <button 
                onClick={() => setView('news')} 
                className="underline hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                news
              </button>
            ) : (
              <span className="underline text-gray-400 dark:text-gray-500">news</span>
            )}
            <a href="/privacy" className="underline">privacy</a>
            <a href="/terms" className="underline">terms</a>
            <a href="/cookies" className="underline">cookies</a>
            <a href="/docs" className="underline">docs</a>
            {user && ['admin', 'moderator'].includes(user.role) && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="inline-flex items-center gap-1 underline text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Shield size={12} />
                control panel
              </button>
            )}
          </div>
        </div>
      </footer>

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </>
  );
} 