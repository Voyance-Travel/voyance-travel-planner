## DC.4 — Delete `src/services/hotelBookingAPI.ts`

### Pre-check

- File exists: `src/services/hotelBookingAPI.ts` (465 lines, 12.5 KB)
- Importers across `src/`: **0** (`grep -rn "hotelBookingAPI" src` returns nothing)

The file is fully orphaned — its booking surface was already dead after DC.3 stripped the `hotels` edge function's `book` action. No call sites need rewiring.

### Action

1. Delete `src/services/hotelBookingAPI.ts`.

### Verification

```bash
ls src/services/hotelBookingAPI.ts 2>/dev/null    # fails
grep -rn "from.*hotelBookingAPI" src --include="*.ts" --include="*.tsx"   # 0
grep -rn "hotelBookingAPI" src --include="*.ts" --include="*.tsx"          # 0
```

No build/UI changes required.