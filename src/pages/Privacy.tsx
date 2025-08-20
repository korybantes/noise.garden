import { Footer } from '../components/Footer';

export default function Privacy() {
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
					<h1 className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
					<p className="font-mono text-sm text-gray-700 dark:text-gray-300">
						This Privacy Policy describes how we process personal data in connection with Noise Garden. We design for minimal data, security, and anonymity.
					</p>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Data we process</h2>
						<ul className="list-disc pl-6 font-mono text-sm text-gray-700 dark:text-gray-300 space-y-1">
							<li>Account: username, password hash, optional recovery backup code hashes</li>
							<li>Profile: optional avatar and bio you provide</li>
							<li>Content: posts/replies and timestamps; ephemeral by design</li>
							<li>Technical: basic logs (IP address at request time, user agent), anti‑abuse signals (e.g., CAPTCHA verification)</li>
						</ul>
						<p className="font-mono text-xs text-gray-600 dark:text-gray-400">If you believe any of this data identifies you, you may request access or deletion as described below.</p>
					</section>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Legal basis for processing (GDPR/UK GDPR)</h2>
						<ul className="list-disc pl-6 font-mono text-sm text-gray-700 dark:text-gray-300 space-y-1">
							<li>Contract necessity: to create and operate your account, deliver core features</li>
							<li>Legitimate interests: platform security, abuse prevention, and fraud detection</li>
							<li>Consent: where required for optional features (e.g., cookies/analytics if enabled)</li>
							<li>Legal obligation: compliance with lawful requests and applicable regulations</li>
						</ul>
					</section>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Your rights</h2>
						<p className="font-mono text-sm text-gray-700 dark:text-gray-300">Subject to region, you may have rights to access, rectify, delete, restrict/oppose processing, and portability. Contact us at privacy@example.com. We will verify requests before acting.</p>
					</section>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Retention</h2>
						<p className="font-mono text-sm text-gray-700 dark:text-gray-300">Posts are ephemeral and auto‑expire after the configured period. Security logs and backup codes are retained only as long as necessary for operations and safety, then deleted or anonymized.</p>
					</section>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Cookies / tracking</h2>
						<p className="font-mono text-sm text-gray-700 dark:text-gray-300">We do not use advertising trackers. If we enable analytics or optional cookies in the future, we will present an opt‑in consent banner and a detailed Cookie Policy.</p>
					</section>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Security & anonymization</h2>
						<p className="font-mono text-sm text-gray-700 dark:text-gray-300">Passwords/backup codes are hashed; transport is encrypted (HTTPS); secrets are stored securely. We minimize logs and remove IP addresses when no longer needed for security.</p>
					</section>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">International transfers</h2>
						<p className="font-mono text-sm text-gray-700 dark:text-gray-300">If data is processed outside your region, we rely on appropriate safeguards (such as Standard Contractual Clauses) with our vendors to protect your data.</p>
					</section>
					<section className="space-y-3">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Contact / DPO</h2>
						<p className="font-mono text-sm text-gray-700 dark:text-gray-300">For privacy requests, contact privacy@example.com. If required by law, we will designate a Data Protection Officer and update these details.</p>
					</section>
				</div>
			</main>
			<Footer />
		</div>
	);
} 