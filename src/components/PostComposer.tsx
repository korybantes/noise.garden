import { useRef, useState, useEffect } from 'react';
import { Send, X, Clock, MoreHorizontal, Lock, ListPlus, MicOff, Mic, StopCircle, Trash2 } from 'lucide-react';
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
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);


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

  // Removed auto permission request to avoid iOS Safari prompting on every refresh.
  // Permission is now requested only when user taps the mic button in startRecording().

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
    // cleanup previous preview before starting a new one
    if (audioUrl) {
      try { URL.revokeObjectURL(audioUrl); } catch {}
      setAudioUrl(null);
    }
    if (wavesurferRef.current) {
      try { wavesurferRef.current.destroy(); } catch {}
      wavesurferRef.current = null;
    }
    setAudioBlob(null);

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
    let startedAt = Date.now();
    const maxMs = 45 * 1000;
    const stopTimer = setTimeout(() => { try { recorder.stop(); } catch {} }, maxMs + 200);

    // timer UI
    setElapsed(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      const e = Date.now() - startedAt;
      setElapsed(Math.min(45, Math.floor(e / 1000)));
    }, 200) as unknown as number;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      clearTimeout(stopTimer);
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      const elapsedMs = Date.now() - startedAt;
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      if (elapsedMs > maxMs + 150) {
        alert('Audio posts can be max 45 seconds.');
        setRecording(false);
        setMediaRecorder(null);
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        return;
      }
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setRecording(false);
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
    };
    recorder.start();
    setMediaRecorder(recorder);
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      try { mediaRecorder.stop(); } catch {}
      setMediaRecorder(null);
      setRecording(false);
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
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
        // Upload raw binary to /api/uploads
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uploadRes = await fetch('/api/uploads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': 'audio.webm',
            'X-File-Type': audioBlob.type || 'audio/webm',
            Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('auth_token') : ''}`
          },
          body: arrayBuffer,
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
      if (audioUrl) { try { URL.revokeObjectURL(audioUrl); } catch {} }
      setAudioUrl(null);
      onPostCreated();
      onCancelReply?.();

    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setLoading(false);
    }
  };

  // (emoji picker removed)

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
		<div className="p-3 sm:p-6">
      {muteStatus.muted && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg">
          <div className="flex items-center gap-2 sm:gap-3 text-red-800 dark:text-red-200">
            <MicOff size={16} className="sm:w-[18px] sm:h-[18px]" />
            <div className="flex-1">
              <p className="font-mono text-sm font-medium">You are muted</p>
              <p className="font-mono text-xs text-red-600 dark:text-red-300 mt-1">
                {muteStatus.reason && `Reason: ${muteStatus.reason}`}
                {muteStatus.expiresAt && ` • Expires: ${new Date(muteStatus.expiresAt).toLocaleString()}`}
                {muteStatus.mutedByUsername && ` • Muted by: @${muteStatus.mutedByUsername}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {replyTo && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono text-gray-600 dark:text-gray-300">{t('replyingTo', language)} @{replyTo.username}</div>
            <button onClick={onCancelReply} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
              <X size={16} />
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-2 font-mono">{replyTo.content}</div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* mic moved to bottom-left action row */}
        {!asPoll && (
          <textarea 
            ref={textareaRef} 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            placeholder={replyTo ? t('writeYourReply', language) : t('shareRandomThought', language)} 
            className="w-full p-3 sm:p-4 bg-transparent border-0 resize-none focus:outline-none font-mono text-sm sm:text-base placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100 leading-relaxed" 
            rows={3} 
            maxLength={280} 
            onKeyDown={handleKeyDown}
            disabled={muteStatus.muted}
          />
        )}
 
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 sm:mt-6 gap-3 sm:gap-0 relative">
          <div className="flex items-center gap-3 sm:gap-4">
            {!asPoll && (
              <button 
                type="button"
                title={recording ? 'Stop' : 'Record'}
                onClick={recording ? stopRecording : startRecording}
                className={`${recording ? 'text-red-600 hover:text-red-700' : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'} transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800`}
                disabled={audioPermission === 'denied' || !audioSupported}
              >
                {recording ? <StopCircle size={18} className="sm:w-5 sm:h-5" /> : <Mic size={18} className="sm:w-5 sm:h-5" />}
              </button>
            )}
            <span className="text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400">{`${content.length}/280`}</span>
            {recording && (
              <span className="text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-300 px-2 sm:px-3 py-1 sm:py-1 bg-red-50 dark:bg-red-900/20 rounded-full">{elapsed}s / 45s</span>
            )}
          </div>
 
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
              {t('expiresIn', language)} {formatTTL(ttl)}
            </div>
 
            {replyTo && (
              <label className="inline-flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-300 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                <input type="checkbox" checked={asWhisper} onChange={(e) => setAsWhisper(e.target.checked)} className="rounded" />
                <Lock size={12} className="sm:w-3.5 sm:h-3.5" /> whisper to OP
              </label>
            )}
 
            {!replyTo && (
              <label className="inline-flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-300 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                <input type="checkbox" checked={asPoll} onChange={(e) => setAsPoll(e.target.checked)} className="rounded" />
                <ListPlus size={12} className="sm:w-3.5 sm:h-3.5" /> poll
              </label>
            )}
 
            <button 
              type="button" 
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)} 
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <MoreHorizontal size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
 
            <button 
              type="submit" 
              disabled={loading || (!asPoll && !content.trim()) || muteStatus.muted} 
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 p-2.5 sm:p-3 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </div>
        
        
        {showAdvancedOptions && !asPoll && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">{t('advancedOptions', language)}</h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <input type="checkbox" id="popupThread" checked={isPopupThread} onChange={(e) => setIsPopupThread(e.target.checked)} className="rounded" />
                <label htmlFor="popupThread" className="text-sm font-mono text-gray-700 dark:text-gray-300">{t('popupThread', language)}</label>
              </div>
              
              {isPopupThread && (
                <div className="ml-4 sm:ml-6 space-y-2 sm:space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">{t('replyLimit', language)}</label>
                    <input type="number" min="1" max="100" value={popupReplyLimit} onChange={(e) => setPopupReplyLimit(Number(e.target.value))} className="w-20 sm:w-24 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-mono text-base" />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">{t('timeLimitMinutes', language)}</label>
                    <input type="number" min="1" max="1440" value={popupTimeLimit} onChange={(e) => setPopupTimeLimit(Number(e.target.value))} className="w-20 sm:w-24 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-mono text-base" />
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 sm:gap-3">
                <input type="checkbox" id="repliesDisabled" checked={repliesDisabled} onChange={(e) => setRepliesDisabled(e.target.checked)} className="rounded" />
                <label htmlFor="repliesDisabled" className="text-sm font-mono text-gray-700 dark:text-gray-300">{t('disableReplies', language)}</label>
              </div>
            </div>
          </div>
        )}

        {asPoll && !replyTo && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">Create a poll</h3>
            <div className="space-y-2 sm:space-y-3">
              <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question" className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-mono text-base" maxLength={120} />
              <div className="space-y-2 sm:space-y-3">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 sm:gap-3">
                    <input value={opt} onChange={(e) => setPollOptions(prev => prev.map((p, idx) => idx===i ? e.target.value : p))} placeholder={`Option ${i+1}`} className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-mono text-base" maxLength={60} />
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))} className="text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-400 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">remove</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                <button type="button" disabled={pollOptions.length >= 5} onClick={() => setPollOptions(prev => [...prev, ''])} className="ng-btn">add option</button>
                <span className="text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400">up to 5 options</span>
              </div>
            </div>
          </div>
        )}
        {!asPoll && audioBlob && audioUrl && (
          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3 sm:gap-4 w-full">
              <button 
                type="button"
                onClick={togglePlay} 
                disabled={!loaded}
                className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {playing ? (
                  <svg width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1"/>
                    <rect x="14" y="4" width="4" height="16" rx="1"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                )}
              </button>
              <div ref={waveformContainerRef} className="flex-1 min-w-0" />
              <span className="text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400 ml-2 min-w-[35px] sm:min-w-[40px] text-right">
                {loaded ? duration.toFixed(1) + 's' : '...'}
              </span>
              <button type="button" onClick={removeAudio} className="text-gray-400 hover:text-red-600 p-1.5 sm:p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"><Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
            </div>
          </div>
        )}
        {!audioSupported && (
          <div className="text-red-500 text-xs sm:text-sm font-mono mt-3 sm:mt-4 p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">Audio recording is not supported on this device/browser.</div>
        )}

      </form>
    </div>
  );
}