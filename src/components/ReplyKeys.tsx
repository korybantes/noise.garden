import React, { useState, useEffect } from 'react';
import { Key, Clock, Copy, Trash2, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface ReplyKey {
  id: string;
  postId: string;
  creatorUsername: string;
  recipientUsername: string;
  expiresAt: string;
  postContent: string;
}

export function ReplyKeys() {
  const { user } = useAuth();
  const [replyKeys, setReplyKeys] = useState<ReplyKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadReplyKeys();
  }, []);

  const loadReplyKeys = async () => {
    try {
      const response = await fetch('/api/reply-keys', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'getActiveReplyKeys',
          args: {}
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load reply keys');
      }

      const result = await response.json();
      setReplyKeys(result.replyKeys);
    } catch (error) {
      setError('Failed to load reply keys');
      console.error('Error loading reply keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createReplyKey = async () => {
    if (!selectedPostId || !recipientUsername) {
      setError('Please select a post and enter recipient username');
      return;
    }

    setCreating(true);
    try {
      // First get the recipient user ID
      const userResponse = await fetch('/api/app', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'getUserByUsername',
          args: { username: recipientUsername }
        })
      });

      if (!userResponse.ok) {
        throw new Error('Recipient user not found');
      }

      const recipientUser = await userResponse.json();
      if (!recipientUser) {
        throw new Error('Recipient user not found');
      }

      // Create the reply key
      const response = await fetch('/api/reply-keys', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'createReplyKey',
          args: {
            postId: selectedPostId,
            recipientId: recipientUser.id
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create reply key');
      }

      const result = await response.json();
      
      // Show the generated key to the user
      alert(`Reply key created: ${result.replyKey}\n\nShare this key with @${recipientUsername} to continue the conversation. The key expires in 24 hours.`);
      
      // Reset form and reload
      setShowCreateForm(false);
      setSelectedPostId('');
      setRecipientUsername('');
      loadReplyKeys();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create reply key');
    } finally {
      setCreating(false);
    }
  };

  const revokeReplyKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this reply key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/reply-keys', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'revokeReplyKey',
          args: { keyId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to revoke reply key');
      }

      loadReplyKeys();
    } catch (error) {
      setError('Failed to revoke reply key');
      console.error('Error revoking reply key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (loading) {
    return (
      <div className="p-4 text-center font-mono text-sm text-gray-500 dark:text-gray-400">
        Loading reply keys...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Key size={16} />
          <span className="font-mono text-sm">Reply Keys</span>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded font-mono text-xs hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Key'}
        </button>
      </div>

      {error && (
        <div className="p-3 border border-red-200 dark:border-red-800 rounded bg-red-50 dark:bg-red-900/20">
          <div className="font-mono text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {showCreateForm && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
          <h3 className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Create Reply Key
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">
                Post ID
              </label>
              <input
                type="text"
                value={selectedPostId}
                onChange={(e) => setSelectedPostId(e.target.value)}
                placeholder="Enter post ID"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">
                Recipient Username
              </label>
              <input
                type="text"
                value={recipientUsername}
                onChange={(e) => setRecipientUsername(e.target.value)}
                placeholder="Enter recipient username"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
            </div>
            <button
              onClick={createReplyKey}
              disabled={creating || !selectedPostId || !recipientUsername}
              className="w-full px-4 py-2 bg-green-600 text-white rounded font-mono text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Reply Key'}
            </button>
          </div>
        </div>
      )}

      {replyKeys.length === 0 ? (
        <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">
          No active reply keys
        </div>
      ) : (
        <div className="space-y-3">
          {replyKeys.map((key) => (
            <div key={key.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <Users size={12} />
                    <span>@{key.creatorUsername} → @{key.recipientUsername}</span>
                  </div>
                  <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                    {key.postContent.length > 100 
                      ? `${key.postContent.substring(0, 100)}...` 
                      : key.postContent
                    }
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock size={12} />
                    <span>{formatTimeRemaining(key.expiresAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyToClipboard(key.id)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    title="Copy key ID"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => revokeReplyKey(key.id)}
                    className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-300"
                    title="Revoke key"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
        <p>• Reply keys allow 24-hour private conversation continuity</p>
        <p>• Share the generated key with the recipient</p>
        <p>• Keys automatically expire after 24 hours</p>
        <p>• Only the creator can revoke keys</p>
      </div>
    </div>
  );
} 