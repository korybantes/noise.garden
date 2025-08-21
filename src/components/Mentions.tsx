import { useEffect, useState } from 'react';
import { AtSign, Check, X, Clock, User, Shield } from 'lucide-react';
import { Mention, getPendingMentions, respondToMention, getPostById } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { loadFeedSettings } from '../lib/settings';

interface MentionsProps {
  onClose: () => void;
  onMentionsUpdated?: () => void;
}

export function Mentions({ onClose, onMentionsUpdated }: MentionsProps) {
  const { user } = useAuth();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [mentionsDisabled, setMentionsDisabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkMentionsPrivacy();
    loadMentions();
  }, [user]);

  const checkMentionsPrivacy = () => {
    try {
      const settings = loadFeedSettings();
      const privacy = (settings as any).privacy || {};
      setMentionsDisabled(!!privacy.disableMentions);
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
    }
  };

  const loadMentions = async () => {
    if (!user) return;
    try {
      const pending = await getPendingMentions(user.userId);
      setMentions(pending);
    } catch (error) {
      console.error('Failed to load mentions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (mentionId: string, status: 'accepted' | 'declined') => {
    setResponding(mentionId);
    try {
      await respondToMention(mentionId, status);
      // Remove the mention from the list
      setMentions(prev => prev.filter(m => m.id !== mentionId));
      // Notify parent component to update header badge
      onMentionsUpdated?.();
    } catch (error) {
      console.error('Failed to respond to mention:', error);
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading mentions...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show disabled mentions message if user has disabled mentions
  if (mentionsDisabled) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-800">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield size={24} className="text-gray-400" />
              <AtSign size={24} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100 mb-2">Mentions Disabled</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You have disabled @mentions in your privacy settings. Others cannot mention you, and you won't receive mention notifications.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              To enable mentions, go to Settings → Privacy and uncheck "Disable @mentions"
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[80vh] border border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <AtSign size={20} className="text-blue-600" />
            <h2 className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100">Mentions</h2>
            {mentions.length > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-mono px-2 py-1 rounded-full">
                {mentions.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {mentions.length === 0 ? (
            <div className="text-center py-8">
              <AtSign size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-mono">No pending mentions</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">When someone @mentions you, it will appear here for approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mentions.map((mention) => (
                <MentionCard
                  key={mention.id}
                  mention={mention}
                  onRespond={handleRespond}
                  responding={responding === mention.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MentionCardProps {
  mention: Mention;
  onRespond: (mentionId: string, status: 'accepted' | 'declined') => void;
  responding: boolean;
}

function MentionCard({ mention, onRespond, responding }: MentionCardProps) {
  const [postContent, setPostContent] = useState<string>('');

  useEffect(() => {
    loadPostContent();
  }, [mention.post_id]);

  const loadPostContent = async () => {
    try {
      const post = await getPostById(mention.post_id);
      if (post) {
        setPostContent(post.content);
      }
    } catch (error) {
      console.error('Failed to load post content:', error);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <User size={16} className="text-gray-500" />
          <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
            @{mention.from_username} mentioned you
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock size={12} />
          {formatTime(mention.created_at)}
        </div>
      </div>

      {/* Post content preview */}
      <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">
          {postContent || 'Loading...'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onRespond(mention.id, 'accepted')}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md font-mono text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          <Check size={16} />
          Accept
        </button>
        <button
          onClick={() => onRespond(mention.id, 'declined')}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md font-mono text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <X size={16} />
          Decline
        </button>
      </div>
    </div>
  );
} 