# Image Handling Strategy - Source of Truth

**Last Updated**: October 21, 2025
**Purpose**: Define how images are sourced, cached, and displayed across the platform
**Status**: ✅ CANONICAL REFERENCE

> **Current Issues**: Static palm tree images, missing hotel photos, placeholder data on review page

---

## 📋 Table of Contents

- [Current Problems](#-current-problems)
- [Image Sources & Strategy](#-image-sources--strategy)
- [Implementation Plan](#-implementation-plan)
- [Code Changes Required](#-code-changes-required)
- [API Requirements](#-api-requirements)

---

## 🚨 Current Problems

### 1. Review Page: Static Destination Images

**Issue**: Hero image always shows palm trees regardless of destination

**Current Code** (`BookingReviewEnhanced.tsx:147-157`):

```typescript
const getDestinationImage = () => {
  const destination = tripDetails.destination.toLowerCase();
  if (destination.includes('maldives')) return '/images/destinations/maldives.jpg';
  if (destination.includes('paris')) return '/images/destinations/paris.jpg';
  if (destination.includes('tokyo')) return '/images/destinations/tokyo.jpg';
  if (destination.includes('bali')) return '/images/destinations/bali.jpg';
  if (destination.includes('greece')) return '/images/destinations/santorini.jpg';
  // Fallback to beautiful travel scene
  return '/images/hero-travel-scene.jpg'; // 🚨 PALM TREES!
};
```

**Problem**:

- Only 5 hardcoded destinations
- Searching "London" → palm trees
- Searching "Austin" → palm trees
- Not scalable

---

### 2. Hotels: Missing/Broken Images

**Issue**: Hotel images not loading, falling back to default placeholder

**Current Code** (`HotelSelectionUpdated.tsx:122-124`):

```typescript
const displayImages =
  hotel.images && hotel.images.length > 0
    ? hotel.images.slice(0, 5)
    : ['/images/hotels/default-hotel.jpg']; // 🚨 FALLBACK
```

**Problem**:

- Backend sends empty `hotel.images[]` array
- OR backend sends broken/invalid URLs
- Users see generic placeholder instead of actual hotel

**Expected from Backend**:

```json
{
  "images": [
    "https://photos.voyage.com/hotels/AC123/photo1.jpg",
    "https://photos.voyage.com/hotels/AC123/photo2.jpg",
    "https://photos.voyage.com/hotels/AC123/photo3.jpg"
  ]
}
```

**Current Reality**:

```json
{
  "images": [] // Empty!
}
```

---

### 3. Review Page: Placeholder/Fake Data

**Issue**: Review page shows empty fields or placeholder text

**Data Flow**:

```
1. User selects flight → Stored in formData.departureFlight
2. User selects hotel → Stored in formData.hotel
3. Navigate to review → Passes formData to BookingReviewEnhanced
4. Review page expects specific data structure
```

**Problem**: Data mismatch between what planner stores and what review expects

**Current Props** (`BookingReviewEnhanced.tsx:31-48`):

```typescript
interface BookingReviewEnhancedProps {
  tripId: string;
  tripDetails: {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    budgetTier?: string;
  };
  flights?: {
    departure?: FlightOption & { priceLock?: PriceLock };
    return?: FlightOption & { priceLock?: PriceLock };
  };
  hotel?: any & { priceLock?: PriceLock };
  onBack?: () => void;
}
```

**What Gets Passed** (`index.tsx:619-636`):

```typescript
<BookingReviewEnhanced
  tripId={formData.tripId || ''}
  tripDetails={{
    destination: formData.destination, // ✅ Works
    startDate: formData.startDate, // ✅ Works
    endDate: formData.endDate, // ✅ Works
    travelers: formData.travelers, // ✅ Works
    budgetTier: formData.budgetTier, // ✅ Works
  }}
  flights={{
    departure: formData.departureFlight || undefined, // ⚠️ May be undefined
    return: formData.returnFlight || undefined, // ⚠️ May be undefined
  }}
  hotel={formData.hotel || undefined} // ⚠️ May be undefined
  onBack={() => setCurrentStep('hotels')}
/>
```

**Missing Data Causes**:

1. User skipped flights → `departureFlight` is undefined
2. User skipped hotel → `hotel` is undefined
3. Data structure mismatch (old API vs new API)
4. Price lock missing → shows expired message

---

## 🎯 Image Sources & Strategy

### Strategy 1: Unsplash API (Dynamic City Images) ⭐ RECOMMENDED

**How It Works**:

- Use Unsplash's free API to fetch city images dynamically
- Cache results locally to avoid rate limits
- Fallback to local images if API fails

**Pros**:

- ✅ Free (5000 requests/hour)
- ✅ High-quality, professional photos
- ✅ Covers every destination
- ✅ No manual curation needed

**Cons**:

- ⚠️ Requires API key setup
- ⚠️ Network dependency (solved with caching)

**Implementation**:

```typescript
// src/services/unsplashAPI.ts
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export async function getCityImage(cityName: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        cityName + ' city skyline travel'
      )}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0].urls.regular; // 1080px width
    }

    // Fallback
    return '/images/hero-travel-scene.jpg';
  } catch (error) {
    console.error('Failed to fetch Unsplash image:', error);
    return '/images/hero-travel-scene.jpg';
  }
}

// With caching
export async function getCityImageCached(cityName: string): Promise<string> {
  const cacheKey = `UNSPLASH_CITY_${cityName.toUpperCase()}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const { url, timestamp } = JSON.parse(cached);
    // Cache for 7 days
    if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
      return url;
    }
  }

  const url = await getCityImage(cityName);
  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      url,
      timestamp: Date.now(),
    })
  );

  return url;
}
```

**Usage**:

```typescript
// BookingReviewEnhanced.tsx
const [destinationImage, setDestinationImage] = useState('/images/hero-travel-scene.jpg');

