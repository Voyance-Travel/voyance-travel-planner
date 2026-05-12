## Hotel-Return Survival Telemetry

Observation-only instrumentation across the 5 bookend pipeline sites so the next user trip produces one structured `[BOOKEND_SUMMARY]` per day, identifying exactly where the hotel-return card is being lost (emit, strip, clamp, save, or read-time).

Zero behavior change. No new code paths, no new conditions — only `console.log` + a tiny per-day counter object stamped onto `metadata.quality.bookend_trace`.

### Trace events (single tag, structured payload)

All sites emit the same `[BOOKEND_TRACE]` line shape so logs are greppable and aggregable:

```text
[BOOKEND_TRACE] day=N site=<emit|strip|clamp|save|readtime> action=<emitted|stripped|clamped|persisted|injected|skipped> source=<bookend-validator|late_nightlife_bookend|bookend-synthesized|bookend-readtime|bookend-overnight|n/a> reason=<short>
```

### Instrumentation sites

1. **`runStep8` — `supabase/functions/generate-itinerary/universal-quality-pass.ts` (~L262)**
   Right after the `result.push(card)`: emit `site=emit action=emitted source=${card.source}`. Also emit `site=emit action=skipped reason=<alreadyReturn|airport|no_window|…>` at each existing early-return so we know *why* a day didn't get one.

2. **`stripPreDawnHotelReturns` — `supabase/functions/_shared/predawn-hotel-strip.ts` (~L82)**
   Inside the splice loop: emit `site=strip action=stripped source=${act.source||'unknown'}` per removal. Existing skip-counter for `late_nightlife_bookend` already logs; reformat to the same tag.

3. **`clampAllBookends` / `clampBookendEndTime` — `supabase/functions/_shared/clamp-bookend.ts` (~L160)**
   Convert the existing `[BOOKEND_CLAMP]` warn to also emit a structured `[BOOKEND_TRACE] site=clamp action=clamped reason=${reason}` line (keep the human-readable warn for now).

4. **`action-save-itinerary normalizeDays` — `supabase/functions/generate-itinerary/action-save-itinerary.ts` (~L173–L182, L500–L515)**
   - At the BOOKEND_REORDER tail-move site: emit `site=save action=reordered`.
   - After the save-time `runStep8` retry: count whether a bookend now exists on the day; emit `site=save action=persisted source=${terminal.source}` or `action=missing reason=<no_runStep8_match>`.

5. **`ensureHotelReturnBookend` — `src/lib/itinerary/ensureHotelReturnBookend.ts` (~L201)**
   At the synthetic injection return: emit `[BOOKEND_TRACE] site=readtime action=injected source=${source}`. Also at the early-return guards (`isTerminalAlready`, `isDepartureTerminal`, late-night non-qualifier, no-times) emit `action=skipped reason=…`.

### Per-day aggregator

In `action-save-itinerary normalizeDays`, after both the BOOKEND_REORDER block and the save-time `runStep8` retry, emit ONE summary line per day and stamp it onto `metadata.quality.bookend_trace`:

```text
[BOOKEND_SUMMARY] day=N emitted=<0|1> stripped=<n> clamped=<n> persisted=<0|1> persistedSource=<…|none>
```

The counts are derived by scanning the day's activities at the end of `normalizeDays` (no extra mutation): `persisted = does the chronologically last card have source ∈ bookend-* / late_nightlife_bookend / category accommodation+TRUE_RETURN_RE`. The emitted/stripped/clamped tallies are accumulated in a tiny per-day `{emitted, stripped, clamped}` object passed by reference (or recomputed from log counters scoped to the loop iteration — easier and same result).

### Read-time aggregator

In the parser path that calls `ensureHotelReturnBookend` (already wired in `parseItineraryParser` Step 4b — no edit needed there beyond the trace lines added in site 5), the existing call site naturally produces one `site=readtime action=injected|skipped` line per day, which is sufficient — no separate summary needed for the read path.

### Files touched

- `supabase/functions/generate-itinerary/universal-quality-pass.ts` (4 trace lines in `runStep8`)
- `supabase/functions/_shared/predawn-hotel-strip.ts` (1 trace line per removal + reformat existing skip log)
- `supabase/functions/_shared/clamp-bookend.ts` (1 trace line in `clampBookendEndTime`)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (3 trace lines + 1 `[BOOKEND_SUMMARY]` per day + stamp on `metadata.quality.bookend_trace`)
- `src/lib/itinerary/ensureHotelReturnBookend.ts` (4 trace lines: 1 inject, 3 skip reasons)

### Exit criteria

After the user regenerates one trip, grep server + browser logs:

```bash
grep BOOKEND_SUMMARY  # one line per day
grep BOOKEND_TRACE    # full pipeline per day
```

Pattern interpretation:
- `emitted=1 stripped=1 persisted=0` → predawn-strip is eating valid bookends → fix allowlist.
- `emitted=0 persisted=0` + `site=emit action=skipped reason=alreadyReturn` on a day with no terminal hotel card → terminal misclassification → tighten `TRUE_RETURN_RE` / `MIDDAY_ACCOM_RE`.
- `emitted=1 persisted=1` but UI shows none → read-time `parseItineraryDays` ghost filter or `dayChronoKey` sort dropping it.
- `emitted=0 persisted=0 site=readtime action=injected=0` + `skipped reason=no_times` → terminal card has unparseable times → expand synthesis fallback in `runStep8`.

Once the leak source is identified from one real trip, write the targeted fix in a follow-up PR. No fix in this PR — telemetry only.

### Risk

Zero behavior change. Worst case: log volume increase of ~6–10 lines per day per trip. All lines are `console.log`/`console.warn` — no new exceptions, no new awaits, no schema changes.