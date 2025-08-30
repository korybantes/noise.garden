import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { Shield, Hash, Timer, Zap, ShieldCheck, Hash as HashIcon, Users } from 'lucide-react';
import { setPageMetadata } from '../lib/meta';
import { t } from '../lib/translations';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

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
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLangPrompt, setShowLangPrompt] = useState(false);

  useEffect(() => {
    setPageMetadata('noise.garden — privacy‑first ephemeral social', t('shareEphemeralIdeas', language));
  }, []);

  useEffect(() => {
    const selectedLang = localStorage.getItem('ng_lang_selected');
    if (!selectedLang) {
      setShowLangPrompt(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
			<header className="sticky top-0 z-30 border-b border-gray-200/60 dark:border-gray-800/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-gray-900/40">
				<div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<img src="/logo.png" alt="logo" className="w-6 h-6" />
						<div className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">noise.garden</div>
					</div>
					<div className="flex items-center gap-3 relative">
						<a href="/privacy" className="hidden md:inline font-mono text-sm text-gray-700 dark:text-gray-300 hover:underline">privacy</a>
						<a href="/terms" className="hidden md:inline font-mono text-sm text-gray-700 dark:text-gray-300 hover:underline">terms</a>
						{!user ? (
							<button onClick={() => navigate('/app')} className="ng-btn">enter</button>
						) : (
							<div className="relative">
								<button onClick={() => setMenuOpen(v => !v)} className="flex items-center gap-2 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800">
									<div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">👤</div>
									<span className="hidden sm:inline font-mono text-sm text-gray-700 dark:text-gray-300">@{user.username}</span>
								</button>
								{menuOpen && (
									<div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md shadow-lg overflow-hidden">
										<button onClick={() => { setMenuOpen(false); navigate('/app'); }} className="w-full text-left px-3 py-2 font-mono text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">open app</button>
										<button onClick={() => { setMenuOpen(false); navigate('/app#profile'); }} className="w-full text-left px-3 py-2 font-mono text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">profile</button>
										<button onClick={() => { setMenuOpen(false); logout(); }} className="w-full text-left px-3 py-2 font-mono text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">sign out</button>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</header>

			<main className="flex-1">
        {showLangPrompt && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
              <div className="font-mono text-base font-bold text-gray-900 dark:text-gray-100 mb-3">choose language / dil seçin</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setLanguage('en'); try { localStorage.setItem('ng_lang_selected','1'); } catch {}; setShowLangPrompt(false); }} className="px-3 py-2 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">English</button>
                <button onClick={() => { setLanguage('tr'); try { localStorage.setItem('ng_lang_selected','1'); } catch {}; setShowLangPrompt(false); }} className="px-3 py-2 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">Türkçe</button>
              </div>
              <div className="mt-3 text-xs font-mono text-gray-500 dark:text-gray-400">This choice is saved on this device.</div>
            </div>
          </div>
        )}
				<section className="bg-gradient-to-b from-gray-100 to-white dark:from-gray-900 dark:to-gray-950">
					<div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
						<div className="space-y-6">
							<h1 className="text-4xl md:text-5xl leading-tight font-mono font-extrabold text-gray-900 dark:text-gray-100">{t('anonymousThoughtsBeautifullySimple', language)}</h1>
							<p className="font-mono text-sm md:text-base text-gray-700 dark:text-gray-300 max-w-prose">{t('shareEphemeralIdeas', language)}</p>
							<div className="flex items-center gap-3">
								<button onClick={() => navigate('/app')} className="ng-btn">{t('startNow', language)}</button>
								<a href="#learn" className="ng-btn secondary">{t('learnMore', language)}</a>
							</div>
							<div className="flex items-center gap-4 pt-2">
								<div className="h-2 w-2 rounded-full bg-emerald-500" />
								<span className="font-mono text-xs text-gray-600 dark:text-gray-400">{t('noEmail', language)} • {t('noTracking', language)} • {t('exportAnytime', language)}</span>
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
								<button onClick={() => navigate('/app')} className="ng-btn">{t('startNow', language)}</button>
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
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">{t('privacyFirstDesign', language)}</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">{t('noTracking', language)}</p>
						</div>
						<div className="ng-card p-5">
							<Timer className="text-gray-900 dark:text-gray-100" size={18} />
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">{t('anonymousThoughtsBeautifullySimple', language)}</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">{t('randomThoughtsShuffledDaily', language)}</p>
						</div>
						<div className="ng-card p-5">
							<Hash className="text-gray-900 dark:text-gray-100" size={18} />
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">{t('noFollowers', language)}</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">{t('useHashtagsToCreateRooms', language)}</p>
						</div>
						<div className="ng-card p-5">
							<Zap className="text-gray-900 dark:text-gray-100" size={18} />
							<div className="mt-3 font-mono font-semibold text-gray-900 dark:text-gray-100">{t('humaneDefaults', language)}</div>
							<p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">{t('privacyFirstDesign', language)}</p>
						</div>
					</div>
				</section>

				{/* Why one invite per person */}
				<section className="max-w-6xl mx-auto px-6 py-14">
					<div className="ng-card p-6 md:p-8">
						<h2 className="font-mono text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">why invites?</h2>
						<p className="font-mono text-sm text-gray-700 dark:text-gray-300 mb-4">keeps things small, intentional, and calm.</p>
						<div className="grid md:grid-cols-3 gap-4">
							<div className="ng-card p-4">
								<div className="flex items-center gap-2 font-mono font-semibold text-gray-900 dark:text-gray-100 mb-1"><ShieldCheck size={16} /> trust</div>
								<p className="font-mono text-sm text-gray-700 dark:text-gray-300">people bring people they care about.</p>
							</div>
							<div className="ng-card p-4">
								<div className="flex items-center gap-2 font-mono font-semibold text-gray-900 dark:text-gray-100 mb-1"><HashIcon size={16} /> rooms</div>
								<p className="font-mono text-sm text-gray-700 dark:text-gray-300">build rooms around topics, not clout.</p>
							</div>
							<div className="ng-card p-4">
								<div className="flex items-center gap-2 font-mono font-semibold text-gray-900 dark:text-gray-100 mb-1"><Users size={16} /> accountability</div>
								<p className="font-mono text-sm text-gray-700 dark:text-gray-300">keep conversations humane by design.</p>
							</div>
						</div>
						<p className="mt-4 font-mono text-sm text-gray-700 dark:text-gray-300">{t('shareEphemeralIdeas', language)}</p>
					</div>
				</section>

				<section className="px-6">
					<div className="max-w-6xl mx-auto">
						<div className="ng-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
							<div className="max-w-2xl">
								<h2 className="font-mono text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">no follower chase — just ideas</h2>
								<p className="mt-2 font-mono text-sm text-gray-700 dark:text-gray-300">{t('shareEphemeralIdeas', language)}</p>
							</div>
							<div className="flex items-center gap-3">
								<button onClick={() => navigate('/app')} className="ng-btn">{t('startNow', language)}</button>
								<a href="/privacy" className="ng-btn secondary">privacy</a>
							</div>
						</div>
					</div>
				</section>
			</main>

      <Footer />
    </div>
  );
} 