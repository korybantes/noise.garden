import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, X, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface PopupThreadProps {
  postId: string;
  isPopupThread: boolean;
  replyLimit?: number;
  timeLimitMinutes?: number;
  closedAt?: Date;
  onClose?: () => void;
  onStatusChange?: () => void;
}

interface PopupThreadStatus {
  isClosed: boolean;
  reason: 'time' | 'replies' | 'manual' | null;
  remainingReplies?: number;
  remainingTime?: number;
}

export function PopupThread({ 
  postId, 
  isPopupThread, 
  replyLimit, 
  timeLimitMinutes, 
  closedAt,
  onClose,
  onStatusChange 
}: PopupThreadProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<PopupThreadStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [replyLimitInput, setReplyLimitInput] = useState(replyLimit?.toString() || '10');
  const [timeLimitInput, setTimeLimitInput] = useState(timeLimitMinutes?.toString() || '60');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isPopupThread) {
      checkStatus();
    }
  }, [isPopupThread, postId]);

  const checkStatus = async () => {
    if (!isPopupThread) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkPopupThreadStatus',
          args: { postId }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setStatus(result);
      }
    } catch (error) {
      console.error('Failed to check popup thread status:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPopupThread = async () => {
    if (!user) return;
    
    const replyLimit = parseInt(replyLimitInput);
    const timeLimit = parseInt(timeLimitInput);
    
    if (isNaN(replyLimit) || isNaN(timeLimit) || replyLimit < 1 || timeLimit < 1) {
      alert('Please enter valid numbers for limits');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'createPopupThread',
          args: {
            postId,
            replyLimit,
            timeLimitMinutes: timeLimit
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create popup thread');
      }

      alert('Popup thread created successfully!');
      setShowCreateForm(false);
      onStatusChange?.();
      checkStatus();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create popup thread');
    } finally {
      setCreating(false);
    }
  };

  const closePopupThread = async () => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to close this popup thread?')) return;

    setLoading(true);
    try {
      const response = await fetch('/api/community-health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'closePopupThread',
          args: { postId }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close popup thread');
      }

      alert('Popup thread closed successfully!');
      onStatusChange?.();
      checkStatus();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to close popup thread');
    } finally {
      setLoading(false);
    }
  };

  if (!isPopupThread && !showCreateForm) {
    return (
      <button
        onClick={() => setShowCreateForm(true)}
        className="flex items-center gap-1 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        title="Make this a popup thread"
      >
        <Clock size={14} />
        popup
      </button>
    );
  }

  if (showCreateForm) {
    return (
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
            Create Popup Thread
          </h4>
          <button
            onClick={() => setShowCreateForm(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reply Limit
            </label>
            <input
              type="number"
              value={replyLimitInput}
              onChange={(e) => setReplyLimitInput(e.target.value)}
              min="1"
              max="100"
              className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Limit (minutes)
            </label>
            <input
              type="number"
              value={timeLimitInput}
              onChange={(e) => setTimeLimitInput(e.target.value)}
              min="1"
              max="1440"
              className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={createPopupThread}
              disabled={creating}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded font-mono text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  if (!status) return null;

  if (status.isClosed) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <Lock size={16} className="text-red-600" />
        <div className="flex-1">
          <div className="font-mono text-sm font-semibold text-red-800 dark:text-red-200">
            Thread Closed
          </div>
          <div className="text-xs text-red-600 dark:text-red-300">
            {status.reason === 'replies' && 'Reply limit reached'}
            {status.reason === 'time' && 'Time limit reached'}
            {status.reason === 'manual' && 'Manually closed'}
          </div>
        </div>
        {user && (
          <button
            onClick={onClose}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-mono"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <Clock size={16} className="text-blue-600" />
      <div className="flex-1">
        <div className="font-mono text-sm font-semibold text-blue-800 dark:text-blue-200">
          Popup Thread Active
        </div>
        <div className="text-xs text-blue-600 dark:text-blue-300 space-x-4">
          {status.remainingReplies !== undefined && (
            <span>
              <MessageSquare size={12} className="inline mr-1" />
              {status.remainingReplies} replies left
            </span>
          )}
          {status.remainingTime !== undefined && (
            <span>
              <Clock size={12} className="inline mr-1" />
              {Math.ceil(status.remainingTime / 60000)}m left
            </span>
          )}
        </div>
      </div>
      {user && (
        <button
          onClick={closePopupThread}
          disabled={loading}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-mono disabled:opacity-50"
        >
          {loading ? 'Closing...' : 'Close'}
        </button>
      )}
    </div>
  );
} 