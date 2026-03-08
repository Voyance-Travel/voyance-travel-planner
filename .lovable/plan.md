

## Plan: Fix Must-Do Activities Being Ignored in Generation

### Root Causes Found

There are **three distinct bugs** causing the US Open (and all must-do activities) to be silently dropped:

**Bug 1 — `.name` property doesn't exist (critical)**
In the generate-trip-day path (line 9621), the code references `item.priority.name`, but `MustDoPriority` has no `name` field — it has `title` and `activityName`. So the per-day prompt injects `"- undefined (must)"` which the LLM ignores completely. Same bug on line 9626.

**Bug 2 — `additionalNotes` completely ignored in per-day generation**
The full-trip path (line 8490) injects `additionalNotes` into the prompt. But the generate-trip-day path (the one actually used for server-side generation) **never reads `additionalNotes` from trip metadata**. So when the user writes an entire paragraph about the US Open in "Anything else?", it's completely lost during per-day generation.

**Bug 3 — Array join uses `, ` but parser splits on `\n`**
`mustDoActivities` array is joined with `', '` (lines 4169, 9582, 9587), but `parseMustDoInput` splits on `\n` (line 202). For a single item like "US Open" this actually works, but for multiple items they get concatenated into one unparseable string.

### Changes

#### File 1: `supabase/functions/generate-itinerary/index.ts`

**Fix A — Property name bug (lines 9621, 9626):**
Change `item.priority.name` → `item.priority.title` in both places within the generate-trip-day must-do prompt builder.

**Fix B — Inject `additionalNotes` into generate-trip-day path (~after line 9696):**
Read `metadata?.additionalNotes` and inject it into the day prompt, same as the full-trip path does at line 8490. Also run it through `parseMustDoInput()` to detect any events the user described in prose (defense-in-depth), merging detected items into the must-do pipeline if they aren't already present from `mustDoActivities`.

**Fix C — Array join delimiter (lines 4169, 9582, 9587):**
Change `raw.join(', ')` → `raw.join('\n')` in all three locations so the parser can split items correctly.

#### File 2: `supabase/functions/generate-itinerary/must-do-priorities.ts`

**Fix D — Also split on commas (line 244):**
Change `line.split(';')` → `line.split(/[;,]/)` as defense-in-depth for any remaining comma-joined input.

**Fix E — Strip conversational prefixes before pattern matching (~line 292):**
Before calling `matchEventPattern`, strip prefixes like "attending the", "going to the", "here for the", "tickets to" so "attending the US Open" still matches the "us open" event pattern.

### Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/index.ts` | Fix `.name` → `.title` (2 spots), inject `additionalNotes` into per-day path, change array join to `\n` (3 spots) |
| `supabase/functions/generate-itinerary/must-do-priorities.ts` | Add comma splitting, add prefix stripping before event matching |

### Risk Assessment
- **Bug 1 fix**: Zero risk — fixing an undefined property reference
- **Bug 2 fix**: Low risk — adding data that was always intended to be there
- **Bug 3 fix**: Low risk — `\n` is the delimiter the parser already expects
- **Fixes D/E**: Additive only — more things match, nothing breaks existing matches

