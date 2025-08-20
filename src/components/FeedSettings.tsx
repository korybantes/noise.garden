import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { FeedSettings as FS, loadFeedSettings, saveFeedSettings } from '../lib/settings';

interface Props {
	onClose: () => void;
}

export function FeedSettings({ onClose }: Props) {
	const [settings, setSettings] = useState<FS>(() => loadFeedSettings());
	const [mutedInput, setMutedInput] = useState('');

	useEffect(() => { saveFeedSettings(settings); }, [settings]);

	return (
		<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
			<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-md p-4">
				<div className="flex items-center justify-between mb-3">
					<h2 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">feed settings</h2>
					<button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"><X size={18} /></button>
				</div>

				<div className="space-y-4">
					<div>
						<label className="font-mono text-sm text-gray-600 dark:text-gray-400">muted words/tags</label>
						<div className="mt-2 flex gap-2">
							<input value={mutedInput} onChange={(e) => setMutedInput(e.target.value)} placeholder="word or #tag" className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
							<button type="button" onClick={() => { if (!mutedInput.trim()) return; setSettings(s => ({ ...s, mutedWords: Array.from(new Set([...(s.mutedWords||[]), mutedInput.trim()])) })); setMutedInput(''); }} className="px-3 py-2 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-mono text-sm">add</button>
						</div>
						{settings.mutedWords.length > 0 && (
							<div className="flex flex-wrap gap-2 mt-2">
								{settings.mutedWords.map((w) => (
									<button key={w} onClick={() => setSettings(s => ({ ...s, mutedWords: s.mutedWords.filter(x => x !== w) }))} className="text-xs font-mono px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">{w} ×</button>
								))}
							</div>
						)}
					</div>

					<div>
						<label className="font-mono text-sm text-gray-600 dark:text-gray-400">quiet hours</label>
						<div className="mt-2 flex items-center gap-2">
							<input type="number" min={0} max={23} value={settings.quietHours?.startHour ?? ''} onChange={(e) => setSettings(s => ({ ...s, quietHours: { startHour: Number(e.target.value||0), endHour: s.quietHours?.endHour ?? 0 } }))} placeholder="start (0-23)" className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
							<span className="text-gray-500">to</span>
							<input type="number" min={0} max={23} value={settings.quietHours?.endHour ?? ''} onChange={(e) => setSettings(s => ({ ...s, quietHours: { startHour: s.quietHours?.startHour ?? 0, endHour: Number(e.target.value||0) } }))} placeholder="end (0-23)" className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm font-mono" />
							<button type="button" onClick={() => setSettings(s => ({ ...s, quietHours: null }))} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 font-mono text-sm">clear</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
} 