useEffect(() => {
  getCityImageCached(tripDetails.destination).then(setDestinationImage);
}, [tripDetails.destination]);

// In render
<div
  className="absolute inset-0 bg-cover bg-center"
  style={{ backgroundImage: `url(${destinationImage})` }}
>
```

---

### Strategy 2: Pexels API (Alternative)

**How It Works**: Same as Unsplash but with Pexels

**Pros**:

- ✅ Free (200 requests/hour)
- ✅ High-quality photos
- ✅ Simple API

**Cons**:

- ⚠️ Lower rate limit than Unsplash

**Implementation**: Nearly identical to Unsplash

---

### Strategy 3: Backend-Curated Image Table ⭐ BEST LONG-TERM

**How It Works**:

- Backend maintains a database table of city → image URL mappings
- Frontend requests: `GET /api/v1/destinations/{cityCode}/image`
- Backend returns optimized, curated image URL

**Pros**:

- ✅ Full control over image quality
- ✅ Can use CDN for performance
- ✅ Can customize per season/event
- ✅ No third-party dependencies

**Cons**:

- ⚠️ Requires manual curation (one-time)
- ⚠️ Backend work required

**Database Schema**:

```sql
CREATE TABLE destination_images (
  id SERIAL PRIMARY KEY,
  city_code VARCHAR(3) NOT NULL UNIQUE,  -- "LON", "PAR", "NYC"
  city_name VARCHAR(255) NOT NULL,       -- "London", "Paris", "New York"
  image_url TEXT NOT NULL,               -- CDN URL
  image_source VARCHAR(100),             -- "unsplash", "pexels", "custom"
  credit_name VARCHAR(255),              -- Photographer name
  credit_url TEXT,                       -- Link to original
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sample data
INSERT INTO destination_images (city_code, city_name, image_url, image_source) VALUES
('PAR', 'Paris', 'https://cdn.voyage.com/destinations/paris-eiffel.jpg', 'unsplash'),
('LON', 'London', 'https://cdn.voyage.com/destinations/london-bridge.jpg', 'unsplash'),
('NYC', 'New York', 'https://cdn.voyage.com/destinations/nyc-skyline.jpg', 'pexels'),
('AUS', 'Austin', 'https://cdn.voyage.com/destinations/austin-downtown.jpg', 'custom');
```

**API Endpoint**:

```typescript
// Backend: GET /api/v1/destinations/:cityCode/image
app.get('/api/v1/destinations/:cityCode/image', async (req, res) => {
  const { cityCode } = req.params;

  const result = await db.query(
    'SELECT image_url, credit_name, credit_url FROM destination_images WHERE city_code = $1',
    [cityCode.toUpperCase()]
  );

  if (result.rows.length > 0) {
    res.json(result.rows[0]);
  } else {
    // Fallback
    res.json({
      image_url: 'https://cdn.voyage.com/destinations/default-travel.jpg',
      credit_name: null,
      credit_url: null,
    });
  }
});
```

**Frontend Usage**:

```typescript
// BookingReviewEnhanced.tsx
const [destinationImage, setDestinationImage] = useState('/images/hero-travel-scene.jpg');

useEffect(() => {
  const cityCode = extractCityCode({ city: tripDetails.destination });

  fetch(`${API_BASE}/destinations/${cityCode}/image`)
    .then(res => res.json())
    .then(data => setDestinationImage(data.image_url))
    .catch(() => setDestinationImage('/images/hero-travel-scene.jpg'));
}, [tripDetails.destination]);
```

---

### Strategy 4: Static Lookup Table (Quick Fix)

**How It Works**: Hardcoded mapping with more cities

**Pros**:

- ✅ No API dependencies
- ✅ Fast
- ✅ Works offline

**Cons**:

- ⚠️ Limited to pre-defined cities
- ⚠️ Requires manual updates

**Implementation**:

```typescript
// src/utils/destinationImages.ts
export const DESTINATION_IMAGE_MAP: Record<string, string> = {
  // Major US Cities
  'new york': '/images/destinations/nyc.jpg',
  'los angeles': '/images/destinations/la.jpg',
  chicago: '/images/destinations/chicago.jpg',
  miami: '/images/destinations/miami.jpg',
  'san francisco': '/images/destinations/sf.jpg',
  austin: '/images/destinations/austin.jpg',
  seattle: '/images/destinations/seattle.jpg',
  boston: '/images/destinations/boston.jpg',

  // Europe
  london: '/images/destinations/london.jpg',
  paris: '/images/destinations/paris.jpg',
  rome: '/images/destinations/rome.jpg',
  barcelona: '/images/destinations/barcelona.jpg',
  amsterdam: '/images/destinations/amsterdam.jpg',
  berlin: '/images/destinations/berlin.jpg',
  athens: '/images/destinations/athens.jpg',

  // Asia
  tokyo: '/images/destinations/tokyo.jpg',
  singapore: '/images/destinations/singapore.jpg',
  bangkok: '/images/destinations/bangkok.jpg',
  dubai: '/images/destinations/dubai.jpg',
  seoul: '/images/destinations/seoul.jpg',

  // Tropical
  maldives: '/images/destinations/maldives.jpg',
  bali: '/images/destinations/bali.jpg',
  hawaii: '/images/destinations/hawaii.jpg',
  cancun: '/images/destinations/cancun.jpg',

  // Add 50-100 more cities...
};

export function getDestinationImage(destination: string): string {
  const key = destination.toLowerCase().trim();

  // Exact match
  if (DESTINATION_IMAGE_MAP[key]) {
    return DESTINATION_IMAGE_MAP[key];
  }

  // Partial match (e.g., "Los Angeles, CA" matches "los angeles")
  for (const [city, image] of Object.entries(DESTINATION_IMAGE_MAP)) {
    if (key.includes(city) || city.includes(key)) {
      return image;
    }
  }

  // Fallback
  return '/images/hero-travel-scene.jpg';
}
```

---

## 🎯 Recommended Solution (Hybrid Approach)

### Phase 1 (Immediate - This Week):

1. **Implement Strategy 1 (Unsplash API)** for dynamic city images
2. **Fix hotel image handling** to properly display backend-provided URLs
3. **Fix review page data flow** to ensure real data is passed

### Phase 2 (Next Sprint):

1. **Backend creates destination images table** (Strategy 3)
2. **Curate top 100 destinations** with high-quality images
3. **Frontend switches to backend API** for images
4. **Keep Unsplash as fallback** for unlisted cities

### Phase 3 (Future):

1. **Backend integration with Amadeus Hotel Ratings API** for hotel photos
2. **CDN optimization** for all images
3. **Lazy loading** and progressive image loading

---

## 📋 Implementation Plan

### Task 1: Fix Review Page Hero Image

**File**: `src/components/booking/BookingReviewEnhanced.tsx`

**Current**:

```typescript
const getDestinationImage = () => {
  const destination = tripDetails.destination.toLowerCase();
  if (destination.includes('maldives')) return '/images/destinations/maldives.jpg';
  // ... 5 hardcoded cities
  return '/images/hero-travel-scene.jpg'; // PALM TREES!
};
```

**Solution A (Unsplash - Quick Win)**:

```typescript
import { getCityImageCached } from '../../services/unsplashAPI';

const [destinationImage, setDestinationImage] = useState<string | null>(null);
const [imageLoading, setImageLoading] = useState(true);

useEffect(() => {
  setImageLoading(true);
  getCityImageCached(tripDetails.destination)
    .then(url => {
      setDestinationImage(url);
      setImageLoading(false);
    })
    .catch(() => {
      setDestinationImage('/images/hero-travel-scene.jpg');
      setImageLoading(false);
    });
}, [tripDetails.destination]);

// In render
{
  imageLoading ? (
    <div className="absolute inset-0 bg-slate-800 animate-pulse" />
  ) : (
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${destinationImage})` }}
    />
  );
}
```

**Solution B (Backend API - Better)**:

```typescript
const [destinationImage, setDestinationImage] = useState<string | null>(null);

useEffect(() => {
  const cityCode = extractCityCode({ city: tripDetails.destination });

  fetch(`${import.meta.env.VITE_API_BASE}/destinations/${cityCode}/image`)
    .then(res => res.json())
    .then(data => setDestinationImage(data.image_url))
    .catch(() => setDestinationImage('/images/hero-travel-scene.jpg'));
}, [tripDetails.destination]);
```

---

### Task 2: Fix Hotel Images

**File**: `src/components/planner/steps/HotelSelectionUpdated.tsx`

**Current**:

```typescript
const displayImages =
  hotel.images && hotel.images.length > 0
    ? hotel.images.slice(0, 5)
    : ['/images/hotels/default-hotel.jpg'];
```

**Issue**: Backend sends empty `hotel.images[]`

**Solution**:

1. **Backend MUST populate `images[]` array** from Amadeus Hotel Search
2. **Add image validation** in frontend
3. **Better fallback** with multiple placeholders

**Enhanced Code**:

```typescript
const displayImages = useMemo(() => {
  // Validate and filter valid image URLs
  const validImages =
    hotel.images?.filter((url: string) => {
      try {
        new URL(url); // Check if valid URL
        return url.startsWith('http'); // Must be http/https
      } catch {
        return false;
      }
    }) || [];

  if (validImages.length > 0) {
    return validImages.slice(0, 5);
  }

  // Fallback: Use hotel star rating to select placeholder
  const placeholderIndex = Math.min(hotel.stars || 3, 5);
  return [`/images/hotels/placeholder-${placeholderIndex}star.jpg`];
}, [hotel.images, hotel.stars]);

// Add error handling for image load failures
const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

const handleImageError = (index: number) => {
  setImageErrors(prev => new Set([...prev, index]));
};

// In render
<OptimizedImage
  src={
    imageErrors.has(currentImageIndex)
      ? '/images/hotels/default-hotel.jpg'
      : displayImages[currentImageIndex]
  }
  alt={`${hotel.name} - Photo ${currentImageIndex + 1}`}
  onError={() => handleImageError(currentImageIndex)}
  className="w-full h-full object-cover"
/>;
```

**Backend Requirements**:

```json
// POST /api/v1/hotels/search response
{
  "results": [
    {
      "id": "ACPAR418",
      "name": "Hotel des Champs-Élysées",
      "images": [
        // ✅ MUST BE POPULATED FROM AMADEUS
        "https://photos.voyage.com/hotels/ACPAR418/exterior.jpg",
        "https://photos.voyage.com/hotels/ACPAR418/lobby.jpg",
        "https://photos.voyage.com/hotels/ACPAR418/room.jpg",
        "https://photos.voyage.com/hotels/ACPAR418/pool.jpg",
        "https://photos.voyage.com/hotels/ACPAR418/restaurant.jpg"
      ]
    }
  ]
}
```

**Backend Fix (Amadeus Integration)**:

```typescript
// backend/services/amadeus/hotelSearch.ts
async function transformHotelOffer(amadeusHotel: AmadeusHotel): Promise<PlannerHotelOption> {
  // ... existing transformation

  // 🚨 MISSING: Extract hotel images from Amadeus
  const images: string[] = [];

  // Option 1: From Amadeus hotel media endpoint
  if (amadeusHotel.hotel?.media) {
    images.push(...amadeusHotel.hotel.media.map(m => m.uri));
  }

  // Option 2: Fallback to hotel chain's CDN
  if (images.length === 0 && amadeusHotel.hotel?.hotelId) {
    const hotelId = amadeusHotel.hotel.hotelId;
    images.push(
      `https://photos.voyage.com/hotels/${hotelId}/1.jpg`,
      `https://photos.voyage.com/hotels/${hotelId}/2.jpg`,
      `https://photos.voyage.com/hotels/${hotelId}/3.jpg`
    );
  }

  return {
    // ... other fields
    images: images.length > 0 ? images : [],
  };
}
```

---

### Task 3: Fix Review Page Placeholder Data

**Issue**: Review page shows "Placeholder Flight" or "Placeholder Hotel"

**Root Cause**: Data not flowing correctly from planner to review

**Files to Check**:

1. `src/pages/planner/index.tsx` (lines 619-636)
2. `src/components/booking/BookingReviewEnhanced.tsx`

**Current Flow**:

```
FlightSelectionUpdated → updateFormData({ departureFlight: flight })
                      ↓
                formData.departureFlight stored
                      ↓
        BookingReviewEnhanced receives flights.departure
                      ↓
                Displays flight details
