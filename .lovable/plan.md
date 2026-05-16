## Plan: make locked activities incorporated, not dumped on top

### Problem to fix
Locked/user-stated activities are currently treated too literally in two paths:

1. If they have no time, venue, description, or purpose, they can become hard `userAnchors` and later get restored by `anchor-guard` as a blank 60-minute locked row.
2. The Day Brief tells the AI “do not drop/replace/retime,” but does not give enough context to schedule around flexible requests or explain their purpose.
3. Post-generation `ledger-check` can insert placeholders for missing user intents, which again surfaces the words instead of an incorporated plan.

So yes: the system is still sometimes “throwing them on top.” The venue resolver helped one case, but it did not fix the anchor/ledger behavior.

### What I will change

#### 1. Split user requests into hard locks vs flexible intents
Update the shared anchor parsing rules in both backend and frontend mirrors:

- Hard locked anchor only if it has enough structure:
  - fixed day + fixed time, or
  - a named/resolved venue with enough detail, or
  - a true booked/pre-existing commitment.
- Generic/flexible wishes like “sushi lunch,” “spa day,” “rooftop cocktails,” or “some shopping” become `trip_day_intents`, not locked activities.
- This preserves user intent without forcing an empty activity card.

#### 2. Carry purpose/context into the Day Brief
Enhance `UserAnchor` / `DayIntent` metadata so the Day Brief can say things like:

```text
USER INTENT — incorporate naturally:
- Lunch request: sushi lunch. Pick a real sushi restaurant, schedule it as lunch, add description/address, and route the day around it.
```

Instead of:

```text
USER REQUIRED — DO NOT DROP: Sushi Lunch (no fixed time)
```

#### 3. Resolve generic dining/drink intents before generation
Extend the resolver work so resolved venues are not only written into prompt text, but also into structured day intents:

- “sushi lunch” -> `lunch` intent with resolved restaurant name/address when possible.
- “rooftop cocktails day 3” -> `drinks` intent with resolved bar name/address.
- If no venue can be resolved, it stays flexible and the AI must pick a real venue, not create a placeholder.

#### 4. Stop placeholder restoration for flexible intent misses
Change `ledger-check` behavior:

- For flexible must intents, do not insert a naked placeholder row.
- Instead, flag the day for repair/regeneration or add a rich validation warning so the next repair pass fills it with a real scheduled activity.
- Hard locked/booked activities still get restored exactly.

#### 5. Make anchor restore richer only for true locks
When `anchor-guard` restores a real hard lock, it will preserve any available:

- description
- purpose/note
- venue name
- address
- source metadata

But it will no longer manufacture a visible empty card from a vague wish.

#### 6. Add regression tests
Add tests for the exact failure class:

- “sushi lunch” becomes a flexible lunch intent / resolved restaurant, not a locked empty card.
- timed named request stays a hard lock.
- no-time/no-description user wishes are not restored as top-of-day placeholders.
- Day Brief wording says “incorporate naturally” for flexible intents and “do not retime” only for true locks.

### Files to update

- `supabase/functions/_shared/user-anchors.ts`
- `src/utils/userAnchors.ts`
- `supabase/functions/_shared/intent-normalizers.ts`
- `supabase/functions/_shared/day-intents-store.ts`
- `supabase/functions/generate-itinerary/day-ledger.ts`
- `supabase/functions/generate-itinerary/ledger-check.ts`
- `supabase/functions/generate-itinerary/anchor-guard.ts`
- `supabase/functions/_shared/resolve-user-intent-venues.ts`
- related tests in `_shared` and `generate-itinerary`

### Expected behavior after this
Users can type natural requests like “sushi lunch” or “spa afternoon,” and the itinerary engine treats them as planning requirements: find or pick a real place, schedule it in a believable slot, add description/address, and route the day around it. Only genuinely fixed commitments are locked verbatim.