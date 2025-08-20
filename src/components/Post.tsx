import { useState } from 'react';
import { MessageCircle, Clock, Trash2, Repeat2, ShieldAlert, ShieldCheck, Link2, Share2 } from 'lucide-react';
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

function linkifyHashtags(text: string): JSX.Element[] {
  const parts = text.split(/(#[\p{L}\p{N}_-]+)/u);
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

async function drawAvatar(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await new Promise((res, rej) => { img.onload = () => res(null); img.onerror = rej; });
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI*2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  } catch {}
}

async function sharePostAsImage(post: PostType) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#0b1220' : '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Header with avatar and username
    if (post.avatar_url) {
      await drawAvatar(ctx, post.avatar_url, 120, 160, 96);
    }
    ctx.fillStyle = isDark ? '#f3f4f6' : '#111827';
    ctx.font = 'bold 44px ui-monospace, monospace';
    ctx.fillText(`@${post.username}`, 240, 210);

    // Content
    ctx.font = '48px ui-monospace, monospace';
    const lines = post.content.split('\n').slice(0, 22);
    let y = 360;
    lines.forEach(line => { ctx.fillText(line, 120, y); y += 64; });

    // Footer branding
    ctx.globalAlpha = 0.7;
    ctx.font = '32px ui-monospace, monospace';
    ctx.fillText('posted in noise.garden', 120, 1740);
    ctx.globalAlpha = 1;

    const dataUrl = canvas.toDataURL('image/png');

    if ((navigator as any).canShare && (navigator as any).share) {
      const blob = await (await fetch(dataUrl)).blob();
      await (navigator as any).share({ files: [new File([blob], 'post.png', { type: 'image/png' })], title: 'Share to Instagram Story', text: post.content });
      return;
    }

    const a = document.createElement('a');
    a.href = dataUrl; a.download = 'post.png'; a.click();
  } catch (e) {
    console.warn('Share failed', e);
  }
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

  const returnToFeed = () => {
    window.history.pushState({}, '', window.location.pathname + window.location.search);
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

      <div className="font-mono text-sm text-gray-800 dark:text-gray-100 leading-relaxed mb-3 whitespace-pre-wrap">{linkifyHashtags(post.content)}</div>
      
      {(showActions || isReply) && !isReply && (
        <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
          <button onClick={() => onReply(post)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Reply to this post"><MessageCircle size={14} />reply</button>
          {post.reply_count && post.reply_count > 0 && onViewReplies && (
            <button onClick={() => onViewReplies(post)} className="text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="View replies">{post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}</button>
          )}
          <button onClick={() => setShowRepost(true)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Repost this content"><Repeat2 size={14} /> repost</button>
          <button onClick={() => sharePostAsImage(post)} className="flex items-center gap-1 text-xs font-mono hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Share as image"><Share2 size={14} /> share</button>
          {canDelete && (
            <button onClick={handleDelete} className="flex items-center gap-1 text-xs font-mono hover:text-red-600 dark:hover:text-red-400 transition-colors" title={user?.role === 'admin' || user?.role === 'moderator' ? 'Delete this post (admin/moderator)' : 'Delete your post'}><Trash2 size={14} /> delete</button>
          )}
        </div>
      )}

      {showRepost && (
        <RepostModal postId={post.repost_of ? post.repost_of : post.id} onClose={() => setShowRepost(false)} onReposted={() => { setShowRepost(false); onReposted?.(); }} />
      )}
    </div>
  );
}
