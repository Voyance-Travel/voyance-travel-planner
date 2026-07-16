// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// Warns when the arrival flight time doesn't line up with Day 1's first
// activity, and offers a one-click "sync schedule to flight" action.
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { EditorialActivity } from '../EditorialItinerary';

interface FlightSyncWarningProps {
  flightArrivalTime: string;
  day1FirstActivity?: EditorialActivity;
  onSyncDay1: () => void;
  isRegenerating: boolean;
}

export function FlightSyncWarning({ flightArrivalTime, day1FirstActivity, onSyncDay1, isRegenerating }: FlightSyncWarningProps) {
  // Parse flight arrival time
  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + mins;
  };

  const flightMins = parseTimeToMinutes(flightArrivalTime);

  // Convention v2 (2026-05-27): the "Arrival Flight" anchor's startTime IS
  // the landing moment (was: endTime under the old "120-min in-flight window"
  // convention). Always compare flight arrival against the card's startTime.
  const firstAct = day1FirstActivity as any;
  const activityTimeField = firstAct?.startTime || firstAct?.start_time || '';
  const activityMins = parseTimeToMinutes(activityTimeField);

  const anchorSource = (firstAct?.anchorSource || firstAct?.source || '').toLowerCase();
  const titleLc = (firstAct?.title || '').toLowerCase();
  const isArrivalFlightAnchor =
    anchorSource === 'arrival-flight' ||
    anchorSource === 'repair-arrival-flight' ||
    anchorSource === 'repair-arrival-flight-reconciled' ||
    anchorSource === 'injected-arrival-flight' ||
    /\barrival flight\b|\blanding\b/.test(titleLc);

  // If no flight time or first activity, don't show warning
  if (flightMins === null || activityMins === null) return null;

  // Check if Day 1's first activity is "Arrival" type - if so, compare times
  const isArrivalActivity = isArrivalFlightAnchor ||
    day1FirstActivity?.title?.toLowerCase().includes('arrival') ||
    day1FirstActivity?.category === 'transport';

  if (!isArrivalActivity) return null;


  // Calculate the EXPECTED earliest activity time (arrival + customs/transit buffer)
  const FLIGHT_BUFFER_MINS = 105; // 1h customs + 45m transit — same as cascadeTransportToItinerary
  const expectedEarliest = flightMins + FLIGHT_BUFFER_MINS;

  // If the arrival activity starts within 5 minutes of flight arrival, times are aligned — no warning
  const timesAreAligned = Math.abs(activityMins - flightMins) <= 5;
  if (timesAreAligned) return null;

  // The warning should only fire if:
  // 1. First activity starts BEFORE the expected earliest (schedule is too early), OR
  // 2. First activity starts more than 3 hours AFTER the expected earliest (unreasonable gap)
  const activityIsBeforeExpected = activityMins < (flightMins + 30); // Activity before arrival + 30m = definitely wrong
  const gapFromExpected = activityMins - expectedEarliest;
  const unreasonableGap = gapFromExpected > 180; // More than 3 hours after expected = suspicious

  if (!activityIsBeforeExpected && !unreasonableGap) return null;

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  };

  return (
    <div className="border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 rounded-full shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 dark:text-amber-100">
            Flight times don't match your itinerary
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Your flight arrives at <span className="font-semibold">{formatTime(flightMins)}</span>,
            but Day 1 shows arrival at <span className="font-semibold">{formatTime(activityMins)}</span>.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            This can happen if you added or changed your flight after generating the itinerary.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncDay1}
            disabled={isRegenerating}
            className="mt-3 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing schedule...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync schedule to flight times
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
