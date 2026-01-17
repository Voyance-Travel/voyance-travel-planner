# Review Page Data Requirements - Complete Breakdown

**Purpose**: This document defines exactly what data the Review Page (`BookingReviewEnhanced`) needs from the backend, what we're currently capturing, and what's missing.

**Last Updated**: 2025-10-21
**Status**: ✅ Active Reference

---

## 📊 **Current Data Flow**

```
FlightSelectionUpdated (stores) → formData.departureFlight
                                 → formData.returnFlight

HotelSelectionUpdated (stores)  → formData.hotel

PlannerIndex (passes to)        → BookingReviewEnhanced
```

---

## 🎯 **What Review Page EXPECTS (Props Interface)**

```typescript
interface BookingReviewEnhancedProps {
  tripId: string; // ✅ Have
  tripDetails: {
    destination: string; // ✅ Have
    startDate: string; // ✅ Have (ISO format)
    endDate: string; // ✅ Have (ISO format)
    travelers: number; // ✅ Have
    budgetTier?: string; // ✅ Have (optional)
  };
  flights?: {
    departure?: FlightOption & { priceLock?: PriceLock };
    return?: FlightOption & { priceLock?: PriceLock };
  };
  hotel?: any & { priceLock?: PriceLock };
  onBack?: () => void;
  onConfirm?: () => void;
}
```

---

## ✈️ **FLIGHT DATA - What We Need**

### **1. Core Flight Object (FlightOption)**

```typescript
interface FlightOption {
  // Required Fields (Currently Used in Review Page)
  id: string; // ✅ Backend provides
  airline: string; // ✅ Used in header ("United Airlines")
  flightNumber?: string; // ✅ Used in footer ("UA 1234")

  // Time & Date
  departureTime: string; // ✅ Used: "10:30 AM"
  arrivalTime: string; // ✅ Used: "2:45 PM"
  departure?: string; // ⚠️ ISO fallback if departureTime missing
  arrival?: string; // ⚠️ ISO fallback if arrivalTime missing

  // Pricing
  price: number | { amount: number }; // ✅ CRITICAL - must be number or { amount }

  // Additional Info (NOT currently displayed but useful)
  duration: number; // ❌ NOT displayed
  origin: string; // ❌ NOT displayed
  destination: string; // ❌ NOT displayed
  cabinClass: string; // ❌ NOT displayed (removed from UI)
  stops: number; // ❌ NOT displayed
  segments?: FlightSegment[]; // ❌ NOT displayed
}
```

### **2. Price Lock Object (CRITICAL)**

```typescript
interface PriceLock {
  lockId: string; // ✅ Used for validation
  expiresAt: string; // ✅ ISO timestamp - shows countdown timer
  amount: number; // ✅ Used for total calculation
}
```

### **3. Flight Data Flow (How it Gets There)**

```typescript
// Step 1: Flight Selection (FlightSelectionUpdated.tsx)
const flightWithLock = {
  ...flight, // All FlightOption fields
  priceLock: {
    lockId: lockResponse.priceLock.id,
    expiresAt: lockResponse.priceLock.expiresAt,
    amount: lockResponse.priceLock.amount,
  },
};

// Step 2: Store in formData (updateFormData call)
updateFormData({
  departureFlight: flightWithLock, // ✅ NEW field name
  selectedDepartureFlight: flightWithLock, // Legacy compatibility
  departurePrice: flight.price.amount,
});

// Step 3: Pass to Review Page (index.tsx)
<BookingReviewEnhanced
  flights={{
    departure: formData.departureFlight, // ✅ Expects this field name
    return: formData.returnFlight,
  }}
/>;
```

---

## 🏨 **HOTEL DATA - What We Need**

### **1. Hotel Object (Currently `any` type - needs definition)**

```typescript
interface HotelOption {
  // Required Fields (Currently Used in Review Page)
  id: string; // ✅ Backend provides
  name: string; // ✅ Used in header ("The Ritz-Carlton")

  // Rating
  stars?: number; // ✅ Used for star display (1-5)
  rating?: {
    overall?: number; // ⚠️ Fallback if stars missing
  };

  // Location
  location?:
    | {
        city?: string; // ✅ Preferred
        address?: string; // ⚠️ Fallback
      }
    | string; // ⚠️ Legacy fallback

  // Pricing
  price?:
    | {
        total?: number; // ✅ Preferred format
      }
    | number; // ⚠️ Legacy fallback

  // Additional Info (NOT currently displayed)
  amenities?: string[]; // ❌ NOT displayed
  description?: string; // ❌ NOT displayed
  images?: string[]; // ❌ NOT displayed (but we SHOULD display)
}
```

### **2. Hotel Price Lock (CRITICAL)**

```typescript
interface PriceLock {
  lockId: string; // ✅ Used for validation
  expiresAt: string; // ✅ ISO timestamp
  amount: number; // ✅ Used for total calculation
}
```

### **3. Hotel Data Flow**

