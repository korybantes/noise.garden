import { createContext, useContext, useMemo, useState, ReactNode, createElement } from 'react';

type View = 'feed' | 'profile' | 'chat';

interface NavigationContextValue {
  view: View;
  setView: (v: View) => void;
  profileUsername: string | null;
  setProfileUsername: (u: string | null) => void;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
  chatActive: boolean;
  setChatActive: (v: boolean) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('feed');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatActive, setChatActive] = useState(false);

  const value = useMemo(
    () => ({ view, setView, profileUsername, setProfileUsername, showChat, setShowChat, chatActive, setChatActive }),
    [view, profileUsername, showChat, chatActive]
  );
  return createElement(NavigationContext.Provider, { value }, children);
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
} 