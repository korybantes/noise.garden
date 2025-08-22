import { createContext, useContext, useMemo, useState, ReactNode, createElement, useEffect, useRef } from 'react';

type View = 'feed' | 'profile' | 'chat' | 'invite' | 'settings';

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
    const order: View[] = ['feed', 'profile', 'chat', 'invite'];
    const SWIPE_THRESHOLD = 80;
    const SWIPE_DEADZONE = 20;

    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      dragging.current = true;
      setIsSwiping(false);
      setSwipeProgress(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current || startX.current == null || startY.current == null) return;
      
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;
      
      // Check if it's a horizontal swipe (not vertical scrolling)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_DEADZONE) {
        e.preventDefault();
        setIsSwiping(true);
        
        // Calculate swipe progress for visual feedback
        const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
        setSwipeProgress(progress);
        
        // Add haptic feedback when crossing threshold
        if (Math.abs(dx) > SWIPE_THRESHOLD && !dragging.current) {
          // Trigger haptic feedback
          if ('vibrate' in navigator) {
            try { (navigator as any).vibrate?.(10); } catch {}
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!dragging.current || startX.current == null) return;
      
      const dx = e.changedTouches[0].clientX - startX.current;
      
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
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
          
          // Add haptic feedback for successful swipe
          if ('vibrate' in navigator) {
            try { (navigator as any).vibrate?.(20); } catch {}
          }
        }
      }
      
      // Reset swipe state
      dragging.current = false;
      startX.current = null;
      startY.current = null;
      setIsSwiping(false);
      setSwipeProgress(0);
    };

    // Add passive: false to allow preventDefault for horizontal swipes
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