```typescript
// Step 1: Hotel Selection (HotelSelectionUpdated.tsx)
const hotelWithLock = {
  ...hotel, // All hotel fields
  priceLock: {
    lockId: lockResponse.priceLock.id,
    expiresAt: lockResponse.priceLock.expiresAt,
    amount: lockResponse.priceLock.amount,
  },
};

// Step 2: Store in formData
updateFormData({
  hotel: hotelWithLock, // ✅ Direct field name
  selectedHotel: hotelWithLock, // Legacy compatibility
  hotelPrice: hotel.price?.total || 0,
});

// Step 3: Pass to Review Page
<BookingReviewEnhanced
  hotel={formData.hotel} // ✅ Expects this field name
/>;
```

---

## 📋 **TRIP DETAILS - What We Need**

```typescript
interface TripDetails {
  destination: string; // ✅ "Paris" - displayed in hero
  startDate: string; // ✅ ISO: "2025-10-21" - formatted to "Oct 21"
  endDate: string; // ✅ ISO: "2025-10-28" - formatted to "Oct 28"
  travelers: number; // ✅ 2 - "2 Guests" or "Per guest"
  budgetTier?: string; // ✅ "premium" - capitalized in UI
}
```

**Current Source**: All data comes from initial form (not backend)

---

## 🔍 **ACTUAL FIELDS ACCESSED IN REVIEW PAGE**

### **From `flights.departure`:**

```typescript
flights.departure.airline; // Line 313: "United Airlines"
flights.departure.priceLock; // Line 316: For price lock UI
flights.departure.priceLock.expiresAt; // Line 320: Timer
flights.departure.departureTime; // Line 335: "10:30 AM"
flights.departure.departure; // Line 337: Fallback ISO string
flights.departure.arrivalTime; // Line 353: "2:45 PM"
flights.departure.arrival; // Line 355: Fallback ISO string
flights.departure.flightNumber; // Line 363: "UA 1234"
flights.departure.price; // Line 367: Price calculation
```

### **From `flights.return`:**

```typescript
// Same fields as departure
```

### **From `hotel`:**

```typescript
hotel.name; // Line 387: "The Ritz-Carlton"
hotel.priceLock; // Line 390: For price lock UI
hotel.priceLock.expiresAt; // Line 394: Timer
hotel.stars; // Line 405: Star rating (1-5)
hotel.rating?.overall; // Line 405: Fallback rating
hotel.location?.city; // Line 411: "Paris"
hotel.location?.address; // Line 412: Fallback
hotel.location; // Line 413: String fallback
hotel.price?.total; // Line 421: Total price
hotel.price; // Line 421: Fallback number
```

### **From `tripDetails`:**

```typescript
tripDetails.destination; // Line 215: "Paris"
tripDetails.startDate; // Line 220: ISO format
tripDetails.endDate; // Line 220: ISO format
tripDetails.travelers; // Line 232: Number of guests
tripDetails.budgetTier; // Line 240: "premium"
```

---

## ❌ **WHAT'S MISSING / NEEDS BACKEND WORK**

### **1. Hotel Images (CRITICAL)**

```typescript
// Currently NOT displayed, but we SHOULD display them
hotel.images?: string[];             // Backend needs to provide

// Need Amadeus Hotel Media API integration
// See: SOT_IMAGE_HANDLING_STRATEGY.md
```

### **2. Destination Images (CRITICAL)**

```typescript
// Currently static/hardcoded
// Need backend to provide dynamic image URL based on destination

// See: SOT_IMAGE_HANDLING_STRATEGY.md
```

### **3. Price Lock Status Check**

```typescript
// Currently only client-side timer
// Should have backend endpoint to verify lock status:
GET /api/v1/price-locks/{lockId}/status

Response:
{
  isValid: boolean,
  expiresAt: string,
  remainingSeconds: number
}
```

### **4. Type Safety**

```typescript
// Hotel type is currently `any`
// Should be a proper interface exported from backend contract
```

---

## 🚨 **COMMON DATA ISSUES**

### **Issue 1: Field Name Mismatch**

```typescript
// ❌ OLD (was causing undefined data)
updateFormData({ selectedDepartureFlight: flight });

// ✅ NEW (correct)
updateFormData({
  departureFlight: flight, // Review page expects this
  selectedDepartureFlight: flight, // Keep for backward compatibility
});
```

### **Issue 2: Price Lock Not Attached**

```typescript
// ❌ OLD (price lock created but not stored)
const lockResponse = await holdFlight();
updateFormData({ departureFlight: flight });

// ✅ NEW (price lock attached to flight)
const lockResponse = await holdFlight();
const flightWithLock = {
  ...flight,
  priceLock: {
    lockId: lockResponse.priceLock.id,
    expiresAt: lockResponse.priceLock.expiresAt,
    amount: lockResponse.priceLock.amount,
  },
};
updateFormData({ departureFlight: flightWithLock });
```

### **Issue 3: Price Format Inconsistency**

