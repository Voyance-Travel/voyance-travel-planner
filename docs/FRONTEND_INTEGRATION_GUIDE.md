# Frontend Integration Guide - Complete Feature Update

## Overview
We've built a comprehensive itinerary enhancement system with transportation, activity selection, data enrichment, friend sharing, and multi-city support. Here's everything the frontend needs to know.

## 1. Enhanced Itinerary Generation

### What Changed
The itinerary now includes rich transportation options, smart activity selection, weather data, photos, coordinates, and group support.

### Key API Endpoints
```typescript
// Generate new itinerary with all enhancements
POST /api/v1/itinerary/generate
{
  destinationId: string,
  startDate: string,
  endDate: string,
  travelers: number,
  preferences: {
    pace: 'slow' | 'moderate' | 'fast',
    interests: string[],
    budget: 'budget' | 'moderate' | 'premium',
    arrivalTime?: string,      // HH:MM format
    departureTime?: string      // HH:MM format
  }
}

// Response includes:
{
  days: [{
    date: string,
    weather: {
      temperature: { high: number, low: number },
      conditions: string,
      rainChance: number
    },
    activities: [{
      id: string,
      name: string,
      description: string,
      coordinates: { lat: number, lng: number },
      photos: string[],
      duration: number,
      price: number,
      walkingDistance: number,     // meters from previous
      venue: {
        name: string,
        type: string,
        rating: number
      },
      transport: {                  // How to get there
        mode: string,
        duration: number,
        cost: number,
        details: string
      }
    }],
    transportation: {
      airport: {                    // Only on arrival/departure days
        mode: 'taxi' | 'shuttle' | 'train' | 'uber',
        duration: number,
        cost: number,
        booking: string,
        departureTime?: string      // For departure days
      }
    }
  }]
}
```

## 2. Friend System & Trip Sharing

### Friend Management
```typescript
// Check if username exists
POST /api/v1/friends/verify-handle
{ handle: string }

// Send friend request
POST /api/v1/friends/request
{ handle: string }  // username or email

// Accept friend request
POST /api/v1/friends/accept
{ handle: string }

// Get friends list
GET /api/v1/friends
// Returns: { connections: Friend[] }

// Get pending requests
GET /api/v1/friends/requests
```

### Trip Sharing
```typescript
// Add friends to trip
POST /api/v1/trips/:tripId/travelers
{
  travelerIds: string[],           // Must be friends
  permissions: 'view' | 'edit' | 'full'
}

// Get trip travelers
GET /api/v1/trips/:tripId/travelers
// Returns travelers + aggregated group profile

// Save activity
POST /api/v1/activities/save
{
  activityId: string,
  destinationId: string,
  notes?: string,
  rating?: 1-5
}

// Get group favorites
GET /api/v1/trips/:tripId/group-favorites
// Returns activities saved by 2+ members
```

## 3. Multi-City Trip Extensions

### Generate Options
```typescript
POST /api/v1/trips/:tripId/add-cities
{
  potentialCities: [{
    cityId: string,
    cityName: string,
    countryName: string,
    priority?: 1-5
  }],
  preferences?: {
    maxBudget?: number,
    preferredTransport?: 'flight' | 'train' | 'any',
    mustSeeCities?: string[]
  }
}

// Returns 3 options:
{
  options: [{
    id: string,
    totalCost: number,
    creditsRequired: number,
    segments: [{
      cityId: string,
      cityName: string,
      nights: number,
      hotel: { name, stars, location, pricePerNight },
      transport: { from, to, mode, duration, cost },
      activities: number
    }],
    breakdown: {
      hotels: number,
      transport: number,
      activities: number,
      fees: number
    }
  }]
}
```

### Pricing Tiers
- **VALUE**: ~€2,350 pp - Budget transport, 3★ hotels
- **BALANCED**: ~€3,100 pp - Mix transport, 4★ hotels  
- **PREMIUM**: ~€4,650 pp - Business class, 5★ hotels

## 4. New Data Fields

### Activity Object Enhancements
```typescript
interface Activity {
  // Existing fields...
  
  // NEW fields:
  coordinates: {
    lat: number,
    lng: number
  },
  photos: string[],              // 2-3 high quality images
  walkingDistance: number,       // Meters from previous activity
  walkingTime: number,          // Minutes to walk
  transport?: {
    mode: string,
    duration: number,
    cost: number,
    details: string
  },
  venue?: {
    name: string,
    type: string,               // restaurant, museum, etc
    cuisine?: string[],
    priceRange?: string,
    rating?: number,
    reviewCount?: number
  },
  weather?: {                   // Activity-specific conditions
    suitable: boolean,
    alternativeIfRain?: string
  }
}
```

### Day Object Enhancements
```typescript
interface ItineraryDay {
  // Existing fields...
  
  // NEW fields:
  weather: {
    temperature: { high: number, low: number },
    conditions: string,         // "Partly cloudy", "Light rain"
    rainChance: number,        // 0-100
    humidity: number,
    windSpeed: number,
    sunrise: string,           // HH:MM
    sunset: string            // HH:MM
  },
  totalWalkingDistance: number,
  totalTransportCost: number,
  paceScore: 'relaxed' | 'moderate' | 'packed',
  narrative?: {
    theme: string,             // "Cultural immersion", "Food journey"
    highlights: string[]
  }
}
```

