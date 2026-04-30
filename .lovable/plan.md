## Diagnosis

The user sees only 2 days of weather forecast for a 6-day trip. This is a real data bug in `supabase/functions/weather/index.ts`, not a frontend issue.

### Root cause

Apple WeatherKit's `forecastDaily` only returns ~10 days **from today**. The function filters those days to `dayDate >= tripStart` (line 211-217). When the trip starts ~8 days from now and runs 6 days (so days 8-13), WeatherKit's window covers days 0-9 → only 2 days overlap → the function returns 2 forecast entries and never falls through to Open-Meteo (which covers 16 days and could cover the full trip).

There's also a hidden second bug at lines 220-223: when zero days overlap (trip starts 11+ days out), it silently substitutes "first N days from today" — wrong dates entirely, but the function still reports `source: 'weatherkit'` as if successful.

The frontend (`src/components/itinerary/WeatherForecast.tsx` line 94) correctly requests `days: tripDays`. The bug is purely in the edge function.

## Fix

One file: `supabase/functions/weather/index.ts`.

### 1. Stop silently substituting wrong dates in `fetchWeatherKit`

Replace the fall-through at lines 220-223. When WeatherKit returns zero overlapping days for the trip, return `null` so the main handler can try Open-Meteo. Today this masks the failure.

### 2. Supplement WeatherKit with Open-Meteo when WeatherKit returns a partial result

In the main handler (lines 433-457), after WeatherKit succeeds:

- If `weather.forecast.length >= days` → use as-is (current behavior).
- Else → call Open-Meteo for the **trip start date + days** window. Take Open-Meteo's days that aren't covered by WeatherKit (date-based merge, WeatherKit wins for overlapping days because it's higher-quality), append until total = `days`.
- If Open-Meteo also can't cover the tail (`daysUntilTrip + days > 16`), fill remaining slots from `generateFallbackForecast` so the UI always renders `days` entries that match the trip's actual dates.

Mark `source`:
- `'weatherkit'` if all days came from WeatherKit
- `'open-meteo'` if mixed or all Open-Meteo
- `'fallback'` only if no real data at all

### 3. Add a coverage log line

```
[Weather] coverage for "<destination>": weatherkit=<n>, open-meteo=<m>, fallback=<k>, requested=<days>, tripStart=<date>
```

So we can audit in production whether real data is reaching trips.

### 4. (Optional, low risk) Remove `forecast_days` cap risk in `fetchOpenMeteo`

Line 281: `Math.min(daysUntilTrip + days, 16)`. This is correct as-is, but I'll keep `forecast_days` strictly within Open-Meteo's documented max (16) and add a guard: if `daysUntilTrip + days > 16`, request `forecast_days=16` and log how many trip days were uncovered.

## Verification

After deploy:

1. Curl `weather` with `{ destination: "Paris", startDate: "<8 days from today>", days: 6 }`. Expect `weather.forecast.length === 6` with dates matching the trip range, not today's range.
2. Curl with `startDate: "<14 days from today>", days: 6`. Expect 6 forecast entries, source `'open-meteo'` (or mixed), dates correct.
3. Curl with `startDate: "<25 days from today>", days: 6`. Expect 6 entries, source `'fallback'` (or mixed), dates correct.
4. Pull the function logs to confirm the new coverage line prints.

If the user can share which trip ID showed only 2 days, I'll also re-run that specific case post-fix.

## Files changed

- `supabase/functions/weather/index.ts` — only file touched.

## Out of scope

- React component refactor (already correct).
- Caching weather results in DB (separate cost-optimization conversation).
- Per-day weather context inside the AI prompt — that's a different consumer; this fix focuses on the user-facing forecast card.
