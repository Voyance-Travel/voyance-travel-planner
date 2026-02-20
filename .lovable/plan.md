

# Validation and Zod Audit

## Current State

**Already using Zod + react-hook-form (6 forms):**
- ProfileEditForm -- name, email, handle, homeAirport
- Contact page -- name, email, subject, message
- ForgotPasswordForm -- email
- ResetPassword -- password, confirmPassword
- ClientIntakeForm (agent) -- traveler intake fields
- TravelerInfoModal (booking) -- traveler passport/details

**Using manual/ad-hoc validation (no Zod):**
Everything else below.

---

## Forms That Need Zod Validation

### 1. SignUpForm (`src/components/auth/SignUpForm.tsx`)
- **Current**: Manual if-checks for empty fields and password length
- **Missing**: No email format validation, no inline field-level errors (just a single error banner)
- **Fix**: Add Zod schema for firstName, lastName, email, password with react-hook-form. Show per-field error messages instead of a single banner.

### 2. SignInForm (`src/components/auth/SignInForm.tsx`)
- **Current**: Manual checks for empty email/password
- **Missing**: No email format validation
- **Fix**: Add Zod schema for email (`.email()`) and password (`.min(1)`). Show inline errors.

### 3. ManualBookingModal (`src/components/planner/ManualBookingModal.tsx`)
- **Current**: Only checks if `flightData.airline` or `hotelData.name` is truthy -- submits empty/partial data silently
- **Missing**: No validation on airport codes, dates, times, or required fields
- **Fix**: Add Zod schemas for flight data (airline required, airport codes 3-letter, dates required) and hotel data (name required). Show toast or inline errors on submit.

### 4. QuoteModal (`src/components/agent/QuoteModal.tsx`)
- **Current**: Uses react-hook-form but NO Zod resolver -- no validation at all
- **Missing**: Quote name, line item descriptions, prices could all be empty
- **Fix**: Add Zod schema requiring quote name, at least one line item with description and positive price. Wire up zodResolver.

### 5. InvoiceBuilderModal (`src/components/agent/InvoiceBuilderModal.tsx`)
- **Current**: No form library, pure useState -- no validation
- **Missing**: Can create invoice with zero line items, no due date validation
- **Fix**: Add validation that at least one line item exists with a positive amount before submission. Toast error if not met.

### 6. QuickConfirmationCapture (`src/components/agent/QuickConfirmationCapture.tsx`)
- **Current**: Only checks `!formData.vendor_name` via disabled button
- **Missing**: No feedback if user clicks submit somehow, cost fields accept any string
- **Fix**: Add toast validation for vendor_name on submit. Validate cost fields are valid numbers.

### 7. Trip Planner final submit (`src/pages/Start.tsx` -- the "Plan my trip" button)
- **Current**: The "Continue" button now has validation (just fixed), but the final "Plan my trip" `onSubmit` may also need checks
- **Likely OK**: Depends on whether the multi-step flow guarantees earlier validation. Worth verifying.

### 8. ReviewCapturePopup (`src/components/reviews/ReviewCapturePopup.tsx`)
- **Current**: Checks `rating === 0` with toast -- adequate for its simplicity
- **Status**: OK as-is (only required field is rating, button is disabled)

### 9. DaySummaryPrompt (`src/components/feedback/DaySummaryPrompt.tsx`)
- **Current**: No validation at all -- submits with all optional fields
- **Status**: OK as-is (all fields are genuinely optional)

---

## Recommended Priority Order

| Priority | Form | Reason |
|----------|------|--------|
| High | SignUpForm | User-facing auth, no email validation |
| High | SignInForm | User-facing auth, no email format check |
| High | ManualBookingModal | Accepts garbage data silently |
| Medium | QuoteModal | Has react-hook-form but no schema |
| Medium | InvoiceBuilderModal | Can create empty invoices |
| Medium | QuickConfirmationCapture | Cost fields unvalidated |
| Low | Start.tsx final submit | Likely guarded by step flow |

---

## Technical Approach

For each form that gets Zod:

1. Define a `z.object({...})` schema at the top of the file
2. Wire it into `useForm` with `resolver: zodResolver(schema)`
3. Replace manual `useState` fields with `register()` where possible
4. Display `errors.fieldName?.message` inline below each input
5. Remove manual if-check validation in `handleSubmit`

For simpler forms (InvoiceBuilder, QuickConfirmationCapture) where full react-hook-form refactoring is heavy, add targeted `toast.error()` checks in the submit handler instead -- matching the pattern already established for expenses and activities.
