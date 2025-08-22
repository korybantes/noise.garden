import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface MuteStatus {
  muted: boolean;
  reason?: string;
  expiresAt?: Date;
  mutedBy?: string;
  mutedByUsername?: string;
}

export function useMuteStatus() {
  const { user } = useAuth();
  const [muteStatus, setMuteStatus] = useState<MuteStatus>({ muted: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMuteStatus({ muted: false });
      setLoading(false);
      return;
    }

    const checkMuteStatus = async () => {
      try {
        const response = await fetch('/api/app', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            action: 'isUserMuted',
            args: { userId: user.userId }
          })
        });

        if (response.ok) {
          const result = await response.json();
          setMuteStatus(result);
        } else {
          setMuteStatus({ muted: false });
        }
      } catch (error) {
        console.error('Failed to check mute status:', error);
        setMuteStatus({ muted: false });
      } finally {
        setLoading(false);
      }
    };

    checkMuteStatus();
    
    // Check every minute for updates
    const interval = setInterval(checkMuteStatus, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return { muteStatus, loading };
} 