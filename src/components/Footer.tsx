import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AdminPanel } from './AdminPanel';

export function Footer() {
  const { user } = useAuth();
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  return (
    <>
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-xs">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
          <div className="font-mono">© {new Date().getFullYear()} noise garden</div>
          <p className="font-mono">
            This is an anonymous community. We do not accept illegal content, hate speech, harassment, or spam. Moderators may remove content and suspend accounts.
          </p>
          <p className="font-mono">
            Privacy & GDPR: We store only necessary data for account and content functionality. No tracking or advertising IDs. Content may be retained for moderation and legal compliance.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono">
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