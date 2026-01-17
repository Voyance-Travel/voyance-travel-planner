# Quiz Data Flow - SOURCE OF TRUTH

Date: 2025-08-03

This document is the definitive source of truth for the quiz data flow in the Voyance backend system.

# Quiz Data Flow - Simple Overview

## STEP 1: User Creates Account

- User fills out registration form
- Data goes to: **users** table
- Fields populated: email, first_name, last_name, handle, loyalty_tier (bronze), display_name
- Default values: test_user = false

## STEP 2: User Starts Quiz

- User clicks "Take Quiz"
- Frontend calls: **POST /api/v1/auth/quiz/start** (REQUIRES JWT Authentication)
- Data goes to: **quiz_sessions** table (PostgreSQL, not Redis)
- Creates new session with: user_id, quiz_version (v3), started_at, status = "in_progress"
- Tracks: current_step, total_steps (11), completion_percentage, user_agent, ip_address, device_type, browser_name

## STEP 3: User Answers Questions (Per Section)

- After completing each section (not every click)
- Frontend calls: **POST /api/v1/auth/quiz/save-step** with section answers (REQUIRES JWT Authentication)
- Data goes to: **quiz_responses** table
- Records: user_id, session_id, quiz_version, field_id, field_type, answer_value, display_label, step_id, question_prompt, response_order
- Also updates: **quiz_sessions** table with current_step, completion_percentage, questions_answered, last_activity_at
- Returns: percentage complete, canContinue flag, progress data, and other fields

## STEP 4: Quiz Completion (Final Step)

- User completes final section (4 sections total in QuizFinal mapped to steps within 1-11 range)
- Frontend calls: **POST /api/quiz/finalize-profile** with sessionId (REQUIRES JWT Authentication header)
- Updates: **quiz_sessions** table - status = "completed", completion_percentage = 100%, is_complete = true, completed_at timestamp
- Backend automatically starts Travel DNA calculation (no separate signal needed)

## STEP 5: Travel DNA Calculation (Backend Process)

- System reads all responses from **quiz_responses** table using session_id
- Processes field_id + answer_value pairs to understand user preferences
- Groups responses by step_id and analyzes answer patterns
- Runs heuristic formulas to calculate travel personality based on field_type and answer_value combinations
- Generates: primary DNA type, secondary type, confidence scores, traits, emotional drivers
- Creates comprehensive travel profile based on structured quiz answers

## STEP 6: Save Travel DNA Results

- Calculated results go to: **travel_dna_profiles** table
- Records: user_id, quiz_session_id, travel_dna_data (JSON), confidence_score
- Also saves to: **travel_dna_history** table (for tracking changes over time)
- Updates: **users** table with quiz_completed_at timestamp and primary travel DNA

## STEP 7: Distribute Data to Preference Tables

Based on quiz answers, system populates these 8 tables:

**user_core_preferences** - Budget range, travel style, group size preferences
**user_emotional_signature** - Emotional profile, intensity scores, confidence levels  
**user_flight_preferences** - Home airport, preferred airlines, cabin class, layover preferences
**user_food_preferences** - Dietary restrictions, cuisine likes/dislikes, spice tolerance
**user_travel_profile** - Activity level, comfort with new experiences, planning style, risk tolerance
**user_contextual_overrides** - Weather preferences, climate preferences, location priorities
**user_mobility_accessibility** - Accessibility needs (populated with default values)
**travel_dna_profiles** - Travel DNA calculation results

## STEP 8: Profile Ready for User

- Frontend displays complete travel profile using data from all preference tables
- User can view their travel DNA results and personality breakdown
- User can edit preferences on profile page (updates go back to preference tables)
- User can retake quiz anytime - creates new entries in travel_dna_history

---

## Key Data Flow Summary

**Main Flow:**
quiz_responses → travel DNA calculation → travel_dna_profiles → distribute to all preference tables

**What Gets Auto-Filled from Quiz:**

- Budget preferences
- Travel style and pace
- Activity level preferences
- Food preferences and dietary restrictions
- Flight preferences (home airport, etc.)
- Weather and climate preferences
- Emotional travel drivers
- Risk tolerance and planning style

