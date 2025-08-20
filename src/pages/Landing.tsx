import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-center justify-between py-4">
          <div className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">noise garden</div>
          <button onClick={() => navigate('/app')} className="font-mono text-sm px-4 py-2 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">enter</button>
        </header>
        <main className="mt-12 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-mono font-bold text-gray-900 dark:text-gray-100">Anonymous thoughts, shuffled daily</h1>
            <p className="font-mono text-sm text-gray-700 dark:text-gray-300">No tracking. No algorithms. Just random thoughts with ephemeral posts, anonymous chat, and privacy-friendly design.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/app')} className="px-4 py-2 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-mono text-sm">start now</button>
              <a href="#learn" className="font-mono text-sm text-gray-700 dark:text-gray-300">learn more</a>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 h-72 bg-gradient-to-br from-gray-100 to-white dark:from-gray-900 dark:to-gray-950" />
          </div>
        </main>
        <section id="learn" className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            { title: 'anonymous', desc: 'No email required. Backup codes for recovery.' },
            { title: 'ephemeral', desc: 'Posts auto-expire to reduce data footprint.' },
            { title: 'realtime', desc: 'Anonymous chat with presence, typing, and reactions.' },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
              <div className="font-mono font-semibold text-gray-900 dark:text-gray-100">{c.title}</div>
              <div className="font-mono text-sm text-gray-700 dark:text-gray-300 mt-2">{c.desc}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
} 