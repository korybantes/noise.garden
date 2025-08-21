import { Home, User, MessageSquare, Ticket, Shield } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';
import { AdminPanel } from './AdminPanel';
import { ModeratorPanel } from './ModeratorPanel';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';

export function BottomNav() {
  const { view, setView, chatActive } = useNavigation();
  const { user } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);
  const { language } = useLanguage();

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-around py-2 px-2">
          <button
            onClick={() => setView('feed')}
            className={`flex flex-col items-center text-xs ${view === 'feed' ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
          >
            <Home size={18} />
            {t('feed', language)}
          </button>
          <button
            onClick={() => setView('profile')}
            className={`flex flex-col items-center text-xs ${view === 'profile' ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
          >
            <User size={18} />
            {t('profile', language)}
          </button>
          <button
            onClick={() => setView('chat')}
            className={`relative flex flex-col items-center text-xs ${view === 'chat' ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
          >
            {chatActive && <span className="absolute -top-1 right-3 w-2 h-2 bg-green-500 rounded-full" />}
            <MessageSquare size={18} />
            {t('chat', language)}
          </button>
          <button
            onClick={() => setView('invite')}
            className={`flex flex-col items-center text-xs ${view === 'invite' ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
          >
            <Ticket size={18} />
            {t('invite', language)}
          </button>
          {user && ['admin', 'moderator'].includes(user.role) && (
            <button
              onClick={() => user.role === 'admin' ? setShowAdminPanel(true) : setShowModeratorPanel(true)}
              className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-300"
            >
              <Shield size={18} />
              {user.role === 'admin' ? t('admin', language) : (language === 'tr' ? 'moderatör' : 'moderator')}
            </button>
          )}
        </div>
      </nav>

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {showModeratorPanel && (
        <ModeratorPanel onClose={() => setShowModeratorPanel(false)} />
      )}
    </>
  );
} 