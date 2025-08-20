import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getInviteForCreator, createInviteForUser, getInvitesCreatedBy, getInviterForUser } from '../lib/database';
import { Footer } from '../components/Footer';
import { SimpleBottomNav } from '../components/SimpleBottomNav';
import { Home } from 'lucide-react';

export default function InvitePage() {
	const { user } = useAuth();
	const [code, setCode] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [invited, setInvited] = useState<Array<{ code: string; used_by: string | null; used_by_username: string | null }>>([]);
	const [inviter, setInviter] = useState<{ inviter_id: string; inviter_username: string } | null>(null);

	useEffect(() => {
		(async () => {
			if (!user) return;
			const inv = await getInviteForCreator(user.userId);
			if (inv?.code) setCode(inv.code);
			const created = await getInvitesCreatedBy(user.userId);
			setInvited(created);
			const whoInvited = await getInviterForUser(user.userId);
			setInviter(whoInvited);
		})();
	}, [user]);

	const generate = async () => {
		if (!user) return;
		const inv = await createInviteForUser(user.userId);
		setCode(inv.code);
	};

	const shareLink = async () => {
		if (!code) return;
		const link = `${window.location.origin}/app?invite=${encodeURIComponent(code)}`;
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
			<header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
				<div className="max-w-2xl mx-auto px-4 py-3">
					<div className="flex items-center justify-between">
						<a href="/app" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-mono text-sm transition-colors">
							<Home size={16} />
							back to app
						</a>
						<div className="font-mono text-sm text-gray-800 dark:text-gray-100">invites</div>
					</div>
				</div>
			</header>
			<main className="flex-1">
				<div className="max-w-3xl mx-auto p-6 space-y-6">
					<p className="font-mono text-sm text-gray-700 dark:text-gray-300">
						We're invite-only to keep the community small, thoughtful, and safe. Limiting invites helps prevent spam, brigading, and bad actors while we grow. Each member can invite one trusted person.
					</p>
					<div className="ng-card p-4">
						<h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100 mb-2">your invite</h2>
						{user ? (
							code ? (
								<div className="flex flex-col sm:flex-row sm:items-center gap-3">
									<div className="font-mono text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-700">{code}</div>
									<button onClick={shareLink} className="ng-btn">{copied ? 'copied!' : 'copy invite link'}</button>
								</div>
							) : (
								<button onClick={generate} className="ng-btn">generate code</button>
							)
						) : (
							<p className="font-mono text-sm text-gray-600 dark:text-gray-400">Log in to generate your invite code.</p>
						)}
						{user && inviter && (
							<p className="mt-3 font-mono text-xs text-gray-600 dark:text-gray-400">invited by @{inviter.inviter_username}</p>
						)}
					</div>
					<div className="ng-card p-4">
						<h3 className="font-mono font-semibold text-gray-900 dark:text-gray-100 mb-1">who you invited</h3>
						{invited.length === 0 ? (
							<p className="font-mono text-sm text-gray-600 dark:text-gray-400">no one yet</p>
						) : (
							<ul className="space-y-1 font-mono text-sm text-gray-700 dark:text-gray-300">
								{invited.map((i) => (
									<li key={i.code}>code {i.code} → {i.used_by_username ? `@${i.used_by_username}` : 'unused'}</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</main>
			<Footer />
			<SimpleBottomNav />
		</div>
	);
} 