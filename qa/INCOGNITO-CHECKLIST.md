# Voyance — Incognito Live-Test Checklist (owner-only steps)

Run this **in a fresh incognito window** on `https://voyance-travel-planner.vercel.app`.
These are the steps the agent can't do (creating accounts, entering passwords, OAuth consent, logout).
Everything here has already passed a **code audit** — this pass just confirms it works live.
For each step: ✅ works / ❌ + paste what you saw.

> Use a throwaway email you control (e.g. a `+test` alias like `ashtonlaurenn+qa1@gmail.com`).

---

## A. Auth flows (Table E)

1. **Marketing home + CTAs** — open `/` (logged out). Confirm it renders the marketing page (NOT a redirect).
   - [ ] Hero CTA, "Get Started Free", "Start Planning", "Take the Quiz" all visible
   - [ ] Sample-itinerary widget shows + its "see sample" / "explore" links work
   - [ ] Social-proof testimonials render
   - [ ] **Images look on-brand (not random stock / broken)** ← you flagged this; note any weird ones

2. **Sign up (email)** — `/signup`. Create the throwaway account.
   - [ ] Form submits, no error
   - [ ] **Signup page image looks intentional** (currently Pexels stock — note if weird)
   - [ ] A **verification email arrives**

3. **Email verification** — click the link in that email.
   - [ ] Lands you logged in (via `/auth/callback`) — no stranded spinner

4. **Quiz-gating** — as the brand-new account, try to reach a build/itinerary feature before doing the quiz.
   - [ ] You're redirected/nudged to the quiz (not allowed straight through)

5. **Logout** — profile menu → Logout.
   - [ ] Returns you to a public page, session cleared

6. **Sign in** — `/signin` with the same email/password.
   - [ ] Logs in cleanly
   - [ ] **Signin page image looks intentional** (currently a generic Unsplash "mountain lake" — note if weird)

7. **OAuth** — `/signin` → "Continue with Google" and "Continue with Apple".
   - [ ] Each completes consent → returns you logged in
   - [ ] ⚠️ If it errors: the **Google/Apple provider keys** likely aren't set in Supabase → Auth → Providers. Set them.

8. **Password reset** — logout → `/forgot-password` → enter the email.
   - [ ] Reset email arrives → click it → `/reset-password` → set a new password → confirm you can sign in with it

9. **Deep-link return-path** — while logged out, paste a deep link e.g. `/trip/<any-id>` or `/profile`.
   - [ ] Bounces to signin, and **after login returns you to that deep link** (not just /profile)

10. **Session persistence** — after logging in, hard-refresh a few times.
    - [ ] Stays logged in (agent already confirmed this ✅)

---

## B. User-type matrix (Table E) — same incognito session

11. **Anonymous/guest** — logged out: browse Explore / sample itineraries.
    - [ ] Can browse, but **generating a trip is blocked / prompts signup**

12. **Free user** — the new account (no purchase). Build a trip.
    - [ ] First trip is **free** (2 days included per the copy); further days/unlocks prompt credits
    - [ ] Free-tier limits enforced (can't unlock everything without credits)

13. **Paid user** — (optional, real money) buy the smallest credit pack via Stripe.
    - [ ] Purchase completes → credits land → build + unlock works
    - [ ] ⚠️ Real Stripe charge — only if you want to test the money path end-to-end

14. **Admin** — already verified (your main account reaches `/admin/dashboard`). Confirm the **new** account does NOT.
    - [ ] Throwaway account hitting `/admin/dashboard` → redirected to /profile (no admin access)

---

## C. Image consistency (you flagged this — please note specifics)
- [ ] Marketing home images — on-brand or random/broken?
- [ ] Signin image (Unsplash mountain-lake) — keep or replace?
- [ ] Signup image (Pexels) — keep or replace? (it's a different source than signin)
- [ ] Trip-card thumbnails on /profile — real city photos, or random/generic?
  - *(Seville now shows a generic fallback instead of broken — the agent recommends switching cards to the live `destination-images` edge fn so they show real city photos like the hero already does. Say the word to implement.)*

---

### How to report back
Paste the **❌ items** with a one-line note (and a screenshot if it's visual). The agent will fix each on the spot.
