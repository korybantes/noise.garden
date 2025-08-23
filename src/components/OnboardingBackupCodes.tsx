import React from 'react';

interface OnboardingBackupCodesProps {
  codes: string[];
  onClose: () => void;
}

export function OnboardingBackupCodes({ codes, onClose }: OnboardingBackupCodesProps) {
  return (
    <div className="modal-overlay bg-black/60">
      <div className="modal-content bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Backup Codes
          </h2>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300 mb-4">
            These one-time codes can recover your account if you lose your password. Store them in a safe place.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-sm mb-4">
            {codes.map((c: string) => (
              <div key={c} className="px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                {c}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(codes.join('\n')).catch(() => {});
              }}
              className="px-3 py-1.5 rounded border border-gray-200 dark:border-gray-800 font-mono text-sm text-gray-700 dark:text-gray-200"
            >
              copy
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 font-mono text-sm"
            >
              done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 