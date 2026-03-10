import type { CheckResult } from '../types';

export default function AutomatedChecks({ checks }: { checks: CheckResult[] }) {
  if (checks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Automated Checks
      </h2>
      <div className="space-y-3">
        {checks.map((check, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
          >
            <div>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {check.check_name.replace(/_/g, ' ')}
              </span>
              {check.message && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{check.message}</p>
              )}
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                check.status === 'passed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                  : check.status === 'warning'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
              }`}
            >
              {check.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
