

# Replace SendGrid with Zoho SMTP for All Emails

## Overview
Migrate all transactional email sending from SendGrid's API to Zoho's SMTP server. This involves creating a shared SMTP utility and updating all 5 email-sending edge functions to use Zoho instead of SendGrid.

---

## Current State

| Function | Current Sender | Status |
|----------|----------------|--------|
| `send-contact-email` | `noreply@travelwithvoyance.com` via SendGrid | Sending |
| `send-trip-reminders` | `no-reply@voyancetravel.com` via SendGrid | Sending |
| `test-email` | `no-reply@voyancetravel.com` via SendGrid | Sending |
| `post-trip-email` | Console log only | Not sending |
| `post-trip-cron` | Calls `post-trip-email` | Not sending |

---

## What Changes

### 1. Store Zoho SMTP Credentials as Secrets
Two new secrets will be added to your backend:

| Secret Name | Value |
|-------------|-------|
| `ZOHO_SMTP_USER` | `contact@travelwithvoyance.com` |
| `ZOHO_SMTP_PASSWORD` | Your app password (you'll enter this securely) |

### 2. Create Shared SMTP Utility
A new reusable module for sending emails via Zoho SMTP.

**File:** `supabase/functions/_shared/zoho-smtp.ts`

This utility will:
- Connect to `smtp.zoho.com:587` with TLS
- Authenticate using your credentials
- Send HTML + plain text emails
- Handle errors gracefully
- Use a consistent sender: `contact@travelwithvoyance.com`

### 3. Update All Email Functions

| Function | Changes |
|----------|---------|
| `send-contact-email` | Replace SendGrid API call with Zoho SMTP |
| `send-trip-reminders` | Replace SendGrid API call with Zoho SMTP |
| `test-email` | Replace SendGrid API call with Zoho SMTP |
| `post-trip-email` | Enable actual email sending (currently just logs) |

### 4. Standardize Sender Address
All emails will now come from:
- **From:** `Voyance <contact@travelwithvoyance.com>`
- **Reply-To:** Set per email type (user's email for contact forms, no-reply for automated)

---

## Technical Implementation

### Shared SMTP Module

```text
supabase/functions/_shared/zoho-smtp.ts
┌─────────────────────────────────────────────────────────────────┐
│ sendEmail({                                                     │
│   to: string,                                                   │
│   subject: string,                                              │
│   html: string,                                                 │
│   text?: string,                                                │
│   replyTo?: string,                                             │
│   fromName?: string                                             │
│ }): Promise<{ success: boolean, error?: string }>               │
├─────────────────────────────────────────────────────────────────┤
│ Uses Deno's built-in SMTP support via:                          │
│   - npm:nodemailer (most reliable for SMTP in Deno)             │
│   - SMTP Host: smtp.zoho.com                                    │
│   - Port: 587 with STARTTLS                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Function Updates

Each function will change from:
```typescript
// OLD: SendGrid API
const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
  method: "POST",
  headers: { "Authorization": `Bearer ${SENDGRID_API_KEY}`, ... },
  body: JSON.stringify({ personalizations: [...], from: {...}, ... }),
});
```

To:
```typescript
// NEW: Zoho SMTP
import { sendEmail } from "../_shared/zoho-smtp.ts";

const result = await sendEmail({
  to: recipientEmail,
  subject: "Your subject",
  html: emailHtmlContent,
  text: plainTextVersion,
  replyTo: "user@example.com", // optional
});
```

---

## Files Summary

| File | Action |
|------|--------|
| `supabase/functions/_shared/zoho-smtp.ts` | **Create** - Shared SMTP utility |
| `supabase/functions/send-contact-email/index.ts` | **Modify** - Use Zoho SMTP |
| `supabase/functions/send-trip-reminders/index.ts` | **Modify** - Use Zoho SMTP |
| `supabase/functions/test-email/index.ts` | **Modify** - Use Zoho SMTP |
| `supabase/functions/post-trip-email/index.ts` | **Modify** - Enable actual sending via Zoho |

---

## Secrets Required

I'll prompt you to add these two secrets:

1. **ZOHO_SMTP_USER** - Your Zoho email username
2. **ZOHO_SMTP_PASSWORD** - Your Zoho app password

---

## Benefits of This Migration

| Benefit | Details |
|---------|---------|
| Single email provider | No confusion between SendGrid and Zoho |
| Consistent sender | All emails from `contact@travelwithvoyance.com` |
| Domain ownership | You control the sending domain |
| No separate API costs | Zoho SMTP included with your mail plan |
| Reply handling | Replies go directly to your Zoho inbox |

---

## Post-Migration Cleanup

After confirming Zoho works:
- The `SENDGRID_API_KEY` secret can be removed
- No code will reference SendGrid anymore

