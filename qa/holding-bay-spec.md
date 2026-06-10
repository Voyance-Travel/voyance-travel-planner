# Holding Bay ("Not yet placed") — Feature Spec

**Goal:** turn the passive *"couldn't fit X"* capacity warning into an actionable holding area. Dropped must-dos live as **real, movable cards** on the side; the user places them with an **explicit trade-off** — *"show what it would displace and ask"* (the chosen model). Never silently auto-shuffle; never put held items inline in the itinerary.

**Arc it completes:** drop cleanly → name what fell off → hold it on the side → user places it → show the cost → they decide.

---

## 1. Data model
The bay lives at **`trip.metadata.holding_bay`** = array of `HeldItem`:

```ts
HeldItem {
  id: string                 // stable
  source: 'capacity_overflow' | 'user_swap'  // why it's in the bay
  label: string              // the must-do text, e.g. "One memorable splurge dinner"
  resolved: {                // PRE-RESOLVED concrete suggestion (the key backend work)
    title: string            // "Splurge Dinner at Bodega Oliva"
    venueName: string
    address?: string
    category: string         // dining | sightseeing | ...
    durationMin: number
    description?: string
  } | null                   // null = couldn't resolve; show as text-only card
  originalMustDo?: string
  createdAt: string
}
```

**Critical:** each held item must carry a **concrete resolved venue**, not just the must-do string — so dropping it adds a *real* card, not a blank stub. Resolve at generation time by reusing the existing venue resolver (catalog / recommend-restaurants / places).

---

## 2. Surfaces (one model, two renderings — mobile-first)
- **Mobile (primary):** sticky bottom chip **"Not yet placed · N"** → opens a **drawer** of cards. Tap a card → "Which day?" picker (drag-drop is miserable on a phone).
- **Desktop (enhancement):** collapsible **right rail** "Not yet placed (N)"; cards are **drag sources** → drag onto a day.
- **Never inline** in the itinerary. Hide entirely when the bay is empty.
- **Naming:** "Not yet placed" (positive holding-area framing, not "Couldn't fit").

---

## 3. Place interaction — explicit trade-off
On place onto **Day D**:

1. **Fit check:** is there an open gap ≥ `durationMin` with no overlap?
   - **Room →** place directly, no displacement. Item leaves bay. Soft toast *"Added to Day D."*
   - **No room →** find swap candidate → confirm sheet.

2. **Swap-candidate rule** (pick the FIRST match among Day D's cards):
   1. **Same slot/category** as the held item (held *dinner* → existing *dinner*), **non-locked, non-must-do**.
   2. Else any **non-locked, non-must-do, non-logistics** card (prefer lowest-weight: filler/leisure over a marquee sight).
   3. Else (only locked/must-do/logistics remain) → "this day is all pinned" path (§4).
   - **Never auto-pick:** logistics (check-in/out, transfer, flight), locked cards, user must-dos.

3. **Confirm sheet:**
   > **Add "Splurge Dinner at Bodega Oliva" to Day 3?**
   > This would replace **Dinner at Café Y** (19:30).
   > **[ Swap ]   [ Add both — Day 3 gets busy ]   [ Cancel ]**
   - **Swap:** held item takes Y's slot; **Y goes BACK to the bay** (`source: 'user_swap'`) — lossless, two-way. Held item leaves bay.
   - **Add both:** place it; **re-time the day** (reuse the breakfast-lift forward-cascade: push overlaps to prevEnd+15, bounded < 23:00); show *"Day 3 is now busy."* Nothing displaced.
   - **Cancel:** no change; item stays in bay.

---

## 4. Guardrails
- **Locks + user must-dos are never silently displaced.** If the only candidate is locked/must-do:
  > *"Replacing Café Y removes a pinned priority. [ Replace anyway ] [ Pick another day ] [ Cancel ]"*
- **Logistics never displaced** (check-in/out, transfers, flights).
- Re-time uses the existing **cascade** logic (`selfCheckAndRepair` breakfast cascade) — forward-push overlaps, cap < 23:00.
- Bay **persists** in `trip.metadata`, survives reload, empties as items are placed; swaps refill it.

---

## 5. Engineering — what's already there vs. new
**Reuse (already built — task #15 "in-itinerary tools: move/swap/add"):**
- The add-card / swap-card / re-time machinery + the user-edit persistence path (frozen-guard already whitelists user saves). The bay "place" is mostly *wiring the bay into the existing add/swap*, not new swap logic.

**New work:**
1. **Backend:** at generation, resolve each `capacity_warning.unmet` → concrete venue; write `holding_bay`. *(the real lift)*
2. **Place/swap orchestration:** fit check + swap-candidate rule + the three confirm actions, mutating `itinerary_data` + `holding_bay` together, persisting via the existing user-edit path.
3. **UI:** mobile drawer + chip (Phase 1); desktop drag rail (Phase 2).

---

## 6. Phasing
- **Phase 1 (MVP):** pre-resolve venues + mobile drawer + tap-to-place + swap/add/cancel sheet. Covers ~80%.
- **Phase 2:** desktop drag rail.

---

## Open questions to lock before build
1. **Final name:** "Not yet placed" / "On your list" / "Saved for later"?
2. **Place orchestration:** client-mutate-then-persist (simpler) vs. a dedicated `place-held-item` edge action (cleaner, server-authoritative)?
3. **Resolve failures:** if we can't resolve a vague must-do to a real venue, show it as a text-only card the user places manually — OK, or drop from bay?
