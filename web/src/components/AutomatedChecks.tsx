import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { CheckResult } from '../types';

interface CheckFinding {
  severity: 'error' | 'warning';
  text: string;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

// The server emits a different details shape per check: manifest_lint sends
// errors/warnings, permissions_audit sends flagged_permissions, and
// metadata_completeness sends concerns.
function extractFindings(details: Record<string, unknown> | null): CheckFinding[] {
  if (!details) return [];

  const findings: CheckFinding[] = [];

  for (const text of asStrings(details.errors)) {
    findings.push({ severity: 'error', text });
  }
  for (const text of asStrings(details.warnings)) {
    findings.push({ severity: 'warning', text });
  }
  for (const text of asStrings(details.concerns)) {
    findings.push({ severity: 'warning', text });
  }

  if (Array.isArray(details.flagged_permissions)) {
    for (const entry of details.flagged_permissions) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { permission, concern } = entry as { permission?: unknown; concern?: unknown };
      if (typeof permission !== 'string') continue;
      findings.push({
        severity: 'warning',
        text: typeof concern === 'string' ? `${permission} — ${concern}` : permission,
      });
    }
  }

  return findings;
}

const FINDING_STYLE = {
  error: { Icon: AlertCircle, color: 'text-red-600 dark:text-red-400' },
  warning: { Icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
} as const;

export default function AutomatedChecks({ checks }: { checks: CheckResult[] }) {
  if (checks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Automated Checks
      </h2>
      <div className="space-y-3">
        {checks.map((check, i) => {
          const findings = extractFindings(check.details);
          return (
            <div
              key={i}
              className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
            >
              <div className="min-w-0">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {check.check_name.replace(/_/g, ' ')}
                </span>
                {check.message && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{check.message}</p>
                )}
                {findings.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {findings.map((finding, j) => {
                      const { Icon, color } = FINDING_STYLE[finding.severity];
                      return (
                        <li key={j} className={`flex items-start gap-1.5 text-sm ${color}`}>
                          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span className="break-words">{finding.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
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
          );
        })}
      </div>
    </div>
  );
}
