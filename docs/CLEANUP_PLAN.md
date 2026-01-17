# Workspace Cleanup Plan

**Generated**: 2025-10-12
**Status**: Pending Approval

## 🎯 Goals

1. Move root MD files to appropriate locations
2. Consolidate 8 trip planner docs → 3-4 authoritative + 1 index
3. Mark outdated docs (don't delete)
4. Create clear navigation

---

## 📋 Phase 1: Root Directory Cleanup

### Files to Move to `docs/legacy/auth/`

```
AUTH_FIX_PROFILE_ISSUE.md
AUTH_FIX_SUMMARY.md
AUTH_FLOW_ANALYSIS.md
AUTH_REPLACEMENT_PLAN.md
BACKEND_AUTH_QUESTIONS.md
CHECK_AUTH.md
CLEAN_AUTH_MIGRATION.md
FRONTEND_TOKEN_EXPECTATIONS.md
JWT_TOKEN_REQUIREMENTS.md
TOKEN_MISMATCH_ANALYSIS.md
TOKEN_STRUCTURE_TRACE.md
SIMPLE_TOKEN_REQUIREMENTS.md
```

### Files to Move to `docs/legacy/profile/`

```
PROFILE_BACKEND_REQUIREMENTS.md
PROFILE_STATUS_FINAL.md
```

### Files to Move to `docs/legacy/billing/`

```
BILLING_AUDIT.md
```

### Files to Move to `docs/legacy/backend/`

```
BACKEND_QUICK_START.md
BACKEND_REQUIREMENTS.md
SEND_TO_BACKEND_TEAM.md
SIMPLE_DATA_FLOW.md
```

### Files to Move to `docs/legacy/summaries/`

```
PR_SUMMARY.md
PR_SUMMARY_CP2.md
TODAY_CHANGES_SUMMARY.md
```

### Files to KEEP at Root

```
README.md ← Project overview
CLAUDE.md ← Keep at root for easy access
```

**Result**: Root goes from 23 files → 2 files ✨

---

## 📋 Phase 2: Trip Planner Doc Consolidation

### Current State (8 files)

```
docs/source-of-truth/
├── TRIP_PLANNER_BACKEND_SOT_UPDATED.md (12K) - Oct 11, 2025
├── TRIP_PLANNER_FLOW.md (6.8K)
├── TRIP_PLANNER_FRONTEND_GUIDE.md (12K) - Oct 11, 2025
├── TRIP_PLANNER_IMPLEMENTATION_STATUS.md (7.5K) - Jan 13, 2025
├── TRIP_PLANNER_IMPLEMENTATION_STRATEGY.md (6.1K) - Planning
├── TRIP_PLANNER_QA_VALIDATION_PLAN.md (6.4K)
├── TRIP_PLANNER_STATEMENT_OF_WORK_FINAL.md (4.2K) - Jan 13, 2025
└── TRIP_PLANNER_UNDERSTANDING.md (5.9K) - Planning
```

### Proposed Structure

#### **KEEP as Authoritative (4 files)**

**1. `TRIP_PLANNER_INDEX.md`** ← NEW

- Single-page overview
- Links to all other docs
- Quick reference for polling interval, budget tiers, endpoints
- Last validated date

**2. `TRIP_PLANNER_BACKEND_SOT_UPDATED.md`** (12K)

- **Status**: ✅ CURRENT (Oct 11, 2025)
- **Purpose**: Complete backend API reference
- **Action**: Add header note: "Last validated: Oct 12, 2025"

**3. `TRIP_PLANNER_FRONTEND_GUIDE.md`** (12K)

- **Status**: ✅ CURRENT (Oct 11, 2025)
- **Purpose**: Page-by-page implementation guide
- **Action**: Add header note: "Last validated: Oct 12, 2025"

**4. `TRIP_PLANNER_QA_VALIDATION_PLAN.md`** (6.4K)

- **Status**: ✅ CURRENT (active testing doc)
- **Purpose**: QA checklist and test scenarios
- **Action**: Add section for validation results

#### **CONSOLIDATE into `TRIP_PLANNER_REFERENCE.md`** ← NEW

Merge these 3 docs into a single reference:

- `TRIP_PLANNER_FLOW.md` (budget tier mappings, validation rules)
- `TRIP_PLANNER_IMPLEMENTATION_STATUS.md` (what's implemented)
- `TRIP_PLANNER_STATEMENT_OF_WORK_FINAL.md` (exec summary)

**Content Structure**:

```markdown
# Trip Planner Reference Guide

Last Updated: Oct 12, 2025

## Quick Reference

- Budget Tier Mapping
- Validation Rules
- Implementation Status
- Success Metrics

## Historical Context

- Jan 2025: Initial implementation
- Oct 2025: Backend deployed
- Oct 2025: Frontend validation
```

#### **MOVE to `docs/archive/trip-planner/planning/`**

Mark with header: `⚠️ ARCHIVED - This was a planning document from January 2025`

```
TRIP_PLANNER_IMPLEMENTATION_STRATEGY.md
TRIP_PLANNER_UNDERSTANDING.md
```

#### **Check for Duplication**

```
FRONTEND_MIGRATION_GUIDE.md ← Need to review if this overlaps with FRONTEND_GUIDE
```

### Final Structure (6 files)

```
docs/source-of-truth/
├── TRIP_PLANNER_INDEX.md ← NEW (navigation hub)
├── TRIP_PLANNER_BACKEND_SOT_UPDATED.md ← KEEP (API reference)
├── TRIP_PLANNER_FRONTEND_GUIDE.md ← KEEP (implementation guide)
├── TRIP_PLANNER_QA_VALIDATION_PLAN.md ← KEEP (testing)
└── TRIP_PLANNER_REFERENCE.md ← NEW (consolidated quick reference)

docs/archive/trip-planner/
└── planning/
    ├── TRIP_PLANNER_IMPLEMENTATION_STRATEGY.md ← MOVED
    └── TRIP_PLANNER_UNDERSTANDING.md ← MOVED
```

**Result**: 8 files → 5 current + 2 archived = Clear hierarchy ✨

---

## 📋 Phase 3: Add Validation Metadata

### Update Headers in All SOT Docs

**Template**:

```markdown
# [Document Title]

**Last Updated**: 2025-10-11
**Last Validated**: 2025-10-12
**Status**: ✅ CURRENT | ⚠️ OUTDATED | 📦 ARCHIVED

> **✅ VALIDATION NOTES** (Oct 12, 2025):
>
> - Country field: ✅ Confirmed working
> - Budget tier mapping: ✅ Verified correct
> - Polling interval: ✅ Implemented at 30s
> - API endpoints: ✅ All match backend
```

---

## 📋 Phase 4: Create INDEX.md

See separate file: `TRIP_PLANNER_INDEX.md` (draft below)

---

## ✅ Execution Checklist

### Phase 1: Root Cleanup

- [ ] Create `docs/legacy/auth/` directory
- [ ] Create `docs/legacy/profile/` directory
- [ ] Create `docs/legacy/billing/` directory
- [ ] Create `docs/legacy/backend/` directory
- [ ] Create `docs/legacy/summaries/` directory
- [ ] Move 21 MD files from root to appropriate folders
- [ ] Verify README.md and CLAUDE.md remain at root

### Phase 2: Trip Planner Consolidation

- [ ] Create `docs/archive/trip-planner/planning/` directory
- [ ] Create `TRIP_PLANNER_INDEX.md`
- [ ] Create `TRIP_PLANNER_REFERENCE.md` (consolidate 3 docs)
- [ ] Move 2 planning docs to archive
- [ ] Review `FRONTEND_MIGRATION_GUIDE.md` for duplication
- [ ] Add validation headers to 4 authoritative docs

### Phase 3: Validation Updates

- [ ] Add "Last Validated: Oct 12, 2025" to all current docs
- [ ] Add validation notes to INDEX
- [ ] Update QA_VALIDATION_PLAN with findings

### Phase 4: Final Verification

- [ ] Verify no broken links
- [ ] Test navigation from INDEX
- [ ] Ensure no information was deleted
- [ ] Git commit with clear message

---

## 📊 Impact Summary

**Before**:

- Root: 23 MD files
- Trip Planner SOT: 8 docs
- No clear entry point
- Conflicting dates

**After**:

- Root: 2 MD files (README + CLAUDE)
- Trip Planner SOT: 5 current docs + INDEX
- Clear navigation via INDEX
- All docs dated and validated

---

**Ready for approval?** Once approved, I'll execute this plan step-by-step.
