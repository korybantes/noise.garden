import { useEffect, useState } from 'react';
import { Heart, MessageSquare, Users, Shield } from 'lucide-react';

export function MobileLoading() {
  const [currentIcon, setCurrentIcon] = useState(0);
  const [progress, setProgress] = useState(0);

  const icons = [
    { icon: Heart, color: 'from-pink-500 to-rose-500' },
    { icon: Users, color: 'from-blue-500 to-indigo-500' },
    { icon: MessageSquare, color: 'from-purple-500 to-violet-500' },
    { icon: Shield, color: 'from-green-500 to-emerald-500' }
  ];

  useEffect(() => {
    const iconInterval = setInterval(() => {
      setCurrentIcon((prev) => (prev + 1) % icons.length);
    }, 800);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => {
      clearInterval(iconInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const CurrentIcon = icons[currentIcon].icon;
  const currentColor = icons[currentIcon].color;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6">
      {/* Animated icon */}
      <div className={`w-24 h-24 mb-8 rounded-full bg-gradient-to-br ${currentColor} flex items-center justify-center text-white shadow-2xl animate-pulse`}>
        <CurrentIcon size={40} />
      </div>

      {/* App name */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 font-mono">
        noise.garden
      </h1>
      <p className="text-gray-600 dark:text-gray-400 text-lg mb-8 text-center">
        Anonymous thoughts, beautifully simple
      </p>

      {/* Progress bar */}
      <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Loading text */}
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        {progress < 100 ? 'Preparing your garden...' : 'Ready!'}
      </p>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-20 animate-bounce"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 2) * 40}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${2 + i * 0.5}s`
            }}
          />
        ))}
      </div>
    </div>
  );
} 