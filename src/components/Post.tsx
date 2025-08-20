import { useState } from 'react';
import { MessageCircle, Clock, Trash2, Repeat2, ShieldAlert, ShieldCheck, Link2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Post as PostType, deletePost } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '../hooks/useNavigation';
import { RepostModal } from './RepostModal';

interface PostProps {
  post: PostType;
  onReply: (post: PostType) => void;
  onViewReplies?: (post: PostType) => void;
  onDeleted?: (postId: string) => void;
  onReposted?: () => void;
  isReply?: boolean;
}

export function Post({ post, onReply, onViewReplies, onDeleted, onReposted, isReply = false }: PostProps) {
  const [showActions, setShowActions] = useState(false);
  const [showRepost, setShowRepost] = useState(false);
  const { user } = useAuth();
  const { setView, setProfileUsername } = useNavigation();

  const canDelete = !!user && (user.userId === post.user_id || user.role === 'admin' || user.role === 'moderator');

  const handleDelete = async () => {
    if (!user) return;
    onDeleted?.(post.id);
    const ok = await deletePost(post.id, user.userId);
    if (!ok) console.warn('Delete failed');
  };

  const RoleBadge = () => {
    if (post.role === 'admin') return <span className="text-red-500" aria-label="admin"><ShieldCheck size={14} /></span>;
    if (post.role === 'moderator') return <span className="text-amber-500" aria-label="moderator"><ShieldAlert size={14} /></span>;
    return null;
  };

  const openProfile = () => {
    setProfileUsername(post.username);
    setView('profile');
  };

  const openOriginal = () => {
    if (!post.repost_of) return;
    window.location.hash = `#post-${post.repost_of}`;
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
          <span>expires in {formatDistanceToNow(new Date(post.expires_at))}</span>
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

      <div className="font-mono text-sm text-gray-800 dark:text-gray-100 leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</div>

      {(showActions || isReply) && !isReply && (
        <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
          <button onClick={() => onReply(post)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><MessageCircle size={14} />reply</button>
          {post.reply_count && post.reply_count > 0 && onViewReplies && (
            <button onClick={() => onViewReplies(post)} className="text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors">{post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}</button>
          )}
          <button onClick={() => setShowRepost(true)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="repost"><Repeat2 size={14} /> repost</button>
          {canDelete && (
            <button onClick={handleDelete} className="flex items-center gap-1 text-xs font-mono hover:text-red-600 dark:hover:text-red-400 transition-colors" aria-label="delete"><Trash2 size={14} /> delete</button>
          )}
        </div>
      )}

      {showRepost && (
        <RepostModal postId={post.repost_of ? post.repost_of : post.id} onClose={() => setShowRepost(false)} onReposted={() => { setShowRepost(false); onReposted?.(); }} />
      )}
    </div>
  );
}
