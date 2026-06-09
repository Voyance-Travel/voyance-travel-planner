import { AlertTriangle } from 'lucide-react';

interface IntegrityViolation {
  code: string;
  dayNumber: number;
  detail: string;
  activityTitle?: string;
}

interface OmittedRequest {
  title: string;
  reason: 'infeasible_time' | 'not_scheduled';
}

interface MealCoverageRow {
  dayNumber: number;
  required: string[];
  scheduled: string[];
  missing: string[];
}

interface IntegrityContract {
  ok?: boolean;
  codes?: string[];
  violations?: IntegrityViolation[];
  infeasibleDays?: number[];
  omittedRequests?: OmittedRequest[];
  mealCoverage?: MealCoverageRow[];
  blocked_ready?: boolean;
}

interface Props {
  contract?: IntegrityContract | null;
}

const CODE_COPY: Record<string, string> = {
  TEMPORAL_ROLE_TIME_MISMATCH: 'A nightlife card is scheduled in the morning.',
  NIGHTLIFE_BEFORE_EVENING: 'A nightcap or cocktail card was scheduled before evening.',
  HOTEL_VENUE_BEFORE_CHECKIN: 'A hotel venue is scheduled before check-in.',
  REQUIRED_USER_INTENT_MISSING: 'A place you requested was not scheduled.',
  NO_SIGHTSEEING_CAPACITY: 'Your flight times leave no realistic time for the must-dos.',
  LOGISTICS_ONLY_CURATED_DAY: 'A day has only travel/hotel logistics.',
  MEAL_COVERAGE_MISSING: 'A day is missing one or more required meals.',
  NEIGHBORHOOD_ADDRESS_CONFLICT: "An activity is scheduled in a neighborhood that doesn't match the day's area.",
  FINAL_ORPHAN_TRANSIT: "A transit connection points to a venue that isn't scheduled that day.",
};

export function IntegrityContractBanner({ contract }: Props) {
  if (!contract || contract.ok !== false) return null;
  // Meal-coverage is intentionally NOT surfaced to users. The detector
  // false-fires (e.g. departure days that don't need breakfast, food-hall /
  // arrival-lunch edge cases), and a "missing meals / trip is incomplete" alarm
  // makes a perfectly good itinerary look broken. Meal coverage is still tracked
  // internally for QA — it's just never shown in this user-facing banner.
  const codes = (Array.isArray(contract.codes) ? contract.codes : []).filter(
    (c) => c !== 'MEAL_COVERAGE_MISSING',
  );
  const violations = (Array.isArray(contract.violations) ? contract.violations : [])
    .filter((v) => v.code !== 'MEAL_COVERAGE_MISSING')
    .slice(0, 5);
  const omitted = Array.isArray(contract.omittedRequests) ? contract.omittedRequests : [];

  // If meal coverage was the only thing that "failed", show nothing at all.
  if (codes.length === 0 && omitted.length === 0 && violations.length === 0) return null;

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

          {omitted.length > 0 && (
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <div className="font-medium">What we attempted but couldn't fit:</div>
              <ul className="mt-1 pl-4 list-disc">
                {omitted.map((o, i) => (
                  <li key={i}>
                    {o.title}
                    {o.reason === 'infeasible_time' ? ' - not enough time on this trip' : ' - not scheduled'}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
