export function setPageMetadata(title: string, description?: string) {
	if (typeof document !== 'undefined') {
		document.title = title;
		if (description !== undefined) {
			let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
			if (!meta) {
				meta = document.createElement('meta');
				meta.name = 'description';
				document.head.appendChild(meta);
			}
			meta.content = description;
		}
	}
} 