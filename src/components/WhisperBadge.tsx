import { Lock } from 'lucide-react';

interface WhisperBadgeProps {
  className?: string;
}

export function WhisperBadge({ className = '' }: WhisperBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 ${className}`}>
      <Lock size={10} />
      whisper
    </div>
  );
} 