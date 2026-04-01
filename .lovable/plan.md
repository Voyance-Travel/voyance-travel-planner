

## Enhance Share Modal for Group Sharing

### Problem
The "Send to a friend" section in the Trip Share Modal only accepts a single email at a time. Users wanting to invite a group have to send one email at a time. The invite link itself already supports multiple uses (up to `travelers × 3` or 10, whichever is higher), but the UI doesn't surface this well.

### Fix

**File: `src/components/sharing/TripShareModal.tsx`**

1. **Replace single email input with a multi-email chip input**:
   - Allow comma or Enter-separated emails
   - Show each added email as a dismissible chip/tag
   - Validate each email on entry; reject invalid ones with inline feedback
   - "Send" button opens a single `mailto:` with all emails in the `to:` field (comma-separated), or sends individually if preferred

2. **Update the label and UX**:
   - Change "Send to a friend" → "Invite friends"
   - Show a subtle note: "This link works for everyone — share it with your whole group"
   - Update the bottom note from "Friends can view your full itinerary without logging in" to include group context

3. **Multi-email flow**:
   - State: `friendEmails: string[]` instead of single `friendEmail: string`
   - Current text input becomes a chip input: type an email, press Enter/comma to add it as a chip
   - Each chip has an × to remove
   - Send button opens `mailto:` with all emails joined by commas
   - Clear all chips after sending
   - Cap at ~10 emails to prevent abuse

### Technical Detail

The `mailto:` approach already works with multiple recipients:
```typescript
// mailto supports comma-separated recipients
window.open(`mailto:${friendEmails.join(',')}?subject=${subject}&body=${body}`, '_blank');
```

The chip input is built inline (no new dependency) — a flex-wrap container with badge-style chips and an input that grows.

### Summary

| File | Change |
|---|---|
| `TripShareModal.tsx` | Multi-email chip input, group-friendly copy, "invite friends" label |