**What's Left Empty for Profile Page:**

- Trip duration preferences
- Communication style preferences
- Override sensitivity settings (has defaults)
- Detailed accessibility needs
- Sacrifice thresholds (has defaults)

**Retake Flow:**
User retakes quiz → new quiz_responses → new travel_dna_profiles → update all preference tables → old profile saved in travel_dna_history

## Table Relationships (Simple)

- One user has one active travel DNA profile
- One user has many quiz sessions (if they retake)
- One quiz session has many quiz responses (one per field answered)
- One user has one record in each preference table
- One user can have many contextual overrides
- One user has many travel DNA history records (tracks changes)

---

## Important Backend Implementation Notes

### Authentication Requirements

**ALL quiz endpoints require JWT authentication**, regardless of their path prefix:
- `/api/v1/auth/quiz/*` endpoints require JWT despite the `/auth/` prefix
- `/api/quiz/*` endpoints also require JWT
- The `/auth/` prefix is a naming convention, not a security pattern

### Flexible Field Naming

The backend intentionally accepts multiple field name variations for compatibility:
- Session ID fields: `sessionId`, `quizSessionId`, `session_id` (all accepted)
- This flexibility supports different frontend versions
- Preferred naming: `quizSessionId` for save-step, `sessionId` for finalize-profile

### Step Numbering System

- Backend internally tracks **11 total steps** for all quiz types
- QuizFinal with 4 sections maps to steps within the 1-11 range
- Completion percentage always calculated as: `(stepNumber / 11) * 100`
- This ensures consistent progress tracking across different quiz formats

---

## Detailed Quiz Response Structure

**quiz_responses table captures:**

- **field_id**: Unique identifier for each quiz field/question
- **field_type**: Type of question (multiple choice, scale, text, etc.)
- **answer_value**: The actual answer the user selected
- **display_label**: Human readable label for the answer
- **step_id**: Which step of the quiz this belongs to
- **question_prompt**: The actual question text shown to user
- **response_order**: Order of response within the step
- **quiz_version**: Tracks quiz version (currently v3)

**quiz_sessions table tracks:**

- **current_step**: Where user is in quiz (1-11)
- **total_steps**: Always 11 for complete quiz
- **completion_percentage**: Real-time progress tracking
- **questions_answered**: Count of fields completed
- **is_complete**: Boolean flag when quiz is done
- **user_agent**, **ip_address**, **device_type**, **browser_name**: Technical tracking
- **started_at**, **completed_at**, **last_activity_at**: Timing data

---

## IMPORTANT: Use This Document

When working on quiz-related features, always refer to this document for:

1. The exact table names and relationships
2. The correct data flow sequence
3. Which tables store which information
4. How data moves through the system

This supersedes any conflicting documentation.

---

## Frontend Component Mapping

This section provides the definitive mapping between frontend quiz components and backend data flow for complete system alignment.

### Frontend Quiz Architecture Overview

**Primary Implementation**: `quiz-final.tsx` (Production)  
**Secondary Implementation**: `DreamQuiz.tsx` (Comprehensive, 11 steps)  
**Total Components**: 35+ quiz-specific components  
**State Management**: QuizContext + Local component state  
**Form Libraries**: react-hook-form (DreamQuiz), direct state (QuizFinal)

### Quiz Implementation Comparison

| Feature                 | QuizFinal (Production)          | DreamQuiz (Comprehensive)       |
| ----------------------- | ------------------------------- | ------------------------------- |
| **Sections/Steps**      | 4 sections                      | 11 steps                        |
| **Form Management**     | useState with manual validation | react-hook-form with Zod        |
| **Progress Saving**     | Manual save after each section  | Auto-save after each step       |
| **Validation**          | Section-level validation        | Field-level + schema validation |
| **State Persistence**   | Backend session + localStorage  | Backend session + form state    |
| **Component Structure** | Monolithic with inline sections | Modular step components         |

### Core Component Architecture

#### Entry Points

