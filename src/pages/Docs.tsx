import { Footer } from '../components/Footer';
import { SimpleBottomNav } from '../components/SimpleBottomNav';
import { Home, Shield, Users, Clock, Hash, MessageSquare, Download, Eye, Settings, Heart, Share2, UserPlus, Lock, Globe, Zap, Palette } from 'lucide-react';

export default function Docs() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
			<header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
				<div className="max-w-2xl mx-auto px-4 py-3">
					<div className="flex items-center justify-between">
						<a href="/app" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors">
							<Home size={16} />
							back to app
						</a>
						<div className="font-mono text-sm text-gray-800 dark:text-gray-100">docs</div>
					</div>
				</div>
			</header>
			<main className="flex-1">
				<div className="max-w-4xl mx-auto p-6 space-y-8">
					<div className="text-center space-y-2">
						<h1 className="font-mono text-3xl font-bold text-gray-900 dark:text-gray-100">noise.garden</h1>
						<p className="font-mono text-sm text-gray-600 dark:text-gray-400">privacy‑first ephemeral social network</p>
					</div>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<UserPlus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">invite‑only community</h2>
						</div>
						<div className="space-y-3 font-mono text-sm text-gray-700 dark:text-gray-300">
							<p>To maintain a small, thoughtful, and safe community, noise.garden operates on an invite‑only basis.</p>
							<ul className="list-disc pl-6 space-y-1">
								<li><strong>One invite per account:</strong> Each member can generate exactly one invite code</li>
								<li><strong>Single‑use codes:</strong> Once redeemed, invite codes become permanently used</li>
								<li><strong>Invite chain:</strong> See who invited you and who you've invited</li>
								<li><strong>No regeneration:</strong> Codes cannot be regenerated after creation</li>
							</ul>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-3">This system helps prevent spam, brigading, and bad actors while fostering genuine connections.</p>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">posting & content</h2>
						</div>
						<div className="space-y-4 font-mono text-sm text-gray-700 dark:text-gray-300">
							<div>
								<h3 className="font-semibold mb-2">ephemeral posts</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Choose post lifetime: 1 hour to 30 days</li>
									<li>Posts automatically expire and are permanently deleted</li>
									<li>No permanent content storage</li>
									<li>Live in the moment, not forever</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">content guidelines</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li><strong>No external links:</strong> Prevents spam and influencer culture</li>
									<li><strong>280 character limit:</strong> Encourages concise thoughts</li>
									<li><strong>No images:</strong> Text‑only to maintain privacy</li>
									<li><strong>Emoji support:</strong> Express yourself with reactions</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">replies & threads</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Reply to any post to start conversations</li>
									<li>Inline reply composer for better context</li>
									<li>Threaded discussions with original post context</li>
									<li>View original post links for easy navigation</li>
								</ul>
							</div>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<Hash className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">rooms & hashtags</h2>
						</div>
						<div className="space-y-3 font-mono text-sm text-gray-700 dark:text-gray-300">
							<p>Create and join topic‑based rooms using hashtags in your posts.</p>
							<div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
								<p className="text-xs text-gray-500 dark:text-gray-400 mb-2">example:</p>
								<p className="font-mono">"just discovered this amazing band! #music"</p>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">→ creates/joins the #music room</p>
							</div>
							<ul className="list-disc pl-6 space-y-1">
								<li><strong>Automatic room creation:</strong> First post with a hashtag creates the room</li>
								<li><strong>Room filtering:</strong> Click hashtags to filter feed by topic</li>
								<li><strong>Leave rooms:</strong> Use "leave room" button to return to main feed</li>
								<li><strong>Topic discovery:</strong> Find conversations by exploring hashtags</li>
							</ul>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">feed settings</h2>
						</div>
						<div className="space-y-4 font-mono text-sm text-gray-700 dark:text-gray-300">
							<div>
								<h3 className="font-semibold mb-2">mute words & tags</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Add words or hashtags to mute from your feed</li>
									<li>Posts containing muted content are hidden</li>
									<li>Manage your personal content preferences</li>
									<li>Create a more focused reading experience</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">quiet hours</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Set specific hours when posting is discouraged</li>
									<li>Post composer is dimmed during quiet hours</li>
									<li>Promotes mindful posting habits</li>
									<li>Customizable to your schedule</li>
								</ul>
							</div>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">sharing & social</h2>
						</div>
						<div className="space-y-3 font-mono text-sm text-gray-700 dark:text-gray-300">
							<div>
								<h3 className="font-semibold mb-2">instagram stories sharing</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Generate branded PNG images of posts</li>
									<li>Includes user avatar and "posted in noise.garden" watermark</li>
									<li>Share to Instagram Stories or download</li>
									<li>Web Share API integration for native sharing</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">profile features</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Custom bio (no links allowed)</li>
									<li>Generated gradient avatars</li>
									<li>Invite chain display</li>
									<li>Public post history</li>
								</ul>
							</div>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">privacy & security</h2>
						</div>
						<div className="space-y-4 font-mono text-sm text-gray-700 dark:text-gray-300">
							<div>
								<h3 className="font-semibold mb-2">data practices</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li><strong>No tracking:</strong> No advertising IDs or analytics</li>
									<li><strong>Minimal logging:</strong> Essential server logs only</li>
									<li><strong>Ephemeral content:</strong> Posts are permanently deleted</li>
									<li><strong>Client‑side avatars:</strong> Generated locally, no uploads</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">authentication</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li><strong>JWT tokens:</strong> Secure session management</li>
									<li><strong>Backup codes:</strong> One‑time recovery codes</li>
									<li><strong>Password hashing:</strong> bcrypt for security</li>
									<li><strong>ALTCHA captcha:</strong> Privacy‑friendly verification</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">gdpr compliance</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Data export functionality</li>
									<li>Minimal data retention</li>
									<li>No third‑party tracking</li>
									<li>Transparent data practices</li>
								</ul>
							</div>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">data export</h2>
						</div>
						<div className="space-y-3 font-mono text-sm text-gray-700 dark:text-gray-300">
							<p>Export your account data in JSON format for transparency and portability.</p>
							<div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
								<p className="text-xs text-gray-500 dark:text-gray-400 mb-2">api endpoint:</p>
								<p className="font-mono text-xs">GET /api/export</p>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">headers: Authorization: Bearer YOUR_TOKEN</p>
							</div>
							<ul className="list-disc pl-6 space-y-1">
								<li>User profile information</li>
								<li>All posts and replies</li>
								<li>Invite relationships</li>
								<li>Account creation date</li>
							</ul>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">technical details</h2>
						</div>
						<div className="space-y-4 font-mono text-sm text-gray-700 dark:text-gray-300">
							<div>
								<h3 className="font-semibold mb-2">architecture</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li><strong>Frontend:</strong> React + Vite + TypeScript</li>
									<li><strong>Backend:</strong> Vercel Serverless Functions</li>
									<li><strong>Database:</strong> Neon PostgreSQL</li>
									<li><strong>Styling:</strong> Tailwind CSS + custom design system</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">features</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Hash‑based client‑side routing</li>
									<li>Real‑time feed updates</li>
									<li>Responsive mobile design</li>
									<li>Dark/light theme support</li>
									<li>Progressive Web App ready</li>
								</ul>
							</div>
							<div>
								<h3 className="font-semibold mb-2">performance</h3>
								<ul className="list-disc pl-6 space-y-1">
									<li>Code splitting for optimal loading</li>
									<li>Client‑side image generation</li>
									<li>Minimal bundle size</li>
									<li>Fast serverless responses</li>
								</ul>
							</div>
						</div>
					</section>

					<section className="ng-card p-6">
						<div className="flex items-center gap-2 mb-4">
							<Heart className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							<h2 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">community guidelines</h2>
						</div>
						<div className="space-y-3 font-mono text-sm text-gray-700 dark:text-gray-300">
							<p>Help maintain a positive, thoughtful community environment.</p>
							<div className="bg-red-50 dark:bg-red-950/50 p-3 rounded border border-red-200 dark:border-red-900">
								<h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">not allowed:</h3>
								<ul className="list-disc pl-6 space-y-1 text-red-700 dark:text-red-300">
									<li>Illegal content or activities</li>
									<li>Hate speech or discrimination</li>
									<li>Harassment or bullying</li>
									<li>Spam or automated posting</li>
									<li>External links or self‑promotion</li>
								</ul>
							</div>
							<div className="bg-green-50 dark:bg-green-950/50 p-3 rounded border border-green-200 dark:border-green-900">
								<h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">encouraged:</h3>
								<ul className="list-disc pl-6 space-y-1 text-green-700 dark:text-green-300">
									<li>Thoughtful discussions</li>
									<li>Genuine connections</li>
									<li>Respectful disagreements</li>
									<li>Topic‑focused conversations</li>
									<li>Mindful posting habits</li>
								</ul>
							</div>
						</div>
					</section>

					<section className="text-center space-y-4">
						<div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
							<Globe className="w-4 h-4" />
							<span className="font-mono text-sm">built for privacy, designed for connection</span>
						</div>
						<div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
							<a href="/privacy" className="underline">privacy</a>
							<a href="/terms" className="underline">terms</a>
							<a href="/cookies" className="underline">cookies</a>
							<a href="/invite" className="underline">invite</a>
						</div>
					</section>
				</div>
			</main>
			<Footer />
			<SimpleBottomNav />
		</div>
	);
} 