```

**Debug Steps**:

```typescript
// In BookingReviewEnhanced.tsx, add:
useEffect(() => {
  console.group('📋 Review Page Data');
  console.log('Trip ID:', tripId);
  console.log('Trip Details:', tripDetails);
  console.log('Flights:', flights);
  console.log('  - Departure:', flights?.departure);
  console.log('  - Return:', flights?.return);
  console.log('Hotel:', hotel);
  console.log('Has Valid Locks:', hasValidLocks());
  console.groupEnd();
}, [tripId, tripDetails, flights, hotel]);
```

**Possible Fixes**:

**Issue 1**: Flight/hotel data structure mismatch

```typescript
// Review page expects FlightOption format
interface FlightOption {
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
}

// But planner might be storing new API format
interface PlannerFlightOption {
  airline: string;
  flightNumber: string;
  departure: string; // ⚠️ Different field name!
  arrival: string; // ⚠️ Different field name!
  price: { amount: number }; // ⚠️ Nested!
}
```

**Solution**: Add data normalization

```typescript
// src/utils/dataTransform.ts
export function normalizeFlightForReview(flight: any): FlightOption {
  return {
    airline: flight.airline,
    flightNumber: flight.flightNumber,
    departureTime: flight.departureTime || flight.departure, // Handle both
    arrivalTime: flight.arrivalTime || flight.arrival, // Handle both
    duration: flight.duration,
    price: typeof flight.price === 'number' ? flight.price : flight.price?.amount || 0,
    // ... other fields
  };
}