## 5. Transportation Features

### Airport Transfers
- Automatic selection based on party size, luggage, time
- Options: Taxi, Uber, Shuttle, Train, Private transfer
- Includes buffer times for check-in/security
- Back-solves from flight time for departures

### Inter-Activity Transport
- Walking preferred under 1km (15 min)
- Public transport for 1-5km
- Taxi/Uber for >5km or time constraints
- Weather-aware (taxi in rain)
- Group-size aware

## 6. UI Components Needed

### 1. Friend Management Section
- Add friends by username/email
- Accept/decline requests
- View connected friends
- Show shared trip count

### 2. Trip Sharing Controls
- "Add Travelers" button in trip editor
- Friend dropdown (not email input)
- Permission selector
- Group member list with roles

### 3. Activity Cards Enhancement
- Photo carousel (2-3 images)
- Walking distance badge
- Transport method icon
- Weather suitability indicator
- "Save" heart icon
- Group saves counter ("2 friends saved")

### 4. Multi-City Builder
- Side-by-side comparison of 3 options
- Sliders for night redistribution
- Cost breakdown accordion
- Credit usage indicator
- "Book This Option" CTA

### 5. Daily Timeline View
- Weather header (temp, conditions, rain%)
- Transport between activities
- Walking distance accumulator
- Pace indicator
- Total daily cost

## 7. State Management

### New State Requirements
```typescript
interface AppState {
  // Existing...
  
  friends: {
    list: Friend[],
    pending: FriendRequest[],
    loading: boolean
  },
  
  tripSharing: {
    travelers: TripTraveler[],
    groupProfile: GroupProfile,
    permissions: Record<userId, Permission>
  },
  
  savedActivities: {
    byUser: Record<userId, Activity[]>,
    groupFavorites: GroupFavorite[]
  },
  
  multiCity: {
    options: MultiCityOption[],
    selected: string | null,
    adjustments: CityNightAdjustment[]
  }
}
```

## 8. Implementation Priority

### Phase 1: Core Enhancements (Week 1)
1. Display weather in day headers
2. Show activity photos and coordinates
3. Display walking distances
4. Show venue details (for restaurants)

### Phase 2: Friend System (Week 2)
1. Friend management in profile
2. Friend request flow
3. Basic trip sharing (add friends)
4. Permission display

### Phase 3: Advanced Features (Week 3)
1. Group activity favorites
2. Multi-city option display
3. Transportation details
4. Activity saving

## 9. Error Handling

### New Error Cases
- `FRIEND_REQUEST_EXISTS` - Already sent/received
- `NOT_FRIENDS` - Must be friends to share trip
- `INSUFFICIENT_CREDITS` - For multi-city booking
- `NO_TRANSPORT_AVAILABLE` - Fallback to taxi
- `WEATHER_UNAVAILABLE` - Show activities anyway

## 10. Performance Considerations

### Caching Strategy
- Cache weather data for 6 hours
- Cache photos indefinitely
- Cache transport options for 24 hours
- Cache friend lists until updated

### Loading States
- Skeleton for activity photos
- Shimmer for weather data
- Progressive transport details
- Optimistic friend updates

## Example Integration

### Fetching Enhanced Itinerary
```typescript
const generateItinerary = async (params) => {
  const response = await fetch('/api/v1/itinerary/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      destinationId: params.destinationId,
      startDate: params.startDate,
      endDate: params.endDate,
      travelers: params.travelers,
      preferences: {
        pace: params.pace,
        interests: params.interests,
        budget: params.budget,
        arrivalTime: params.flight?.arrival,
        departureTime: params.flight?.departure
      }
    })
  });
  
  const data = await response.json();
  
  // New data available:
  // - data.days[0].weather
  // - data.days[0].activities[0].photos
  // - data.days[0].activities[0].walkingDistance
  // - data.days[0].transportation.airport
  
  return data;
};
```

### Adding Friends to Trip
```typescript
const addTravelersToTrip = async (tripId, friendIds) => {
  // Get friends first
  const friends = await fetch('/api/v1/friends');
  const { connections } = await friends.json();
  
  // Validate all are friends
  const validFriends = friendIds.filter(id => 
    connections.some(f => f.userId === id)
  );
  
  // Add to trip
  const response = await fetch(`/api/v1/trips/${tripId}/travelers`, {
    method: 'POST',
    body: JSON.stringify({
      travelerIds: validFriends,
      permissions: 'edit'
    })
  });
  
  return response.json();
};
```

## Support

For questions about:
- Transportation logic → Check `transportation-api-service.ts`
- Activity selection → Check `activity-selector.ts`
- Friend system → Check `friend-trip-sharing-service.ts`
- Multi-city → Check `multi-city-option-builder.ts`

All error responses follow the pattern:
```json
{
  "error": "Human readable message",
  "code": "ERROR_CODE",
  "details": {}
}
```

Ready to build an amazing travel planning experience! 🚀