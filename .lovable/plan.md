## RS.M7 — PDF currency rendering

Replace the currency-blind `${act.cost.currency || '$'}${amount}` line in `consumerPdfGenerator.ts` with a proper currency→symbol mapping that falls back through the activity's currency → trip currency → `USD`, never the bare `$`.

### Changes

**1. `src/utils/consumerPdfGenerator.ts`**

- **Interface** (`ConsumerTripPdfData`, ~line 12): add optional `tripCurrency?: string;`.
- **Line 390**: replace the single-line cost push with the spec'd block:
  ```ts
  if (act.cost?.amount && act.cost.amount > 0) {
    const currency = (act.cost.currency || tripCurrency || 'USD').toUpperCase();
    const symbol = (() => {
      switch (currency) {
        case 'USD': case 'CAD': case 'AUD': return '$';
        case 'EUR': return '€';
        case 'GBP': return '£';
        case 'JPY': return '¥';
        case 'CHF': return 'CHF ';
        default: return `${currency} `;
      }
    })();
    metaParts.push(`${symbol}${act.cost.amount}`);
  }
  ```
- Destructure `tripCurrency` from `data` near the top of `generateConsumerTripPdf` so it's in scope at the activity loop.

**2. `src/components/itinerary/EditorialItinerary.tsx`** (~line 5974)

- Pass `tripCurrency` (already a local in this file, line 3747+) into the `generateConsumerTripPdf({...})` call.

**3. `src/components/planner/summary/EditorialTripSummary.tsx`** (~line 149)

- Pass `tripCurrency: data.currency` (or whichever field this component already exposes — confirm by reading the call site context) into the `generateConsumerTripPdf({...})` call. If no trip-level currency exists on `data`, omit; the function gracefully falls back to `USD`.

### Verification

- `grep -c "symbol = (() =>" src/utils/consumerPdfGenerator.ts` ≥ 1.
- Manual: a EUR trip exports a PDF showing `€120` (not `$120` or `EUR120`); a USD trip still shows `$`; a CHF trip shows `CHF 80`.
- $0 cost rows no longer render a stray `$0` in the meta line.

### Out of scope

- Locale-aware number formatting (thousands separators, decimals) — the spec keeps the raw `amount`.
- Converting amounts between currencies for display — caller-side concern, already handled in `EditorialItinerary`.
