import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Share2, Flag, Trash2, MoreHorizontal, Link2, Lock, ShieldCheck, ShieldAlert, Repeat2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Post as PostType, deletePost, getAcceptedMentionsForPost, getPostById } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '../hooks/useNavigation';
import { RepostModal } from './RepostModal';
import { PostFlag } from './PostFlag';
import { InstagramPostGenerator } from './InstagramPostGenerator';
import { PostComposer } from './PostComposer';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { ReplyThread } from './ReplyThread';
import { Poll } from './Poll';
import { WhisperBadge } from './WhisperBadge';

interface PostProps {
  post: PostType;
  onReply: (post: PostType) => void;
  onViewReplies?: (post: PostType) => void;
  onDeleted?: (postId: string) => void;
  onReposted?: () => void;
  isReply?: boolean;
  inlineComposer?: boolean; // when true, open composer inside this component; otherwise delegate to parent
}

function linkifyHashtags(text: string, setView: (view: any) => void, setCurrentRoom: (room: string | null) => void): JSX.Element[] {
  // React escapes text content automatically; split by hashtags without additional escaping
  const parts = text.split(/(#[\p{L}\p{N}_-]+)/u);
  return parts.map((part, idx) => {
    if (part.startsWith('#') && part.length > 1) {
      const tag = part;
      return (
        <button key={idx} onClick={() => {
          setCurrentRoom(tag);
          setView('chat');
        }} className="underline decoration-dotted">
          {tag}
        </button>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function renderPostContent(content: string, mentions: string[] = [], setProfileUsername: (username: string) => void, setView: (view: any) => void, setCurrentRoom: (room: string | null) => void): JSX.Element {
  // Split by mentions first, then by hashtags
  let parts = [content];
  
  // Replace mentions with placeholders
  mentions.forEach((username, index) => {
    const newParts: string[] = [];
    parts.forEach(part => {
      const split = part.split(`@${username}`);
      split.forEach((subPart, subIndex) => {
        if (subIndex > 0) {
          newParts.push(`__MENTION_${index}__`);
        }
        if (subPart) {
          newParts.push(subPart);
        }
      });
    });
    parts = newParts;
  });
  
  // Now process hashtags and mentions
  const elements: JSX.Element[] = [];
  parts.forEach((part, idx) => {
    if (part.startsWith('__MENTION_')) {
      const mentionIndex = parseInt(part.replace('__MENTION_', '').replace('__', ''));
      const username = mentions[mentionIndex];
      elements.push(
        <button 
          key={`mention-${idx}`} 
          onClick={() => {
            setProfileUsername(username);
            setView('profile');
          }} 
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          @{username}
        </button>
      );
    } else {
      // Process hashtags in this part
      const hashtagElements = linkifyHashtags(part, setView, setCurrentRoom);
      hashtagElements.forEach((element, elementIdx) => {
        elements.push(
          <span key={`${idx}-${elementIdx}`}>
            {element}
          </span>
        );
      });
    }
  });
  
  return <>{elements}</>;
}

export function Post({ post, onReply, onViewReplies, onDeleted, onReposted, isReply = false, inlineComposer = true }: PostProps) {
  const [showActions, setShowActions] = useState(false);
  const [showRepost, setShowRepost] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [acceptedMentions, setAcceptedMentions] = useState<string[]>([]);
  const [originalPost, setOriginalPost] = useState<PostType | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { setView, setProfileUsername, setCurrentRoom } = useNavigation();
  const { language } = useLanguage();

  // Load accepted mentions for this post
  useEffect(() => {
    const loadMentions = async () => {
      try {
        const mentions = await getAcceptedMentionsForPost(post.id);
        setAcceptedMentions(mentions.map(m => m.mentioned_username));
      } catch (error) {
        console.error('Failed to load mentions:', error);
      }
    };
    loadMentions();
  }, [post.id]);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Load original post content for reposts
  useEffect(() => {
    const loadOriginalPost = async () => {
      if (post.repost_of) {
        try {
          const original = await getPostById(post.repost_of);
          setOriginalPost(original);
        } catch (error) {
          console.error('Failed to load original post:', error);
        }
      }
    };
    loadOriginalPost();
  }, [post.repost_of]);

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
          {post.is_whisper && <WhisperBadge />}
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

      {/* Show original post content for reposts */}
      {post.repost_of && originalPost && (
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">@{originalPost.username}</span>
            <span className="text-gray-300">•</span>
            <span className="text-xs font-mono text-gray-400">{formatDistanceToNow(new Date(originalPost.created_at), { addSuffix: true })}</span>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 font-mono">
            {originalPost.content}
          </div>
        </div>
      )}

      {post.image_url && (
        <div className="mb-2"><img src={post.image_url.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/')} alt="post" className="rounded border border-gray-200 dark:border-gray-800" /></div>
      )}

      <div className="font-mono text-sm text-gray-800 dark:text-gray-100 leading-relaxed mb-3 whitespace-pre-wrap">{renderPostContent(post.content, acceptedMentions, setProfileUsername, setView, setCurrentRoom)}</div>

      {/* Poll (lazy-render) */}
      <Poll postId={post.id} />
      
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
      
      {(showActions || isReply) && (
        <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
          <button onClick={() => { if (inlineComposer) { setShowReplyComposer(true); } else { onReply(post); } }} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('replyToThisPost', language)}><MessageCircle size={14} />{t('reply', language)}</button>
          {post.reply_count && post.reply_count > 0 && onViewReplies && !isReply && (
            <button onClick={() => onViewReplies(post)} className="text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('viewReplies', language)}>{post.reply_count} {post.reply_count === 1 ? t('reply', language) : t('replies', language)}</button>
          )}
          <button onClick={() => setShowRepost(true)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('repostThisContent', language)}><Repeat2 size={14} /> {t('repost', language)}</button>
          <button onClick={() => sharePostAsImage()} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title={t('shareAsImage', language)}><Share2 size={14} /> {t('share', language)}</button>
          
          {/* More Actions Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button 
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="more actions"
            >
              <MoreHorizontal size={14} />
            </button>
            
            {showMoreMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  {/* Community Health Actions */}
                  {user && user.userId !== post.user_id && (
                    <button 
                      onClick={() => { setShowFlagModal(true); setShowMoreMenu(false); }} 
                      className="w-full text-left px-4 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <Flag size={14} />
                      {t('flag', language)}
                    </button>
                  )}
                  
                  {user && user.userId === post.user_id && !isReply && (
                    <button 
                      onClick={() => { setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <Lock size={14} />
                      toggle replies
                    </button>
                  )}
                  
                  {canDelete && (
                    <button 
                      onClick={() => { handleDelete(); setShowMoreMenu(false); }} 
                      className="w-full text-left px-4 py-2 text-sm font-mono text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      {t('delete', language)}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showReplyComposer && !post.replies_disabled && (
        <div className="mt-3">
          <PostComposer
            replyTo={{ id: post.id, username: post.username, content: post.content }}
            onCancelReply={() => setShowReplyComposer(false)}
            onPostCreated={() => { setShowReplyComposer(false); setRefreshKey(k => k + 1); }}
          />
        </div>
      )}

      {/* Nested replies for replies */}
      {isReply && (
        <div className="mt-3"><ReplyThread parent={post} refreshKey={refreshKey} /></div>
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
