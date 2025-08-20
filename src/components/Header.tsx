import React, { useState } from 'react';
import { User, LogOut, Settings, MessageSquare, Moon, Sun, Home, Ticket, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserSettings } from './UserSettings';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '../hooks/useNavigation';
import { Notifications } from './Notifications';
import { AdminPanel } from './AdminPanel';

export function Header() {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { setView, chatActive } = useNavigation();

  if (!user) return null;

  return (
    <>
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
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
            
            <div className="hidden md:flex items-center gap-4">
              <button onClick={() => setView('feed')} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title="Feed"><Home size={16} />feed</button>
              <button onClick={() => setView('chat')} className="relative flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title="Anonymous chat">
                {chatActive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />}
                <MessageSquare size={16} />chat
              </button>
              <a href="/invite" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title="Invite"><Ticket size={16} />invite</a>
              {['admin', 'moderator'].includes(user.role) && (
                <button onClick={() => setShowAdminPanel(true)} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors" title="Admin Panel"><Shield size={16} />admin</button>
              )}
              <Notifications />
              <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
              <button onClick={() => setShowSettings(true)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title="Settings"><Settings size={16} /></button>
              <button onClick={logout} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </div>
      </header>

      {showSettings && (
        <UserSettings onClose={() => setShowSettings(false)} />
      )}

      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </>
  );
}