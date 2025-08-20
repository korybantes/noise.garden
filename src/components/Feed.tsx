import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { Post as PostType, getRandomPosts, getPostReplies } from '../lib/database';
import { Post } from './Post';
import { PostComposer } from './PostComposer';

export function Feed() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<PostType | null>(null);
  const [viewingReplies, setViewingReplies] = useState<{ post: PostType; replies: PostType[] } | null>(null);

  const loadPosts = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const newPosts = await getRandomPosts();
      setPosts(newPosts);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const loadReplies = async (post: PostType) => {
    try {
      const replies = await getPostReplies(post.id);
      setViewingReplies({ post, replies });
    } catch (error) {
      console.error('Failed to load replies:', error);
    }
  };

  useEffect(() => {
    loadPosts();
    const onFocus = () => loadPosts({ silent: true });
    const onVis = () => { if (!document.hidden) onFocus(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const handlePostCreated = () => {
    if (viewingReplies) {
      loadReplies(viewingReplies.post);
    } else {
      loadPosts({ silent: true });
    }
  };

  const handleDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  if (viewingReplies) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setViewingReplies(null)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
            >
              <ArrowLeft size={16} />
              back to feed
            </button>
          </div>

          {/* Original Post */}
          <Post
            post={viewingReplies.post}
            onReply={setReplyTo}
            onDeleted={handleDeleted}
          />

          {/* Reply Composer */}
          {replyTo && (
            <div className="mt-6">
              <PostComposer
                onPostCreated={handlePostCreated}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
              />
            </div>
          )}

          {/* Replies */}
          <div className="mt-6 space-y-4">
            {viewingReplies.replies.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">
                no replies yet
              </div>
            ) : (
              viewingReplies.replies.map((reply) => (
                <Post
                  key={reply.id}
                  post={reply}
                  onReply={setReplyTo}
                  isReply={true}
                  onDeleted={handleDeleted}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-mono font-bold text-gray-900 dark:text-gray-100">noise garden</h1>
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400">random thoughts, shuffled daily</p>
          </div>
          
          <button
            onClick={() => loadPosts({ silent: false })}
            disabled={loading}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            refresh
          </button>
        </div>

        {replyTo && (
          <PostComposer
            onPostCreated={handlePostCreated}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        )}

        {!replyTo && (
          <PostComposer onPostCreated={handlePostCreated} />
        )}

        {loading ? (
          <div className="text-center py-8 font-mono text-gray-500 dark:text-gray-300">
            loading random thoughts...
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-mono text-gray-500 dark:text-gray-400 mb-4">the garden is empty</p>
            <p className="font-mono text-sm text-gray-400 dark:text-gray-500">be the first to plant a thought</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Post
                key={post.id}
                post={post}
                onReply={setReplyTo}
                onViewReplies={loadReplies}
                onDeleted={handleDeleted}
                onReposted={() => loadPosts({ silent: true })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}