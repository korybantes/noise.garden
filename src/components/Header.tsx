import { useState, useEffect } from 'react';
import { User, LogOut, Settings, MessageSquare, Moon, Sun, Home, Ticket, Shield, AtSign } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserSettings } from './UserSettings';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '../hooks/useNavigation';
import { Notifications } from './Notifications';
import { AdminPanel } from './AdminPanel';
import { ModeratorPanel } from './ModeratorPanel';
import { Mentions } from './Mentions';
import { getPendingMentions } from '../lib/database';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { loadFeedSettings } from '../lib/settings';

export function Header() {
  const { user, logout } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [pendingMentionsCount, setPendingMentionsCount] = useState(0);
  const [mentionsDisabled, setMentionsDisabled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { setView, chatActive, view } = useNavigation();
  const { language } = useLanguage();

  useEffect(() => {
    if (!user) return;
    checkMentionsPrivacy();
    loadPendingMentions();
    const interval = setInterval(loadPendingMentions, 10000); // Check every 10 seconds instead of 30
    return () => clearInterval(interval);
  }, [user]);

  const checkMentionsPrivacy = () => {
    try {
      const settings = loadFeedSettings();
      const privacy = (settings as any).privacy || {};
      setMentionsDisabled(!!privacy.disableMentions);
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
    }
  };

  const loadPendingMentions = async () => {
    if (!user || mentionsDisabled) return;
    try {
      const mentions = await getPendingMentions(user.userId);
      setPendingMentionsCount(mentions.length);
    } catch (error) {
      console.error('Failed to load pending mentions:', error);
    }
  };

  const handleOpenMentions = () => {
    setShowMentions(true);
    // Refresh mentions count when opening
    loadPendingMentions();
  };

  const handleCloseMentions = () => {
    setShowMentions(false);
    // Refresh mentions count when closing
    loadPendingMentions();
  };

  if (!user) return null;

  return (
    <>
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setView('profile')} className="flex items-center gap-2">
              {/* @ts-ignore */}
              {(user as any)?.avatar_url ? (
                // @ts-ignore
                <img src={(user as any).avatar_url.replace('/upload/', '/upload/f_auto,q_auto,w_64,h_64,c_fill,g_face/')} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <User size={18} className="text-gray-600 dark:text-gray-300" />
              )}
              <span className="font-mono text-sm text-gray-800 dark:text-gray-100">@{user.username}</span>
            </button>
            
            {/* Mobile actions */}
            <div className="flex md:hidden items-center gap-3">
              {!mentionsDisabled && (
                <button onClick={handleOpenMentions} className="relative text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title={t('mentions', language)}>
                  <AtSign size={16} />
                  {pendingMentionsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-mono font-bold shadow-sm">
                      {pendingMentionsCount > 9 ? '9+' : pendingMentionsCount}
                    </span>
                  )}
                </button>
              )}
              <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"><span className="sr-only">theme</span>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
              <button onClick={() => setView('settings')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title={t('settings', language)}>
                <Settings size={16} />
              </button>
            </div>
            
            <div className="hidden md:flex items-center gap-4">
              <button onClick={() => setView('feed')} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title={t('feed', language)}><Home size={16} />{t('feed', language)}</button>
              <button onClick={() => setView('chat')} className="relative flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title={t('anonymousChat', language)}>
                {chatActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />}
                <MessageSquare size={16} />{t('chat', language)}
              </button>
              <button onClick={() => setView('invite')} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title={t('invite', language)}><Ticket size={16} />{t('invite', language)}</button>
              {user.role === 'admin' && (
                <button onClick={() => setShowAdminPanel(true)} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title={t('adminPanel', language)}><Shield size={16} />{t('admin', language)}</button>
              )}
              {user.role === 'moderator' && (
                <button onClick={() => setShowModeratorPanel(true)} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title={language === 'tr' ? 'Moderatör Paneli' : 'Moderator Panel'}><Shield size={16} />{language === 'tr' ? 'moderatör' : 'moderator'}</button>
              )}
              <Notifications />
              {!mentionsDisabled && (
                <button onClick={handleOpenMentions} className="relative flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title={t('mentions', language)}>
                  <AtSign size={16} />
                  {pendingMentionsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-mono font-bold shadow-sm">
                      {pendingMentionsCount > 9 ? '9+' : pendingMentionsCount}
                    </span>
                  )}
                </button>
              )}
              <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title={theme === 'dark' ? t('switchToLightMode', language) : t('switchToDarkMode', language)}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
              <button onClick={() => setView('settings')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title={t('settings', language)}><Settings size={16} /></button>
              <button onClick={logout} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title={t('signOut', language)}><LogOut size={16} /></button>
            </div>
          </div>
        </div>
      </header>

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {showModeratorPanel && (
        <ModeratorPanel onClose={() => setShowModeratorPanel(false)} />
      )}

      {showMentions && !mentionsDisabled && (
        <Mentions onClose={handleCloseMentions} onMentionsUpdated={loadPendingMentions} />
      )}
    </>
  );
}