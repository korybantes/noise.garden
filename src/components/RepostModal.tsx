import { useEffect, useState } from 'react';
import { X, Repeat2 } from 'lucide-react';
import { getPostById, createPost, Post as PostType } from '../lib/database';
import { useAuth } from '../hooks/useAuth';

interface RepostModalProps {
  postId: string;
  onClose: () => void;
  onReposted?: () => void;
}

export function RepostModal({ postId, onClose, onReposted }: RepostModalProps) {
  const { user } = useAuth();
  const [original, setOriginal] = useState<PostType | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPostById(postId).then(setOriginal).catch(console.error);
  }, [postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      await createPost(user.userId, comment || '', undefined, postId);
      onReposted?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20 pb-20 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg my-auto">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-mono text-sm">
            <Repeat2 size={16} /> repost
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {original && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
              <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-2">original by @{original.username}</div>
              <div className="text-sm font-mono text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                {original.content}
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="add your thoughts... (optional)"
              className="w-full p-3 bg-transparent border border-gray-200 dark:border-gray-800 rounded resize-none focus:outline-none font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100"
              rows={4}
              maxLength={280}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
              >
                <Repeat2 size={14} /> repost
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 