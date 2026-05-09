## MD2 Fix: Wire DNAFeedbackChat success callback

### Scope
Single render site found:
- `src/components/profile/TravelDNAReveal.tsx:674` — `<DNAFeedbackChat userId={userId} />` with no `onFeedbackApplied`.

The DNA query in this same file uses `queryKey: ['travelDNA', userId, refreshKey]` (note: `travelDNA`, not `travel-dna` as in the issue snippet). Profile queries use the broad key `['profile']` / `['profile', userId]`.

### Change
In `src/components/profile/TravelDNAReveal.tsx`:

1. Import `useQueryClient` from `@tanstack/react-query` (already imports `useQuery` from same package).
2. Inside the default-exported `TravelDNAReveal` component, instantiate:
   ```ts
   const queryClient = useQueryClient();
   ```
3. Pass the callback to the existing render site:
   ```tsx
   <DNAFeedbackChat
     userId={userId}
     onFeedbackApplied={() => {
       queryClient.invalidateQueries({ queryKey: ['travelDNA', userId] });
       queryClient.invalidateQueries({ queryKey: ['profile', userId] });
       queryClient.invalidateQueries({ queryKey: ['profile'] });
     }}
   />
   ```

Using the actual project keys (`travelDNA`, `profile`) ensures invalidation matches; partial-match invalidation will refresh `['travelDNA', userId, refreshKey]` regardless of `refreshKey` value.

### Verification
- `rg -n "DNAFeedbackChat" src -g '*.tsx'` — confirm only one render site (TravelDNAReveal.tsx:674) — already verified.
- After submitting feedback in the Deeper tab, the archetype/trait UI should refresh without manual reload.

### Out of scope
- No changes to `DNAFeedbackChat.tsx` itself; the optional prop already exists.
- No backend changes.
