export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
        <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
          This Privacy Policy explains how we process limited personal data in connection with the Noise Garden app. We collect the minimum required to operate the service.
        </p>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">What we collect</h2>
          <ul className="list-disc pl-6 font-mono text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li>Account: username, password hash, optional backup code hashes</li>
            <li>Content: posts, replies, and metadata (timestamps)</li>
            <li>Technical: basic diagnostics, fraud signals (e.g., CAPTCHA verification)</li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Legal bases & regions</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            For users in the EU/EEA/UK, processing is based on contract (Art.6(1)(b) GDPR) and legitimate interests (Art.6(1)(f) GDPR) for security and abuse prevention. For US users, we apply CCPA/CPRA principles (opt-out of sale—no sale of data). We aim to satisfy global privacy norms.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Data sharing</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            We do not sell personal data. Service providers (e.g., hosting, database, realtime messaging) may process data on our behalf under DPAs.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Retention</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            Posts expire automatically per product design; logs and backup codes are retained only as needed for security and operations.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Your rights</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            Depending on your region, you may have rights to access, rectify, delete, port, or object. Contact us at privacy@example.com.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Children</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">This service is not directed to children under 16.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Changes</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">We may update this policy; continued use indicates acceptance.</p>
        </section>
      </div>
    </div>
  );
} 