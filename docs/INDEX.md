# 📚 Voyance Documentation Index

<!--
@keywords: index, documentation, docs, guide, reference, SOT, source of truth, search
@category: INDEX
@searchTerms: find docs, documentation list, all documents, search docs, table of contents
-->

**Last Updated**: January 2025  
**Status**: ✅ Active - Optimized for Lovable  
**Total Documents**: 35

> **Architecture**: Supabase Auth + Neon DB via Edge Functions + Zustand State

---

## 🔍 Quick Search Guide

| Looking for... | Document |
|---------------|----------|
| **System overview** | [SYSTEM_SOT.md](./SYSTEM_SOT.md) |
| **API endpoints** | [SYSTEM_SOT.md](./SYSTEM_SOT.md#api-endpoints) |
| **Database schema** | [SYSTEM_SOT.md](./SYSTEM_SOT.md#database-schema) |
| **Authentication** | [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md) |
| **Preferences** | [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) |
| **Quiz flow** | [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) |
| **Itinerary** | [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) |
| **Trip planner** | [TRIP_PLANNER_INDEX.md](./TRIP_PLANNER_INDEX.md) |
| **Airport codes** | [airport-codes-database-full.md](./airport-codes-database-full.md) |
| **Amadeus APIs** | [SOT_AMADEUS_APIS.md](./SOT_AMADEUS_APIS.md) |

---

## 📖 Core Documentation (Active)

### ✅ Lovable System Docs (Use These)
| Document | Purpose | Keywords |
|----------|---------|----------|
| [SYSTEM_SOT.md](./SYSTEM_SOT.md) | **Master SOT** - Start here | architecture, API, schema, endpoints |
| [ARCHITECTURE_LOVABLE.md](./ARCHITECTURE_LOVABLE.md) | System architecture | backend, frontend, auth, data flow |
| [ITINERARY_LOVABLE.md](./ITINERARY_LOVABLE.md) | Itinerary system | activities, days, AI generation |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Preferences system | quiz, travel style, budget |
| [QUIZ_FLOW_LOVABLE.md](./QUIZ_FLOW_LOVABLE.md) | Quiz data flow | questions, answers, completion |

---

## 📋 Reference Documents (Original System)

### 🗺️ Trip Planner
| Document | Purpose | Keywords |
|----------|---------|----------|
| [TRIP_PLANNER_INDEX.md](./TRIP_PLANNER_INDEX.md) | Trip planner overview | planner, flow, steps |
| [TRIP_PLANNER_BACKEND_SOT.md](./TRIP_PLANNER_BACKEND_SOT.md) | Backend API specs | API, endpoints, requests |
| [TRIP_PLANNER_FRONTEND_GUIDE.md](./TRIP_PLANNER_FRONTEND_GUIDE.md) | Frontend implementation | components, UI, pages |
| [TRIP_PLANNER_REFERENCE.md](./TRIP_PLANNER_REFERENCE.md) | Quick reference | lookup, API |
| [TRIP_PLANNER_QA_VALIDATION_PLAN.md](./TRIP_PLANNER_QA_VALIDATION_PLAN.md) | Testing plan | QA, validation |

### 📅 Itinerary System
| Document | Purpose | Keywords |
|----------|---------|----------|
| [ITINERARY_SCHEMA.md](./ITINERARY_SCHEMA.md) | Field definitions | schema, types |
| [ITINERARY_DATABASE_SCHEMA.md](./ITINERARY_DATABASE_SCHEMA.md) | Neon DB schema | SQL, tables |
| [BACKEND_ITINERARY_CONTRACT_V2.md](./BACKEND_ITINERARY_CONTRACT_V2.md) | API contract | response format |
| [SOT_PROGRESSIVE_ITINERARY_GENERATION.md](./SOT_PROGRESSIVE_ITINERARY_GENERATION.md) | AI generation flow | streaming, progress |
| [ITINERARY_PARSING_RULES.md](./ITINERARY_PARSING_RULES.md) | Text parsing logic | keywords, types |
| [PRODUCTION_AUDIT_ITINERARY_SYSTEM.md](./PRODUCTION_AUDIT_ITINERARY_SYSTEM.md) | Production issues | bugs, fixes |

### ⚙️ Preferences System
| Document | Purpose | Keywords |
|----------|---------|----------|
| [PREFERENCES_SYSTEM_SOT.md](./PREFERENCES_SYSTEM_SOT.md) | Full preferences spec | master schema |
| [PREFERENCES_MAPPING_CONTRACT.md](./PREFERENCES_MAPPING_CONTRACT.md) | Field mappings | contract |
| [PREFERENCES_FIELD_MAPPING.md](./PREFERENCES_FIELD_MAPPING.md) | UI to DB mapping | frontend, database |
| [PREFERENCES_RECONCILIATION_GUIDE.md](./PREFERENCES_RECONCILIATION_GUIDE.md) | Migration guide | changes |

### 🔌 API & Data Mapping
| Document | Purpose | Keywords |
|----------|---------|----------|
| [SOT_API_TO_UI_MAPPING.md](./SOT_API_TO_UI_MAPPING.md) | API → UI fields | transformation |
| [SOT_TRIP_PLANNER_DATA_USAGE.md](./SOT_TRIP_PLANNER_DATA_USAGE.md) | Data field usage | components |
| [SOT_AMADEUS_APIS.md](./SOT_AMADEUS_APIS.md) | Amadeus integration | flights, hotels |
| [SOT_IMAGE_HANDLING_STRATEGY.md](./SOT_IMAGE_HANDLING_STRATEGY.md) | Image handling | fallback, CDN |

### 🏨 Hotels & Flights
| Document | Purpose | Keywords |
|----------|---------|----------|
| [SOT_HOTEL_ROOM_OPTIONS_NEEDED.md](./SOT_HOTEL_ROOM_OPTIONS_NEEDED.md) | Room options | selection |
| [SOT_BACKEND_HOTEL_ROOM_DATA.md](./SOT_BACKEND_HOTEL_ROOM_DATA.md) | Hotel data | backend API |
| [SOT_REVIEW_PAGE_DATA_REQUIREMENTS.md](./SOT_REVIEW_PAGE_DATA_REQUIREMENTS.md) | Review page | booking summary |

### 👤 Profile System
| Document | Purpose | Keywords |
|----------|---------|----------|
| [profile-system-source-of-truth.md](./profile-system-source-of-truth.md) | Profile SOT | user, display |
| [PROFILE_FRONTEND_BACKEND_ALIGNMENT.md](./PROFILE_FRONTEND_BACKEND_ALIGNMENT.md) | Alignment | sync, fields |

### 📊 Reference Data
| Document | Purpose | Keywords |
|----------|---------|----------|
| [airport-codes-database-full.md](./airport-codes-database-full.md) | 879 airports, 152 countries | IATA, cities |
| [TRAVEL_ARCHETYPES.md](./TRAVEL_ARCHETYPES.md) | Travel personalities | DNA, archetype |
| [database-schema-reference.md](./database-schema-reference.md) | Original DB schema | tables |
| [quiz-data-flow.md](./quiz-data-flow.md) | Original quiz flow | questions |

### 🛠️ Development
| Document | Purpose | Keywords |
|----------|---------|----------|
| [FRONTEND_MIGRATION_GUIDE.md](./FRONTEND_MIGRATION_GUIDE.md) | Migration guide | refactor |

---

## 🏷️ Keyword Index

| Keyword | Documents |
|---------|-----------|
| **API** | SYSTEM_SOT, TRIP_PLANNER_BACKEND_SOT, SOT_AMADEUS_APIS |
| **Auth** | ARCHITECTURE_LOVABLE, SYSTEM_SOT |
| **Database** | SYSTEM_SOT, ITINERARY_DATABASE_SCHEMA |
| **Flights** | SOT_AMADEUS_APIS, TRIP_PLANNER_INDEX |
| **Hotels** | SOT_BACKEND_HOTEL_ROOM_DATA, SOT_HOTEL_ROOM_OPTIONS_NEEDED |
| **Itinerary** | ITINERARY_LOVABLE, ITINERARY_SCHEMA |
| **Preferences** | PREFERENCES_LOVABLE, PREFERENCES_SYSTEM_SOT |
| **Quiz** | QUIZ_FLOW_LOVABLE, quiz-data-flow |
| **Schema** | SYSTEM_SOT, database-schema-reference |
| **Zustand** | SYSTEM_SOT |

---

## 🔄 Original vs Lovable

| Aspect | Original | Lovable |
|--------|----------|---------|
| Backend | Railway (Node.js) | Edge Functions (Deno) |
| Auth | Custom JWT | Supabase Auth |
| Database | Neon (direct) | Neon via Edge Function |
| State | React Context | Zustand + Context |

---

## 📂 File Structure

```
docs/
├── INDEX.md                 # This file
├── SYSTEM_SOT.md           # Master SOT ⭐
├── *_LOVABLE.md            # Adapted docs (5 files)
├── TRIP_PLANNER_*.md       # Trip planner (5 files)
├── ITINERARY_*.md          # Itinerary (4 files)
├── SOT_*.md                # Original SOT (8 files)
├── PREFERENCES_*.md        # Preferences (4 files)
└── *.md                    # Other reference (8 files)
```

**Total: 35 documents** (reduced from 51)
