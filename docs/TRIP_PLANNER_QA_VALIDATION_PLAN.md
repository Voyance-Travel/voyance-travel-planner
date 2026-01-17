# Trip Planner QA Validation Plan

**Last Updated**: 2025-01-13
**Last Validated**: 2025-10-12
**Status**: ✅ ACTIVE - Ready for QA Phase

> **✅ PRE-QA AUDIT COMPLETE** (Oct 12, 2025):
>
> - Code audit performed - all 9 endpoints match backend SOT
> - Country field flow validated
> - Budget tier mapping confirmed correct
> - No contract mismatches found in code review
> - **Ready to begin integration testing**

## 🚨 CRITICAL: IMPLEMENTATION STATUS

**IMPORTANT**: The trip planner has been implemented separately by frontend and backend teams based on shared source of truth documents. **NONE OF THIS HAS BEEN VALIDATED YET.**

## 📋 Current State

### What Has Been Built (But Not Tested):

#### Frontend Implementation:

1. **TripSetup Component**

   - Destination autocomplete with city, country, airport
   - Date selection with validation
   - Traveler count selection
   - Trip type selection (round_trip, one_way, multi_city)
   - Budget tier mapping (economy/standard/premium/luxury → safe/stretch/splurge)

2. **FlightSelectionUpdated Component**

   - Flight search using IATA codes
   - Price lock functionality (15-minute timers)
   - Lock status polling (30-second intervals)
   - Visual countdown timers
   - Expired lock handling

3. **HotelSelectionUpdated Component**

   - Hotel search using cityCode
   - Price lock functionality
   - Skip hotel option
   - Same lock pattern as flights

4. **BookingReviewEnhanced Component**

   - Lock validation before checkout
   - Shows all price lock timers
   - Prevents checkout if locks expired
   - Integrated with CheckoutButton

5. **API Services Created**
   - plannerFlightAPI.ts (search, hold, status)
   - plannerHotelAPI.ts (search, hold, status)
   - checkoutAPI.ts (session creation with idempotency)

#### Backend Expectations (Per SOT):

- Trip creation endpoint expecting specific field structure
- Price lock endpoints for flights and hotels
- Checkout session creation with Stripe
- Specific validation rules and field requirements

## 🔍 QA Validation Required

### Phase 1: API Contract Validation

**Goal**: Verify frontend/backend are speaking the same language

1. **Trip Creation Validation**

   - [ ] Verify request payload structure matches backend expectations
   - [ ] Confirm country field is properly included in destinations array
   - [ ] Validate budget tier mapping (safe/stretch/splurge)
   - [ ] Check required vs optional fields
   - [ ] Test validation error responses

2. **Destination Search Validation**

   - [ ] Verify search endpoint returns expected structure
   - [ ] Confirm displayName, iata, city, country fields
   - [ ] Test minimum character requirements (2-3 chars)
   - [ ] Validate airport-only vs full destination results

3. **Flight API Validation**

   - [ ] Test search endpoint with IATA codes
   - [ ] Verify price lock request/response structure
   - [ ] Confirm lockId and expiresAt format
   - [ ] Test lock status endpoint
   - [ ] Validate 15-minute expiration timing

4. **Hotel API Validation**

   - [ ] Test search with cityCode parameter
   - [ ] Verify optional hotel flow
   - [ ] Test price lock functionality
   - [ ] Confirm response structure matches frontend

5. **Checkout API Validation**
   - [ ] Test idempotency key handling
   - [ ] Verify Stripe session creation
   - [ ] Validate lock verification before checkout
   - [ ] Test success/cancel redirect URLs

### Phase 2: User Flow Testing

**Goal**: Ensure the complete flow works end-to-end

1. **Happy Path Testing**

   - [ ] Create trip with all required fields
   - [ ] Search and select flights
   - [ ] Lock flight prices
   - [ ] Search and select hotel
   - [ ] Lock hotel price
   - [ ] Review with active locks
   - [ ] Complete checkout
   - [ ] Handle Stripe redirect

2. **Edge Cases**

   - [ ] One-way trip (no return flight)
   - [ ] Skip hotel selection
   - [ ] Let price locks expire
   - [ ] Try checkout with expired locks
   - [ ] Network failures during polling
   - [ ] Page refresh during flow

3. **Error Scenarios**
   - [ ] Invalid trip data
   - [ ] No flight results
   - [ ] No hotel results
   - [ ] Failed price lock
   - [ ] Checkout session failure
   - [ ] Stripe payment failure

### Phase 3: Integration Testing

**Goal**: Verify all components work together

1. **State Management**

   - [ ] Trip data persists through steps
   - [ ] Price locks properly stored
   - [ ] Form data validation
   - [ ] Navigation between steps

2. **Timer Functionality**

   - [ ] Countdown displays correctly
   - [ ] Color changes (green→orange→red)
   - [ ] Expiration callbacks fire
   - [ ] Polling updates status

3. **Data Persistence**
   - [ ] Refresh handling
   - [ ] Browser back/forward
   - [ ] Session recovery
   - [ ] Lock recovery from localStorage

## 🐛 Known Issues to Investigate

1. **CSS Diagnostics** - Cached warnings about block/flex conflicts
2. **TypeScript Errors** - Various type mismatches in other components
3. **Budget Tier Confusion** - Frontend uses different values than backend
4. **Country Field** - Verify it's being sent correctly

## 📝 Testing Checklist

### Before Testing:

- [ ] Verify backend is deployed and accessible
- [ ] Confirm API endpoints match documentation
- [ ] Check authentication is working
- [ ] Ensure test payment methods available

### During Testing:

- [ ] Document all request/response payloads
- [ ] Screenshot any UI issues
- [ ] Note any console errors
- [ ] Track timing of price locks
- [ ] Monitor network calls

### After Testing:

- [ ] Create bug tickets for issues found
- [ ] Update SOT documents with clarifications
- [ ] Document any API contract changes
- [ ] Plan fixes based on priority

## 🚦 Success Criteria

1. **All API calls succeed** with expected payloads
2. **Price locks work** for full 15 minutes
3. **Checkout completes** with Stripe
4. **No data loss** through the flow
5. **Error handling** provides clear user feedback

## 📊 Risk Assessment

**HIGH RISK**: API contract mismatches

- Frontend/backend built separately
- Assumptions made on both sides
- No integration testing yet

**MEDIUM RISK**: Price lock timing

- 15-minute windows need coordination
- Polling intervals must align
- Expiration handling critical

**LOW RISK**: UI/UX issues

- Components are built
- Styling is complete
- Minor adjustments expected

## 🎯 Next Steps

1. **Start with API validation** - Use Postman/curl to test endpoints
2. **Fix contract issues** before UI testing
3. **Test happy path** once APIs align
4. **Document all findings** in this plan
5. **Create fix tickets** for issues found

## ⚠️ IMPORTANT REMINDERS

- This is the FIRST time frontend and backend will talk to each other
- Expect issues - this is normal for first integration
- Document everything for future reference
- Small fixes are better than large refactors
- Communication between teams is critical
