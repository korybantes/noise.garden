import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserPostsByUsername, Post as PostType, getUserByUsername, getInviterForUser, isUserBanned } from '../lib/database';
import { useNavigation } from '../hooks/useNavigation';
import { Post } from './Post';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export function Profile() {
  const { user } = useAuth();
  const { profileUsername, setProfileUsername, setView } = useNavigation();
  const username = profileUsername || user?.username;
  const viewingOwn = username === user?.username;

  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [banned, setBanned] = useState<{ banned: boolean; reason?: string; bannedBy?: string } | null>(null);

  const load = async (opts?: { silent?: boolean }) => {
    if (!username) return;
    if (!opts?.silent) setLoading(true);
    try {
      const data = await getUserPostsByUsername(username);
      setPosts(data);
      const u = await getUserByUsername(username);
      setAvatarUrl(u?.avatar_url ?? null);
      setBio(u?.bio ?? null);
      setUserRole(u?.role ?? null);
      if (u?.id) {
        const iv = await getInviterForUser(u.id);
        if (iv?.inviter_username) setInvitedBy(iv.inviter_username);
        const banInfo = await isUserBanned(u.id);
        setBanned(banInfo);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load({ silent: true });
    const onVis = () => { if (!document.hidden) onFocus(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [username]);

  const handleDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const RoleBadge = () => {
    if (userRole === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono text-red-600 dark:text-red-400">
          <ShieldCheck size={12} />
          admin
        </span>
      );
    }
    if (userRole === 'moderator') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400">
          <ShieldAlert size={12} />
          moderator
        </span>
      );
    }
    return null;
  };

  if (!username) return null;

  const isSuspended = !!banned?.banned;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="ng-card p-6">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
            ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
            )}
            <div>
              <div className="flex items-center gap-2">
              <div className="font-mono text-lg text-gray-900 dark:text-gray-100">@{username}</div>
                <RoleBadge />
              </div>
              <div className="text-xs font-mono text-gray-500 dark:text-gray-400">{viewingOwn ? 'your posts' : 'public profile'}</div>
              {invitedBy && (
                <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">invited by <button className="underline" onClick={() => { setProfileUsername(invitedBy!); setView('profile'); }}>@{invitedBy}</button></div>
              )}
            </div>
          </div>
          {bio && (
            <div className="mt-3 font-mono text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{bio}</div>
          )}
        </div>

        {isSuspended && (
          <div className="p-4 border border-red-200 dark:border-red-900 rounded bg-red-50 dark:bg-red-900/20">
            <div className="text-sm font-mono text-red-700 dark:text-red-300">
              This account has been suspended for breaching community guidelines.
            </div>
            {banned?.reason && (
              <div className="mt-1 text-xs font-mono text-red-600 dark:text-red-400">Reason: {banned.reason}</div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">loading…</div>
        ) : isSuspended ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">posts are hidden</div>
        ) : posts.length === 0 ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">no posts yet</div>
        ) : (
          <div className="space-y-4">
            {posts.map(p => (
              <Post key={p.id} post={p} onReply={() => {}} onDeleted={handleDeleted} onReposted={() => load({ silent: true })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 