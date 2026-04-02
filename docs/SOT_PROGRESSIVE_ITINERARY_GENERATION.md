# SOT: Progressive Itinerary Generation System

**Source of Truth Document**  
**Feature:** Progressive Itinerary Generation  
**Version:** 1.0.0  
**Last Updated:** 2025-01-30  
**Status:** ACTIVE - In Production  

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [API Contract](#api-contract)
4. [Frontend Implementation](#frontend-implementation)
5. [Data Flow](#data-flow)
6. [State Management](#state-management)
7. [Error Handling](#error-handling)
8. [Testing Requirements](#testing-requirements)
9. [Performance Requirements](#performance-requirements)
10. [Migration Strategy](#migration-strategy)

---

## Overview

The Progressive Itinerary Generation system provides a smooth, real-time itinerary creation experience that shows progress through 4 distinct stages, eliminating blank loading screens and providing continuous user feedback.

### Key Features

- **4-Stage Generation Process**: Initialize → Template → Populate → Finalize
- **Real-time Progress**: Visual progress from 0% to 100%
- **Immediate Feedback**: Template appears at 50% completion
- **Error Resilience**: Graceful handling of failures with retry capability
- **Smart Caching**: Prevents redundant generation for existing itineraries

### User Experience Goals

1. **No Blank Screens**: Users see progress immediately upon page load
2. **Predictable Timing**: ~10-15 seconds total generation time
3. **Visual Feedback**: Progress bar and contextual messages
4. **Early Preview**: Skeleton/template visible at 50% completion

---

## System Architecture

### Component Hierarchy

```
TripItineraryPage
├── ItineraryGenerator (Main Container)
│   ├── ProgressBar (Visual progress indicator)
│   ├── LoadingAnimation (Stage-specific animations)
│   └── ItineraryDisplay (Content renderer)
│       ├── ItineraryDayCard
│       └── ActivityCard
```

### Service Layer

> **Note (2025-04):** The original `useProgressiveItinerary.ts` hook described below was removed as dead code.
> All production itinerary generation now goes through `TripDetail.tsx` → edge function `generate-itinerary`
> with `action: 'generate-trip'`, polled by `useGenerationPoller.ts`.

```
hooks/
├── useGenerationPoller.ts        # Polls trip status, detects stalls, triggers auto-resume
└── useLovableItinerary.ts        # Legacy generation hook
```

---

## API Contract

### Base Configuration

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://voyance-backend-production.up.railway.app';
const API_VERSION = '/api/v1';
```

### Endpoints

#### 1. Check Existing Itinerary

```typescript
GET /api/v1/trips/:tripId/itinerary

Response (200 - Exists):
{
  "success": true,
  "hasItinerary": true,
  "itinerary": {
    "id": "uuid",
    "tripId": "uuid",
    "days": [
      {
        "dayNumber": 1,
        "date": "2025-03-15",
        "title": "Arrival in Paris",
        "activities": [...]
      }
    ],
    "generatedAt": "2025-01-30T10:00:00Z",
    "status": "completed"
  }
}

Response (200 - Does Not Exist):
{
  "success": true,
  "hasItinerary": false,
  "itinerary": null
}

Response (404):
{
  "success": false,
  "error": "Itinerary not found",
  "message": "No itinerary exists for this trip"
}
```

#### 2. Progressive Generation

```typescript
POST /api/v1/trips/:tripId/itinerary/generate-progressive

Headers:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>"
}

Request Body:
{
  "step": "initialize" | "template" | "populate" | "finalize",
  "preferences": {
    "pace": "relaxed" | "moderate" | "packed",
    "interests": ["museums", "food", "nature", "adventure"],
    "budget": "budget" | "moderate" | "luxury",
    "accessibility": boolean,
    "familyFriendly": boolean
  }
}

Response (200):
{
  "success": true,
  "step": "template",
  "progress": 50,
  "message": "Building your personalized itinerary structure...",
  "data": {
    "tripId": "uuid",
    "destination": "Paris, France",
    "duration": 7,
    "travelers": 2,
    "template": {
      "days": [
        {
          "dayNumber": 1,
          "date": "2025-03-15",
          "title": "Day 1",
          "activities": []
        }
      ]
    }
  }
}
```

### Step-by-Step Progress

| Step | Progress | Returns | Description |
|------|----------|---------|-------------|
| `initialize` | 0% → 25% | Trip metadata | Validates trip, prepares generation |
| `template` | 25% → 50% | Empty day structure | Creates skeleton with dates/titles |
| `populate` | 50% → 75% | Partial activities | Adds AI-generated activities |
| `finalize` | 75% → 100% | Complete itinerary | Finalizes details, saves to DB |

---

## Frontend Implementation

### 1. API Service Layer

```typescript
// src/services/api/itineraryAPI.ts

import { apiClient } from '@/services/apiClient';

export interface ProgressiveGenerationRequest {
  step: 'initialize' | 'template' | 'populate' | 'finalize';
  preferences?: UserPreferences;
}

export interface ProgressiveGenerationResponse {
  success: boolean;
  step: string;
  progress: number;
  message: string;
  data: {
    tripId?: string;
    destination?: string;
    duration?: number;
    template?: ItineraryTemplate;
    itinerary?: Itinerary;
  };
}

export const itineraryAPI = {
  // Check for existing itinerary
  async getItinerary(tripId: string): Promise<Itinerary | null> {
    try {
      const response = await apiClient.get(
        `/trips/${tripId}/itinerary`
      );

      // Handle three possible states
      if (response.data.hasItinerary === false) {
        return null;
      }

      if (!response.data.itinerary?.days?.length) {
        return null;
      }

      return response.data.itinerary;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Generate progressively
  async generateProgressive(
    tripId: string,
    request: ProgressiveGenerationRequest
  ): Promise<ProgressiveGenerationResponse> {
    const response = await apiClient.post(
      `/trips/${tripId}/itinerary/generate-progressive`,
      request
    );
    return response.data;
  },

  // Full regeneration (legacy endpoint)
  async regenerateFull(
    tripId: string,
    preferences?: UserPreferences
  ): Promise<Itinerary> {
    const response = await apiClient.post(
      `/trips/${tripId}/itinerary/generate`,
      { preferences, regenerate: true }
    );
    return response.data.itinerary;
  }
};
```

### 2. React Hook Implementation

```typescript
// src/hooks/useProgressiveItinerary.ts

export interface ProgressiveItineraryState {
  // Core state
  loading: boolean;
  progress: number;
  currentStep: ProgressStep;
  message: string;
  itinerary: Itinerary | null;
  error: Error | null;
  
  // Metadata
  hasExistingItinerary: boolean;
  generationStartTime: number | null;
  generationDuration: number | null;
}

export function useProgressiveItinerary(tripId: string) {
  const [state, setState] = useState<ProgressiveItineraryState>({
    loading: false,
    progress: 0,
    currentStep: 'idle',
    message: '',
    itinerary: null,
    error: null,
    hasExistingItinerary: false,
    generationStartTime: null,
    generationDuration: null,
  });

  // Retry logic
  const retryCount = useRef(0);
  const MAX_RETRIES = 2;

  const executeStep = async (
    step: ProgressStep,
    preferences?: UserPreferences
  ): Promise<ProgressiveGenerationResponse> => {
    try {
      return await itineraryAPI.generateProgressive(tripId, {
        step,
        preferences,
      });
    } catch (error) {
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        await delay(1000 * retryCount.current); // Exponential backoff
        return executeStep(step, preferences);
      }
      throw error;
    }
  };

  const generateProgressive = useCallback(async (preferences?: UserPreferences) => {
    const startTime = Date.now();
    setState(prev => ({
      ...prev,
      loading: true,
      progress: 0,
      error: null,
      generationStartTime: startTime,
    }));

    try {
      // Step 1: Initialize (0% → 25%)
      const step1 = await executeStep('initialize', preferences);
      setState(prev => ({
        ...prev,
        progress: step1.progress,
        currentStep: 'initialize',
        message: step1.message,
      }));

      await delay(500); // UX delay

      // Step 2: Template (25% → 50%)
      const step2 = await executeStep('template', preferences);
      setState(prev => ({
        ...prev,
        progress: step2.progress,
        currentStep: 'template',
        message: step2.message,
        itinerary: step2.data.template || prev.itinerary,
      }));

      await delay(500);

      // Step 3: Populate (50% → 75%)
      const step3 = await executeStep('populate', preferences);
      setState(prev => ({
        ...prev,
        progress: step3.progress,
        currentStep: 'populate',
        message: step3.message,
        itinerary: step3.data.itinerary || prev.itinerary,
      }));

      await delay(500);

      // Step 4: Finalize (75% → 100%)
      const step4 = await executeStep('finalize', preferences);
      const duration = Date.now() - startTime;
      
      setState(prev => ({
        ...prev,
        progress: step4.progress,
        currentStep: 'finalize',
        message: step4.message,
        itinerary: step4.data.itinerary,
        loading: false,
        generationDuration: duration,
      }));

      // Analytics
      trackEvent('itinerary_generation_complete', {
        tripId,
        duration,
        preferences,
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Generation failed'),
      }));

      trackEvent('itinerary_generation_failed', {
        tripId,
        error: error.message,
        step: state.currentStep,
      });
    }
  }, [tripId]);

  return {
    ...state,
    generateProgressive,
    checkExisting,
    regenerateFull,
    clearError: () => setState(prev => ({ ...prev, error: null })),
  };
}
```

### 3. Component Implementation

```typescript
// src/components/itinerary/ItineraryGenerator.tsx

interface ItineraryGeneratorProps {
  tripId: string;
  trip: Trip;
  onComplete?: (itinerary: Itinerary) => void;
}

export function ItineraryGenerator({ 
  tripId, 
  trip,
  onComplete 
}: ItineraryGeneratorProps) {
  const {
    loading,
    progress,
    message,
    itinerary,
    error,
    hasExistingItinerary,
    generateProgressive,
    checkExisting,
    regenerateFull,
    clearError,
  } = useProgressiveItinerary(tripId);

  const { userPreferences } = useUserPreferences();
  const isMounted = useRef(true);

  // Initialize on mount
  useEffect(() => {
    if (!isMounted.current) return;

    async function initialize() {
      const exists = await checkExisting();
      
      if (!exists && trip.status === 'booked') {
        await generateProgressive(userPreferences);
      }
    }

    initialize();

    return () => {
      isMounted.current = false;
    };
  }, [tripId]);

  // Render logic with all states handled
  if (error) {
    return <ItineraryError error={error} onRetry={() => {
      clearError();
      generateProgressive(userPreferences);
    }} />;
  }

  if (loading && !itinerary) {
    return <ItineraryLoading progress={progress} message={message} />;
  }

  if (loading && itinerary) {
    return <ItineraryPartial itinerary={itinerary} progress={progress} message={message} />;
  }

  if (itinerary) {
    return <ItineraryComplete 
      itinerary={itinerary} 
      onRegenerate={() => regenerateFull(userPreferences)} 
    />;
  }

  return <ItineraryEmpty onGenerate={() => generateProgressive(userPreferences)} />;
}
```

---

## Data Flow

### Generation Flow Diagram

```
User Action (Page Load / Generate Button)
    ↓
Check Existing Itinerary
    ↓
[Exists?] → Yes → Display Immediately
    ↓ No
Start Progressive Generation
    ↓
Step 1: Initialize (0-25%)
    - Validate trip data
    - Set up generation context
    - Return metadata
    ↓
Step 2: Template (25-50%)
    - Create day structure
    - Add dates and titles
    - Return skeleton → [Display Template]
    ↓
Step 3: Populate (50-75%)
    - AI generates activities
    - Add to template
    - Return partial → [Update Display]
    ↓
Step 4: Finalize (75-100%)
    - Complete details
    - Save to database
    - Return full → [Display Complete]
```

---

## State Management

### Local Component State

```typescript
interface ItineraryState {
  // Generation State
  loading: boolean;
  progress: number; // 0-100
  currentStep: 'idle' | 'initialize' | 'template' | 'populate' | 'finalize';
  message: string;
  
  // Data State
  itinerary: Itinerary | null;
  template: ItineraryTemplate | null;
  
  // Error State
  error: Error | null;
  retryCount: number;
  
  // Metadata
  hasExistingItinerary: boolean;
  lastGeneratedAt: Date | null;
  generationDuration: number | null;
}
```

### Context Integration

```typescript
// Optional: Share state across components
const ItineraryContext = createContext<{
  itineraries: Map<string, Itinerary>;
  activeItinerary: Itinerary | null;
  generateItinerary: (tripId: string) => Promise<void>;
  clearItinerary: (tripId: string) => void;
}>({
  itineraries: new Map(),
  activeItinerary: null,
  generateItinerary: async () => {},
  clearItinerary: () => {},
});
```

---

## Error Handling

### Error Types and Responses

| Error Type | User Message | Recovery Action |
|------------|--------------|-----------------|
| Network Error | "Connection issue. Please check your internet." | Retry with exponential backoff |
| 401 Unauthorized | "Please log in to continue." | Redirect to login |
| 404 Not Found | "Trip not found. Please refresh." | Redirect to trips list |
| 429 Rate Limited | "Too many requests. Please wait." | Show countdown timer |
| 500 Server Error | "Something went wrong. Please try again." | Retry button |
| Generation Timeout | "Taking longer than expected..." | Continue polling or retry |

### Error Recovery Strategy

```typescript
const errorRecovery = {
  network: {
    maxRetries: 3,
    backoffMs: [1000, 2000, 4000],
    userAction: 'retry',
  },
  auth: {
    maxRetries: 1,
    backoffMs: [0],
    userAction: 'login',
  },
  server: {
    maxRetries: 2,
    backoffMs: [2000, 5000],
    userAction: 'retry',
  },
  timeout: {
    maxRetries: 1,
    backoffMs: [5000],
    userAction: 'regenerate',
  },
};
```

---

## Testing Requirements

### Unit Tests

```typescript
describe('useProgressiveItinerary', () => {
  it('should handle complete generation flow', async () => {
    // Test all 4 steps complete successfully
  });

  it('should handle existing itinerary', async () => {
    // Test immediate display of existing data
  });

  it('should handle network errors with retry', async () => {
    // Test retry logic and error display
  });

  it('should handle partial generation failure', async () => {
    // Test failure at step 3, recovery options
  });
});
```

### Integration Tests

```typescript
describe('ItineraryGenerator Integration', () => {
  it('should generate new itinerary for booked trip', async () => {
    // Full E2E test with mocked API
  });

  it('should display existing itinerary without generation', async () => {
    // Test cache hit scenario
  });

  it('should regenerate on user request', async () => {
    // Test manual regeneration flow
  });
});
```

### E2E Test Scenarios

1. **New User First Itinerary**
   - Book trip → Land on page → See generation → View complete itinerary

2. **Returning User**
   - Navigate to existing trip → See immediate display → No loading

3. **Error Recovery**
   - Simulate network failure → See error → Click retry → Success

4. **Regeneration Flow**
   - View existing → Click regenerate → See progress → New itinerary

---

## Performance Requirements

### Target Metrics

| Metric | Target | Maximum |
|--------|--------|---------|
| Time to First Byte (TTFB) | < 200ms | 500ms |
| Time to Template (50%) | < 3s | 5s |
| Time to Complete (100%) | < 10s | 15s |
| API Response Time (per step) | < 2s | 3s |
| UI Update Frequency | 60 FPS | 30 FPS |

### Optimization Strategies

1. **Caching**
   ```typescript
   // In-memory cache with TTL
   const cache = new Map<string, { data: Itinerary; expires: number }>();
   
   function getCached(tripId: string): Itinerary | null {
     const cached = cache.get(tripId);
     if (cached && cached.expires > Date.now()) {
       return cached.data;
     }
     return null;
   }
   ```

2. **Preloading**
   ```typescript
   // Preload when hovering trip card
   function preloadItinerary(tripId: string) {
     if (!cache.has(tripId)) {
       itineraryAPI.getItinerary(tripId).catch(() => {});
     }
   }
   ```

3. **Progressive Enhancement**
   ```typescript
   // Load critical path first
   const CriticalItinerary = lazy(() => 
     import(/* webpackPreload: true */ './ItineraryDisplay')
   );
   
   // Load enhancements later
   const ItineraryExtras = lazy(() => 
     import(/* webpackPrefetch: true */ './ItineraryExtras')
   );
   ```

---

## Migration Strategy

### From Legacy to Progressive

1. **Phase 1: Parallel Implementation** (Current)
   - Keep legacy endpoints active
   - Implement progressive alongside
   - Feature flag for testing

2. **Phase 2: Gradual Rollout**
   ```typescript
   const useProgressiveGeneration = () => {
     const { flags } = useFeatureFlags();
     return flags.progressiveItinerary?.enabled ?? false;
   };
   ```

3. **Phase 3: Full Migration**
   - Monitor error rates
   - Migrate all users
   - Deprecate legacy endpoints

### Rollback Plan

```typescript
// Quick rollback via feature flag
if (!features.progressiveItinerary || errorRate > 0.05) {
  return useLegacyItinerary(tripId);
}
```

---

## Monitoring and Analytics

### Key Metrics to Track

```typescript
// Track generation performance
trackEvent('itinerary_generation_step', {
  tripId,
  step,
  duration: Date.now() - stepStartTime,
  progress,
});

// Track user experience
trackEvent('itinerary_user_action', {
  action: 'regenerate' | 'edit' | 'share',
  hasExistingItinerary,
  generationMethod: 'progressive' | 'legacy',
});

// Track errors
trackEvent('itinerary_error', {
  errorType,
  step,
  retryCount,
  recovered: boolean,
});
```

---

## Appendix

### Type Definitions

```typescript
// Complete TypeScript interfaces
interface Itinerary {
  id: string;
  tripId: string;
  days: ItineraryDay[];
  generatedAt: string;
  lastModified: string;
  status: 'draft' | 'completed' | 'archived';
  preferences: UserPreferences;
}

interface ItineraryDay {
  dayNumber: number;
  date: string;
  title: string;
  description?: string;
  activities: Activity[];
  notes?: string;
}

interface Activity {
  id: string;
  time: string;
  duration: number;
  type: ActivityType;
  title: string;
  description: string;
  location?: Location;
  cost?: Cost;
  booking?: BookingInfo;
  tags: string[];
}

type ActivityType = 
  | 'flight' 
  | 'accommodation' 
  | 'dining' 
  | 'sightseeing' 
  | 'transport' 
  | 'activity' 
  | 'free-time';

interface UserPreferences {
  pace: 'relaxed' | 'moderate' | 'packed';
  interests: string[];
  budget: 'budget' | 'moderate' | 'luxury';
  accessibility?: boolean;
  familyFriendly?: boolean;
  dietaryRestrictions?: string[];
}
```

### API Response Examples

See [API Contract Section](#api-contract) for detailed examples.

### Related Documentation

- [Itinerary SOT Index](./ITINERARY_SOT_INDEX.md)
- [API Contract v1.0](../api/ITINERARY_CONTRACT_v1.0.md)
- [Backend Requirements](../ITINERARY_BACKEND_REQUIREMENTS.md)
- [Trip Planner Index](./TRIP_PLANNER_INDEX.md)

---

**Document Status:** ACTIVE  
**Maintained By:** Frontend Team  
**Review Schedule:** Monthly  
**Last Review:** 2025-01-30