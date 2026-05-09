## Fix 2.2 — Clear invite token on logout

### Status: Already shipped

`src/contexts/AuthContext.tsx` logout already calls `clearPendingInviteToken()` after the `legacyKeys.forEach` block (lines 582–583), via a dynamic `await import('@/utils/inviteTokenPersistence')`. Functionally identical to the spec's static import — both clear sessionStorage + localStorage on signout.

Verification: `grep -c "clearPendingInviteToken" src/contexts/AuthContext.tsx` → **2 hits** (the import + the call), matching the spec's expected output.

### Optional polish (not required)

The current dynamic import works but adds a tiny async hop. If you want to match the spec exactly and shave a microtask, promote it to a top-of-file static import:

```ts
import { clearPendingInviteToken } from '@/utils/inviteTokenPersistence';
```

…and replace lines 582–583 with a direct `clearPendingInviteToken();` call.

This is cosmetic — no behavioral change, no security delta. Recommend skipping unless you're cleaning up.

### Action

Close Fix 2.2 as already-implemented. Proceed to next ticket.