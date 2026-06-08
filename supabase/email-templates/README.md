# Voyance — Auth Email Branding

The default Supabase auth emails look generic ("from Supabase", plain) and can land in spam.
Two fixes — do **both** for the best result.

---

## 1. Branded templates (fixes the "plain" look) — 5 min

Supabase → **Authentication → Email Templates**. For each template, paste the matching HTML
as the **Message body** and set a clear **Subject**:

| Template | File here | Suggested subject |
|---|---|---|
| **Confirm signup** | `confirm-signup.html` | `Confirm your Voyance account` |
| **Reset Password** | `reset-password.html` | `Reset your Voyance password` |
| Magic Link | *(reuse confirm-signup.html, change copy)* | `Your Voyance sign-in link` |
| Invite user | *(reuse confirm-signup.html, change copy)* | `You're invited to Voyance` |
| Change Email | *(reuse confirm-signup.html, change copy)* | `Confirm your new email` |

These use Supabase's `{{ .ConfirmationURL }}` variable, so the links work unchanged.
(Brand: serif "VOYANCE" wordmark, `#1f3d35` deep-green button, cream `#f6f4ef` background.)

---

## 2. Custom SMTP (fixes "from Supabase" + spam) — the important one

By default Supabase sends from its **shared** SMTP (`noreply@mail.app.supabase.io`) — a shared IP,
not your domain → generic sender + poor deliverability. Send from **your own domain** instead:

Supabase → **Authentication → SMTP Settings** → enable custom SMTP and fill in a provider:

**Recommended providers** (free tiers, great deliverability):
- **Resend** — `smtp.resend.com`, port 465, user `resend`, pass = your Resend API key
- **Postmark** — `smtp.postmarkapp.com`, port 587
- **Zoho** (you already have a Zoho secret) — `smtp.zoho.com`, port 465, your Zoho mailbox + app password

Set:
- **Sender email**: `noreply@travelwithvoyance.com`
- **Sender name**: `Voyance`

### ⚠️ Critical for not-spam: authenticate the domain
In your DNS (where `travelwithvoyance.com` lives), add the provider's:
- **SPF** record (TXT)
- **DKIM** records (CNAME/TXT the provider gives you)
- **DMARC** (TXT) — `v=DMARC1; p=none; rua=mailto:dmarc@travelwithvoyance.com`

Without SPF/DKIM on your domain, even a custom sender lands in spam. The provider's dashboard
walks you through these records and verifies them.

---

## Result
After both: emails arrive **from "Voyance <noreply@travelwithvoyance.com>"**, branded, and in the inbox
(not spam). The agent can re-test the signup flow afterward to confirm the new sender + template render.
