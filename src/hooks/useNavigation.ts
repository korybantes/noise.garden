import { createContext, useContext, useMemo, useState, ReactNode, createElement, useEffect, useRef } from 'react';

type View = 'feed' | 'profile' | 'chat' | 'invite' | 'settings' | 'notifications' | 'news' | 'notificationTester';

interface NavigationContextValue {
  view: View;
  setView: (v: View) => void;
  profileUsername: string | null;
  setProfileUsername: (u: string | null) => void;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
  chatActive: boolean;
  setChatActive: (v: boolean) => void;
  currentRoom: string | null;
  setCurrentRoom: (r: string | null) => void;
  clearRoom: () => void;
  swipeProgress: number;
  isSwiping: boolean;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('feed');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const lastView = useRef<View>(view);

  useEffect(() => {
    const order: View[] = ['feed', 'profile', 'chat', 'invite', 'notifications', 'news', 'notificationTester'];
    const SWIPE_THRESHOLD = 80;
    const SWIPE_DEADZONE = 20;
    const VERTICAL_DEADZONE = 30; // Allow vertical scrolling

    const onTouchStart = (e: TouchEvent) => {
      // Disable swipe nav entirely on settings view
      if (view === 'settings') return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      dragging.current = true;
      setIsSwiping(false);
      setSwipeProgress(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (view === 'settings') return; // no swipe feedback or haptics in settings
      if (!dragging.current || startX.current == null || startY.current == null) return;
      
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;
      
      // Only handle horizontal swipes, let vertical swipes (pull-to-refresh) pass through
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_DEADZONE && Math.abs(dy) < VERTICAL_DEADZONE) {
        e.preventDefault();
        setIsSwiping(true);
        
        // Calculate swipe progress for visual feedback
        const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
        setSwipeProgress(progress);
      } else {
        // Reset swipe state if it's a vertical scroll
        setIsSwiping(false);
        setSwipeProgress(0);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (view === 'settings') return; // no swipe switching or haptics in settings
      if (!dragging.current || startX.current == null || startY.current == null) return;
      
      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;
      
      // Only handle horizontal swipes
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
        const idx = order.indexOf(view);
        let newView: View | null = null;
        
        if (dx < 0 && idx < order.length - 1) {
          newView = order[idx + 1];
        } else if (dx > 0 && idx > 0) {
          newView = order[idx - 1];
        }
        
        if (newView && newView !== view) {
          lastView.current = view;
          setView(newView);
          // Remove haptic feedback for successful swipe
        }
      }
      
      // Reset swipe state
      dragging.current = false;
      startX.current = null;
      startY.current = null;
      setIsSwiping(false);
      setSwipeProgress(0);
    };

    // Use passive: true for all events to avoid interfering with pull-to-refresh
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    
    return () => {
      window.removeEventListener('touchstart', onTouchStart as any);
      window.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('touchend', onTouchEnd as any);
    };
  }, [view]);

  const value = useMemo(
    () => ({ 
      view, 
      setView, 
      profileUsername, 
      setProfileUsername, 
      showChat, 
      setShowChat, 
      chatActive, 
      setChatActive, 
      currentRoom, 
      setCurrentRoom, 
      clearRoom: () => setCurrentRoom(null),
      swipeProgress,
      isSwiping
    }),
    [view, profileUsername, showChat, chatActive, currentRoom, swipeProgress, isSwiping]
  );
  
  return createElement(NavigationContext.Provider, { value }, children);
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
} 