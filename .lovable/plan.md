

## Fix: Remove Leaked Booking Urgency Text

**File**: `supabase/functions/generate-itinerary/sanitization.ts`

**Change**: Add 4 new `.replace()` calls to the `sanitizeAITextField` chain (lines 72-88), inserted after the `FORWARD_REF_RE` replacement (line 82) and before the empty-parens cleanup (line 83):

```typescript
// After line 82 (.replace(FORWARD_REF_RE, '')), add:

// Caps booking urgency: BOOK 2-4 WEEKS, RESERVE EARLY, SECURE 2 MONTHS AHEAD
.replace(/\b(?:BOOK|RESERVE|SECURE)\s+\d[\d-]*\s*(?:WEEKS?|MONTHS?|DAYS?)\s*(?:AHEAD|IN ADVANCE|BEFORE|OUT|EARLY)?\b/gi, '')

// Emoji booking flags: 🔴 Book now, 🟡 Reserve early
.replace(/[🔴🟡🟢🔵]\s*(?:Book|Reserve|BOOK|RESERVE)[^.]*\.?\s*/g, '')

// Code-style booking patterns: book_now, book_soon, reserve_early
.replace(/\b(?:book_now|book_soon|book_early|reserve_early|reserve_now)\b/gi, '')

// "Reservation urgency: high" or "Urgency: moderate" labels
.replace(/(?:^|\.\s*)\s*(?:Reservation\s*)?[Uu]rgency[:\s]+\w+\.?\s*/gi, '')
```

No new files, functions, or imports. Just 4 additional `.replace()` calls in the existing chain.

