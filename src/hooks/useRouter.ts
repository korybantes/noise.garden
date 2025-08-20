import { createContext, useContext, useEffect, useMemo, useState, ReactNode, createElement } from 'react';

export type Route =
  | { name: 'feed' }
  | { name: 'profile' }
  | { name: 'post'; params: { id: string } };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  // Supported forms: 
  // 1) "/post/<id>" (preferred)
  // 2) "post/<id>"
  // 3) "post-<id>" (back-compat)
  const cleaned = h.startsWith('/') ? h.slice(1) : h;
  if (!cleaned) return { name: 'feed' };

  // back-compat: post-<id>
  const legacyMatch = cleaned.match(/^post-(.+)$/);
  if (legacyMatch) {
    return { name: 'post', params: { id: legacyMatch[1] } };
  }

  const parts = cleaned.split('/');
  if (parts[0] === 'post' && parts[1]) {
    return { name: 'post', params: { id: parts[1] } };
  }

  return { name: 'feed' };
}

interface RouterContextValue {
  route: Route;
  navigateToPost: (id: string) => void;
  navigateToFeed: () => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const value = useMemo<RouterContextValue>(() => ({
    route,
    navigateToPost: (id: string) => {
      window.location.hash = `#/post/${id}`;
    },
    navigateToFeed: () => {
      window.location.hash = '';
    },
  }), [route]);

  return createElement(RouterContext.Provider, { value }, children);
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}
