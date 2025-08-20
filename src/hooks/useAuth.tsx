import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { verifyToken, getStoredToken, clearToken, AuthToken } from '../lib/auth';

interface AuthContextType {
  user: AuthToken | null;
	login: (token: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
		(async () => {
    const token = getStoredToken();
    if (token) {
				const decoded = await verifyToken(token);
      if (decoded) {
        setUser(decoded);
      } else {
        clearToken();
      }
    }
    setIsLoading(false);
		})()
  }, []);

	const login = async (token: string) => {
		const decoded = await verifyToken(token);
    if (decoded) {
      setUser(decoded);
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}