```typescript
// Backend can send either format:
price: 1234; // Old format (number)
price: {
  amount: 1234;
} // New format (object)

// Review page handles both:
typeof price === 'number' ? price : (price as { amount?: number })?.amount || 0;
```

---

## 🎯 **BACKEND API CONTRACT (What We Need)**

### **Flight Hold Response**

```typescript
POST /api/v1/flights/hold

Request:
{
  tripId: string;
  flightId: string;
  selectedCabin?: string;
}

Response:
{
  success: boolean;
  priceLock: {
    id: string;              // Use as lockId
    expiresAt: string;       // ISO timestamp
    amount: number;          // Lock price
    lockedAt: string;        // ISO timestamp
  };
  flight: {
    // All FlightOption fields
    id: string;
    airline: string;
    flightNumber: string;
    departureTime: string;
    arrivalTime: string;
    price: number;
    // ...
  };
}
```

### **Hotel Hold Response**

```typescript
POST /api/v1/hotels/hold

Request:
{
  tripId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
}

Response:
{
  success: boolean;
  priceLock: {
    id: string;              // Use as lockId
    expiresAt: string;       // ISO timestamp
    amount: number;          // Lock price
    lockedAt: string;        // ISO timestamp
  };
  hotel: {
    // All hotel fields
    id: string;
    name: string;
    stars: number;
    location: {
      city: string;
      address: string;
    };
    price: {
      total: number;
    };
    images?: string[];       // ⚠️ Currently missing, need to add
  };
}
```

---

## 🔧 **DEBUG: How to Check Data Flow**

### **1. Check Browser Console (Development Mode)**

```typescript
// Logs appear automatically in dev mode:
📋 Review Page Data Debug
  Trip ID: "abc123"
  Trip Details: { destination: "Paris", ... }
  Flights Object: { departure: {...}, return: {...} }
    - Departure Flight: {...}
    - Departure Price Lock: { lockId, expiresAt, amount }
  Hotel Object: {...}
    - Hotel Price Lock: { lockId, expiresAt, amount }
```

### **2. Check formData in Planner**

```typescript
// In src/pages/planner/index.tsx
// Add console.log before passing to review:
console.log('Passing to review:', {
  departureFlight: formData.departureFlight,
  returnFlight: formData.returnFlight,
  hotel: formData.hotel,
});
```

### **3. Check API Responses**

```typescript
// In FlightSelectionUpdated.tsx:
console.log('Flight hold response:', lockResponse);

// In HotelSelectionUpdated.tsx:
console.log('Hotel hold response:', lockResponse);
```

---

## ✅ **CHECKLIST: Is Data Complete?**

### **For Flights:**

- [ ] `departureFlight` field exists in formData
- [ ] `returnFlight` field exists in formData (if round-trip)
- [ ] Each flight has `airline`, `flightNumber`, `departureTime`, `arrivalTime`
- [ ] Each flight has `price` (number or { amount: number })
- [ ] Each flight has `priceLock` object with `lockId`, `expiresAt`, `amount`

### **For Hotel:**

- [ ] `hotel` field exists in formData
- [ ] Hotel has `name`, `stars` or `rating.overall`
- [ ] Hotel has `location.city` or `location.address`
- [ ] Hotel has `price.total` or `price` as number
- [ ] Hotel has `priceLock` object with `lockId`, `expiresAt`, `amount`

### **For Trip:**

- [ ] `destination` is populated
- [ ] `startDate` and `endDate` are ISO format strings
- [ ] `travelers` is a number > 0
- [ ] `budgetTier` is provided (optional but recommended)

---

## 🚀 **NEXT STEPS / TODO**

1. **Add Hotel Images**

   - Integrate Amadeus Hotel Media API
   - Store images in hotel object
   - Display in review page

2. **Add Destination Images**

   - Create curated destination image table
   - Backend provides URL based on destination
   - See: SOT_IMAGE_HANDLING_STRATEGY.md

3. **Type Hotel Object**

   - Export `HotelOption` interface from backend
   - Replace `any` type in review page
   - Add proper TypeScript validation

4. **Add Price Lock Verification**

   - Backend endpoint to check lock status
   - Call before allowing checkout
   - Refresh lock if close to expiry

5. **Add More Flight Details**
   - Display `duration` (e.g., "5h 30m")
   - Display `stops` (e.g., "1 stop via LAX")
   - Display `cabinClass` if we want it back

---

## 📞 **CONTACT FOR QUESTIONS**

- **Frontend Data Flow**: Check `src/pages/planner/index.tsx`
- **Flight Selection**: Check `src/components/planner/steps/FlightSelectionUpdated.tsx`
- **Hotel Selection**: Check `src/components/planner/steps/HotelSelectionUpdated.tsx`
- **Review Page**: Check `src/components/booking/BookingReviewEnhanced.tsx`
- **API Types**: Check `src/services/flightAPI.ts` and `src/services/plannerHotelAPI.ts`
