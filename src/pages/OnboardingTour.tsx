import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OnboardingTour() {
  const navigate = useNavigate();
  useEffect(() => {
    try { localStorage.setItem('ng_start_tour', '1'); } catch {}
    navigate('/app', { replace: true });
  }, []);
  return null;
}


