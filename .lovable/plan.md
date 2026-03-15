

# Fix: Home Airport Not Saving / Not Recognizing Codes

## Problems Found

1. **Default value not passed**: `ProfileEdit.tsx` passes `name` and `email` to the form but **never passes `homeAirport`** — so the field always starts empty, and the form thinks nothing changed (`isDirty` stays false if you type the same value).

2. **Read/write mismatch**: The `homeAirport` is **read** from `user_preferences.home_airport` (via AuthContext) but **saved** to `profiles.home_airport`. The next page load reads from preferences again, so the saved value never appears.

3. **Case-sensitive validation**: The regex `^[A-Z]{3}$` requires uppercase, but users can type lowercase "atl". The CSS class `uppercase` only visually uppercases the text — the actual form value stays lowercase, failing validation silently.

4. **Plain text input instead of autocomplete**: The existing `AirportAutocomplete` component queries the airports table and would both validate codes exist AND provide a better UX. It's not used here.

## Fix Plan

### 1. Pass `homeAirport` default value (`ProfileEdit.tsx`)
- Read `user?.homeAirport` and pass it to `ProfileEditForm` defaultValues.

### 2. Fix read/write consistency (`ProfileEdit.tsx`)
- Save to `profiles.home_airport` (already done) AND sync to `user_preferences.home_airport` so the AuthContext reads the updated value on next load. Alternatively, change AuthContext to read from `profiles.home_airport` instead of preferences.
- Simplest: update AuthContext's `mapUser` to read `home_airport` from the profile query instead of preferences.

### 3. Fix validation — auto-uppercase before regex (`ProfileEditForm.tsx`)
- Add `.transform(val => val.toUpperCase())` before the regex, or change regex to case-insensitive `/^[A-Za-z]{3}$/` and uppercase on submit.

### 4. Replace plain input with `AirportAutocomplete` (`ProfileEditForm.tsx`)
- Swap the text input for the existing `AirportAutocomplete` component, which searches the airports DB and returns valid codes. This ensures only real airport codes are accepted.

| File | Change |
|------|--------|
| `src/pages/ProfileEdit.tsx` | Pass `homeAirport: user?.homeAirport` to form defaults |
| `src/components/profile/ProfileEditForm.tsx` | Use `AirportAutocomplete`, fix validation to accept lowercase input |
| `src/contexts/AuthContext.tsx` | Read `home_airport` from profiles instead of (or in addition to) preferences |

