

# Audit: Paris Trip Quality Issues

## Issues Found

The Paris trip (Apr 9-13) has severe structural problems across all 5 days:

| Issue | Days Affected | Severity |
|-------|--------------|----------|
| Activities at 00:00-06:00 AM (breakfast at 1:25 AM, Louvre at 3:55 AM, sunset at 2:00 AM) | Days 2, 3, 4 | Critical |
| Duplicate "Return to Your Hotel" entries | Day 1 | High |
| Consecutive transport cards with no activity between | Days 2, 3 | High |
| Overlapping activities (wellness 12:20-14:00 vs lunch 12:30-13:30) | Day 2 | High |
| Nightcap scheduled before dinner (22:00 vs 23:00) | Day 4 | Medium |
| Departure train overlaps lunch | Day 5 | Medium |
| Late-night spillover from previous day onto next day | Days 2, 3 | Critical |

## Root Cause Analysis

The **Dawn Guard** in `repair-day.ts` (line 574-630) is the primary culprit. When the AI generates activities with pre-dawn times, the Dawn Guard shifts **ALL** activities forward by the same offset. This means:

- If earliest activity is at 00:05 (5 min), the guard computes a shift of ~475 minutes
- Activities already at reasonable times (09:30, 12:30) get pushed to 17:25, 20:25
- The result is worse than the original

The duplicate hotels and consecutive transports should already be improved by our previous deployment, but the timing catastrophe makes everything else irrelevant.

## Implementation Plan

### 1. Fix Dawn Guard: split-shift strategy (repair-day.ts)

Instead of shifting ALL activities uniformly:
- **Partition** activities into two clusters: pre-dawn (before 06:00) and post-dawn (06:00+)
- **Remove** the pre-dawn cluster if it looks like spillover from the previous day (hotel returns, transport-to-hotel at 00:xx)
- **Rebase** remaining pre-dawn activities (real morning activities with wrong times) to start at `earliestAllowed` (08:00), preserving their relative spacing
- **Leave post-dawn activities untouched**

### 2. Add spillover detection pass (repair-day.ts, before Dawn Guard)

Add a new pass that detects and strips end-of-previous-day activities that got placed on the current day:
- Activities before 03:00 AM with titles matching "Return to Hotel", "Travel to Your Hotel", "Nightcap", or hotel accommodation categories
- On non-first days only

### 3. Add overlap resolution pass (universal-quality-pass.ts)

The quality pass currently has no overlap detection. Add a pass that:
- Iterates activities in chronological order
- When activity N's startTime is before activity N-1's endTime, shifts activity N to start after N-1 ends (plus 15-min buffer)
- Cascades shifts to subsequent activities if needed

### 4. Strengthen nightcap/dinner ordering (repair-day.ts)

The existing nightcap swap logic (line 933-966) should work but may not fire if the activity titles don't match the keyword regex. Broaden the `NIGHTCAP_KW` pattern to also catch:
- Titles containing "cocktail" (without "evening" prefix)
- Titles containing "bar" combined with a late time slot
- Activities at bars/lounges scheduled before a dinner activity

Also re-run the nightcap check **after** the timing overlap pass to catch cases where reordering created new violations.

## Files to Modify

| File | Change |
|------|--------|
| `pipeline/repair-day.ts` | Fix Dawn Guard split-shift + add spillover strip |
| `universal-quality-pass.ts` | Add overlap resolution pass |
| `pipeline/repair-day.ts` | Broaden nightcap detection keywords |