```
src/pages/
├── quiz.tsx                 → Re-exports quiz-final (main entry)
├── quiz-final.tsx          → Production quiz (4 sections)
├── quiz-wrapper.tsx        → DreamQuiz wrapper (deprecated)
└── quiz-reveal.tsx         → DNA reveal page after completion
```

#### Question Component Types

| Component Type    | Usage                         | Database Mapping     | Examples                          |
| ----------------- | ----------------------------- | -------------------- | --------------------------------- |
| `QuizCard`        | Single selection cards        | Direct field mapping | travelerType → archetype_name     |
| `MultiSelect`     | Multiple selections           | JSON array storage   | emotional_drivers → JSON field    |
| `InterestSlider`  | Rating scales (0-100)         | Numeric values       | activity_interests → scores       |
| `Select Dropdown` | Single from many options      | Direct field mapping | aesthetic_bias → style_preference |
| `Radio Groups`    | Binary/small set choices      | Enum values          | daytime_bias → preferred_time     |
| `Checkbox Groups` | Multiple unlimited selections | JSON arrays          | dietary_needs → restrictions      |
| `Range Sliders`   | Numeric value selection       | Integer/decimal      | luxury_tolerance → 1-10 scale     |
| `Text Input`      | Open-ended responses          | Text fields          | special_requests → notes          |

### Quiz Section to Database Flow

#### Section 1: Emotional Core

**Frontend Fields** → **Backend Storage**:

```typescript
{
  primary_goal: 'explore' → user_emotional_signature.primary_goal
  emotional_drivers: ['discovery', 'culture'] → user_emotional_signature.emotional_drivers (JSON)
  emotional_triggers: ['crowds'] → user_emotional_signature.emotional_triggers (JSON)
  peak_emotional_state: 'energized' → user_emotional_signature.emotional_recovery
}
```

**Quiz Response Records**:

```sql
INSERT INTO quiz_responses (user_id, session_id, field_id, answer_value, step_id)
VALUES
(?, ?, '1.2_primary_goal', 'explore', 1),
(?, ?, '1.3_emotional_drivers', '["discovery","culture"]', 1),
(?, ?, '1.4_emotional_triggers', '["crowds"]', 1);
```

#### Section 2: Sensory & Style

**Frontend Fields** → **Backend Storage**:

```typescript
{
  aesthetic_bias: 'authentic' → user_aesthetic_preferences.style_preference
  luxury_tolerance: 6 → user_core_preferences.luxury_level
  hotel_class_floor: 7 → user_core_preferences.accommodation_style
  taste_graph: {spicy: 85, sweet: 40} → user_food_preferences.taste_preferences (JSON)
  meal_cost_ceiling: 50 → user_core_preferences.budget_tier
  visual_plating_bias: 8 → user_food_preferences.presentation_importance
}
```

#### Section 3: Rhythm & Structure

**Frontend Fields** → **Backend Storage**:

```typescript
{
  trip_structure_preference: 'flexible' → user_core_preferences.planning_style
  pace_identity: 'moderate_explorer' → user_core_preferences.travel_pace
  daytime_bias: 'morning' → user_contextual_overrides.preferred_time
  override_sensitivity: 'medium' → user_contextual_overrides.flexibility_level
  sacrifice_threshold: 'medium' → user_core_preferences.compromise_tolerance
}
```

#### Section 4: Practical Reality

**Frontend Fields** → **Backend Storage**:

```typescript
{
  dietary_needs: ['vegetarian'] → user_food_preferences.dietary_restrictions (JSON)
  mobility_flags: [] → user_mobility_accessibility.accessibility_needs (JSON)
  loyalty_programs: {airlines: ['Delta']} → user_flight_preferences.airline_loyalty (JSON)
  value_alignment_style: 'value_conscious' → user_core_preferences.spending_philosophy
  budget_compromise_index: 7 → user_core_preferences.budget_flexibility
  carry_vs_check: 'both' → user_flight_preferences.luggage_preference
  group_control_preference: 'collaborate' → user_contextual_overrides.leadership_style
}
```

### API Endpoint Integration

#### Current Frontend API Calls

