import { useState } from 'react';
import { MessageCircle, Share2, Trash2, Flag, Clock, Lock, Repeat2, ShieldAlert, ShieldCheck, Link2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Post as PostType, deletePost } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '../hooks/useNavigation';
import { RepostModal } from './RepostModal';
import { PostFlag } from './PostFlag';
import { PopupThread } from './PopupThread';
import { DoNotReplyToggle } from './DoNotReplyToggle';
import { InstagramPostGenerator } from './InstagramPostGenerator';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';

interface PostProps {
  post: PostType;
  onReply: (post: PostType) => void;
  onViewReplies?: (post: PostType) => void;
  onDeleted?: (postId: string) => void;
  onReposted?: () => void;
  isReply?: boolean;
}

function linkifyHashtags(text: string): JSX.Element[] {
  // First, escape any HTML to prevent XSS and display issues
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
    
  const parts = escapedText.split(/(#[\p{L}\p{N}_-]+)/u);
  return parts.map((part, idx) => {
    if (part.startsWith('#') && part.length > 1) {
      const tag = part;
      return (
        <button key={idx} onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set('room', tag);
          window.history.pushState({}, '', url.toString());
          window.dispatchEvent(new PopStateEvent('popstate'));
        }} className="underline decoration-dotted">
          {tag}
        </button>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function Post({ post, onReply, onViewReplies, onDeleted, onReposted, isReply = false }: PostProps) {
  const [showActions, setShowActions] = useState(false);
  const [showRepost, setShowRepost] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const { user } = useAuth();
  const { setView, setProfileUsername } = useNavigation();
  const { language } = useLanguage();

  const canDelete = !!user && (user.userId === post.user_id || user.role === 'admin' || user.role === 'moderator');

  const handleDelete = async () => {
    if (!user) return;
    onDeleted?.(post.id);
    const ok = await deletePost(post.id, user.userId);
    if (!ok) console.warn('Delete failed');
  };

  const sharePostAsImage = () => {
    // Show Instagram story generator modal
    setShowInstagramModal(true);
  };

  const RoleBadge = () => {
    if (post.role === 'admin') {
      return (
        <span className="relative group">
          <ShieldCheck size={14} className="text-red-500" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-mono bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            admin
          </div>
        </span>
      );
    }
    if (post.role === 'moderator') {
      return (
        <span className="relative group">
          <ShieldAlert size={14} className="text-amber-500" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-mono bg-gray-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            moderator
          </div>
        </span>
      );
    }
    return null;
  };

  const openProfile = () => {
    setProfileUsername(post.username);
    setView('profile');
  };

  const openOriginal = () => {
    if (!post.repost_of) return;
    window.location.hash = `#/post/${post.repost_of}`;
  };

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 transition-shadow hover:shadow-sm ${isReply ? 'ml-6 border-l-4 border-l-gray-200 dark:border-l-gray-800' : ''}`} onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {post.avatar_url && <img src={post.avatar_url.replace('/upload/', '/upload/f_auto,q_auto,w_64,h_64,c_fill,g_face/')} alt="avatar" className="w-6 h-6 rounded-full object-cover" />}
          <button onClick={openProfile} className="font-mono text-sm text-gray-600 dark:text-gray-300 hover:underline">@{post.username}</button>
          <RoleBadge />
          <span className="text-gray-300">•</span>
          <span className="text-xs font-mono text-gray-400 flex items-center gap-1"><Clock size={12} />{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
        </div>
        <div className="text-xs font-mono text-gray-300 dark:text-gray-500 flex items-center gap-3">
          <span>{t('expiresIn', language)} {formatDistanceToNow(new Date(post.expires_at))}</span>
        </div>
      </div>
      
      {post.repost_of && (
        <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
          <Repeat2 size={12} /> reposted
          <button onClick={openOriginal} className="inline-flex items-center gap-1 underline">
            <Link2 size={12} /> view original
          </button>
      </div>
      )}

      {post.image_url && (
        <div className="mb-2"><img src={post.image_url.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/')} alt="post" className="rounded border border-gray-200 dark:border-gray-800" /></div>
      )}

      <div className="font-mono text-sm text-gray-800 dark:text-gray-100 leading-relaxed mb-3 whitespace-pre-wrap">{linkifyHashtags(post.content)}</div>
      
      {/* Status Indicators for Community Health Features */}
      {post.is_quarantined && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-xs font-mono">
          ⚠️ {t('postQuarantined', language)}
        </div>
      )}

      {post.replies_disabled && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 text-xs font-mono">
          🔒 {t('repliesDisabled', language)}
        </div>
      )}
      
      {(showActions || isReply) && !isReply && (
        <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
          <button onClick={() => onReply(post)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('replyToThisPost', language)}><MessageCircle size={14} />{t('reply', language)}</button>
          {post.reply_count && post.reply_count > 0 && onViewReplies && (
            <button onClick={() => onViewReplies(post)} className="text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('viewReplies', language)}>{post.reply_count} {post.reply_count === 1 ? t('reply', language) : t('replies', language)}</button>
          )}
          <button onClick={() => setShowRepost(true)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('repostThisContent', language)}><Repeat2 size={14} /> {t('repost', language)}</button>
          <button onClick={() => sharePostAsImage()} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('shareAsImage', language)}><Share2 size={14} /> {t('share', language)}</button>
          
          {/* Community Health Actions - Only show when hovering */}
          {user && user.userId !== post.user_id && (
            <button 
              onClick={() => setShowFlagModal(true)} 
              className="flex items-center gap-1 text-xs font-mono hover:text-red-500 dark:hover:text-red-400 transition-colors" 
              title={t('flagThisPost', language)}
            >
              <Flag size={14} /> {t('flag', language)}
            </button>
          )}
          
          {user && user.userId === post.user_id && (
            <>
              <DoNotReplyToggle
                postId={post.id}
                repliesDisabled={post.replies_disabled || false}
                onToggle={() => {
                  // Refresh post data if needed
                  // You can implement a refresh function here
                }}
              />
              
              {!post.parent_id && (
                <PopupThread
                  postId={post.id}
                  isPopupThread={post.is_popup_thread || false}
                  replyLimit={post.popup_reply_limit}
                  timeLimitMinutes={post.popup_time_limit}
                  closedAt={post.popup_closed_at}
                  onStatusChange={() => {
                    // Refresh post data if needed
                  }}
                />
              )}
            </>
          )}
          
          {canDelete && (
            <button onClick={handleDelete} className="flex items-center gap-1 text-xs font-mono hover:text-red-600 dark:hover:text-red-400 transition-colors" title={user?.role === 'admin' || user?.role === 'moderator' ? t('deleteThisPostAdmin', language) : t('deleteYourPost', language)}><Trash2 size={14} /> {t('delete', language)}</button>
          )}
        </div>
      )}

      {/* Community Health Features - PostActions Component */}
      {/* The PostActions component is removed, so these features are now directly in the action buttons */}
      {post.is_quarantined && (
        <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-xs font-mono">
          <Flag size={14} /> {t('quarantined', language)}
        </div>
      )}
      {post.replies_disabled && (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-xs font-mono">
          <Lock size={14} /> {t('repliesDisabled', language)}
        </div>
      )}

      {showRepost && (
        <RepostModal postId={post.repost_of ? post.repost_of : post.id} onClose={() => setShowRepost(false)} onReposted={() => { setShowRepost(false); onReposted?.(); }} />
      )}

      {/* Flag Modal */}
      {showFlagModal && (
        <PostFlag
          postId={post.id}
          onClose={() => setShowFlagModal(false)}
          onFlagged={() => setShowFlagModal(false)}
        />
      )}

      {/* Instagram Post Generator Modal */}
      {showInstagramModal && (
        <InstagramPostGenerator
          post={{
            id: post.id,
            content: post.content,
            username: post.username,
            avatar_url: post.avatar_url,
            created_at: post.created_at
          }}
          onClose={() => setShowInstagramModal(false)}
        />
      )}
    </div>
  );
}
