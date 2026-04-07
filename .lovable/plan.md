

## Inject Venue Dedup + DNA Style into AI Prompt — Assessment

### Current State

The codebase already implements all three sections from the user's `buildDNAPromptSection` spec:

| Spec Section | Already Exists | Location |
|---|---|---|
| `DINING STYLE FOR THIS TRAVELER` + `diningStyle` | ✓ `buildDiningPromptBlock()` outputs "Style: {diningStyle}" | `dining-config.ts:258-281`, injected at `compile-prompt.ts:876` |
| `PRICE GUIDANCE PER PERSON` (breakfast/lunch/dinner/drinks) | ✓ Same function outputs "Price guidance per person: Breakfast €X-Y, Lunch..." | `dining-config.ts:274-276` |
| Michelin policy (required/encouraged/discouraged) | ✓ `buildMichelinPromptBlock()` called inside `buildDiningPromptBlock` | `dining-config.ts:278` |
| `REAL RESTAURANTS ONLY` banned patterns | ✓ 11-line block with exact same banned patterns | `compile-prompt.ts:796-806` |
| Venue dedup blocklist | ✓ `VENUE DEDUP — DO NOT REVISIT` with fuzzy-match guidance | `compile-prompt.ts:1079-1093` |

The DNA dining config is computed from the traveler's archetype tier at `compile-prompt.ts:672`:
```typescript
const diningConfig = getDiningConfig(archetypeTier, archetypeContext.definition.identity || primaryArchetype);
```

### Conclusion

**No changes needed.** Every element of the proposed `buildDNAPromptSection` is already present in the system prompt, with richer detail (Michelin block includes destination-specific guidance, venue dedup includes fuzzy-match warnings). Adding it again would create duplicate/conflicting instructions in the prompt.

