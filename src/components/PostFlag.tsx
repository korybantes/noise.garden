import React, { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface PostFlagProps {
  postId: string;
  onClose: () => void;
  onFlagged?: () => void;
}

const FLAG_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Violence or threats',
  'Inappropriate content',
  'Copyright violation',
  'Other'
];

export function PostFlag({ postId, onClose, onFlagged }: PostFlagProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const reason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    if (!reason) {
      setError('Please select or enter a reason');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'flagPost',
          args: {
            postId,
            reason
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to flag post');
      }

      const result = await response.json();
      
      if (result.quarantined) {
        alert('Post has been flagged multiple times and is now quarantined for review.');
      } else {
        alert('Post flagged successfully. Thank you for helping keep the community safe.');
      }
      
      onFlagged?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to flag post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-600" />
            <h3 className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
              Flag Post
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Help us understand why you're flagging this post. Your report will be reviewed by moderators.
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for flagging
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
              required
            >
              <option value="">Select a reason...</option>
              {FLAG_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === 'Other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Please specify
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the issue..."
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
                rows={3}
                maxLength={500}
                required
              />
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              False reports may result in account restrictions.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!selectedReason || (selectedReason === 'Other' && !customReason.trim()))}
              className="px-4 py-2 bg-red-600 text-white rounded-md font-mono text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Flag Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 