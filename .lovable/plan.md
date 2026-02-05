
# Code Quality & Bug Fix Plan

## Summary of Issues Found

After a thorough code review, I've identified **6 major categories** of issues that are causing QA breaks and instability:

---

## 1. Unhandled Async Errors (HIGH PRIORITY)

**Problem**: Many async handlers lack proper try/catch blocks, causing unhandled promise rejections that crash the app.

**Evidence**: Found 205+ catch blocks, but many are incomplete or missing error handling in critical paths.

**Fix**:
- Add global unhandled rejection handler in `App.tsx`
- Audit all async handlers in pages (22 files have catch blocks, many more are missing them)

```text
┌─────────────────────────────────────────────────────────┐
│  App.tsx                                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  useEffect(() => {                               │  │
│  │    const handler = (e: PromiseRejectionEvent) => │  │
│  │      console.error(e.reason);                    │  │
│  │      toast.error("An error occurred");           │  │
│  │      e.preventDefault(); // Prevent crash        │  │
│  │    };                                            │  │
│  │    window.addEventListener("unhandledrejection", │  │
│  │                            handler);             │  │
│  │    return () => window.removeEventListener(...); │  │
│  │  }, []);                                         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Type Safety Issues (HIGH PRIORITY)

**Problem**: 525+ instances of `as any`, `@ts-ignore`, and unsafe type casts that hide runtime errors.

**Key Files Affected**:
- `src/pages/TripDetail.tsx` - 15+ unsafe casts
- `src/services/bookingStateMachine.ts` - 6+ unsafe casts
- `src/components/agent/ProfitDashboard.tsx` - 4+ unsafe casts
- `src/contexts/AuthContext.tsx` - 2+ unsafe casts

**Fix**:
- Replace `as any` with proper type guards
- Add null checks before property access
- Use optional chaining consistently

---

## 3. Null/Undefined Access Patterns (MEDIUM PRIORITY)

**Problem**: 509+ patterns of potential null/undefined access that can cause "Cannot read properties of undefined" errors.

**Common Patterns**:
```typescript
// DANGEROUS - crashes if trip is null
const cleanDestination = trip?.destination
  ?.replace(/\s*\(.*?\)\s*/g, '')
  .trim() || 'your destination';

// SAFER
const cleanDestination = trip?.destination 
  ? trip.destination.replace(/\s*\(.*?\)\s*/g, '').trim() 
  : 'your destination';
```

**Files Most Affected**:
- `src/pages/TripDetail.tsx` - Complex nested object access
- `src/pages/ActiveTrip.tsx` - Itinerary data parsing
- `src/pages/DestinationDetail.tsx` - Dynamic field access

---

## 4. Database Deletion Cascade Issues (FIXED)

**Status**: Already addressed in previous messages by updating edge functions to manually cascade deletions.

---

## 5. Edge Function Import Stability (FIXED)

**Status**: Already migrated all 56 edge functions from `esm.sh` to stable `npm:` specifiers.

---

## 6. RLS Policy Warnings (LOW PRIORITY)

**Problem**: 3 overly permissive RLS policies detected that use `USING (true)` for write operations.

**Risk**: Security vulnerability if not intentional for public tables.

**Fix**: Review and tighten RLS policies on affected tables.

---

## Proposed Fix Order

| Priority | Category | Estimated Files | Impact |
|----------|----------|-----------------|--------|
| 1 | Global error handler | 1 file (App.tsx) | Prevents all white-screen crashes |
| 2 | Critical type guards | 5-10 key files | Prevents runtime type errors |
| 3 | Null safety audit | 10-15 pages | Prevents "undefined" crashes |
| 4 | RLS policy review | Database migration | Security hardening |

---

## Technical Implementation

### Phase 1: Global Error Recovery (App.tsx)
Add unhandled promise rejection handler and improve ErrorBoundary integration.

### Phase 2: Type Safety Fixes
Priority files to fix:
1. `TripDetail.tsx` - Core trip viewing page
2. `ActiveTrip.tsx` - Live trip tracking
3. `AuthContext.tsx` - Authentication flow
4. `bookingStateMachine.ts` - Booking state transitions

### Phase 3: Defensive Null Checks
Add explicit null guards in:
- Itinerary data parsing
- Hotel/flight selection handling
- User preferences access

---

## Notes for Implementation

- All async event handlers need `try/catch` with user-friendly error messages
- Replace `(data as any)` with proper TypeScript interfaces
- Use `data?.field ?? fallback` pattern consistently
- Add input validation before API calls