// In BookingReviewEnhanced.tsx
const normalizedDeparture = flights?.departure
  ? normalizeFlightForReview(flights.departure)
  : undefined;
```

**Issue 2**: Missing price locks

```typescript
// Check if price locks are attached
console.log('Departure Price Lock:', flights?.departure?.priceLock);
console.log('Hotel Price Lock:', hotel?.priceLock);

// If missing, review page shows "Price lock expired"
```

**Solution**: Ensure price locks are stored in formData

```typescript
// In FlightSelectionUpdated.tsx, after hold API call:
const flightWithLock = {
  ...selectedFlight,
  priceLock: {
    lockId: holdResponse.priceLock.id,
    expiresAt: holdResponse.priceLock.expiresAt,
    amount: holdResponse.priceLock.amount,
  },
};

updateFormData({ departureFlight: flightWithLock });
```

---

## 🔧 Code Changes Required

### File 1: Create Unsplash Service

**Create**: `src/services/unsplashAPI.ts`

```typescript
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
const API_BASE = 'https://api.unsplash.com';

interface UnsplashImage {
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
  };
}

interface UnsplashSearchResponse {
  results: UnsplashImage[];
  total: number;
}

/**
 * Fetch a high-quality city image from Unsplash
 */
export async function getCityImage(cityName: string): Promise<string> {
  try {
    const response = await fetch(
      `${API_BASE}/search/photos?` +
        new URLSearchParams({
          query: `${cityName} city skyline travel landmark`,
          per_page: '1',
          orientation: 'landscape',
          client_id: UNSPLASH_ACCESS_KEY,
        })
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data: UnsplashSearchResponse = await response.json();

    if (data.results && data.results.length > 0) {
      // Use 'regular' size (1080px width) for hero images
      return data.results[0].urls.regular;
    }

    // No results found
    return '/images/hero-travel-scene.jpg';
  } catch (error) {
    console.error('Failed to fetch Unsplash image:', error);
    return '/images/hero-travel-scene.jpg';
  }
}

/**
 * Fetch city image with local storage caching
 * Cache lasts 7 days to reduce API calls
 */
export async function getCityImageCached(cityName: string): Promise<string> {
  const cacheKey = `UNSPLASH_CITY_${cityName.toUpperCase().replace(/\s+/g, '_')}`;

  try {
    // Check cache
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const { url, timestamp } = JSON.parse(cached);

      // Cache for 7 days
      if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
        return url;
      }
    }

    // Fetch fresh image
    const url = await getCityImage(cityName);

    // Save to cache
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        url,
        timestamp: Date.now(),
      })
    );

    return url;
  } catch (error) {
    console.error('Failed to get cached city image:', error);
    return '/images/hero-travel-scene.jpg';
  }
}

