import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, ArrowLeft, Tag } from 'lucide-react';
import { Post as PostType, getRandomPosts, getPostById, getPostReplies } from '../lib/database';
import { Post } from './Post';
import { PostComposer } from './PostComposer';
import { loadFeedSettings, contentMatchesMuted, isWithinQuietHours } from '../lib/settings';
import { useRouter } from '../hooks/useRouter';
import { useNavigation } from '../hooks/useNavigation';
import { Select } from './ui/Select';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { hapticLight } from '../lib/haptics';
import { ENABLE_PULL_TO_REFRESH } from '../lib/flags';

export function Feed() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'random'>('newest');
  const [replyTo, setReplyTo] = useState<PostType | null>(null);
  const [viewingReplies, setViewingReplies] = useState<{ post: PostType; replies: PostType[] } | null>(null);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [pullToRefresh, setPullToRefresh] = useState({ isPulling: false, distance: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const { route } = useRouter();
  const { language } = useLanguage();
  const { currentRoom, clearRoom } = useNavigation();

  const containerRef = useRef<HTMLDivElement>(null);

  const settings = useMemo(() => loadFeedSettings(), [settingsVersion]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || 
                           ('ontouchstart' in window) || 
                           (navigator.maxTouchPoints > 0);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const clearRoomFilter = () => {
    clearRoom();
  };

  const persistCache = (items: PostType[]) => {
    try {
      const payload = { ts: Date.now(), items: items.slice(0, 50) };
      localStorage.setItem('feed_cache', JSON.stringify(payload));
    } catch {}
  };

  const hydrateFromCache = () => {
    try {
      const raw = localStorage.getItem('feed_cache');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.items) return false;
      setPosts(parsed.items as PostType[]);
      setLoading(false);
      return true;
    } catch {
      return false;
    }
  };

  const loadPosts = async (opts?: { silent?: boolean; reset?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const newOffset = opts?.reset ? 0 : offset;
      const newPosts = await getRandomPosts(20, newOffset, sortBy);
      if (opts?.reset) {
      setPosts(newPosts);
        setOffset(20);
        // Don't persist cache when refreshing to ensure fresh data
      } else {
        setPosts(prev => [...prev, ...newPosts]);
        setOffset(prev => prev + 20);
        persistCache([...posts, ...newPosts]);
      }
      setHasMore(newPosts.length === 20);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      if (!opts?.silent) setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadPosts({ silent: true });
  }, [loadingMore, hasMore, offset, sortBy]);

  const loadReplies = async (post: PostType) => {
    try {
      const replies = await getPostReplies(post.id);
      setViewingReplies({ post, replies });
      setReplyTo(null);
    } catch (error) {
      console.error('Failed to load replies:', error);
    }
  };

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1000) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // Initial load; try cache first
  useEffect(() => {
    const hadCache = hydrateFromCache();
    loadPosts({ reset: true, silent: hadCache });
    const onFocus = () => loadPosts({ silent: true, reset: true });
    const onVis = () => { if (!document.hidden) onFocus(); };
    const onPop = () => setSettingsVersion(v => v + 1);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('popstate', onPop);
    };
  }, [sortBy]);

  // Respond to post route
  useEffect(() => {
    (async () => {
      if (route.name === 'post') {
        const post = await getPostById(route.params.id);
        if (post) {
          await loadReplies(post);
        }
      } else {
        setViewingReplies(null);
      }
    })();
  }, [route?.name === 'post' ? (route as any).params?.id : '']);

  // Pull-to-refresh via downward swipe at top (mobile only)
  useEffect(() => {
    if (!isMobile || !ENABLE_PULL_TO_REFRESH) return;
    
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    let pullTimeout: number | null = null;

    const pullStateRef = { get: () => pullToRefresh, set: (v: any) => setPullToRefresh(v) };

    const resetPullState = () => {
      pullStateRef.set({ isPulling: false, distance: 0 });
      isPulling = false;
      if (pullTimeout) {
        window.clearTimeout(pullTimeout);
        pullTimeout = null;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger when at the very top of the page
      if (window.scrollY === 0 && window.pageYOffset === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || window.scrollY > 0) return;
      currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY);
      if (distance > 0) {
        // Add resistance to the pull (make it feel more natural)
        const resistedDistance = distance * 0.6;
        pullStateRef.set({ isPulling: true, distance: Math.min(resistedDistance, 120) });
      }
    };

    const handleTouchEnd = () => {
      const state = pullStateRef.get();
      if (state.isPulling && state.distance > 60) {
        // Trigger refresh with haptic feedback
        hapticLight();
        // Clear cache and force fresh load
        try {
          localStorage.removeItem('feed_cache');
        } catch {}
        loadPosts({ silent: false, reset: true });
      }
      resetPullState();
    };

    // Touch events for mobile only
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart as any);
      document.removeEventListener('touchmove', handleTouchMove as any);
      document.removeEventListener('touchend', handleTouchEnd as any);
      resetPullState();
    };
  }, [isMobile]);

  const handlePostCreated = () => {
    if (viewingReplies) {
      loadReplies(viewingReplies.post);
    } else {
      loadPosts({ silent: true, reset: true });
      setReplyTo(null);
    }
  };

  const handleDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const filtered = useMemo(() => {
    const muted = settings.mutedWords || [];
    const filteredByMute = posts.filter(p => !contentMatchesMuted(`${p.content} ${p.username}`, muted));
    if (!currentRoom) return filteredByMute;
    return filteredByMute.filter(p => p.content.toLowerCase().includes(currentRoom.toLowerCase()));
  }, [posts, settings, currentRoom]);

  const quiet = isWithinQuietHours(settings.quietHours);

  if (viewingReplies) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-950 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto px-2 sm:px-4">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => { 
                setViewingReplies(null); 
                window.history.pushState({}, '', window.location.pathname + window.location.search);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors"
            >
              <ArrowLeft size={16} />
              {t('backToFeed', language)}
            </button>
          </div>

          <Post
            post={viewingReplies.post}
            onReply={setReplyTo}
            onDeleted={handleDeleted}
            inlineComposer={false}
          />

          {replyTo && replyTo.id === viewingReplies.post.id && (
            <div className="mt-6">
              <PostComposer
                onPostCreated={handlePostCreated}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
              />
            </div>
          )}

          <div className="mt-6 space-y-4">
            {viewingReplies.replies.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-mono text-sm">
                {t('noReplies', language)}
              </div>
            ) : (
              viewingReplies.replies.map((reply) => (
                <Post
                  key={reply.id}
                  post={reply}
                  onReply={setReplyTo}
                  isReply={true}
                  onDeleted={handleDeleted}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-y-auto">
      <div className="w-full max-w-3xl mx-auto px-2 sm:px-6" ref={containerRef}>
        {/* Enhanced Pull to refresh indicator - only show on mobile */}
        {isMobile && (
          <div className={`text-center py-2 sm:py-4 transition-all duration-200 ease-out ${
            pullToRefresh.isPulling ? 'opacity-100' : 'opacity-60'
          }`}>
            <div className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm font-mono">
              <RefreshCw 
                size={14} 
                className={`sm:w-4 sm:h-4 transition-transform duration-200 ${
                  pullToRefresh.isPulling 
                    ? pullToRefresh.distance > 60 
                      ? 'text-green-600 dark:text-green-400 rotate-180' 
                      : 'text-gray-600 dark:text-gray-400'
                    : 'text-gray-400 dark:text-gray-500'
                } ${loading ? 'animate-spin' : ''}`}
              />
              <span className={`transition-colors duration-200 ${
                pullToRefresh.isPulling 
                  ? pullToRefresh.distance > 60 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
            {pullToRefresh.isPulling 
                  ? pullToRefresh.distance > 60 
                ? 'Release to refresh' 
                : 'Keep pulling...'
              : '↓ Pull down to refresh'
            }
              </span>
            </div>
            {/* Progress bar */}
            {pullToRefresh.isPulling && (
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-blue-500 dark:bg-blue-400 h-1 rounded-full transition-all duration-200 ease-out"
                  style={{ 
                    width: `${Math.min((pullToRefresh.distance / 60) * 100, 100)}%`,
                    backgroundColor: pullToRefresh.distance > 60 ? '#10b981' : '#3b82f6'
                  }}
                />
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-8 gap-3 sm:gap-0">
          <div>
            {currentRoom ? (
              <>
                <h1 className="text-lg sm:text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">{currentRoom}</h1>
                <div className="mt-1 sm:mt-2 flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <Tag size={12} className="sm:w-3.5 sm:h-3.5" /> {t('room', language)}
                  </span>
                  <button 
                    onClick={clearRoomFilter} 
                    className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {t('leaveRoom', language)}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-lg sm:text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">{t('noiseGarden', language)}</h1>
                <p className="text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400 mt-1">{t('randomThoughtsShuffledDaily', language)}</p>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Select 
              value={sortBy} 
              options={[
                { value: 'newest', label: t('newest', language) },
                { value: 'oldest', label: t('oldest', language) },
                { value: 'random', label: t('random', language) }
              ]} 
              onChange={(v) => setSortBy(v as 'newest' | 'oldest' | 'random')} 
              ariaLabel={t('sortBy', language)}
            />
          </div>
        </div>

        {!replyTo && !quiet && (
          <div id="ng-composer" className="mb-4 sm:mb-8">
            <div className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow-sm sm:shadow-lg border border-gray-200 dark:border-gray-800 p-3 sm:p-6">
              <PostComposer onPostCreated={handlePostCreated} />
            </div>
          </div>
        )}

        {quiet && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 border border-amber-200 dark:border-amber-800 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-900/20 text-xs sm:text-sm font-mono text-amber-700 dark:text-amber-300">
            {t('quietHoursActive', language)}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 sm:py-12 font-mono text-gray-500 dark:text-gray-300">
            <div className="animate-pulse">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:mb-4"></div>
              <span className="text-sm sm:text-base">{t('loadingRandomThoughts', language)}</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center">
              <span className="text-xl sm:text-2xl">🌱</span>
            </div>
            <p className="font-mono text-gray-500 dark:text-gray-400 mb-2 text-base sm:text-lg">{t('nothingHere', language)}</p>
            <p className="font-mono text-xs sm:text-sm text-gray-400 dark:text-gray-500">{t('tryRemovingMutes', language)}</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-6">
            {filtered.map((post) => (
              <div key={post.id} className="group">
                <div className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden">
                  <Post
                    post={post}
                    onReply={setReplyTo}
                    onViewReplies={loadReplies}
                    onDeleted={handleDeleted}
                    onReposted={() => loadPosts({ silent: true, reset: true })}
                    inlineComposer={false}
                  />
                </div>
                {replyTo && replyTo.id === post.id && (
                  <div className="mt-3 sm:mt-4 ml-3 sm:ml-6">
                    <div className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-3 sm:p-4">
                      <PostComposer onPostCreated={handlePostCreated} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loadingMore && (
              <div className="text-center py-6 sm:py-8 font-mono text-gray-500 dark:text-gray-300">
                <div className="animate-pulse">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-2"></div>
                  <span className="text-sm">{t('loadingMore', language)}</span>
                </div>
              </div>
            )}
            
            {!hasMore && filtered.length > 0 && (
              <div className="text-center py-6 sm:py-8 font-mono text-gray-500 dark:text-gray-300">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-2 sm:mb-3 flex items-center justify-center">
                  <span className="text-base sm:text-lg">✨</span>
                </div>
                <span className="text-sm sm:text-base">{t('noMorePosts', language)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}