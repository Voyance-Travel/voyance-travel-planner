

## Fix: Credit Ledger Shows "0" For All Charges

### Problem
`formatCredits()` returns `'0'` for negative values. The ledger display passes raw `credits_delta` (e.g., -150) to it, so all debits show "0".

### Changes

#### 1. Fix debit display (line 277)
**File:** `src/pages/CreditsAndBilling.tsx`

Change:
```
{isFree ? 'Free' : `${isCredit ? '+' : ''}${formatCredits(entry.credits_delta)}`}
```
To:
```
{isFree ? 'Free' : `${isCredit ? '+' : '-'}${formatCredits(Math.abs(entry.credits_delta))}`}
```

#### 2. Add missing ACTION_LABELS (lines 36, 49)
**File:** `src/pages/CreditsAndBilling.tsx`

After `group_unlock: 'Bulk Day Unlock'`, add:
```
group_unlock_purchase: 'Group Unlock',
```

Before `admin_manual_grant: 'Credit Grant'`, add:
```
refund: 'Refund',
add_activity: 'Add Activity',
route_optimization: 'Route Optimization',
regenerate_trip: 'Trip Regeneration',
```

