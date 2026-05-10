## P1.5 — Delete `flight-status` edge function (and live UI consumers)

### Heads-up before I delete

The spec frames this as a stale function cleanup, but `flight-status` is **not orphaned**. It powers the agent workspace's "Flights" tab. Deleting it as written removes a live, working feature from `/agent/...`. I want to confirm scope before nuking it.

### What's referenced today


| Reference                                                               | Role                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `supabase/functions/flight-status/index.ts` (239 lines)                 | Amadeus-backed flight status lookup (carrier+flight+date → live status, gate, terminal, delay)     |
| `supabase/config.toml:80` `[functions.flight-status]`                   | Deploy config                                                                                      |
| `src/components/agent/FlightStatusTracker.tsx` (full file, ~200+ lines) | Component that calls `supabase.functions.invoke('flight-status', …)` and renders status cards      |
| `src/pages/agent/TripWorkspace.tsx:92, 604`                             | Imports + renders `<FlightStatusTracker segments={segments} />` inside the "Flights" `TabsContent` |


So the deletion blast radius is: 1 edge function + its config block + 1 component + 2 lines in `TripWorkspace.tsx` + the Flights tab visibly loses its tracker (the empty-state card below it stays).

### Plan

**Recommendation: A.** The spec's intent is "stop deploying this function," and the surrounding UI is internal-agent-only with an empty-state already in place. But I want explicit confirmation rather than silently breaking a tab.

**A. Full delete (matches the spec literally).**

1. `rm -rf supabase/functions/flight-status/`
2. Remove `[functions.flight-status]` block from `supabase/config.toml` (lines around 80).
3. Delete `src/components/agent/FlightStatusTracker.tsx`.
4. In `src/pages/agent/TripWorkspace.tsx`:
  - drop the `import FlightStatusTracker …` (line 92),
  - remove `<FlightStatusTracker segments={segments} />` (line 604),
  - leave the existing "No flights to track" empty-state card so the tab still renders something useful when there are flights too — or replace with a static "Flight tracking coming soon" message; will go with **just removing the tracker line** and letting the existing card show whenever segments are empty (when segments exist, the tab will be blank — acceptable for an internal tool, but flagging it).
5. Call `supabase--delete_edge_functions(["flight-status"])` so the deployed function is removed, not just the local file.
6. Verify: `ls supabase/functions/ | grep flight-status` → empty; `rg -n "flight-status\|FlightStatusTracker" src/ supabase/` → empty.

**B. Soft delete (safer).** Keep `FlightStatusTracker.tsx` but stub `invoke('flight-status', …)` to return `{ success: false, error: 'tracking unavailable' }` so the existing "tracking unavailable" UI path renders. Then delete the edge function + config. Frontend grep still shows one match (the now-unused invoke call) — fails the spec's verify, but preserves the tab structure.

**C. Skip — keep flight-status.** If the function is supposed to stay (e.g., Amadeus key is configured and agents rely on it), reject the ticket. Confirm by checking whether `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` are configured for the project; if they are, this feature is in production use.

### Files / state changed for option A

- Deleted: `supabase/functions/flight-status/index.ts`, `src/components/agent/FlightStatusTracker.tsx`
- Edited: `supabase/config.toml` (remove block), `src/pages/agent/TripWorkspace.tsx` (2 lines)
- Deployed: `delete_edge_functions(["flight-status"])`

No DB migration. No schema impact. The "Flights" tab on `/agent/...` will lose its tracker UI; the empty-state card remains for the no-segments case.

### Question for you

Should I proceed with **A (full delete + agent UI gutted)**, **B (soft delete, keep tab UI shape)**, or **C (skip — function stays)**? **Option C — skip, keep** `flight-status`**.**

Reasons:

- Your original directive was "no longer support **flight search**" — that's the customer-facing flight *booking* path. **Flight status tracking is a different feature** (post-booking value: gate, terminal, delay for flights users already have). The spec conflated the two.
- It's a **live working feature** in your internal agent workspace. The audit prescription was based on it being orphaned; you've proved that wrong. Following the spec literally would delete working code.
- Cost to keep: ~zero. Edge function only bills per invocation; if the agent tab sees light use, billing is rounding error.
- Cost to delete + later re-add: high. Re-implementing Amadeus integration, the React component, and the agent tab plumbing is a half-day's work to undo a 5-minute delete.
- Option B (soft delete) is the worst of both — leaves dead code in the frontend, breaks the live call without any cleanup benefit, and still fails the spec's verify grep. Don't ship B under any circumstances.

**Action:** reject the ticket. Update the audit note: "RS.M.X flight-status — not applicable. Function is live in agent workspace (`TripWorkspace.tsx:604`), powered by Amadeus, distinct from the deprecated `flights` search function."

**Quick verification** before fully closing the ticket:

```
# Confirm Amadeus secrets are configured (proves it's actively used, not stub)
```

`# In Supabase Dashboard → Edge Function Secrets, look for:`

`#   AMADEUS_API_KEY`

`#   AMADEUS_API_SECRET`

If both secrets are present → the function is in active use, definitely keep. If both are missing → the agent tab has been silently broken; you can either delete (Option A) or set up Amadeus credentials. Your call based on whether agent flight-tracking is something you actually use.

Either way: don't blindly follow a spec that's targeting the wrong function.