

## Fix: "All Good" Label Ignoring Issues and Buffer Warnings

### Root Cause

In `RefreshDayDiffView.tsx` (line 60), the `hasActionableChanges` flag only checks if `proposedChanges` contains non-`no_change` entries. The `issues` array (warnings/errors) and `insufficientBuffers` count are computed (lines 87-89) but never factor into the headline or the "All Good" determination. So when the edge function returns buffer warnings but no concrete patches (e.g. activities lack coordinates for transit-based fixes), the panel says "All Good" while simultaneously showing "3 too short" buffers below.

### Fix — 1 file: `src/components/itinerary/RefreshDayDiffView.tsx`

**Change the "has problems" flag** to also consider issues and insufficient buffers:

```typescript
// Line 60 — replace:
const hasActionableChanges = actionableChanges.length > 0;

// With:
const hasIssues = actionableChanges.length > 0 || issues.length > 0 || insufficientBuffers > 0;
```

Then replace all references to `hasActionableChanges` throughout the component with `hasIssues`, except where it specifically gates the change-list UI (lines 141+, 195+) which should still use `actionableChanges.length > 0`.

Specifically:
- **Line 99** (border styling): use `hasIssues`
- **Line 108-111** (icon): use `hasIssues`
- **Line 115** (headline text): use `hasIssues` — show "Proposed Changes" or a new label like "Issues Found" when there are warnings but no patches
- **Line 117-125** (subtitle): show issue/warning counts when `hasIssues` even without actionable changes
- **Line 134-138** ("No timing issues" message): only show when `!hasIssues`

The subtitle for the issues-only case (no patches but warnings exist):
```typescript
{!hasActionableChanges && hasIssues && (
  <p className="text-xs text-muted-foreground mt-0.5">
    {insufficientBuffers > 0 && `${insufficientBuffers} buffer${insufficientBuffers !== 1 ? 's' : ''} too short`}
    {warnCount > 0 && ` · ${warnCount} warning${warnCount !== 1 ? 's' : ''}`}
  </p>
)}
```

This ensures the headline accurately reflects the state: "All Good" only appears when there are truly zero issues, zero warnings, and zero insufficient buffers.

