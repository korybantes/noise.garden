import React from 'react';

export function OnboardingBackupCodes({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Save your backup codes</h2>
        <p className="font-mono text-sm text-gray-700 dark:text-gray-300 mb-4">
          These one-time codes can recover your account if you lose your password. Store them in a safe place.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-sm mb-4">
          {codes.map((c) => (
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
  );
} 