import React, { useState, useEffect } from 'react';
import { MessageSquare, Eye, EyeOff, Trash2, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface Whisper {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  expiresAt: string;
  parentContent: string;
  parentUserId: string;
}

export function Whispers() {
  const { user } = useAuth();
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [whisperContent, setWhisperContent] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadWhispers();
  }, []);

  const loadWhispers = async () => {
    try {
      const response = await fetch('/api/whispers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'getUserWhispers',
          args: {}
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load whispers');
      }

      const result = await response.json();
      setWhispers(result.whispers);
    } catch (error) {
      setError('Failed to load whispers');
      console.error('Error loading whispers:', error);
    } finally {
      setLoading(false);
    }
  };

  const createWhisper = async () => {
    if (!selectedPostId || !whisperContent.trim()) {
      setError('Please select a post and enter whisper content');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/whispers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'createWhisper',
          args: {
            content: whisperContent.trim(),
            parentId: selectedPostId
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create whisper');
      }

      const result = await response.json();
      
      // Show success message
      alert('Whisper created successfully! Only the original poster can see this reply.');
      
      // Reset form and reload
      setShowCreateForm(false);
      setSelectedPostId('');
      setWhisperContent('');
      loadWhispers();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create whisper');
    } finally {
      setCreating(false);
    }
  };

  const deleteWhisper = async (whisperId: string) => {
    if (!confirm('Are you sure you want to delete this whisper? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/whispers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          action: 'deleteWhisper',
          args: { whisperId }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete whisper');
      }

      loadWhispers();
    } catch (error) {
      setError('Failed to delete whisper');
      console.error('Error deleting whisper:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-4 text-center font-mono text-sm text-gray-500 dark:text-gray-400">
        Loading whispers...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
          <Lock size={16} />
          <span className="font-mono text-sm">Whispers</span>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3 py-1.5 bg-purple-600 text-white rounded font-mono text-xs hover:bg-purple-700"
        >
          {showCreateForm ? 'Cancel' : 'New Whisper'}
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
            Create Whisper
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">
                Post ID to reply to
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
                Whisper content
              </label>
              <textarea
                value={whisperContent}
                onChange={(e) => setWhisperContent(e.target.value)}
                placeholder="Enter your private reply..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
              />
            </div>
            <button
              onClick={createWhisper}
              disabled={creating || !selectedPostId || !whisperContent.trim()}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded font-mono text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Whisper'}
            </button>
          </div>
        </div>
      )}

      {whispers.length === 0 ? (
        <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400 py-8">
          No whispers yet
        </div>
      ) : (
        <div className="space-y-3">
          {whispers.map((whisper) => (
            <div key={whisper.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Lock size={12} />
                  <span>Private reply to post</span>
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span>{formatDate(whisper.createdAt)}</span>
                </div>
                
                <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {whisper.content}
                </div>
                
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded border-l-2 border-gray-300 dark:border-gray-600">
                  <div className="text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">
                    Original post:
                  </div>
                  <div className="text-sm font-mono text-gray-800 dark:text-gray-200">
                    {whisper.parentContent.length > 150 
                      ? `${whisper.parentContent.substring(0, 150)}...` 
                      : whisper.parentContent
                    }
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    Expires: {formatDate(whisper.expiresAt)}
                  </div>
                  <button
                    onClick={() => deleteWhisper(whisper.id)}
                    className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-300"
                    title="Delete whisper"
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
        <p>• Whispers are private replies only visible to the original poster</p>
        <p>• Use whispers for sensitive or personal responses</p>
        <p>• Whispers follow the same expiration rules as regular posts</p>
        <p>• Only you and moderators can see your whispers</p>
      </div>
    </div>
  );
} 