import React, { useRef, useState, useEffect } from 'react';
import { Send, X, Smile } from 'lucide-react';
import { createPost } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { Select } from './ui/Select';
import { containsLink, sanitizeLinks } from '../lib/validation';

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuth();

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
			await createPost(user.userId, content.trim(), replyTo?.id, undefined, null, ttl);
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
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const next = `${before}${emoji}${after}`;
    setContent(next);
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  };

  return (
		<div className="ng-card p-4 mb-6">
      {replyTo && (
        <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-gray-500 dark:text-gray-400">replying to @{replyTo.username}</div>
            <button onClick={onCancelReply} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{replyTo.content}</div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
				<textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder={replyTo ? "write your reply..." : "share a random thought... use #hashtags to create rooms"} className="w-full p-3 bg-transparent border-0 resize-none focus:outline-none font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100" rows={3} maxLength={280} />
        
        <div className="flex items-center justify-between mt-3 relative">
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-gray-400 dark:text-gray-500">{content.length}/280</div>
            <div className="relative">
              <button type="button" onClick={() => setShowEmojis(v => !v)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors" title="Insert emoji">
                <Smile size={16} />
              </button>
              {showEmojis && (
                <div className="absolute z-10 mt-2 w-56 p-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow">
                  <div className="grid grid-cols-8 gap-1 text-xl">
                    {COMMON_EMOJIS.map(e => (
                      <button key={e} type="button" className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded" onClick={() => { insertEmoji(e); setShowEmojis(false); }} aria-label={`Insert ${e}`}>{e}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
					</div>
					
					<div className="flex items-center gap-3">
						<label className="font-mono text-xs text-gray-500 dark:text-gray-400">expires in</label>
						<Select value={ttl} options={TTL_PRESETS.map(p => ({ value: p.seconds, label: p.label }))} onChange={(v) => setTtl(Number(v))} ariaLabel="expires in" />
          </div>
          
					<button type="submit" disabled={!content.trim() || loading} className="mt-3 ng-btn">
            <Send size={16} />
            {replyTo ? 'reply' : 'post'}
          </button>
        </div>
      </form>
    </div>
  );
}