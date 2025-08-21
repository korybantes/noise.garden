import { useEffect } from 'react';
import { Footer } from '../components/Footer';
import { setPageMetadata } from '../lib/meta';

export default function Cookies() {
  useEffect(() => {
    setPageMetadata('Cookies — noise.garden', 'We use essential cookies only; optional analytics would be opt‑in.');
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <a href="/" className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">noise.garden</a>
          <a href="/app" className="font-mono text-sm text-gray-700 dark:text-gray-300">open app</a>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <h1 className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">Cookie Policy</h1>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">We do not use advertising or tracking cookies. If we enable optional analytics in the future, we will request opt‑in consent and provide details here.</p>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">You can control cookies via your browser settings. Essential cookies, if any, are used solely to provide core functionality.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
} 