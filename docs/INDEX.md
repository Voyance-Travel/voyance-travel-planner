# 📚 Voyance Documentation Index

**Last Updated**: January 2025  
**Status**: ✅ Active - Adapted for Lovable Codebase

> **Architecture**: Supabase Auth + Neon DB via Edge Functions + Zustand State

---

## 🏗️ System Architecture

| Component | Technology | Location |
|-----------|------------|----------|
| **Auth** | Supabase Auth | `src/contexts/AuthContext.tsx` |
| **Database** | Neon PostgreSQL | Edge Function: `supabase/functions/neon-db/` |
| **API Layer** | Edge Functions | `src/services/neonDb.ts` |
| **State** | Zustand | `src/lib/tripStore.ts` |
| **Types** | TypeScript | `src/types/trip.ts` |

---

## 📖 Core Documentation (Lovable-Adapted)

### ✅ Current System Docs
| Document | Purpose | Status |
|----------|---------|--------|
| [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md) | System architecture overview | ✅ Current |
| [SYSTEM_SOT.md](./SYSTEM_SOT.md) | **Master SOT for Lovable** | ✅ Current |
| [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) | Itinerary system mapping | ✅ Current |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Preferences system mapping | ✅ Current |
| [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) | Quiz data flow | ✅ Current |

---

## 📋 Reference Documents (Original System)

### Trip Planner
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [TRIP_PLANNER_INDEX.md](./TRIP_PLANNER_INDEX.md) | 352 | Master trip planner index | 📦 Reference |
| [TRIP_PLANNER_BACKEND_SOT.md](./TRIP_PLANNER_BACKEND_SOT.md) | 539 | Backend API specs | 📦 Reference |
| [TRIP_PLANNER_FRONTEND_GUIDE.md](./TRIP_PLANNER_FRONTEND_GUIDE.md) | 556 | Frontend implementation | 📦 Reference |
| [TRIP_PLANNER_QA_VALIDATION_PLAN.md](./TRIP_PLANNER_QA_VALIDATION_PLAN.md) | 238 | QA testing plan | 📦 Reference |
| [TRIP_PLANNER_REFERENCE.md](./TRIP_PLANNER_REFERENCE.md) | 317 | Quick reference | 📦 Reference |

### Itinerary System
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [ITINERARY_SCHEMA.md](./ITINERARY_SCHEMA.md) | 285 | Frontend schema | 📦 Reference |
| [ITINERARY_DATABASE_SCHEMA.md](./ITINERARY_DATABASE_SCHEMA.md) | 292 | Neon DB schema | 📦 Reference |
| [BACKEND_ITINERARY_CONTRACT_V2.md](./BACKEND_ITINERARY_CONTRACT_V2.md) | 272 | API contract | 📦 Reference |
| [SOT_PROGRESSIVE_ITINERARY_GENERATION.md](./SOT_PROGRESSIVE_ITINERARY_GENERATION.md) | 863 | Progressive generation | 📦 Reference |
| [ITINERARY_PARSING_RULES.md](./ITINERARY_PARSING_RULES.md) | 200 | Text parsing | 📦 Reference |
| [PRODUCTION_AUDIT_ITINERARY_SYSTEM.md](./PRODUCTION_AUDIT_ITINERARY_SYSTEM.md) | 342 | Production issues | 📦 Reference |

### Preferences System
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [PREFERENCES_SYSTEM_SOT.md](./PREFERENCES_SYSTEM_SOT.md) | 371 | Master preferences SOT | 📦 Reference |
| [PREFERENCES_MAPPING_CONTRACT.md](./PREFERENCES_MAPPING_CONTRACT.md) | 210 | Field mappings | 📦 Reference |
| [PREFERENCES_FIELD_MAPPING.md](./PREFERENCES_FIELD_MAPPING.md) | 227 | UI to DB mapping | 📦 Reference |
| [PREFERENCES_RECONCILIATION_GUIDE.md](./PREFERENCES_RECONCILIATION_GUIDE.md) | 565 | Frontend changes | 📦 Reference |
| [PREFERENCES_DATA_FIELDS.md](./PREFERENCES_DATA_FIELDS.md) | - | Data fields | 📦 Reference |

