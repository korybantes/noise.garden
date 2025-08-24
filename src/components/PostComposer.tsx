import { useRef, useState, useEffect } from 'react';
import { Send, X, Smile, Clock, MoreHorizontal, Lock, ListPlus, MicOff, Mic, StopCircle, Trash2 } from 'lucide-react';
import { createPost, createPollPost, createMention } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { containsLink, sanitizeLinks } from '../lib/validation';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { useMuteStatus } from '../hooks/useMuteStatus';

import WaveSurfer from 'wavesurfer.js';

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
	const [ttl] = useState<number>(TTL_PRESETS[4].seconds);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isPopupThread, setIsPopupThread] = useState(false);
  const [popupReplyLimit, setPopupReplyLimit] = useState(10);
  const [popupTimeLimit, setPopupTimeLimit] = useState(60);
  const [repliesDisabled, setRepliesDisabled] = useState(false);
  const [asWhisper, setAsWhisper] = useState(false);
	const [asPoll, setAsPoll] = useState(false);
	const [pollQuestion, setPollQuestion] = useState('');
	const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuth();
  const { language } = useLanguage();
  const { muteStatus } = useMuteStatus();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPermission, setAudioPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const [audioSupported, setAudioSupported] = useState(true);


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

  // Request mic permission on mobile
  useEffect(() => {
    if (audioPermission === 'unknown') {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => setAudioPermission('granted'))
        .catch(() => setAudioPermission('denied'));
    }
  }, [audioPermission]);

  useEffect(() => {
    // Check for MediaRecorder and supported MIME types
    let supported = false;
    if (typeof window !== 'undefined' && 'MediaRecorder' in window) {
      const types = [
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/mpeg',
      ];
      supported = types.some(type => MediaRecorder.isTypeSupported(type));
    }
    setAudioSupported(supported);
  }, []);

  const startRecording = async () => {
    if (!audioSupported) {
      alert('Audio recording is not supported on this device/browser.');
      return;
    }
    // Only request permission when user clicks record
    if (audioPermission !== 'granted') {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioPermission('granted');
      } catch {
        setAudioPermission('denied');
        return;
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Prefer supported MIME type
    let mimeType = '';
    if (window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (window.MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (window.MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (window.MediaRecorder.isTypeSupported('audio/mpeg')) {
      mimeType = 'audio/mpeg';
    }
    const recorder = mimeType ? new window.MediaRecorder(stream, { mimeType }) : new window.MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    recorder.start();
    setMediaRecorder(recorder);
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setRecording(false);
    }

  };

  const removeAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }
  };

  // Initialize waveform when audio URL is set
  useEffect(() => {
    if (audioUrl && waveformContainerRef.current && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformContainerRef.current,
        waveColor: '#888',
        progressColor: '#18181b',
        height: 40,
        barWidth: 3,
        barRadius: 3,
        cursorColor: '#18181b',
        barGap: 1,
      });
      wavesurferRef.current.load(audioUrl);
    }
    return () => {
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch (error: any) {
          // Ignore AbortError during cleanup
          if (error?.name !== 'AbortError') {
            console.error('Error destroying wavesurfer:', error);
          }
        }
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl]);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.on('ready', () => {
        setDuration(wavesurferRef.current?.getDuration() || 0);
        setLoaded(true);
      });
      wavesurferRef.current.on('finish', () => setPlaying(false));
      wavesurferRef.current.on('play', () => setPlaying(true));
      wavesurferRef.current.on('pause', () => setPlaying(false));
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (wavesurferRef.current && loaded) {
      wavesurferRef.current.playPause();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
		const postContent = content.trim();
		if (asPoll && replyTo) { return; }
		if ((!postContent && !asPoll && !audioBlob) || !user) return;
		// Only block links in new posts, not in replies (chat)
		if (!replyTo && containsLink(postContent)) {
			setContent(sanitizeLinks(postContent));
			return;
		}

    setLoading(true);
    try {
      let audioUrlToSend: string | null = null;
      if (audioBlob) {
        // Check audio duration (max 45 seconds)
        const audio = document.createElement('audio');
        audio.src = URL.createObjectURL(audioBlob);
        await new Promise((resolve) => {
          audio.onloadedmetadata = () => resolve(null);
        });
        if (audio.duration > 45) {
          alert('Audio posts can be max 45 seconds.');
          setLoading(false);
          return;
        }
        // Upload audio to /api/uploads
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        const uploadRes = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) {
          alert('Audio upload failed.');
          setLoading(false);
          return;
        }
        const uploadData = await uploadRes.json();
        audioUrlToSend = uploadData.url;
        console.log('Audio uploaded successfully:', uploadData);
        console.log('Audio URL to send:', audioUrlToSend);
      }
      if (replyTo && asWhisper) {
        // Send whisper to API
        const response = await fetch('/api/whispers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            action: 'createWhisper',
            args: { content: postContent, parentId: replyTo.id }
          })
        });
        if (!response.ok) {
          console.error('Failed to create whisper');
        }
      } else if (asPoll && !replyTo) {
			const opts = pollOptions.map(o => o.trim()).filter(Boolean).slice(0, 5);
			await createPollPost(
				user.userId,
				pollQuestion.trim() || postContent,
				opts,
				ttl,
				null
			);
			setPollQuestion('');
			setPollOptions(['','']);
			setAsPoll(false);
		} else {
			// Create post with permanent audio URL
			console.log('Creating post with audio URL:', audioUrlToSend);
			const newPost = await createPost(
				user.userId, 
				postContent, 
				replyTo?.id, 
				undefined, 
				undefined, // imageUrl
				audioUrlToSend, // audioUrl
				ttl,
				false, // isWhisper
				repliesDisabled,
				isPopupThread,
				isPopupThread ? popupReplyLimit : undefined,
				isPopupThread ? popupTimeLimit : undefined
			);
			console.log('Post created:', newPost);

      // Check for mentions and create them
      const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
      const mentions = postContent.match(mentionRegex);
      if (mentions && newPost) {
        for (const mention of mentions) {
          const username = mention.slice(1); // Remove @
          if (username !== user.username) { // Don't mention yourself
            try {
              await createMention(newPost.id, username, user.userId);
            } catch (error) {
              console.error('Failed to create mention:', error);
            }
          }
        }
      }
      }
      setContent('');
      setAudioBlob(null);
      setAudioUrl(null);
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
      if ((content.trim() || asPoll) && !loading) {
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
      {muteStatus.muted && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <MicOff size={16} />
            <div className="flex-1">
              <p className="font-mono text-sm font-medium">You are muted</p>
              <p className="font-mono text-xs text-red-600 dark:text-red-300">
                {muteStatus.reason && `Reason: ${muteStatus.reason}`}
                {muteStatus.expiresAt && ` • Expires: ${new Date(muteStatus.expiresAt).toLocaleString()}`}
                {muteStatus.mutedByUsername && ` • Muted by: @${muteStatus.mutedByUsername}`}
              </p>
            </div>
          </div>
        </div>
      )}

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
				{!asPoll && (
					<textarea 
						ref={textareaRef} 
						value={content} 
						onChange={(e) => setContent(e.target.value)} 
						placeholder={replyTo ? t('writeYourReply', language) : t('shareRandomThought', language)} 
						className="w-full p-3 bg-transparent border-0 resize-none focus:outline-none font-mono text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 text-base" 
						rows={3} 
						maxLength={280} 
						onKeyDown={handleKeyDown}
						disabled={muteStatus.muted}
					/>
				)}

        <div className="flex items-center justify-between mt-3 relative">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowEmojis(!showEmojis)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <Smile size={16} />
            </button>
            <button 
              type="button" 
              onClick={startRecording}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              disabled={audioPermission === 'denied' || recording || !audioSupported}
            >
              <Mic size={16} />
            </button>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{asPoll ? 'poll' : `${content.length}/280`}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-mono text-gray-500 dark:text-gray-400">
              <Clock size={12} />
              {t('expiresIn', language)} {formatTTL(ttl)}
            </div>
            
            {replyTo && (
              <label className="inline-flex items-center gap-1 text-xs font-mono text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={asWhisper} onChange={(e) => setAsWhisper(e.target.checked)} />
                <Lock size={12} /> whisper to OP
              </label>
            )}

				{!replyTo && (
					<label className="inline-flex items-center gap-1 text-xs font-mono text-gray-600 dark:text-gray-300">
						<input type="checkbox" checked={asPoll} onChange={(e) => setAsPoll(e.target.checked)} />
						<ListPlus size={12} /> poll
					</label>
				)}
            
            <button type="button" onClick={() => setShowAdvancedOptions(!showAdvancedOptions)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <MoreHorizontal size={16} />
            </button>
            
            <button type="submit" disabled={loading || (!asPoll && !content.trim()) || muteStatus.muted} className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 p-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
        
        {showEmojis && !asPoll && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
            <div className="grid grid-cols-10 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button 
                  key={emoji} 
                  onClick={() => {
                    insertEmoji(emoji);
                    setShowEmojis(false);
                  }} 
                  className="w-6 h-6 text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {showAdvancedOptions && !asPoll && (
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
                    <input type="number" min="1" max="100" value={popupReplyLimit} onChange={(e) => setPopupReplyLimit(Number(e.target.value))} className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm font-mono text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">{t('timeLimitMinutes', language)}</label>
                    <input type="number" min="1" max="1440" value={popupTimeLimit} onChange={(e) => setPopupTimeLimit(Number(e.target.value))} className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm font-mono text-base" />
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

        {asPoll && !replyTo && (
          <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 mb-3">Create a poll</h3>
            <div className="space-y-2">
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono text-base" maxLength={120} />
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={opt} onChange={(e) => setPollOptions(prev => prev.map((p, idx) => idx===i ? e.target.value : p))} placeholder={`Option ${i+1}`} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono text-base" maxLength={60} />
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))} className="text-xs font-mono text-gray-600 dark:text-gray-400">remove</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button type="button" disabled={pollOptions.length >= 5} onClick={() => setPollOptions(prev => [...prev, ''])} className="ng-btn">add option</button>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">up to 5 options</span>
              </div>
            </div>
          </div>
        )}
        {!asPoll && recording && (
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded font-mono text-xs"
            >
              <StopCircle size={16} /> Stop Recording
            </button>
          </div>
        )}
        
        {!asPoll && audioBlob && audioUrl && (
          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3 w-full">
              <button 
                type="button"
                onClick={togglePlay} 
                disabled={!loaded}
                className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {playing ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1"/>
                    <rect x="14" y="4" width="4" height="16" rx="1"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                )}
              </button>
              <div ref={waveformContainerRef} className="flex-1 min-w-0" />
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 ml-2 min-w-[30px] text-right">
                {loaded ? duration.toFixed(1) + 's' : '...'}
              </span>
              <button type="button" onClick={removeAudio} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          </div>
        )}
        {!audioSupported && (
          <div className="text-red-500 text-sm font-mono mt-2">Audio recording is not supported on this device/browser.</div>
        )}

      </form>
    </div>
  );
}