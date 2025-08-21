import { useEffect, useState } from 'react';
import { getPostReplies, Post as PostType } from '../lib/database';
import { Post } from './Post';

interface ReplyThreadProps {
  parent: PostType;
  refreshKey?: number;
}

export function ReplyThread({ parent, refreshKey = 0 }: ReplyThreadProps) {
  const [replies, setReplies] = useState<PostType[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getPostReplies(parent.id);
      if (active) setReplies(r);
    })();
    return () => { active = false; };
  }, [parent.id, refreshKey]);

  if (replies.length === 0) return null;

  return (
    <div className="space-y-3">
      {replies.map(r => (
        <Post key={r.id} post={r} isReply inlineComposer onReply={() => {}} />
      ))}
    </div>
  );
} 