### API & Data Mapping
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [SOT_API_TO_UI_MAPPING.md](./SOT_API_TO_UI_MAPPING.md) | 1256 | API → UI mapping | 📦 Reference |
| [SOT_TRIP_PLANNER_DATA_USAGE.md](./SOT_TRIP_PLANNER_DATA_USAGE.md) | 1035 | Data field usage | 📦 Reference |
| [SOT_AMADEUS_APIS.md](./SOT_AMADEUS_APIS.md) | 1134 | Amadeus integration | 📦 Reference |
| [SOT_IMAGE_HANDLING_STRATEGY.md](./SOT_IMAGE_HANDLING_STRATEGY.md) | 1176 | Image handling | 📦 Reference |

### Hotels & Flights
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [SOT_HOTEL_ROOM_OPTIONS_NEEDED.md](./SOT_HOTEL_ROOM_OPTIONS_NEEDED.md) | 363 | Room options | 📦 Reference |
| [SOT_BACKEND_HOTEL_ROOM_DATA.md](./SOT_BACKEND_HOTEL_ROOM_DATA.md) | 452 | Hotel data | 📦 Reference |
| [SOT_REVIEW_PAGE_DATA_REQUIREMENTS.md](./SOT_REVIEW_PAGE_DATA_REQUIREMENTS.md) | 537 | Review page | 📦 Reference |
| [ISSUE_BACKEND_ONLY_SENDS_ONE_ROOM.md](./ISSUE_BACKEND_ONLY_SENDS_ONE_ROOM.md) | 344 | Room issue | 📦 Reference |

### Profile System
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [profile-system-source-of-truth.md](./profile-system-source-of-truth.md) | - | Profile SOT | 📦 Reference |
| [PROFILE_FRONTEND_BACKEND_ALIGNMENT.md](./PROFILE_FRONTEND_BACKEND_ALIGNMENT.md) | 364 | Alignment | 📦 Reference |

### Reference Data
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [airport-codes-database-full.md](./airport-codes-database-full.md) | 2197 | 879 airports | ✅ Data |
| [airport-codes-database.md](./airport-codes-database.md) | - | Airport codes | ✅ Data |
| [TRAVEL_ARCHETYPES.md](./TRAVEL_ARCHETYPES.md) | - | Travel styles | ✅ Data |
| [database-schema-reference.md](./database-schema-reference.md) | - | DB schema | 📦 Reference |

### Development Guides
| Document | Lines | Purpose | Adapt Status |
|----------|-------|---------|--------------|
| [FRONTEND_MIGRATION_GUIDE.md](./FRONTEND_MIGRATION_GUIDE.md) | 508 | Migration guide | 📦 Reference |
| [BILLING_SYSTEM.md](./BILLING_SYSTEM.md) | - | Billing specs | 📦 Reference |
| [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) | 267 | Workspace cleanup | 📦 Reference |
| [PHASE2_CONTRACT_DIFF.md](./PHASE2_CONTRACT_DIFF.md) | 366 | API validation | 📦 Reference |

---

## 🔄 Key Differences: Original vs Lovable

| Aspect | Original System | Lovable System |
|--------|-----------------|----------------|
| **Backend** | Railway (Node.js) | Edge Functions (Deno) |
| **Auth** | Custom JWT | Supabase Auth |
| **Database** | Neon (direct) | Neon via Edge Function |
| **API Routes** | `/api/v1/*` | Edge Function paths |
| **State** | React Context | Zustand + Context |
| **Flights/Hotels** | Amadeus API | Mock data (future: Amadeus) |
| **Itinerary Gen** | OpenAI API | Lovable AI Gateway |

---

## 🚀 Implementation Priority

### Phase 1: Core CRUD ✅
- [x] Auth (Supabase)
- [x] Profiles (Neon)
- [x] Preferences (Neon)
- [x] Trips (Neon)

### Phase 2: Trip Planning 🔧
- [ ] Extended preferences schema
- [ ] Flight search (mock → Amadeus)
- [ ] Hotel search (mock → Amadeus)
- [ ] Price locking

### Phase 3: Itinerary 🔧
- [ ] Itinerary generation (AI Gateway)
- [ ] Day/activity management
- [ ] Activity locking
- [ ] Progressive loading

### Phase 4: Advanced 📋
- [ ] Real-time weather
- [ ] Booking integration
- [ ] Billing system
- [ ] Companions

---

## 📂 File Organization

```
docs/
├── INDEX.md                    # This file
├── SYSTEM_SOT.md              # Master Lovable SOT
├── *_LOVABLE.md               # Adapted docs
├── SOT_*.md                   # Original SOT docs
├── TRIP_PLANNER_*.md          # Trip planner docs
├── ITINERARY_*.md             # Itinerary docs
├── PREFERENCES_*.md           # Preferences docs
├── airport-codes-*.md         # Reference data
└── *.md                       # Other docs
```
