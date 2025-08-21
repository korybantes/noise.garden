export interface FeedSettings {
	mutedWords: string[];
	quietHours: { startHour: number; endHour: number } | null;
	language: 'en' | 'tr';
}

const KEY = 'feed_settings_v1';

export function loadFeedSettings(): FeedSettings {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { mutedWords: [], quietHours: null, language: 'en' };
		const parsed = JSON.parse(raw);
		return {
			mutedWords: Array.isArray(parsed?.mutedWords) ? parsed.mutedWords.map(String) : [],
			quietHours: parsed?.quietHours && typeof parsed.quietHours.startHour === 'number' && typeof parsed.quietHours.endHour === 'number'
				? { startHour: parsed.quietHours.startHour, endHour: parsed.quietHours.endHour }
				: null,
			language: parsed?.language === 'tr' ? 'tr' : 'en',
		};
	} catch {
		return { mutedWords: [], quietHours: null, language: 'en' };
	}
}

export function saveFeedSettings(s: FeedSettings) {
	localStorage.setItem(KEY, JSON.stringify(s));
}

export function isWithinQuietHours(quiet: FeedSettings['quietHours'], now: Date = new Date()): boolean {
	if (!quiet) return false;
	const h = now.getHours();
	const { startHour, endHour } = quiet;
	if (startHour === endHour) return false;
	if (startHour < endHour) {
		return h >= startHour && h < endHour;
	}
	// wraps midnight
	return h >= startHour || h < endHour;
}

export function contentMatchesMuted(content: string, mutedWords: string[]): boolean {
	if (!mutedWords.length) return false;
	const lower = content.toLowerCase();
	return mutedWords.some(w => w && lower.includes(String(w).toLowerCase()));
} 