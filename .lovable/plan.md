
# Fixes #11, #12, #13, #14: Credit UX and Constants

Four changes addressing credit display, copy consistency, signup constants, and edge function sync.

---

## Fix #13: Wire CREDIT_EXPIRATION_COPY to All UI Surfaces

Replace hardcoded expiration strings with the `CREDIT_EXPIRATION_COPY` constant from `src/config/pricing.ts`.

**Files to modify:**

1. **`src/components/profile/CreditBalanceCard.tsx`** (2 changes)
   - Line 156: `"Purchased credits never expire"` → `CREDIT_EXPIRATION_COPY.purchasedCreditsNotice`
   - Line 134: The free credits expiration line already uses `formatDistanceToNow` (dynamic) so it stays, but add a tooltip or keep as-is since it shows relative time

2. **`src/components/common/WelcomeCreditsModal.tsx`** (1 change)
   - Line 218: `"Welcome credits expire in 2 months • Launch bonus expires in 6 months"` → Use `CREDIT_EXPIRATION_COPY.freeCreditsNotice` (the "6 months" for launch bonus is a different policy -- we'll keep it inline but source the free part from the constant)

3. **`src/components/checkout/OutOfCreditsModal.tsx`** (1 change)
   - Line 222: `"You get 150 free credits every month. Purchased credits never expire."` → Use `CREDIT_EXPIRATION_COPY.purchasedCreditsNotice` for the second sentence

4. **`src/pages/Pricing.tsx`** (3 changes)
   - Line 116 FAQ: `"Free credits expire after 2 months"` → Use `CREDIT_EXPIRATION_COPY.freeCreditsNotice`
   - Line 293: `"Credits expire in 12 months"` — This is about Quick Top-Up, not free credits. Leave as-is (different policy).
   - Line 383: `"expire in 2 months"` → Use constant

**NOT changed:** `src/pages/admin/UnitEconomics.tsx` (admin-only internal comments, not user-facing). `EditorialItinerary.tsx` "6 months" reference (visa info, unrelated to credits).

Each modified file will import `CREDIT_EXPIRATION_COPY` from `@/config/pricing`.

---

## Fix #12: Fix Dashboard 0-Credits Race Condition

Add new-user detection and polling to prevent showing "0 credits" during onboarding.

**Files to modify:**

1. **`src/hooks/useCredits.ts`**
   - Add `isNewUserLoading` and `newUserTimedOut` fields to `CreditData`
   - Import `useAuth` (already imported) to access `user.createdAt`
   - Use a `useRef` for retry count and a `useEffect` to poll every 2s (max 10 retries)
   - Detection: `totalCredits === 0 AND purchases.length === 0 AND account age < 60s`
   - Augment the returned `data` with these two boolean flags

2. **`src/components/profile/CreditBalanceCard.tsx`**
   - After the error check, add a new-user loading state block
   - Shows `Skeleton` + "Setting up your account..." text
   - After timeout, shows balance with a note: "Your welcome credits are on the way!"

3. **`src/contexts/OutOfCreditsContext.tsx`**
   - Import `useCredits` in the provider
   - In `showOutOfCredits`, check `credits.data?.isNewUserLoading` and silently skip if true

---

## Fix #11: Centralize Signup Bonus Constants

**Files to modify:**

1. **`src/config/pricing.ts`**
   - Add after `MONTHLY_CREDIT_GRANT`:
   ```typescript
   export const SIGNUP_CREDITS = {
     welcomeBonus: 150,
     earlyAdopterBonus: 500,
     earlyAdopterEnabled: true,
     get totalSignupCredits() {
       return this.welcomeBonus + (this.earlyAdopterEnabled ? this.earlyAdopterBonus : 0);
     }
   } as const;
   ```

2. **`src/lib/voyanceFlowController.ts`**
   - Add `SIGNUP_CREDITS` to the re-exports from `@/config/pricing`

3. **`src/hooks/useBonusCredits.ts`**
   - Import `SIGNUP_CREDITS` from `@/config/pricing`
   - Update `BONUS_INFO.welcome.credits` to use `SIGNUP_CREDITS.welcomeBonus` (150)
   - Update `BONUS_INFO.launch.credits` to use `SIGNUP_CREDITS.earlyAdopterBonus` (500)
   - Add guard comment pointing to `pricing.ts`

---

## Fix #14: Edge Function Constant Sync Verification

**New file + guard comments:**

1. **Create `scripts/check-edge-constants.ts`**
   - Reads `src/config/pricing.ts` and `src/lib/tripCostCalculator.ts` using `fs.readFileSync`
   - Extracts key constants via regex: `BASE_RATE_PER_DAY`, `UNLOCK_DAY`, `SMART_FINISH`, `SWAP_ACTIVITY`, etc.
   - Reads `supabase/functions/get-entitlements/index.ts` and `supabase/functions/spend-credits/index.ts`
   - Extracts the same constants from those files
   - Compares values, reports mismatches
   - Exits with code 1 if any mismatch found

2. **`supabase/functions/get-entitlements/index.ts`** — Add guard comment at top:
   ```
   // SYNC CHECK: Run 'npx ts-node scripts/check-edge-constants.ts' after any
   // pricing or cost constant change. See src/config/pricing.ts for source of truth.
   ```

3. **`supabase/functions/spend-credits/index.ts`** — Same guard comment at top

---

## Technical Notes

- Fix #12 uses `useAuth().user.createdAt` which is already available as `supabase.auth.users.created_at`
- Fix #12 polling uses a `useEffect` + `setInterval` pattern with a ref counter, not react-query's `refetchInterval` (to avoid stale closure issues with the retry count)
- Fix #14 script is a Node.js script (not Deno), intended for CI/local dev use
- No database migrations needed
- No edge function logic changes
