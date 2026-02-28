

# Fix: 4th Flight Leg (Return) Disappearing in Multi-City Step 2

## Root Cause

There are **two competing useEffects** in `MultiLegFlightEditor.tsx` that both try to populate the flight slots when an import happens, and they **fight each other**, causing the return leg to be dropped.

### The Race Condition

When you import 4 legs (e.g., ATL->MAD, MAD->PMI, MAD->BOS, BOS->ATL):

1. `handleImportAllLegs` in Start.tsx splits the 4 legs into:
   - `outboundFlight` = leg 0 (ATL->MAD)
   - `additionalLegs` = legs 1-2 (MAD->PMI, MAD->BOS)
   - `returnFlight` = leg 3 (BOS->ATL)

2. This triggers **two effects simultaneously** in `MultiLegFlightEditor`:
   - **Effect A (line 277)**: The "rehydration" effect, triggered by changes to `initialOutbound`/`initialReturn`/`initialAdditionalLegs`. It builds `incomingLegs = [outbound, ...additional, return]` = 4 legs, but only has 3 auto-generated slots (outbound, intercity, return). It fills 3 slots and tries to insert 1 custom slot.
   - **Effect B (line 341)**: The "import" effect, triggered by `importNonce`. It does classification-aware matching and also tries to insert custom slots.

3. Both effects call `setSlots()` with the **same `prev` state** (React batching), so one overwrites the other. The return leg's custom slot insertion from one effect gets wiped by the other effect's result.

### Why previous fixes didn't work

Every attempt added more logic to insert "extra" legs, but the fundamental issue is that **two effects both try to modify slots from the same import event**, and React's state updates mean the second one overwrites the first.

## Solution

**Make the import effect (Effect B) the sole authority during imports, and prevent the rehydration effect (Effect A) from firing when an import just happened.**

### File Changes

#### 1. `src/components/planner/flight/MultiLegFlightEditor.tsx`

- Add a `lastAppliedNonce` ref to track when an import was just processed
- In the **rehydration effect (line 277)**: Skip execution if `importNonce` matches `lastAppliedNonce` (meaning the import effect will handle it)
- In the **import effect (line 341)**: 
  - Set `lastAppliedNonce.current = importNonce` when processing
  - Build slots from scratch for the import case: start with the auto-generated slots, match ALL imported legs (primary + connections + unplaced), and create custom slots for anything left over -- all in ONE pass
  - Remove the `alreadyExists` check that was incorrectly filtering out legs that partially matched slots from the racing rehydration effect

```text
Before (two effects racing):
  Import arrives
    -> Effect A fires (rehydration): fills 3 slots, tries to add 1 custom
    -> Effect B fires (import): fills 3 slots, tries to add customs
    -> Effect B overwrites Effect A -> return leg lost

After (single authority):
  Import arrives
    -> Effect A fires but sees importNonce === lastAppliedNonce, skips
    -> Effect B fires: fills 3 slots + creates 1 custom slot for 4th leg
    -> All 4 legs visible
```

#### 2. No other files need changes

The `handleImportAllLegs` in Start.tsx, the `FlightImportModal`, and `AddBookingInline` are all correct. The split into outbound/additional/return is fine -- the bug is entirely in how `MultiLegFlightEditor` processes these inputs.

## Technical Details

Changes to `MultiLegFlightEditor.tsx`:

1. Add `const lastAppliedNonce = useRef<number>(0);` after the `initialized` state
2. In the rehydration effect (~line 277), add guard: `if (importNonce && importNonce === lastAppliedNonce.current) return;`
3. In the import effect (~line 341):
   - Set `lastAppliedNonce.current = importNonce!;` at the top
   - After matching primary legs to existing slots, do a single pass for ALL unplaced legs (connections + unmatched), inserting them before the return slot
   - Remove the `alreadyExists` dedup check that was based on partial data from the racing effect, and instead use `placedLegIds` (already tracked) as the sole dedup mechanism
4. Add `importNonce` to the rehydration effect's dependency array so it can check against it

This is a **targeted, minimal fix** -- no architectural changes, no new props, no new components.
