export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-xs">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        <div className="font-mono">© {new Date().getFullYear()} noise garden</div>
        <p className="font-mono">
          This is an anonymous community. We do not accept illegal content, hate speech, harassment, or spam. Moderators may remove content and suspend accounts.
        </p>
        <p className="font-mono">
          Privacy & GDPR: We store only necessary data for account and content functionality. No tracking or advertising IDs. Content may be retained for moderation and legal compliance.
        </p>
        <p className="font-mono">
          By using this service you agree to our terms and community guidelines. <a href="/privacy" className="underline">privacy</a> · <a href="/terms" className="underline">terms</a>
        </p>
      </div>
    </footer>
  );
} 