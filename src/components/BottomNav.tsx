import { Home, User, MessageSquare, Ticket, Shield, Bell } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';
import { useRouter } from '../hooks/useRouter';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import { AdminPanel } from './AdminPanel';
import { ModeratorPanel } from './ModeratorPanel';
import { CommunityManagerPanel } from './CommunityManagerPanel';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { hapticSelection } from '../lib/haptics';
import { getUnreadNotificationCount } from '../lib/database';

export function BottomNav() {
  const { view, setView, chatActive } = useNavigation();
  const { navigateToFeed } = useRouter();
  const { user } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);
  const [showCommunityManagerPanel, setShowCommunityManagerPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { language } = useLanguage();

  const onSelect = async (v: typeof view) => {
    if (v !== view) await hapticSelection();
    setView(v);
  };

  const onSelectFeed = async () => {
    if (view !== 'feed') await hapticSelection();
    // Clear any post viewing state first
    window.history.pushState({}, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
    // Then set view and navigate
    setView('feed');
    navigateToFeed();
  };

  // Load unread notification count
  useEffect(() => {
    if (user) {
      loadUnreadCount();
      // Real-time updates every 5 seconds
      const interval = setInterval(loadUnreadCount, 5000);
      
      // Listen for real-time notification events
      const handleNewNotification = () => {
        loadUnreadCount();
      };
      
      window.addEventListener('newNotification', handleNewNotification);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('newNotification', handleNewNotification);
      };
    }
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;
    
    try {
      const count = await getUnreadNotificationCount(user.userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const btnClass = (active: boolean) => `flex flex-col items-center justify-center text-xs ${active ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'} px-2 py-2 active:opacity-80 transition-colors duration-200 min-w-0 flex-1`;

  const getPanelButton = () => {
    if (!user) return null;
    
    if (user.role === 'admin') {
      return (
        <button onClick={() => setShowAdminPanel(true)} className="flex flex-col items-center justify-center text-xs text-gray-600 dark:text-gray-300 px-2 py-2 min-w-0 flex-1">
          <Shield size={18} />
          <span className="truncate text-[10px] leading-tight">{t('admin', language)}</span>
        </button>
      );
    } else if (user.role === 'moderator') {
      return (
        <button onClick={() => setShowModeratorPanel(true)} className="flex flex-col items-center justify-center text-xs text-gray-600 dark:text-gray-300 px-2 py-2 min-w-0 flex-1">
          <Shield size={18} />
          <span className="truncate text-[10px] leading-tight">{language === 'tr' ? 'moderatör' : 'moderator'}</span>
        </button>
      );
    } else if (user.role === 'community_manager') {
      return (
        <button onClick={() => setShowCommunityManagerPanel(true)} className="flex flex-col items-center justify-center text-xs text-gray-600 dark:text-gray-300 px-2 py-2 min-w-0 flex-1">
          <Shield size={18} />
          <span className="truncate text-[10px] leading-tight">{language === 'tr' ? 'topluluk yöneticisi' : 'community manager'}</span>
        </button>
      );
    }
    
    return null;
  };

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg z-40 pb-safe-area-inset-bottom">
        <div className="w-full max-w-2xl mx-auto flex items-stretch justify-around px-1 py-1">
          <button onClick={onSelectFeed} className={btnClass(view === 'feed')}>
            <Home size={18} />
            <span className="truncate text-[10px] leading-tight">{t('feed', language)}</span>
          </button>
          <button onClick={() => onSelect('profile')} className={btnClass(view === 'profile')}>
            <User size={18} />
            <span className="truncate text-[10px] leading-tight">{t('profile', language)}</span>
          </button>
          <button onClick={() => onSelect('chat')} className={`relative ${btnClass(view === 'chat')}`}>
            {chatActive && <span className="absolute -top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />}
            <MessageSquare size={18} />
            <span className="truncate text-[10px] leading-tight">{t('chat', language)}</span>
          </button>
          <button onClick={() => onSelect('invite')} className={btnClass(view === 'invite')}>
            <Ticket size={18} />
            <span className="truncate text-[10px] leading-tight">{t('invite', language)}</span>
          </button>
          <button onClick={() => onSelect('notifications')} className={`relative ${btnClass(view === 'notifications')}`}>
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-mono font-bold text-[10px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <span className="truncate text-[10px] leading-tight">{language === 'tr' ? 'bildirimler' : 'notifications'}</span>
          </button>
          {getPanelButton()}
          {user?.role === 'admin' && (
            <button onClick={() => setView('notificationTester')} className={btnClass(view === 'notificationTester')}>
              <Bell size={18} />
              <span className="truncate text-[10px] leading-tight">Test</span>
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

      {showCommunityManagerPanel && (
        <CommunityManagerPanel onClose={() => setShowCommunityManagerPanel(false)} />
      )}
    </>
  );
} 