```typescript
// QuizFinal Implementation - ACTUAL ENDPOINTS (ALL REQUIRE JWT)
POST /api/v1/auth/quiz/start           // Start session (requires JWT)
POST /api/v1/auth/quiz/save-step       // Save quiz responses (requires JWT)
POST /api/quiz/finalize-profile        // Submit complete quiz and generate DNA (requires JWT)
GET /api/v1/auth/quiz/progress         // Get quiz progress (requires JWT)
POST /api/v1/auth/quiz-complete        // Legacy submission format
POST /api/quiz/submit-v2               // Field-based submission (alternative)

// Additional Available Endpoints
GET /api/quiz/travel-dna               // Get travel DNA results
GET /api/quiz/sessions                 // Get user's quiz sessions
GET /api/quiz/answers                  // Get quiz answers
GET /api/quiz/data                     // Get comprehensive quiz data
GET /api/quiz/finalize-status/:sessionId // Check finalization status
```

#### API Request/Response Mapping

**Step Save Request**:

```typescript
// Frontend → Backend
POST /api/v1/auth/quiz/save-step
Headers: {
  Authorization: "Bearer <jwt_token>"  // REQUIRED
}
Body: {
  // Backend accepts ALL of these field names:
  quizSessionId: "quiz_sess_abc123",  // Preferred
  session_id: "quiz_sess_abc123",     // Also accepted
  sessionId: "quiz_sess_abc123",      // Also accepted
  
  stepNumber: 1,  // Passed in body
  // Supports multiple formats:

  // Format 1: Frontend "responses" array
  responses: [
    { field: "primary_goal", answer: "explore" },
    { field: "emotional_drivers", answer: ["discovery", "culture"] }
  ]

  // Format 2: Direct fields (also supported)
  fields: [
    { field_id: "1.2_primary_goal", answer_value: "explore" },
    { field_id: "1.3_emotional_drivers", answer_value: ["discovery", "culture"] }
  ]
}

// Backend Processing
quiz_responses records created:
- field_id: "1.2_primary_goal", answer_value: "explore"
- field_id: "1.3_emotional_drivers", answer_value: '["discovery","culture"]'

quiz_sessions updated:
- current_step: 1, completion_percentage: 9 (1/11 * 100), questions_answered: 2
```

**Step Save Response**:

```typescript
// Backend → Frontend
{
  success: true,
  message: "Quiz progress saved",
  quizSessionId: "quiz_sess_abc123",
  stepNumber: 1,
  answersSaved: 2,
  percentage: 9,            // Always included
  canContinue: true,        // Always included  
  questionsAnswered: 2,     // Always included
  isLastStep: false         // true when stepNumber === 11
}
```

**Final Submission Request**:

```typescript
// Frontend → Backend
POST /api/quiz/finalize-profile
Headers: {
  Authorization: "Bearer <jwt_token>"  // REQUIRED
}
Body: {
  // Backend accepts both:
  sessionId: "quiz_sess_abc123",     // Preferred  
  session_id: "quiz_sess_abc123",    // Also accepted
  // Optional - backend can fetch from session if not provided
}

// Backend Processing Flow:
1. Validate all required fields present
2. Mark quiz_sessions as complete
3. Calculate Travel DNA from responses
4. Populate travel_dna_profiles table
5. Distribute data to 8 enrichment tables
6. Update users.quizCompleted timestamp
7. Return Travel DNA results
```

### State Management Integration

#### QuizContext (Global State)

```typescript
interface QuizSession {
  sessionId: string | null; // Maps to quiz_sessions.id
  currentStep: number; // Maps to quiz_sessions.current_step
  percentage: number; // Maps to quiz_sessions.completion_percentage
  questionsAnswered: number; // Maps to quiz_sessions.questions_answered
  canContinue: boolean; // Derived from backend validation
}
```

#### Component State (QuizFinal)

