import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserPostsByUsername, Post as PostType, getUserByUsername, getInviterForUser, isUserBanned, getPostById } from '../lib/database';
import { useNavigation } from '../hooks/useNavigation';
import { Post } from './Post';
import { ShieldCheck, ShieldAlert, Link2 } from 'lucide-react';
import { useRouter } from '../hooks/useRouter';

export function Profile() {
  const { user } = useAuth();
  const { profileUsername, setProfileUsername, setView } = useNavigation();
  const { navigateToPost } = useRouter();
  const username = profileUsername || user?.username;
  const viewingOwn = username === user?.username;

  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [banned, setBanned] = useState<{ banned: boolean; reason?: string; bannedBy?: string } | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);

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
      setJoinedAt(u?.created_at ? new Date(u.created_at).toLocaleDateString() : null);
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
  const postCount = posts.length;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 dark:bg-gray-950 pb-20 md:pb-0">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="ng-card p-6">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
            ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
              <div className="font-mono text-lg text-gray-900 dark:text-gray-100">@{username}</div>
                <RoleBadge />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
                <span>{viewingOwn ? 'your posts' : 'public profile'}</span>
                <span>•</span>
                <span>{postCount} posts</span>
                {joinedAt && (
                  <>
                    <span>•</span>
                    <span>joined {joinedAt}</span>
                  </>
                )}
              </div>
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
              <div key={p.id} className="space-y-2">
                {/* Show quote of parent if this is a reply */}
                {p.parent_id && (
                  <ParentQuote parentId={p.parent_id} onView={(id) => { setView('feed'); navigateToPost(id); }} />
                )}
                <Post post={p} onReply={() => {}} onDeleted={handleDeleted} isReply={!!p.parent_id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParentQuote({ parentId, onView }: { parentId: string; onView: (id: string) => void }) {
  const [parent, setParent] = useState<PostType | null>(null);
  useEffect(() => { (async () => { setParent(await getPostById(parentId)); })(); }, [parentId]);
  if (!parent) return null;
  return (
    <div className="p-2 border border-gray-200 dark:border-gray-800 rounded bg-gray-50 dark:bg-gray-900 flex items-start gap-2">
      <div className="text-xs font-mono text-gray-500 dark:text-gray-400 flex-1 truncate">
        <span className="mr-2">replying to @{parent.username}</span>
        <span className="block text-gray-700 dark:text-gray-300 truncate">{parent.content}</span>
      </div>
      <button onClick={() => onView(parent.id)} className="inline-flex items-center gap-1 text-xs font-mono underline text-gray-700 dark:text-gray-300">
        <Link2 size={12} /> view
      </button>
    </div>
  );
} 