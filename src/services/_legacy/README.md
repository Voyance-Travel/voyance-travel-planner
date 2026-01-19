# Legacy Services (Archived)

> **⚠️ DEPRECATED - DO NOT USE**
> 
> These files are archived for historical reference only.
> They contain references to the old Railway backend which has been decommissioned.

## Migration Status

These services were part of the Railway backend architecture. As of January 2025, 
all functionality has been migrated to Lovable Cloud (Supabase Edge Functions) or 
the features are no longer part of the MVP.

## Archived Services

| Service | Original Purpose | Current Status |
|---------|------------------|----------------|
| `mealPlanningAPI.ts` | AI-powered meal planning | Future feature (post-MVP) |
| `mealPlansAPI.ts` | Meal plan CRUD operations | Future feature (post-MVP) |
| `destinationsCanonicalAPI.ts` | Paginated destinations | Replaced by `supabase/destinations.ts` |
| `bdqAPI.ts` | Background Discovery Queue | Admin feature (post-MVP) |
| `emotionalTaggingAPI.ts` | Emotional event protection | Future feature (post-MVP) |
| `timelineBlocksAPI.ts` | Timeline block management | Merged into trip_activities |
| `budgetAPI.ts` | Trip budget tracking | Future feature (post-MVP) |
| `previewAPI.ts` | Itinerary teaser generation | Replaced by `generate-itinerary` edge function |
| `dreamBuilderAPI.ts` | Dream trip submissions | Future feature (post-MVP) |
| `itineraryPreviewAPI.ts` | Itinerary previews | Replaced by `generate-itinerary` edge function |
| `destinationScoringAPI.ts` | Destination scoring | Client-side scoring now |
| `emotionalTagsAPI.ts` | Trip emotional tags | Future feature (post-MVP) |
| `connectionRiskAPI.ts` | Flight connection risk | Future feature (post-MVP) |
| `activityAlternativesAPI.ts` | Activity swap suggestions | Future feature (post-MVP) |
| `tripsEnhancedAPI.ts` | Enhanced trip operations | Merged into Supabase trips service |
| `contentAPI.ts` | Static content endpoints | Frontend assets now |
| `quizSectionsAPI.ts` | Quiz section management | Frontend-driven quiz |
| `quizExtendedAPI.ts` | Quiz diagnostics | Dev tool only |

## Active Services (Still in Use)

These services are still actively used and should NOT be archived:

- `flightAPI.ts` - Amadeus flight search (uses edge functions)
- `hotelAPI.ts` - Amadeus hotel search (uses edge functions)
- `tripPaymentsAPI.ts` - Stripe payment verification
- `tripNotificationsAPI.ts` - Push notifications
- `authAuditAPI.ts` - Security audit logging
- `profileAPI.ts` - User profiles
- `quizAPI.ts` - Quiz flow (partial Railway, transitioning)

## Restoration

If these features are needed in the future, the types and interfaces 
in these files can serve as reference for implementing Supabase Edge Functions.

---

*Archived: January 19, 2026*
