import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserPostsByUsername, Post as PostType } from '../lib/database';
import { useNavigation } from '../hooks/useNavigation';
import { Post } from './Post';

export function Profile() {
  const { user } = useAuth();
  const { profileUsername } = useNavigation();
  const username = profileUsername || user?.username;
  const viewingOwn = username === user?.username;

  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (opts?: { silent?: boolean }) => {
    if (!username) return;
    if (!opts?.silent) setLoading(true);
    try {
      const data = await getUserPostsByUsername(username);
      setPosts(data);
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

  if (!username) return null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800" />
            <div>
              <div className="font-mono text-lg text-gray-900 dark:text-gray-100">@{username}</div>
              <div className="text-xs font-mono text-gray-500 dark:text-gray-400">{viewingOwn ? 'your posts' : 'public profile'}</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">loading…</div>
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