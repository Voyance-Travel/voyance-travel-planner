# 📚 Voyance Documentation Index

<!--
@keywords: index, documentation, docs, guide, reference, SOT, source of truth, search
@category: INDEX
@searchTerms: find docs, documentation list, all documents, search docs, table of contents
-->

**Last Updated**: January 2025  
**Status**: ✅ Active - Adapted for Lovable Codebase

> **Architecture**: Supabase Auth + Neon DB via Edge Functions + Zustand State

---

## 🔍 Quick Search Guide

| Looking for... | Document |
|---------------|----------|
| System overview | [SYSTEM_SOT.md](./SYSTEM_SOT.md) |
| API endpoints | [SYSTEM_SOT.md](./SYSTEM_SOT.md#api-endpoints) |
| Database schema | [SYSTEM_SOT.md](./SYSTEM_SOT.md#database-schema) |
| Authentication | [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md#auth-flow) |
| Preferences | [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) |
| Quiz flow | [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) |
| Itinerary | [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) |
| Trip planner | [TRIP_PLANNER_INDEX.md](./TRIP_PLANNER_INDEX.md) |
| Airport codes | [airport-codes-database-full.md](./airport-codes-database-full.md) |
| Amadeus APIs | [SOT_AMADEUS_APIS.md](./SOT_AMADEUS_APIS.md) |

---

## 🏗️ System Architecture

| Component | Technology | Location | Keywords |
|-----------|------------|----------|----------|
| **Auth** | Supabase Auth | `src/contexts/AuthContext.tsx` | login, signup, session, JWT |
| **Database** | Neon PostgreSQL | Edge: `supabase/functions/neon-db/` | postgres, SQL, tables |
| **API Layer** | Edge Functions | `src/services/neonDb.ts` | API, fetch, REST |
| **State** | Zustand | `src/lib/tripStore.ts` | store, state, persist |
| **Types** | TypeScript | `src/types/trip.ts` | interfaces, types |

---

## 📖 Core Documentation (Lovable-Adapted)

### ✅ Current System Docs
| Document | Purpose | Keywords |
|----------|---------|----------|
| [SYSTEM_SOT.md](./SYSTEM_SOT.md) | **Master SOT** | architecture, API, schema, endpoints, types |
| [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md) | System architecture | backend, frontend, data flow, auth |
| [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) | Itinerary system | activities, days, generation, AI |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Preferences system | quiz, travel style, budget, interests |
| [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) | Quiz data flow | questions, answers, save, completion |

---

## 📋 Reference Documents by Category

### 🗺️ Trip Planner
| Document | Keywords | Lines |
|----------|----------|-------|
| [TRIP_PLANNER_INDEX.md](./TRIP_PLANNER_INDEX.md) | planner, flow, steps, booking | 352 |
| [TRIP_PLANNER_BACKEND_SOT.md](./TRIP_PLANNER_BACKEND_SOT.md) | API, backend, endpoints, requests | 539 |
| [TRIP_PLANNER_FRONTEND_GUIDE.md](./TRIP_PLANNER_FRONTEND_GUIDE.md) | components, UI, pages, React | 556 |
| [TRIP_PLANNER_QA_VALIDATION_PLAN.md](./TRIP_PLANNER_QA_VALIDATION_PLAN.md) | testing, QA, validation, errors | 238 |
| [TRIP_PLANNER_REFERENCE.md](./TRIP_PLANNER_REFERENCE.md) | quick reference, lookup, API | 317 |

### 📅 Itinerary System
| Document | Keywords | Lines |
|----------|----------|-------|
| [ITINERARY_SCHEMA.md](./ITINERARY_SCHEMA.md) | schema, fields, types, frontend | 285 |
| [ITINERARY_DATABASE_SCHEMA.md](./ITINERARY_DATABASE_SCHEMA.md) | Neon, SQL, tables, columns | 292 |
| [BACKEND_ITINERARY_CONTRACT_V2.md](./BACKEND_ITINERARY_CONTRACT_V2.md) | API contract, response, format | 272 |
| [SOT_PROGRESSIVE_ITINERARY_GENERATION.md](./SOT_PROGRESSIVE_ITINERARY_GENERATION.md) | AI, generation, progressive, streaming | 863 |
| [ITINERARY_PARSING_RULES.md](./ITINERARY_PARSING_RULES.md) | text parsing, activity type, keywords | 200 |
| [PRODUCTION_AUDIT_ITINERARY_SYSTEM.md](./PRODUCTION_AUDIT_ITINERARY_SYSTEM.md) | production, issues, bugs, fixes | 342 |

### ⚙️ Preferences System
| Document | Keywords | Lines |
|----------|----------|-------|
| [PREFERENCES_SYSTEM_SOT.md](./PREFERENCES_SYSTEM_SOT.md) | preferences, fields, schema, master | 371 |
| [PREFERENCES_MAPPING_CONTRACT.md](./PREFERENCES_MAPPING_CONTRACT.md) | mapping, field names, contract | 210 |
| [PREFERENCES_FIELD_MAPPING.md](./PREFERENCES_FIELD_MAPPING.md) | UI, DB, column, frontend | 227 |
| [PREFERENCES_RECONCILIATION_GUIDE.md](./PREFERENCES_RECONCILIATION_GUIDE.md) | changes, migration, update | 565 |

### 🔌 API & Data Mapping
| Document | Keywords | Lines |
|----------|----------|-------|
| [SOT_API_TO_UI_MAPPING.md](./SOT_API_TO_UI_MAPPING.md) | API, UI, fields, transformation | 1256 |
| [SOT_TRIP_PLANNER_DATA_USAGE.md](./SOT_TRIP_PLANNER_DATA_USAGE.md) | data, fields, usage, components | 1035 |
| [SOT_AMADEUS_APIS.md](./SOT_AMADEUS_APIS.md) | Amadeus, flights, hotels, search | 1134 |
| [SOT_IMAGE_HANDLING_STRATEGY.md](./SOT_IMAGE_HANDLING_STRATEGY.md) | images, fallback, loading, CDN | 1176 |

### 🏨 Hotels & Flights
| Document | Keywords | Lines |
|----------|----------|-------|
| [SOT_HOTEL_ROOM_OPTIONS_NEEDED.md](./SOT_HOTEL_ROOM_OPTIONS_NEEDED.md) | rooms, options, selection | 363 |
| [SOT_BACKEND_HOTEL_ROOM_DATA.md](./SOT_BACKEND_HOTEL_ROOM_DATA.md) | hotel data, backend, API | 452 |
| [SOT_REVIEW_PAGE_DATA_REQUIREMENTS.md](./SOT_REVIEW_PAGE_DATA_REQUIREMENTS.md) | review, booking, summary | 537 |

### 👤 Profile System
| Document | Keywords | Lines |
|----------|----------|-------|
| [profile-system-source-of-truth.md](./profile-system-source-of-truth.md) | profile, user, display | - |
| [PROFILE_FRONTEND_BACKEND_ALIGNMENT.md](./PROFILE_FRONTEND_BACKEND_ALIGNMENT.md) | alignment, sync, fields | 364 |

### 📊 Reference Data
| Document | Keywords | Lines |
|----------|----------|-------|
| [airport-codes-database-full.md](./airport-codes-database-full.md) | IATA, airports, cities, countries | 2197 |
| [TRAVEL_ARCHETYPES.md](./TRAVEL_ARCHETYPES.md) | archetype, personality, DNA | - |
| [database-schema-reference.md](./database-schema-reference.md) | schema, tables, columns | - |

### 🛠️ Development Guides
| Document | Keywords | Lines |
|----------|----------|-------|
| [FRONTEND_MIGRATION_GUIDE.md](./FRONTEND_MIGRATION_GUIDE.md) | migration, refactor, changes | 508 |
| [CLEANUP_PLAN.md](./CLEANUP_PLAN.md) | cleanup, remove, deprecated | 267 |
| [PHASE2_CONTRACT_DIFF.md](./PHASE2_CONTRACT_DIFF.md) | contract, validation, diff | 366 |

---

## 🔄 Key Differences: Original vs Lovable

| Aspect | Original System | Lovable System | Search Terms |
|--------|-----------------|----------------|--------------|
| **Backend** | Railway (Node.js) | Edge Functions (Deno) | edge, deno, railway |
| **Auth** | Custom JWT | Supabase Auth | supabase, auth, JWT |
| **Database** | Neon (direct) | Neon via Edge Function | neon, postgres, edge |
| **API Routes** | `/api/v1/*` | Edge Function paths | api, routes, endpoints |
| **State** | React Context | Zustand + Context | zustand, state, store |
| **Flights/Hotels** | Amadeus API | Mock data | amadeus, mock, flights |
| **Itinerary Gen** | OpenAI API | Lovable AI Gateway | openai, AI, generation |

---

## 🏷️ Keyword Index

### A-C
- **Activities** → ITINERARY_LOVABLE, ITINERARY_SCHEMA
- **Amadeus** → SOT_AMADEUS_APIS
- **API** → SYSTEM_SOT, TRIP_PLANNER_BACKEND_SOT
- **Archetypes** → TRAVEL_ARCHETYPES, QUIZ_FLOW_LOVABLE
- **Auth** → ARCHITECTURE_LOVABLE, SYSTEM_SOT
- **Budget** → PREFERENCES_LOVABLE
- **Components** → TRIP_PLANNER_FRONTEND_GUIDE

### D-F
- **Database** → SYSTEM_SOT, ITINERARY_DATABASE_SCHEMA
- **Edge Functions** → ARCHITECTURE_LOVABLE, SYSTEM_SOT
- **Flights** → SOT_AMADEUS_APIS, TRIP_PLANNER_INDEX

### G-I
- **Generation** → SOT_PROGRESSIVE_ITINERARY_GENERATION
- **Hotels** → SOT_BACKEND_HOTEL_ROOM_DATA, SOT_HOTEL_ROOM_OPTIONS_NEEDED
- **Images** → SOT_IMAGE_HANDLING_STRATEGY
- **Itinerary** → ITINERARY_LOVABLE, ITINERARY_SCHEMA

### J-N
- **Neon** → SYSTEM_SOT, ARCHITECTURE_LOVABLE

### O-Q
- **Preferences** → PREFERENCES_LOVABLE, PREFERENCES_SYSTEM_SOT
- **Profile** → profile-system-source-of-truth, PROFILE_FRONTEND_BACKEND_ALIGNMENT
- **Quiz** → QUIZ_FLOW_LOVABLE

### R-T
- **Schema** → SYSTEM_SOT, database-schema-reference
- **State** → SYSTEM_SOT (tripStore)
- **Trips** → TRIP_PLANNER_INDEX, SYSTEM_SOT

### U-Z
- **UI Mapping** → SOT_API_TO_UI_MAPPING
- **Zustand** → SYSTEM_SOT

---

## 📂 File Organization

```
docs/
├── INDEX.md                    # This file (search index)
├── SYSTEM_SOT.md              # Master Lovable SOT
├── *_LOVABLE.md               # Adapted docs
├── SOT_*.md                   # Original SOT docs
├── TRIP_PLANNER_*.md          # Trip planner docs
├── ITINERARY_*.md             # Itinerary docs
├── PREFERENCES_*.md           # Preferences docs
├── airport-codes-*.md         # Reference data
└── *.md                       # Other docs
```
