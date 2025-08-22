import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getInviteForCreator, createInviteForUser, getInvitesCreatedBy, getInviterForUser } from '../lib/database';
import { RefreshCw, ArrowLeft, Share2 } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';

export function InvitePage() {
  const { user } = useAuth();
  const { setView } = useNavigation();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState<Array<{ code: string; used_by: string | null; used_by_username: string | null }>>([]);
  const [inviter, setInviter] = useState<{ inviter_id: string; inviter_username: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const inv = await getInviteForCreator(user.userId);
      if (inv?.code) setCode(inv.code);
      const created = await getInvitesCreatedBy(user.userId);
      setInvited(created);
      const whoInvited = await getInviterForUser(user.userId);
      setInviter(whoInvited);
    })();
  }, [user]);

  const generate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const inv = await createInviteForUser(user.userId);
      setCode(inv.code);
      // Refresh the invited list
      const created = await getInvitesCreatedBy(user.userId);
      setInvited(created);
    } finally {
      setLoading(false);
    }
  };

  const shareInvite = async () => {
    if (!code) return;
    const base = (import.meta as any).env?.VITE_PUBLIC_BASE_URL || 'https://noise-garden.vercel.app';
    const link = `${base}/app?invite=${encodeURIComponent(code)}`;
    const message = `🌱 You’ve received a private invitation to join **noise.garden** 🌱\n\nAn anonymity-first, privacy-protected social space.  \nNo profiles. No tracking. No algorithms — just pure connection.\n\n🔑 Access your personal link: ${link}\n\n⚠️ This invitation can only be used once. After that, it disappears.`;

    // Try Web Share API first
    try {
      const shareData: any = { title: 'noise.garden invite', text: message, url: link };
      if ((navigator as any).canShare ? (navigator as any).canShare(shareData) : true) {
        await (navigator as any).share(shareData);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch {
      // continue to fallbacks
    }

    // Try Capacitor Share plugin if available
    try {
      // Use the alias; during dev it resolves to our stub
      const mod: any = await import('@capacitor/share');
      const Share = (mod as any).Share || mod;
      if (Share?.share) {
        await Share.share({ title: 'noise.garden invite', text: message, url: link, dialogTitle: 'Share invite' });
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch {
      // continue to clipboard fallback
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      alert('Invite message copied to clipboard! Paste it into your favorite app.');
    } catch {
      // last resort open mailto
      window.open(`mailto:?subject=${encodeURIComponent('noise.garden invite')}&body=${encodeURIComponent(message)}`);
    }
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setView('feed')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            back to feed
          </button>
        </div>

        {/* Main Content */}
        <div className="ng-card p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Invites</h1>
          
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300 mb-6">
            We're invite-only to keep the community small, thoughtful, and safe. Limiting invites helps prevent spam, brigading, and bad actors while we grow. Each member can invite one trusted person.
          </p>
          
          <div className="space-y-6">
            {/* Your Invite Section */}
            <div className="ng-card p-4">
              <h3 className="font-mono font-semibold text-gray-900 dark:text-gray-100 mb-3">your invite</h3>
              {user ? (
                code ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="font-mono text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">{code}</div>
                    <button 
                      onClick={shareInvite} 
                      className="ng-btn flex items-center gap-2"
                      disabled={copied}
                    >
                      <Share2 size={16} />
                      {copied ? 'shared!' : 'share invite'}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={generate} 
                    className="ng-btn flex items-center gap-2"
                    disabled={loading}
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'generating...' : 'generate code'}
                  </button>
                )
              ) : (
                <p className="font-mono text-sm text-gray-600 dark:text-gray-400">Log in to generate your invite code.</p>
              )}
              {user && inviter && (
                <p className="mt-3 font-mono text-xs text-gray-600 dark:text-gray-400">invited by @{inviter.inviter_username}</p>
              )}
            </div>
            
            {/* Who You Invited Section */}
            <div className="ng-card p-4">
              <h3 className="font-mono font-semibold text-gray-900 dark:text-gray-100 mb-3">who you invited</h3>
              {invited.length === 0 ? (
                <p className="font-mono text-sm text-gray-600 dark:text-gray-400">no one yet</p>
              ) : (
                <ul className="space-y-2 font-mono text-sm text-gray-700 dark:text-gray-300">
                  {invited.map((i) => (
                    <li key={i.code} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span>code {i.code}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {i.used_by_username ? `@${i.used_by_username}` : 'unused'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 