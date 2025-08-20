import { Home, User, MessageSquare } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';

export function BottomNav() {
  const { view, setView, setShowChat } = useNavigation();
  return (
    <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-2xl mx-auto flex items-center justify-around py-2">
        <button
          onClick={() => setView('feed')}
          className={`flex flex-col items-center text-xs ${view === 'feed' ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
        >
          <Home size={18} />
          feed
        </button>
        <button
          onClick={() => setView('profile')}
          className={`flex flex-col items-center text-xs ${view === 'profile' ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
        >
          <User size={18} />
          profile
        </button>
        <button
          onClick={() => setShowChat(true)}
          className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-300"
        >
          <MessageSquare size={18} />
          chat
        </button>
      </div>
    </nav>
  );
} 