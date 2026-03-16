

## Fix Soft 404 on /legal/privacy and /legal/terms

### Problem
Google Search Console is crawling `https://travelwithvoyance.com/legal/privacy` — but no route exists for `/legal/privacy`. The app only has `/privacy` and `/terms`. This results in a soft 404 (React SPA returns 200 but renders nothing useful at that path).

### Changes

**1. Add `/legal/privacy` and `/legal/terms` redirect routes (App.tsx)**
Add `<Route path="/legal/privacy" element={<Navigate to="/privacy" replace />} />` and same for terms. This ensures anyone (or Google) hitting `/legal/*` gets redirected to the canonical URL.

**2. Update sitemap.xml**
Add `/legal/privacy` and `/legal/terms` entries pointing to the canonical URLs, or better — since we're redirecting, just ensure `/privacy` and `/terms` remain in the sitemap (they already are). No change needed here.

**3. Hardcode the "Last Updated" date (Privacy.tsx, Terms.tsx)**
Both pages currently use `new Date()` which changes on every render. Replace with a static string like `"March 16, 2026"` so the content is stable for crawlers.

**4. Update meta tags (Privacy.tsx, Terms.tsx)**
- Privacy: description → `"Voyance privacy policy. Learn how we protect your data and handle your personal information."`
- Terms: description → `"Voyance terms of service. Read our usage guidelines and service agreements."`

**5. Confirm no auth gating**
Both pages use `MainLayout` (not `ProtectedRoute`) — they are already fully public. No change needed.

### Files to change

| File | Change |
|------|--------|
| `src/App.tsx` | Add two redirect routes for `/legal/privacy` and `/legal/terms` |
| `src/pages/Privacy.tsx` | Hardcode `lastUpdated` date string; update meta description |
| `src/pages/Terms.tsx` | Hardcode `lastUpdated` date string; update meta description |
| `src/config/routes.ts` | Add `LEGAL_PRIVACY: '/legal/privacy'` and `LEGAL_TERMS: '/legal/terms'` aliases (optional, for completeness) |