```typescript
const [answers, setAnswers] = useState<TravelDNAAnswers>({
  // Section 1: Emotional Core
  primary_goal?: string;
  emotional_drivers?: string[];
  emotional_triggers?: string[];
  peak_emotional_state?: string;

  // Section 2: Sensory & Style
  aesthetic_bias?: string;
  luxury_tolerance?: number;
  hotel_class_floor?: number;
  design_fidelity_index?: number;
  taste_graph?: Record<string, number>;

  // Section 3: Rhythm & Structure
  trip_structure_preference?: string;
  pace_identity?: string;
  daytime_bias?: string;
  override_sensitivity?: string;

  // Section 4: Practical Reality
  dietary_needs?: string[];
  mobility_flags?: string[];
  loyalty_programs?: object;
  value_alignment_style?: string;
  budget_compromise_index?: number;
});
```

### Data Transformation Pipeline

#### Frontend Collection → Backend Processing

```typescript
// 1. Frontend collects answers
updateAnswer('primary_goal', 'explore');
updateAnswer('emotional_drivers', ['discovery', 'culture']);

// 2. Section completion triggers save
POST /api/v1/auth/quiz/save-step {
  quizSessionId: "quiz_sess_abc123",
  stepNumber: 1,
  answers: { primary_goal: 'explore', emotional_drivers: ['discovery', 'culture'] }
}

// 3. Backend creates quiz_responses records
INSERT INTO quiz_responses
VALUES ('1.2_primary_goal', 'explore', 1, ...),
       ('1.3_emotional_drivers', '["discovery","culture"]', 1, ...);

// 4. Final submission triggers enrichment
POST /api/quiz/finalize-profile { sessionId: "quiz_sess_abc123" }

// 5. Backend processes into enrichment tables
INSERT INTO user_emotional_signature (user_id, primary_goal, emotional_drivers)
VALUES (?, 'explore', '["discovery","culture"]'::jsonb);

// 6. Travel DNA calculation
CALL calculate_travel_dna(?); // Generates personality profile

// 7. Return complete profile to frontend
{
  travelDNA: { primary: "Explorer", secondary: "Culture Seeker", ... },
  enrichmentComplete: true
}
```

### Question Field Mapping Reference

#### Complete Field → Table Mapping

| Frontend Field              | Database Table             | Column               | Data Type | Transformation   |
| --------------------------- | -------------------------- | -------------------- | --------- | ---------------- |
| `primary_goal`              | user_emotional_signature   | primary_goal         | text      | Direct           |
| `emotional_drivers`         | user_emotional_signature   | emotional_drivers    | jsonb     | JSON.stringify() |
| `aesthetic_bias`            | user_aesthetic_preferences | style_preference     | text      | Direct           |
| `luxury_tolerance`          | user_core_preferences      | luxury_level         | integer   | Direct           |
| `taste_graph`               | user_food_preferences      | taste_preferences    | jsonb     | JSON.stringify() |
| `trip_structure_preference` | user_core_preferences      | planning_style       | text      | Direct           |
| `dietary_needs`             | user_food_preferences      | dietary_restrictions | jsonb     | JSON.stringify() |
| `loyalty_programs`          | user_flight_preferences    | airline_loyalty      | jsonb     | JSON.stringify() |
| `budget_compromise_index`   | user_core_preferences      | budget_flexibility   | integer   | Direct           |

### Error Handling Integration

#### Frontend Error States → Backend Error Codes

```typescript
// Authentication Errors
401 AUTH_REQUIRED → Redirect to login
401 AUTH_TOKEN_INVALID → Refresh token
401 AUTH_TOKEN_MISSING → Include Authorization header

// Session Errors
400 SESSION_NOT_FOUND → Start new session
409 SESSION_EXPIRED → Restore from localStorage

// Validation Errors
422 VALIDATION_ERROR → Show field-specific errors
400 INCOMPLETE_QUIZ → Highlight missing required fields

// Submission Errors
409 QUIZ_ALREADY_COMPLETE → Navigate to profile
500 DNA_GENERATION_FAILED → Retry submission
```

#### Error Recovery Patterns

