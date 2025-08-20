import React, { useRef, useState } from 'react';
import { Send, X, Smile } from 'lucide-react';
import { createPost } from '../lib/database';
import { useAuth } from '../hooks/useAuth';

interface PostComposerProps {
  onPostCreated: () => void;
  replyTo?: { id: string; username: string; content: string };
  onCancelReply?: () => void;
}

const COMMON_EMOJIS = ['😀','😁','😂','🤣','😊','😍','🤔','😎','🙃','🤯','🥲','🙏','🔥','✨','🤝','👍','👀','💡','💬','💭','🌱'];

export function PostComposer({ onPostCreated, replyTo, onCancelReply }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setLoading(true);
    try {
      await createPost(user.userId, content.trim(), replyTo?.id);
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
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-6">
      {replyTo && (
        <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
              replying to @{replyTo.username}
            </div>
            <button
              onClick={onCancelReply}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
            {replyTo.content}
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={replyTo ? "write your reply..." : "share a random thought..."}
          className="w-full p-3 bg-transparent border-0 resize-none focus:outline-none font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100"
          rows={3}
          maxLength={280}
        />
        
        <div className="flex items-center justify-between mt-3 relative">
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-gray-400 dark:text-gray-500">
            {content.length}/280
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojis(v => !v)}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="Insert emoji"
              >
                <Smile size={16} />
              </button>
              {showEmojis && (
                <div className="absolute z-10 mt-2 w-56 p-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow">
                  <div className="grid grid-cols-8 gap-1 text-xl">
                    {COMMON_EMOJIS.map(e => (
                      <button
                        key={e}
                        type="button"
                        className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        onClick={() => { insertEmoji(e); setShowEmojis(false); }}
                        aria-label={`Insert ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={!content.trim() || loading}
            className="flex items-center gap-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-md font-mono text-sm hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
            {replyTo ? 'reply' : 'post'}
          </button>
        </div>
      </form>
    </div>
  );
}