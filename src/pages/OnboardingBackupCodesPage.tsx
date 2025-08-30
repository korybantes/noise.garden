import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OnboardingBackupCodesPage() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('onboarding_backup_codes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCodes(parsed as string[]);
      }
    } catch {}
  }, []);

  const download = () => {
    try {
      const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ng_backup_codes.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <h1 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Backup Codes</h1>
        <p className="font-mono text-sm text-gray-700 dark:text-gray-300 mb-4">Save these one-time recovery codes somewhere safe.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {codes.map((c) => (
            <div key={c} className="px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 font-mono text-sm">{c}</div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button onClick={download} className="ng-btn">download</button>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard?.writeText(codes.join('\n')).catch(()=>{}); }} className="px-3 py-2 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-700 dark:text-gray-300">copy</button>
            <button onClick={() => { localStorage.removeItem('onboarding_backup_codes'); navigate('/onboarding/tour'); }} className="px-3 py-2 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-mono text-sm">continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}



