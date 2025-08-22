import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Footer } from '../components/Footer';
import { Shield, Hash, Timer, Zap } from 'lucide-react';
import { setPageMetadata } from '../lib/meta';

function AppPreview() {
	return (
		<div className="relative pointer-events-none select-none hidden md:block" aria-hidden>
			<div className="aspect-[9/16] w-[18rem] rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
				<div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<img src="/logo.png" alt="logo" className="w-5 h-5 rounded" draggable={false} />
						<span className="font-mono text-sm text-gray-900 dark:text-gray-100">noise.garden</span>
					</div>
					<div className="h-5 w-16 rounded bg-gray-100 dark:bg-gray-800" />
				</div>
				<div className="p-4">
					<div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
						<div className="h-16 rounded bg-gray-100 dark:bg-gray-800" />
						<div className="mt-2 text-[10px] font-mono text-gray-500 dark:text-gray-400">share a random thought…</div>
						<div className="mt-3 flex items-center justify-between">
							<div className="h-5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
							<div className="h-8 w-16 rounded bg-gray-900 dark:bg-gray-100" />
						</div>
					</div>
				</div>
				<div className="px-4 pb-4 space-y-3">
					<div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
							<div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800" />
						</div>
						<div className="h-10 rounded bg-gray-100 dark:bg-gray-800" />
					</div>
					<div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
							<div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800" />
						</div>
						<div className="h-8 rounded bg-gray-100 dark:bg-gray-800" />
					</div>
				</div>
			</div>
		</div>
	);
}

export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    setPageMetadata('noise.garden — privacy‑first ephemeral social', 'Invite‑only, ephemeral, privacy‑first social app.');
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
			<header className="sticky top-0 z-30 border-b border-gray-200/60 dark:border-gray-800/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-gray-900/40">
				<div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
            <img src="/logo.png" alt="logo" className="w-6 h-6" />
            <div className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">noise.garden</div>
          </div>
          <div className="flex items-center gap-3">
						<a href="/privacy" className="hidden md:inline font-mono text-sm text-gray-700 dark:text-gray-300 hover:underline">privacy</a>
						<a href="/terms" className="hidden md:inline font-mono text-sm text-gray-700 dark:text-gray-300 hover:underline">terms</a>
						<button onClick={() => navigate('/app')} className="ng-btn">enter</button>
					</div>
          </div>
        </header>

			<main className="flex-1">
				<section className="bg-gradient-to-b from-gray-100 to-white dark:from-gray-900 dark:to-gray-950">
					<div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
						<div className="space-y-6">
							<h1 className="text-4xl md:text-5xl leading-tight font-mono font-extrabold text-gray-900 dark:text-gray-100">
								Anonymous thoughts, beautifully simple
							</h1>
							<p className="font-mono text-sm md:text-base text-gray-700 dark:text-gray-300 max-w-prose">
								No feed hacks. No followers. No trackers. Share ephemeral ideas in topic rooms, with privacy-first design and humane defaults.
							</p>
            <div className="flex items-center gap-3">
								<button onClick={() => navigate('/app')} className="ng-btn">start now</button>
								<a href="#learn" className="ng-btn secondary">learn more</a>
							</div>
							<div className="flex items-center gap-4 pt-2">
								<div className="h-2 w-2 rounded-full bg-emerald-500" />
								<span className="font-mono text-xs text-gray-600 dark:text-gray-400">no email • no tracking • export anytime</span>
            </div>
          </div>

						<div className="relative">
							<AppPreview />
          </div>
            </div>
        </section>

        {/* Android App Announcement */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-y border-blue-200 dark:border-blue-800">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full font-mono text-sm">
                📱 <span className="font-semibold">NEW</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-mono font-bold text-gray-900 dark:text-gray-100">
                Now available on Android!
              </h2>
              <p className="font-mono text-base text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
                Join our limited beta to test the mobile app. Experience noise.garden on the go with native Android features like push notifications and haptic feedback.
              </p>
              <div className="flex items-center justify-center gap-4 pt-4">
                <button onClick={() => navigate('/app')} className="ng-btn">
                  Join Beta
                </button>
                <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
                  iPhone version coming soon
                </span>
              </div>
            </div>
          </div>
        </section>

				<section id="learn" className="max-w-6xl mx-auto px-6 py-14">
					<div className="grid md:grid-cols-4 gap-6">
						<div className="ng-card p-5">
							<Shield className="text-gray-900 dark:text-gray-100" size={18} />
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">privacy-first</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">No ad trackers. Minimal logs. Optional passkeys and backup codes.</p>
						</div>
						<div className="ng-card p-5">
							<Timer className="text-gray-900 dark:text-gray-100" size={18} />
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">ephemeral</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">Posts auto-expire. Choose per-post lifetime that fits your mood.</p>
						</div>
						<div className="ng-card p-5">
							<Hash className="text-gray-900 dark:text-gray-100" size={18} />
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">rooms, not feeds</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">Drop into topic rooms. No followers, no pressure, no performative metrics.</p>
						</div>
						<div className="ng-card p-5">
							<Zap className="text-gray-900 dark:text-gray-100" size={18} />
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">fast & simple</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">Small, responsive, and friendly on low-data connections and older devices.</p>
          </div>
          </div>
        </section>

				<section className="px-6">
					<div className="max-w-6xl mx-auto">
						<div className="ng-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
							<div className="max-w-2xl">
								<h2 className="font-mono text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">no accounts to farm, just ideas to share</h2>
								<p className="mt-2 font-mono text-sm text-gray-700 dark:text-gray-300">Enter with a username and a password or passkey. That’s it. Keep a few backup codes to recover. You’re in control.</p>
							</div>
							<div className="flex items-center gap-3">
								<button onClick={() => navigate('/app')} className="ng-btn">enter now</button>
								<a href="/privacy" className="ng-btn secondary">read privacy</a>
							</div>
						</div>
      </div>
				</section>
			</main>

      <Footer />
    </div>
  );
} 