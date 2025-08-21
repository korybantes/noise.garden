import { useRef, useState, useEffect } from 'react';
import { Send, X, Smile, Clock, MoreHorizontal } from 'lucide-react';
import { createPost } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { containsLink, sanitizeLinks } from '../lib/validation';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';

interface PostComposerProps {
  onPostCreated: () => void;
  replyTo?: { id: string; username: string; content: string };
  onCancelReply?: () => void;
	initialContent?: string;
}

const COMMON_EMOJIS = ['😀','😁','😂','🤣','😊','😍','🤔','😎','🙃','🤯','🥲','🙏','🔥','✨','🤝','👍','👀','💬','💭','🌱'];
const TTL_PRESETS: { label: string; seconds: number }[] = [
	{ label: '1h', seconds: 60 * 60 },
	{ label: '24h', seconds: 60 * 60 * 24 },
	{ label: '3d', seconds: 60 * 60 * 24 * 3 },
	{ label: '7d', seconds: 60 * 60 * 24 * 7 },
	{ label: '30d', seconds: 60 * 60 * 24 * 30 },
];

export function PostComposer({ onPostCreated, replyTo, onCancelReply, initialContent = '' }: PostComposerProps) {
	const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
	const [ttl, setTtl] = useState<number>(TTL_PRESETS[4].seconds);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isPopupThread, setIsPopupThread] = useState(false);
  const [popupReplyLimit, setPopupReplyLimit] = useState(10);
  const [popupTimeLimit, setPopupTimeLimit] = useState(60);
  const [repliesDisabled, setRepliesDisabled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuth();
  const { language } = useLanguage();

	// Auto-fill hashtag when in a room
	useEffect(() => {
		if (!initialContent && !replyTo) {
			try {
				const url = new URL(window.location.href);
				const room = url.searchParams.get('room');
				if (room && !content.includes(room)) {
					setContent(room + ' ');
				}
			} catch {}
		}
	}, [initialContent, replyTo]); // Removed 'content' from dependencies to prevent infinite loop

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
		if (!content.trim() || !user) return;
		if (containsLink(content)) {
			setContent(sanitizeLinks(content));
			return;
		}

    setLoading(true);
    try {
			await createPost(
        user.userId, 
        content.trim(), 
        replyTo?.id, 
        undefined, 
        null, 
        ttl,
        false, // isWhisper
        repliesDisabled,
        isPopupThread,
        isPopupThread ? popupReplyLimit : undefined,
        isPopupThread ? popupTimeLimit : undefined
      );
      setContent('');
      onPostCreated();
      onCancelReply?.();
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setLoading(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    const newContent = content.slice(0, pos) + emoji + content.slice(pos);
    setContent(newContent);
    
    // Focus and set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(pos + emoji.length, pos + emoji.length);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (content.trim() && !loading) {
        handleSubmit(e as any);
      }
    }
  };

  const formatTTL = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
		<div className="ng-card p-4 mb-6">
      {replyTo && (
        <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-gray-500 dark:text-gray-400">{t('replyingTo', language)} @{replyTo.username}</div>
            <button onClick={onCancelReply} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{replyTo.content}</div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
				<textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder={replyTo ? t('writeYourReply', language) : t('shareRandomThought', language)} className="w-full p-3 bg-transparent border-0 resize-none focus:outline-none font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100" rows={3} maxLength={280} onKeyDown={handleKeyDown} />
        
        <div className="flex items-center justify-between mt-3 relative">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowEmojis(!showEmojis)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <Smile size={16} />
            </button>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{content.length}/280</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-mono text-gray-500 dark:text-gray-400">
              <Clock size={12} />
              {t('expiresIn', language)} {formatTTL(ttl)}
            </div>
            
            <button type="button" onClick={() => setShowAdvancedOptions(!showAdvancedOptions)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <MoreHorizontal size={16} />
            </button>
            
            <button type="submit" disabled={loading || !content.trim()} className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 p-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
        
        {showEmojis && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
            <div className="grid grid-cols-10 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button key={emoji} onClick={() => insertEmoji(emoji)} className="w-6 h-6 text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {showAdvancedOptions && (
          <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('advancedOptions', language)}</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="popupThread" checked={isPopupThread} onChange={(e) => setIsPopupThread(e.target.checked)} className="rounded" />
                <label htmlFor="popupThread" className="text-sm font-mono text-gray-700 dark:text-gray-300">{t('popupThread', language)}</label>
              </div>
              
              {isPopupThread && (
                <div className="ml-6 space-y-2">
                  <div>
                    <label className="block text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">{t('replyLimit', language)}</label>
                    <input type="number" min="1" max="100" value={popupReplyLimit} onChange={(e) => setPopupReplyLimit(Number(e.target.value))} className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">{t('timeLimitMinutes', language)}</label>
                    <input type="number" min="1" max="1440" value={popupTimeLimit} onChange={(e) => setPopupTimeLimit(Number(e.target.value))} className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <input type="checkbox" id="repliesDisabled" checked={repliesDisabled} onChange={(e) => setRepliesDisabled(e.target.checked)} className="rounded" />
                <label htmlFor="repliesDisabled" className="text-sm font-mono text-gray-700 dark:text-gray-300">{t('disableReplies', language)}</label>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}