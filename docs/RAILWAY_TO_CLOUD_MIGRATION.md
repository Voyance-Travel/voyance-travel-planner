# Railway → Lovable Cloud Migration Plan

> ## ✅ MIGRATION COMPLETE (January 2025)
> 
> **This document is now HISTORICAL REFERENCE ONLY.**
> 
> The migration from Railway backend to Lovable Cloud has been completed.
> All active services now use Supabase Edge Functions or direct database queries.
> 
> **Current state:**
> - 29 Edge Functions deployed
> - All core APIs migrated (flights, hotels, itinerary, payments)
> - Railway backend decommissioned
> - 18 legacy service files archived to `src/services/_legacy/`
> 
> For current architecture, see: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md)

---

## Migration Summary

### ✅ Successfully Migrated Services

| Service | Old Location | New Location | Status |
|---------|-------------|--------------|--------|
| Flights API | Railway `/api/v1/flights/*` | `supabase/functions/flights/` | ✅ Live |
| Hotels API | Railway `/api/v1/hotels/*` | `supabase/functions/hotels/` | ✅ Live |
| Itinerary Generation | Railway `/api/v1/itinerary/*` | `supabase/functions/generate-itinerary/` | ✅ Live |
| Stripe Payments | Railway `/stripe/*` | `supabase/functions/create-checkout/` | ✅ Live |
| Weather API | Railway `/api/weather/*` | `supabase/functions/weather/` | ✅ Live |
| Destination Images | Railway `/api/v1/images/*` | `supabase/functions/destination-images/` | ✅ Live |
| Contact Form | Railway `/api/contact` | `supabase/functions/send-contact-email/` | ✅ Live |

### 📦 Archived Legacy Services

These services have been moved to `src/services/_legacy/` for reference:

- `mealPlanningAPI.ts` - Future feature (meal recommendations)
- `mealPlansAPI.ts` - Future feature (meal plan CRUD)
- `destinationsCanonicalAPI.ts` - Replaced by `supabase/destinations.ts`
- `bdqAPI.ts` - Admin feature (Background Discovery Queue)
- `emotionalTaggingAPI.ts` - Future feature
- `timelineBlocksAPI.ts` - Merged into trip_activities
- `budgetAPI.ts` - Future feature (budget tracking)
- `previewAPI.ts` - Replaced by generate-itinerary
- `dreamBuilderAPI.ts` - Future feature
- `itineraryPreviewAPI.ts` - Replaced by generate-itinerary
- `destinationScoringAPI.ts` - Client-side scoring now
- `emotionalTagsAPI.ts` - Future feature
- `connectionRiskAPI.ts` - Future feature
- `activityAlternativesAPI.ts` - Future feature
- `tripsEnhancedAPI.ts` - Merged into Supabase trips
- `contentAPI.ts` - Frontend assets now
- `quizSectionsAPI.ts` - Frontend-driven quiz
- `quizExtendedAPI.ts` - Dev tool only

### ⚡ Active Services (Not Migrated - Already Cloud-Native)

These services use Edge Functions or direct Supabase queries and were never on Railway:

- `flightAPI.ts` - Uses `supabase/functions/flights/`
- `hotelAPI.ts` - Uses `supabase/functions/hotels/`
- `tripPaymentsAPI.ts` - Uses `supabase/functions/verify-booking-payment/`
- `tripNotificationsAPI.ts` - Uses `supabase/functions/trip-notifications/`
- `authAuditAPI.ts` - Direct Supabase audit_logs table
- `profileAPI.ts` - Direct Supabase profiles table
- All `src/services/supabase/*` - Direct database queries

---

## Secrets Configuration

All required secrets are configured in Lovable Cloud:

| Secret | Purpose | Status |
|--------|---------|--------|
| AMADEUS_API_KEY | Flight/Hotel search | ✅ Configured |
| AMADEUS_API_SECRET | Flight/Hotel search | ✅ Configured |
| GOOGLE_MAPS_API_KEY | Maps & Geocoding | ✅ Configured |
| VIATOR_API_KEY | Activities/Tours | ✅ Configured |
| STRIPE_SECRET_KEY | Payments | ✅ Configured |
| RESEND_API_KEY | Email sending | ✅ Configured |
| LOVABLE_API_KEY | AI features | ✅ Auto-configured |

---

## Cleanup Completed

- [x] Migrated all core API endpoints to Edge Functions
- [x] Updated frontend services to use `supabase.functions.invoke()`
- [x] Removed `VITE_BACKEND_URL` dependency
- [x] Archived 18 unused Railway service files
- [x] Updated all SOT documentation
- [x] Railway subscription cancelled

---

*Document created: January 18, 2026*  
*Migration completed: January 19, 2026*  
*Status: ✅ COMPLETE*
