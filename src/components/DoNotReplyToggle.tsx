import React, { useState } from 'react';
import { MessageSquare, X, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface DoNotReplyToggleProps {
  postId: string;
  repliesDisabled: boolean;
  onToggle: (disabled: boolean) => void;
}

export function DoNotReplyToggle({ postId, repliesDisabled, onToggle }: DoNotReplyToggleProps) {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!user) return null;

  const handleToggle = async () => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      // Update the post in the database
      const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'updatePostRepliesDisabled',
          args: {
            postId,
            repliesDisabled: !repliesDisabled
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update post');
      }

      onToggle(!repliesDisabled);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update post');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isUpdating}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-colors ${
        repliesDisabled
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
      title={repliesDisabled ? 'Replies are disabled' : 'Click to disable replies'}
    >
      {repliesDisabled ? (
        <>
          <Lock size={12} />
          no replies
        </>
      ) : (
        <>
          <MessageSquare size={12} />
          allow replies
        </>
      )}
    </button>
  );
} 