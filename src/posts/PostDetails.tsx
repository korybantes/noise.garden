import { useEffect, useState } from 'react';
import { ArrowLeft, Repeat2 } from 'lucide-react';
import { getPostById, getPostReplies, Post as PostType } from '../lib/database';
import { Post } from '../components/Post';
import { PostComposer } from '../components/PostComposer';
import { useRouter } from '../hooks/useRouter';

export function PostDetails({ id }: { id: string }) {
  const { navigateToFeed } = useRouter();
  const [post, setPost] = useState<PostType | null>(null);
  const [original, setOriginal] = useState<PostType | null>(null);
  const [replies, setReplies] = useState<PostType[]>([]);
  const [replyTo, setReplyTo] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const p = await getPostById(id);
        if (!active) return;
        setPost(p);
        if (p?.repost_of) {
          const o = await getPostById(p.repost_of);
          if (!active) return;
          setOriginal(o);
        } else {
          setOriginal(null);
        }
        const reps = await getPostReplies(p?.repost_of ? p.repost_of : id);
        if (!active) return;
        setReplies(reps);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id]);

  const handlePostCreated = async () => {
    if (post) {
      const reps = await getPostReplies(post.repost_of ? post.repost_of : post.id);
      setReplies(reps);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40">
      <div className="absolute inset-y-0 right-0 w-full md:w-[640px] bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-xl overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <button onClick={navigateToFeed} className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm">
            <ArrowLeft size={16} /> back
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="font-mono text-sm text-gray-500 dark:text-gray-400">loading…</div>
          )}

          {!loading && post && (
            <>
              {post.repost_of && original ? (
                <div className="space-y-3">
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Repeat2 size={12} /> repost
                  </div>
                  <Post post={original} onReply={setReplyTo} />
                  <div className="border-t border-gray-200 dark:border-gray-800" />
                  <Post post={post} onReply={setReplyTo} />
                </div>
              ) : (
                <Post post={post} onReply={setReplyTo} />
              )}

              {replyTo && (
                <PostComposer onPostCreated={handlePostCreated} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
              )}

              <div className="mt-2 space-y-3">
                {replies.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">no replies yet</div>
                ) : (
                  replies.map(r => (
                    <Post key={r.id} post={r} onReply={setReplyTo} isReply />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
