import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Users, Shuffle } from 'lucide-react';
import * as Ably from 'ably';
import { ChatClient, ChatMessageEvent, RoomStatusChange, TypingSetEvent } from '@ably/chat';
import { useNavigation } from '../hooks/useNavigation';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';

let ablySingleton: Ably.Realtime | null = null;
let chatSingleton: ChatClient | null = null;

interface ChatWindowProps {
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'you' | 'peer';
  timestamp: Date;
}

export function ChatWindow({ onClose }: ChatWindowProps) {
  const { setView, setChatActive, chatActive } = useNavigation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>(chatActive ? 'connected' : 'disconnected');
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [ablyClient, setAblyClient] = useState<Ably.Realtime | null>(ablySingleton);
  const [chatClient, setChatClient] = useState<ChatClient | null>(chatSingleton);
  const [lobbyRoom, setLobbyRoom] = useState<any>(null);
  const [peerRoom, setPeerRoom] = useState<any>(null);
  const [typingText, setTypingText] = useState<string | null>(null);
  const [reactionBubbles, setReactionBubbles] = useState<Array<{ id: number; emoji: string; x: number; y: number }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingClearTimer = useRef<number | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const { language } = useLanguage();

  useEffect(() => {
    const end = messagesEndRef.current;
    const container = end?.parentElement;
    if (end && container) {
      try {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } catch {
        // no-op
      }
    }
  }, [messages]);

  const addMessage = (text: string, sender: 'you' | 'peer') => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const reactionNameToEmoji = (name?: string) => {
    switch (name) {
      case 'like': return '👍';
      case 'heart': return '❤️';
      case 'joy': return '😂';
      case 'fire': return '🔥';
      default: return '';
    }
  };

  const spawnReactions = (name?: string, count: number = 6) => {
    const emoji = reactionNameToEmoji(name);
    if (!emoji) return;
    const now = Date.now();
    const newBubbles: Array<{ id: number; emoji: string; x: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
      const id = now + i;
      const x = 10 + Math.random() * 80; // 10% - 90%
      const y = 20 + Math.random() * 50; // 20% - 70%
      newBubbles.push({ id, emoji, x, y });
      // schedule removal
      window.setTimeout(() => {
        setReactionBubbles(prev => prev.filter(b => b.id !== id));
      }, 1200 + Math.random() * 600);
    }
    setReactionBubbles(prev => [...prev, ...newBubbles]);
  };

  // Initialize Ably once
  useEffect(() => {
    if (ablySingleton && chatSingleton) {
      setAblyClient(ablySingleton);
      setChatClient(chatSingleton);
      return;
    }
    const key = import.meta.env.VITE_ABLY_KEY;
    if (!key) return;
    const client = new Ably.Realtime({ key, clientId: `user-${Math.random().toString(36).slice(2)}` });
    const chat = new ChatClient(client);
    ablySingleton = client;
    chatSingleton = chat;
    setAblyClient(client);
    setChatClient(chat);

    // Do not close on unmount to keep connection alive; explicit disconnect handles cleanup
    return () => {};
  }, []);

  // Toggle chat-active class on document.body based on connection status
  useEffect(() => {
    if (connectionStatus === 'connected') {
      document.body.classList.add('chat-active');
    } else {
      document.body.classList.remove('chat-active');
    }
    
    return () => {
      document.body.classList.remove('chat-active');
    };
  }, [connectionStatus]);

  // Presence count in lobby
  useEffect(() => {
    if (!chatClient) return;
    let unsubStatus: (() => void) | null = null;
    let unsubPresence: (() => void) | null = null;

    (async () => {
      const room = await chatClient.rooms.get('lobby');
      setLobbyRoom(room);
      unsubStatus = room.onStatusChange((change: RoomStatusChange) => {
        if (change.current === 'attached') {
          // nothing
        }
      }).off;

      // Track presence members
      await room.attach();
      await room.presence.enter();
      const updateCount = async () => {
        const members = await room.presence.get();
        setOnlineCount(members.length);
      };
      unsubPresence = room.presence.subscribe(() => updateCount()).unsubscribe;
      updateCount();
    })().catch(console.error);

    return () => {
      try { unsubStatus && unsubStatus(); } catch {}
      try { unsubPresence && unsubPresence(); } catch {}
    };
  }, [chatClient]);

  const connectToPeerRoom = async (roomName: string) => {
    if (!chatClient) return;
    setConnectionStatus('connecting');
    setMessages([]);
    try {
      const room = await chatClient.rooms.get(roomName);
      setPeerRoom(room);
      const { unsubscribe } = room.messages.subscribe((evt: ChatMessageEvent) => {
        const msgId = (evt.message as any)?.id || `${evt.message.clientId}-${(evt.message as any)?.timestamp || ''}-${evt.message.text}`;
        if (msgId && seenMessageIdsRef.current.has(msgId)) return;
        if (msgId) seenMessageIdsRef.current.add(msgId);
        const fromSelf = evt.message.clientId && ablyClient?.auth.clientId && evt.message.clientId === ablyClient.auth.clientId;
        if (evt.message.text) {
          addMessage(evt.message.text, fromSelf ? 'you' : 'peer');
        }
      });

      // Typing indicators
      const typingSub = room.typing.subscribe((event: TypingSetEvent) => {
        const me = ablyClient?.auth.clientId;
        const others = Array.from(event.currentlyTyping).filter((id) => id !== me);
        if (typingClearTimer.current) {
          window.clearTimeout(typingClearTimer.current);
          typingClearTimer.current = null;
        }
        if (others.length === 0) {
          setTypingText(null);
        } else if (others.length === 1) {
          setTypingText(`${others[0]} is typing…`);
        } else {
          setTypingText('multiple people are typing…');
        }
        typingClearTimer.current = window.setTimeout(() => setTypingText(null), 15000) as unknown as number;
      });

      // Reactions → bubbles
      const reactionsSub = room.reactions.subscribe((evt: any) => {
        if (evt?.reaction?.isSelf) return;
        spawnReactions(evt.reaction?.name);
      });

      // Detect peer disconnects via presence
      const { unsubscribe: presenceUnsub } = room.presence.subscribe('leave' as any, (pev: any) => {
        const me = ablyClient?.auth.clientId;
        const who = pev?.member?.clientId;
        if (who && me && who !== me) {
          setConnectionStatus('disconnected');
          setPeerRoom(null);
          setRoomId(null);
          setTypingText(null);
          setChatActive(false);
          addMessage('Your pair disconnected.', 'you');
        }
      });

      await room.attach();
      try { await room.presence.enter(); } catch {}
      setConnectionStatus('connected');
      setChatActive(true);
      addMessage('Connected to anonymous peer. Messages are not stored.', 'you');

      return () => {
        try { unsubscribe(); } catch {}
        try { typingSub.unsubscribe(); } catch {}
        try { reactionsSub.unsubscribe(); } catch {}
        try { presenceUnsub(); } catch {}
      };
    } catch (e) {
      setConnectionStatus('disconnected');
      console.error(e);
    }
  };

  // Very simple matchmaking
  const findRandomPeer = async () => {
    if (!chatClient || !lobbyRoom) return;
    if (onlineCount <= 1) {
      setConnectionStatus('disconnected');
      setMessages([]);
      addMessage('Nobody else is online at the moment. Try again later.', 'you');
      return;
    }
    setConnectionStatus('connecting');
    setMessages([]);
    addMessage('Looking for anonymous peer...', 'you');
    
    const candidateRoom = `pair-${Math.random().toString(36).slice(2)}`;

    // Try to claim a pending invite
    const invites = await lobbyRoom.messages.history({ direction: 'backwards', limit: 20 });
    const items = Array.isArray(invites?.items) ? invites.items : [];
    const readText = (x: any) => x?.message?.text ?? x?.text;
    const readMeta = (x: any) => x?.message?.metadata ?? x?.metadata;
    const pending = items.find((it: any) => readText(it) === 'invite');

    if (pending) {
      const peerRoomName = readMeta(pending)?.room as string;
      await connectToPeerRoom(peerRoomName);
      // mark consumed
      await lobbyRoom.messages.send({ text: 'invite-consumed', metadata: { room: peerRoomName } });
      setRoomId(peerRoomName);
      return;
    }

    // No pending invite: publish one and wait for a consumer
    await lobbyRoom.messages.send({ text: 'invite', metadata: { room: candidateRoom } });
    setRoomId(candidateRoom);

    const { unsubscribe } = lobbyRoom.messages.subscribe(async (evt: any) => {
      const evtText = readText(evt);
      const evtMeta = readMeta(evt);
      if (evtText === 'invite-consumed' && evtMeta?.room === candidateRoom) {
        unsubscribe();
        await connectToPeerRoom(candidateRoom);
      }
    });

    // Safety: auto-cancel after 20s
    setTimeout(() => {
      try { unsubscribe(); } catch {}
      if (connectionStatus !== 'connected') {
        setConnectionStatus('disconnected');
        addMessage('No peer found. Try again.', 'you');
      }
    }, 20000);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !peerRoom) return;
    await peerRoom.messages.send({ text: inputText });
    try { await peerRoom.typing.stop(); } catch {}
    setInputText('');
  };

  const onInputChange = async (value: string) => {
    setInputText(value);
    if (peerRoom) {
      try { await peerRoom.typing.keystroke(); } catch {}
    }
  };

  const disconnect = async () => {
    try {
      if (peerRoom) { try { await peerRoom.typing.stop(); } catch {} }
      if (peerRoom) { try { await peerRoom.presence.leave(); } catch {} }
      await peerRoom?.detach();
    } catch {}
    setConnectionStatus('disconnected');
    setPeerRoom(null);
    setRoomId(null);
    setTypingText(null);
    setChatActive(false);
    addMessage('Disconnected.', 'you');
  };

  const findNewPair = async () => {
    await disconnect();
    setTimeout(() => { findRandomPeer(); }, 0);
  };

  const sendReaction = async (name: string) => {
    if (!peerRoom) return;
    try { await peerRoom.reactions.send({ name }); } catch {}
    spawnReactions(name);
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between px-2 sm:px-4 py-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gray-600 dark:text-gray-300" />
            <h2 className="font-mono font-bold text-gray-900 dark:text-gray-100">{t('anonymousChat', language)}</h2>
          </div>
          <button
            onClick={() => { disconnect(); setView('feed'); onClose?.(); }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-4 text-xs font-mono text-gray-600 dark:text-gray-300 flex items-center justify-between">
        <span>{t('online', language)}: {onlineCount}</span>
        <span className={connectionStatus === 'connected' ? 'text-green-600' : connectionStatus === 'connecting' ? 'text-amber-600' : 'text-gray-500'}>
          {t(connectionStatus, language)}
        </span>
      </div>

      {typingText && (
        <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 py-1 text-xs font-mono text-gray-500 dark:text-gray-400">{typingText}</div>
      )}

      <div className="max-w-2xl mx-auto flex-1 overflow-y-auto p-4 space-y-2 relative">
        <div className="pointer-events-none absolute inset-0">
          {reactionBubbles.map(b => (
            <div key={b.id} className="absolute animate-bounce text-2xl" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
              {b.emoji}
            </div>
          ))}
        </div>

        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 font-mono text-sm mt-8">
            <p>{t('noMessagesYet', language)}</p>
            <p className="text-xs mt-1">{t('findPeerToStartChatting', language)}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`text-sm font-mono ${
                message.sender === 'you' 
                  ? 'text-gray-600 dark:text-gray-300 text-right' 
                  : 'text-gray-800 dark:text-gray-100'
              }`}
            >
              <span className={`inline-block p-2 rounded-lg max-w-xs ${
                message.sender === 'you'
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : 'bg-blue-50 dark:bg-blue-900/30'
              }`}>
                {message.text}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 p-4 max-w-2xl mx-auto">
        {connectionStatus === 'disconnected' ? (
          <>
            <button
              onClick={findRandomPeer}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2 px-4 rounded-md font-mono text-sm hover:bg-gray-800 transition-colors"
            >
              <Shuffle size={16} />
              {t('findRandomPeer', language)}
            </button>
          </>
        ) : connectionStatus === 'connecting' ? (
          <div className="text-center font-mono text-sm text-gray-500 dark:text-gray-400">
            {t('connecting', language)}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600 font-mono text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                {t('connected', language)} {t('anonymously', language)} {roomId ? `(${roomId})` : ''}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={findNewPair}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-mono text-xs transition-colors"
                >
                  {t('findNewPair', language)}
                </button>
                <button
                  onClick={disconnect}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-mono text-xs transition-colors"
                >
                  {t('disconnect', language)}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => sendReaction('like')} className="text-sm" title="like">👍</button>
              <button onClick={() => sendReaction('heart')} className="text-sm" title="heart">❤️</button>
              <button onClick={() => sendReaction('joy')} className="text-sm" title="joy">😂</button>
              <button onClick={() => sendReaction('fire')} className="text-sm" title="fire">🔥</button>
            </div>
            
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => onInputChange(e.target.value)}
                onBlur={() => { if (peerRoom) { try { peerRoom.typing.stop(); } catch {} } }}
                placeholder={t('typeAnonymously', language)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                maxLength={200}
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="bg-gray-900 text-white p-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}