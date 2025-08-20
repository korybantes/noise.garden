export function containsLink(text: string): boolean {
	// Detect http(s), www, or domain.tld patterns
	const urlLike = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|\bwww\.[\w\-]+\.[a-z]{2,}\b|\b[\w\-]+\.(?:com|net|org|io|app|dev|gg|xyz|ai|co|me|site|to|info|biz|edu|gov|uk|de|fr|ru|in)\b/gi;
	return urlLike.test(text);
}
 
export function sanitizeLinks(text: string): string {
	const urlLike = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|\bwww\.[\w\-]+\.[a-z]{2,}\b|\b[\w\-]+\.(?:com|net|org|io|app|dev|gg|xyz|ai|co|me|site|to|info|biz|edu|gov|uk|de|fr|ru|in)\b/gi;
	return text.replace(urlLike, '[link blocked]');
} 