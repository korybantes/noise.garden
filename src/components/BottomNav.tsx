import { Home, User, MessageSquare, Ticket, Shield } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';
import { AdminPanel } from './AdminPanel';
import { ModeratorPanel } from './ModeratorPanel';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { hapticSelection } from '../lib/haptics';

export function BottomNav() {
  const { view, setView, chatActive } = useNavigation();
  const { user } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);
  const { language } = useLanguage();

  const onSelect = async (v: typeof view) => {
    if (v !== view) await hapticSelection();
    setView(v);
  };

  const btnClass = (active: boolean) => `flex flex-col items-center text-xs ${active ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'} px-3 py-2 active:opacity-80`;

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-around py-2 px-2">
          <button onClick={() => onSelect('feed')} className={btnClass(view === 'feed')}>
            <Home size={20} />
            {t('feed', language)}
          </button>
          <button onClick={() => onSelect('profile')} className={btnClass(view === 'profile')}>
            <User size={20} />
            {t('profile', language)}
          </button>
          <button onClick={() => onSelect('chat')} className={`relative ${btnClass(view === 'chat')}`}>
            {chatActive && <span className="absolute -top-1 right-3 w-2 h-2 bg-green-500 rounded-full" />}
            <MessageSquare size={20} />
            {t('chat', language)}
          </button>
          <button onClick={() => onSelect('invite')} className={btnClass(view === 'invite')}>
            <Ticket size={20} />
            {t('invite', language)}
          </button>
          {user && ['admin', 'moderator'].includes(user.role) && (
            <button onClick={() => (user.role === 'admin' ? setShowAdminPanel(true) : setShowModeratorPanel(true))} className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-300 px-3 py-2">
              <Shield size={20} />
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