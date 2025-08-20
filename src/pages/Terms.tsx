export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100">Terms & Conditions</h1>
        <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
          By using Noise Garden you agree to these Terms. If you do not agree, do not use the service.
        </p>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">User content & responsibility</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            You are solely responsible for the content you post. We are not responsible or liable for user content. We may remove content or suspend accounts that violate these Terms or applicable law.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Acceptable use</h2>
          <ul className="list-disc pl-6 font-mono text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li>No illegal content or activity</li>
            <li>No harassment, threats, or hate speech</li>
            <li>No spam, fraud, or misuse of the platform</li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Disclaimers & limitation of liability</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            The service is provided “as is.” To the maximum extent permitted by law, we disclaim all warranties and shall not be liable for indirect or consequential damages.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Privacy & regional compliance</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            We follow GDPR/UK GDPR principles for EU/UK users and CCPA/CPRA principles in the US. See our Privacy Policy for details.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-mono font-semibold text-gray-900 dark:text-gray-100">Governing law</h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
            These Terms are governed by the laws of the operator’s principal place of business, without regard to conflict of laws. Local mandatory consumer protections still apply.
          </p>
        </section>
      </div>
    </div>
  );
} 