import { AlertTriangle } from 'lucide-react';

interface IntegrityViolation {
  code: string;
  dayNumber: number;
  detail: string;
  activityTitle?: string;
}

interface IntegrityContract {
  ok?: boolean;
  codes?: string[];
  violations?: IntegrityViolation[];
  infeasibleDays?: number[];
  blocked_ready?: boolean;
}

interface Props {
  contract?: IntegrityContract | null;
}

const CODE_COPY: Record<string, string> = {
  TEMPORAL_ROLE_TIME_MISMATCH: 'A nightlife card is scheduled in the morning.',
  HOTEL_VENUE_BEFORE_CHECKIN: 'A hotel venue is scheduled before check-in.',
  REQUIRED_USER_INTENT_MISSING: 'A place you selected was not scheduled.',
  NO_SIGHTSEEING_CAPACITY: 'Your flight times leave no realistic time for the must-dos.',
  LOGISTICS_ONLY_CURATED_DAY: 'A day has only travel/hotel logistics.',
};

export function IntegrityContractBanner({ contract }: Props) {
  if (!contract || contract.ok !== false) return null;
  const codes = Array.isArray(contract.codes) ? contract.codes : [];
  const violations = Array.isArray(contract.violations) ? contract.violations.slice(0, 5) : [];

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 my-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
            This trip is incomplete and was kept as a draft.
          </div>
          <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc pl-5">
            {codes.map((c) => (
              <li key={c}>{CODE_COPY[c] || c}</li>
            ))}
          </ul>
          {violations.length > 0 && (
            <details className="text-xs text-amber-700 dark:text-amber-300">
              <summary className="cursor-pointer">Show details ({violations.length})</summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {violations.map((v, i) => (
                  <li key={i}>
                    Day {v.dayNumber}: {v.detail}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