/**
 * Preload images for multiple cities
 * Useful for upcoming destinations
 */
export async function preloadCityImages(cities: string[]): Promise<void> {
  await Promise.allSettled(cities.map(city => getCityImageCached(city)));
}
```

---

### File 2: Update Review Page Component

**Update**: `src/components/booking/BookingReviewEnhanced.tsx`

```typescript
// Add import
import { getCityImageCached } from '../../services/unsplashAPI';

// Inside component, replace getDestinationImage() with:
const [destinationImage, setDestinationImage] = useState<string>('/images/hero-travel-scene.jpg');
const [imageLoading, setImageLoading] = useState(true);

useEffect(() => {
  setImageLoading(true);

  getCityImageCached(tripDetails.destination)
    .then(url => {
      setDestinationImage(url);
      setImageLoading(false);
    })
    .catch(error => {
      console.error('Failed to load destination image:', error);
      setDestinationImage('/images/hero-travel-scene.jpg');
      setImageLoading(false);
    });
}, [tripDetails.destination]);

// Update render (line 173-181):
<div className="relative h-[400px] overflow-hidden">
  {imageLoading ? (
    <div className="absolute inset-0 bg-slate-800 animate-pulse" />
  ) : (
    <div
      className="absolute inset-0 bg-cover bg-center transition-all duration-700"
      style={{
        backgroundImage: `url(${destinationImage})`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80"></div>
    </div>
  )}

  <div className="relative h-full max-w-7xl mx-auto px-6 flex flex-col justify-center">
    {/* ... rest of hero content */}
  </div>
</div>;
```

---

### File 3: Add Environment Variable

**Update**: `.env`

```bash
# Unsplash API (for destination images)
VITE_UNSPLASH_ACCESS_KEY=your_access_key_here
```

**How to Get Key**:

1. Go to https://unsplash.com/developers
2. Register application (free)
3. Copy "Access Key"
4. Paste in `.env`

---

### File 4: Update Hotel Images Display

**Update**: `src/components/planner/steps/HotelSelectionUpdated.tsx`

```typescript
// Replace displayImages logic (lines 121-124):
const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

const displayImages = useMemo(() => {
  // Validate hotel images
  const validImages = (hotel.images || [])
    .filter((url: string) => {
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
      } catch {
        return false;
      }
    })
    .slice(0, 5);

  if (validImages.length > 0) {
    return validImages;
  }

  // Fallback: Use star rating to determine placeholder quality
  const placeholderTier = Math.min(hotel.stars || 3, 5);
  return [`/images/hotels/placeholder-${placeholderTier}star.jpg`];
}, [hotel.images, hotel.stars]);

const handleImageError = (index: number) => {
  console.warn(`Failed to load hotel image ${index} for ${hotel.name}`);
  setImageErrors(prev => new Set([...prev, index]));
};

// Update OptimizedImage (line 199-205):
<OptimizedImage
  src={
    imageErrors.has(currentImageIndex)
      ? '/images/hotels/default-hotel.jpg'
      : displayImages[currentImageIndex]
  }
  alt={`${hotel.name} - Photo ${currentImageIndex + 1}`}
  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
  width={800}
  height={320}
  onError={() => handleImageError(currentImageIndex)}
/>;
```

---

## 🔧 API Requirements

### Backend: Hotel Images

**Endpoint**: `POST /api/v1/hotels/search`

**Current Issue**: `images[]` array is empty

**Fix Required**:

```typescript
// backend/services/amadeus/hotelSearch.ts
async function transformHotelOffer(offer: AmadeusHotelOffer): Promise<PlannerHotelOption> {
  const hotelId = offer.hotel.hotelId;

  // 🚨 FIX: Fetch hotel media from Amadeus
  let images: string[] = [];

  try {
    // Method 1: From Amadeus Hotel Media API
    const mediaResponse = await amadeus.shopping.hotelOffersByHotel({
      hotelId: hotelId,
      view: 'FULL',
    });

    if (mediaResponse.data?.hotel?.media) {
      images = mediaResponse.data.hotel.media.filter(m => m.category === 'PHOTO').map(m => m.uri);
    }
  } catch (error) {
    console.warn(`Failed to fetch media for hotel ${hotelId}:`, error);
  }

  // Method 2: Fallback to chain CDN (if no Amadeus images)
  if (images.length === 0) {
    images = [
      `https://photos.voyage.com/hotels/${hotelId}/1.jpg`,
      `https://photos.voyage.com/hotels/${hotelId}/2.jpg`,
      `https://photos.voyage.com/hotels/${hotelId}/3.jpg`,
    ];
  }

  return {
    // ... other fields
    images: images, // ✅ MUST BE POPULATED
  };
}
```

**Expected Response**:

```json
{
  "results": [
    {
      "images": [
        "https://cdn.amadeus.com/hotels/ACPAR418/photo1.jpg",
        "https://cdn.amadeus.com/hotels/ACPAR418/photo2.jpg",
        "https://cdn.amadeus.com/hotels/ACPAR418/photo3.jpg"
      ]
    }
  ]
}
```

---

### Backend: Destination Images Table (Future)

**Create Table**:

```sql
CREATE TABLE destination_images (
  id SERIAL PRIMARY KEY,
  city_code VARCHAR(3) NOT NULL UNIQUE,
  city_name VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  image_source VARCHAR(100) DEFAULT 'unsplash',
  photographer_name VARCHAR(255),
  photographer_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_destination_images_city_code ON destination_images(city_code);
CREATE INDEX idx_destination_images_active ON destination_images(is_active);
```

**Seed Data** (Top 50 cities):

```sql
INSERT INTO destination_images (city_code, city_name, image_url) VALUES
('LON', 'London', 'https://cdn.voyage.com/destinations/london.jpg'),
('PAR', 'Paris', 'https://cdn.voyage.com/destinations/paris.jpg'),
('NYC', 'New York', 'https://cdn.voyage.com/destinations/nyc.jpg'),
('TYO', 'Tokyo', 'https://cdn.voyage.com/destinations/tokyo.jpg'),
('SIN', 'Singapore', 'https://cdn.voyage.com/destinations/singapore.jpg');
-- ... 45 more cities
```

**API Endpoint**:

```typescript
// GET /api/v1/destinations/:cityCode/image
router.get('/destinations/:cityCode/image', async (req, res) => {
  const { cityCode } = req.params;

  const image = await db.query(
    `SELECT image_url, thumbnail_url, photographer_name, photographer_url
     FROM destination_images
     WHERE city_code = $1 AND is_active = true`,
    [cityCode.toUpperCase()]
  );

  if (image.rows.length > 0) {
    res.json(image.rows[0]);
  } else {
    // Fallback
    res.json({
      image_url: 'https://cdn.voyage.com/destinations/default.jpg',
      thumbnail_url: null,
      photographer_name: null,
      photographer_url: null,
    });
  }
});
```

---

## ✅ Implementation Checklist

### Immediate (This Sprint):

**Destination Images**:

- [ ] Create `src/services/unsplashAPI.ts`
- [ ] Add `VITE_UNSPLASH_ACCESS_KEY` to `.env`
- [ ] Update `BookingReviewEnhanced.tsx` to use Unsplash
- [ ] Test with 10+ different cities
- [ ] Verify caching works (check localStorage)

**Hotel Images**:

- [ ] Update `HotelSelectionUpdated.tsx` with better error handling
- [ ] Add image validation logic
- [ ] Create placeholder images for 1-5 star hotels
- [ ] Backend: Fix Amadeus integration to populate `images[]`
- [ ] Test with real hotel data

**Review Page Data**:

- [ ] Add debug logging to `BookingReviewEnhanced.tsx`
- [ ] Verify data flow from planner → review
- [ ] Ensure price locks are attached to selections
- [ ] Test with full flow (flight + hotel + review)

### Next Sprint:

**Backend Infrastructure**:

- [ ] Create `destination_images` table
- [ ] Seed with top 100 destinations
- [ ] Implement `GET /api/v1/destinations/:cityCode/image`
- [ ] Frontend switch to backend API
- [ ] Keep Unsplash as fallback

### Future:

**Optimization**:

- [ ] CDN for all images
- [ ] Progressive image loading
- [ ] Image compression
- [ ] WebP format support
- [ ] Lazy loading for hotel carousels

---

**Document Version**: 1.0.0
**Last Updated**: October 21, 2025
**Next Review**: After implementation
**Owner**: Voyance Engineering Team
**Status**: ✅ IMPLEMENTATION READY
