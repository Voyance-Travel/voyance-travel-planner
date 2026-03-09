

## Bring Back "Need to Know" as Collapsible Row in Unified Card

The `NeedToKnowSection` component still exists in `EditorialItinerary.tsx` (line 6284) but was disabled at line 5638. It needs to be added as a new collapsible row (ROW 6) in the unified Trip Command Center card, after Travel Intelligence.

### Changes

**File: `src/components/itinerary/EditorialItinerary.tsx`**

1. **Add ROW 6 after Travel Intel (after line 4305)**: Insert a new collapsible section that renders `<NeedToKnowSection>` with `destination`, `destinationCountry`, and `destinationInfo` props (all already available in scope).

```tsx
{/* ROW 6: Need to Know (collapsible) */}
<Collapsible>
  <CollapsibleTrigger className="w-full px-4 sm:px-6 py-3 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors border-b border-border/50">
    <div className="flex items-center gap-2">
      <Shield className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xs font-semibold text-primary uppercase tracking-wider">Need to Know</span>
    </div>
    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="p-3 sm:p-4">
      <NeedToKnowSection
        destination={destination}
        destinationCountry={destinationCountry}
        destinationInfo={destinationInfo}
      />
    </div>
  </CollapsibleContent>
</Collapsible>
```

`Shield` is already imported from lucide-react. No other file changes needed — the component and its data-fetching logic are intact.