```typescript
// Session Recovery
const handleSessionExpired = async () => {
  // Start new session
  const newSession = await quizAPI.startQuizSession();

  // Restore progress from localStorage
  const backup = localStorage.getItem("quiz_answers_backup");
  if (backup) {
    const { answers, completedSections } = JSON.parse(backup);

    // Re-save completed sections to new session
    for (const sectionId of completedSections) {
      await quizAPI.saveStepAnswers(sectionId, getSectionAnswers(sectionId));
    }
  }
};
```

### Performance Optimizations

#### Debounced Saves

```typescript
// Auto-save to localStorage (fallback)
const debouncedLocalSave = useMemo(
  () =>
    debounce((data: TravelDNAAnswers) => {
      localStorage.setItem(
        "quiz_answers_backup",
        JSON.stringify({
          answers: data,
          timestamp: Date.now(),
          sessionId: quizSessionId,
        }),
      );
    }, 1000),
  [],
);
```

#### Parallel Submission

```typescript
// Submit to both V2 and legacy endpoints
const submitQuiz = async () => {
  const [v2Result, legacyResult] = await Promise.allSettled([
    quizAPI.submitQuizV2(answers, sessionId),
    quizAPI.completeQuiz(transformToLegacy(answers), sessionId),
  ]);

  // Prefer V2, fallback to legacy
  return v2Result.status === "fulfilled" ? v2Result.value : legacyResult.value;
};
```

### Mobile Responsiveness

#### Component Adaptations

```typescript
// Responsive breakpoints
Mobile (< 768px): Single column, touch-friendly
Tablet (768px - 1024px): Adjusted grids
Desktop (> 1024px): Multi-column layout

// Touch interactions
QuizCard: Min 80px height, full-width tappable
MultiSelect: 44px minimum touch targets
Sliders: 32px enlarged thumbs
Progress: Bottom-fixed navigation
```

### Testing Integration

#### Mock Backend Responses

```typescript
// Mock session start
const mockStartSession = () => ({
  success: true,
  data: {
    sessionId: "quiz_sess_test_123",
    userId: "test_user_456",
  },
});

// Mock step save
const mockSaveStep = (stepData: any) => ({
  success: true,
  data: {
    saved: true,
    quizSessionId: stepData.quizSessionId,
    stepNumber: stepData.stepNumber,
    answersSaved: 5,
    percentage: stepData.stepNumber * 9,  // Approx 9% per step
    questionsAnswered: stepData.stepNumber * 4,
    canContinue: true,
    isLastStep: stepData.stepNumber === 11
  },
});
```

### Production Readiness Checklist

#### ✅ Ready for Production

- QuizFinal component with 4-section flow
- Backend session management with PostgreSQL (NOT Redis)
- Error recovery with localStorage fallback
- Responsive design for all devices
- Multiple save format support in save-step endpoint
- Comprehensive Travel DNA generation
- Flexible field naming for compatibility
- All endpoints require JWT authentication

#### 📝 Backend Implementation Notes

- Session management uses PostgreSQL `quiz_sessions` table, not Redis
- Save-step endpoint supports multiple request formats for flexibility
- Travel DNA calculation happens automatically on finalize
- Enrichment populates 8 tables total
- Legacy endpoints maintained for backward compatibility
- Backend accepts flexible field naming (sessionId, session_id, quizSessionId)
- Progress tracking based on 11-step system internally
- All quiz endpoints require JWT authentication regardless of path prefix

#### 🔄 Continuous Improvements

- Enhanced error boundary implementation
- Advanced analytics integration
- A/B testing framework for questions
- Performance monitoring and optimization

---

**Last Updated**: August 3, 2025  
**API Version**: v1  
**Endpoints**: 6 primary + legacy support  
**Average Response Time**: < 200ms  
**Session TTL**: 60 minutes (extendable)  
**Authentication**: ALL endpoints require JWT

---

## ⚠️ CRITICAL: API Configuration Requirements

### Backend API Domain Requirement
**ALL quiz API calls MUST be made to the BACKEND server domain, NOT the frontend domain.**

❌ **INCORRECT** (calling frontend domain - causes 404 errors):
```javascript
// This calls your Vercel/Netlify frontend, not the backend!
fetch('https://voyance-frontend-xyz.vercel.app/api/quiz/finalize-profile', ...)
fetch('/api/quiz/finalize-profile', ...)  // Relative URLs resolve to frontend domain
```

