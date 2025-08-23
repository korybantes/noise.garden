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

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

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
    <div className="modal-overlay bg-black/50">
      <div className="modal-content bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Repost
          </h2>
          
          {original && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {original.content}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                — @{original.username}
              </p>
            </div>
          )}
          
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add a comment (optional)
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                rows={3}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Reposting...' : 'Repost'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 