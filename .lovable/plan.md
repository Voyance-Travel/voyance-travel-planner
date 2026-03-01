

# Fix: Ensure All Shareable Links Use Public URLs

## Findings

After auditing the entire codebase, almost everything is correct. The `getAppUrl()` utility already handles URL normalization for shareable links (invites, referrals, agency shares, quiz invites, archetype shares, intake links).

The `window.location.origin` usages for auth flows (OAuth redirects, password resets, email confirmations) are intentionally correct -- those must match the browser's actual origin.

**One issue found:**

`src/pages/GuideDetail.tsx` (line 189) uses `window.location.href` directly for the guide share URL. If someone shares a guide from the preview environment, it will generate a private/preview URL instead of the public one.

## Fix

| File | Change |
|------|--------|
| `src/pages/GuideDetail.tsx` | Import `getAppUrl` and replace `window.location.href` with `` `${getAppUrl()}/guides/${slug}` `` |

This is a one-line fix to ensure guide share links always point to the public site.

