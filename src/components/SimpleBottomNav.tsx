import { Home, User, MessageSquare, Ticket } from 'lucide-react';

export function SimpleBottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-2xl mx-auto flex items-center justify-around py-2">
        <a
          href="/app"
          className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-300"
        >
          <Home size={18} />
          feed
        </a>
        <a
          href="/app#profile"
          className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-300"
        >
          <User size={18} />
          profile
        </a>
        <a
          href="/app#chat"
          className="relative flex flex-col items-center text-xs text-gray-600 dark:text-gray-300"
        >
          {/* When using the hash router, a connection indicator could be toggled by adding a class to body */}
          <span className="hidden chat-active:block absolute -top-1 right-3 w-2 h-2 bg-green-500 rounded-full" />
          <MessageSquare size={18} />
          chat
        </a>
        <a
          href="/invite"
          className="flex flex-col items-center text-xs text-gray-900 dark:text-white"
        >
          <Ticket size={18} />
          invite
        </a>
      </div>
    </nav>
  );
} 