✅ **CORRECT** (calling backend domain):
```javascript
// This calls the actual backend API
fetch(`${process.env.VITE_API_URL}/api/quiz/finalize-profile`, ...)
```

### Environment Variable Required

**Development** (`.env`):
```bash
VITE_API_URL=http://localhost:3002
```

**Production** (`.env` or deployment config):
```bash
VITE_API_URL=https://voyance-backend-production.up.railway.app
```

### API Client Configuration

Update your API client/axios configuration to use the backend domain:

```typescript
// src/services/api.ts or similar
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor - JWT required for ALL quiz endpoints
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Quiz Endpoint URLs (Backend Domain Only)

All these endpoints require the backend domain + JWT authentication:

```typescript
// Quiz Flow - ALL require Authorization: Bearer <token>
POST ${API_BASE_URL}/api/v1/auth/quiz/start
POST ${API_BASE_URL}/api/v1/auth/quiz/save-step
POST ${API_BASE_URL}/api/quiz/finalize-profile
GET ${API_BASE_URL}/api/v1/auth/quiz/progress
```

### Common Frontend Mistakes to Avoid

1. ❌ **Calling quiz endpoints on frontend domain** (Vercel/Netlify URL)
2. ❌ **Forgetting JWT Authorization header** (all endpoints require it)
3. ❌ **Using relative URLs** like `/api/quiz/...` (these resolve to frontend domain)
4. ❌ **Not configuring VITE_API_URL** environment variable
5. ❌ **Using direct fetch()** instead of configured API service

### Quick Fix for 404 Errors

If you're getting 404 errors like:
```
POST https://voyance-frontend-jq0v1pg0l-ashtonlaurens-projects.vercel.app/api/quiz/finalize-profile 404 (Not Found)
```

**This means you're calling the frontend domain instead of the backend.**

**Solution:**
1. Set `VITE_API_URL` environment variable to your backend domain
2. Update all quiz API calls to use the configured backend URL
3. Ensure JWT auth headers are included in all requests
4. Use your API service instead of direct `fetch()` calls

### Backend Flexibility Features

The backend accepts multiple field name variations for compatibility:

**Session ID fields**: `sessionId`, `quizSessionId`, `session_id` (all accepted)
**Step fields**: `stepNumber`, `step_number`, `step`, `stepId` (all accepted)

**Request Format Examples:**

```typescript
// save-step endpoint accepts both formats:

// Format 1: Current frontend format (works)
{
  quizSessionId: "uuid-here",
  stepNumber: 1,
  responses: [
    { fieldId: "primary_goal", answerValue: "explore" }
  ]
}

// Format 2: Alternative format (also works)
{
  sessionId: "uuid-here",
  step: 1,
  fields: [
    { field_id: "primary_goal", answer_value: "explore" }
  ]
}
```

### Recent Backend Fixes (Aug 3, 2025)

- ✅ **CRITICAL BUG FIXED**: Database constraint violation resolved
- ✅ Quiz responses now save properly without conflicts
- ✅ Quiz sessions complete with proper timestamps
- ✅ Travel DNA generation works end-to-end
- ✅ All endpoints properly require JWT authentication

### Testing Checklist

After configuring API domain correctly, verify:

- [ ] Environment variable `VITE_API_URL` is set to backend domain
- [ ] Quiz API calls go to backend domain (check Network tab in browser)
- [ ] Authorization headers are included in all requests
- [ ] Quiz responses save successfully (no 404/401 errors)
- [ ] Quiz completion finishes without errors
- [ ] Travel DNA results are returned properly

### Emergency Debugging

If you still get errors:

1. **Check browser Network tab** - confirm the URL being called
2. **Check the Response** - what HTTP status and error message?
3. **Check Console** - any JavaScript errors?
4. **Verify environment variables** - is `VITE_API_URL` set correctly?
5. **Check auth token** - is JWT token present and valid?

**The backend is working correctly. API domain configuration issues are the most common cause of quiz failures.**