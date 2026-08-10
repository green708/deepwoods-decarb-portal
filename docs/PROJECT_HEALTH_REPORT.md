# Project Health Report

**Assessment date:** 2026-08-06  
**Assessed by:** Architecture review (Phases 1–9)  
**Repository:** `C:\Users\likhi\Downloads\FL\decarb`

---

## Score Summary

| Dimension | Score | Grade |
|---|---|---|
| Repository health | 68/100 | C+ |
| Architecture | 62/100 | C |
| Maintainability | 58/100 | C |
| Scalability | 45/100 | D+ |
| Multi-tenant readiness | 49/100 | D+ |
| Technical debt | 55/100 | C |
| Code quality | 65/100 | C |
| Documentation | 85/100 | B+ (post-reorganization) |
| **Overall** | **61/100** | **C** |

---

## Repository Health: 68/100

**Strengths:**
- Two-repo separation (active + reference) is a sound practice
- Schema is properly multi-client from day 1
- Build pipeline works end-to-end (Vite → Nitro → static bundle)
- Demo mode enables full testing without a live backend

**Weaknesses:**
- Root directory was cluttered with xlsx/pdf/docx reference files (now fixed)
- `reporting-platform/` was empty in the active repo despite scripts existing
- Old build outputs (`dist-static_old/`, `.output_old/`) present on disk
- No `.env.example`
- Stale lock files present

**Fixed in this session:** Root directory reorganization, docs creation, scripts copied.

---

## Architecture: 62/100

**Strengths:**
- TanStack Start gives a solid, modern React foundation
- React Query hooks centralized in `src/lib/api.ts` is clean
- ClientContext pattern is correct for multi-client
- CSS variable theming is the right approach for branding

**Weaknesses:**
- PHP shared hosting limits concurrency, background jobs, and maintainability
- No ORM or query builder — raw PDO everywhere
- No middleware pipeline — auth copied into each endpoint
- Large inline components in route files (5 files >40KB)
- Legacy `ghg-api.php` not yet removed
- Hardcoded API keys in client-side code (security critical)

---

## Maintainability: 58/100

**Strengths:**
- File-based routing is easy to navigate
- shadcn/ui primitives are self-contained and well-understood
- React Query hooks provide a clear data access layer

**Weaknesses:**
- Route files are very large (some >60KB) with multiple responsibilities
- No test suite
- `src/data/featherlite.ts` is 42KB of auto-generated code checked in
- Two documentation systems coexisting (CLAUDE.md + new docs/) during transition
- Business logic scattered between PHP, TypeScript, Python script, and Apps Script

---

## Scalability: 45/100

**Strengths:**
- DB schema is multi-client and will support many clients
- CDN-served static assets (Hostinger handles this)

**Weaknesses:**
- Hostinger shared hosting: limited concurrent connections, no persistent processes
- No pagination on list endpoints
- Google Drive as file storage creates API rate limit concerns at scale
- No caching layer (Redis etc.) between PHP and MySQL
- Apps Script web app has execution quotas (6 min/run, 20 concurrent)
- All Drive file operations are synchronous in the request cycle

---

## Code Duplication Summary

| Duplication | Location | Status |
|---|---|---|
| Auth middleware | Repeated `require_once '../db.php'` in every API file | Acceptable (PHP pattern) |
| `schema.sql` vs `schema_combined.sql` | `backend/schema.sql` and `backend/schema_combined.sql` | Archive `schema.sql` |
| `schema_v2.sql` vs `schema_combined.sql` | Two schema files | Archive `schema_v2.sql` |
| `portal.tsx` `PageHeader` vs `decarb/shared.tsx` `PageHeader` | Two PageHeader components | Minor — different styling purposes |
| Carbon price constants | `master.ts` and `client_config` | Fix: always read from context |
| IREC factor constant | `master.ts` and `client_config` | Fix: always read from context |
| Entity/FY state | `entity.tsx` and Featherlite static data | Retire static data |

---

## Migration Summary

| Component | Status |
|---|---|
| Core routes (28 pages) | Migrated to decarb |
| PHP API — auth endpoints | Migrated + enhanced |
| PHP API — GHG endpoints | Migrated + split into subfolders |
| PHP API — submission flow | Migrated + enhanced |
| PHP API — admin endpoints | Migrated |
| Multi-client DB schema | New (not in Featherlite-GHG) |
| ClientContextProvider | New (not in Featherlite-GHG) |
| React Query API hooks | New (not in Featherlite-GHG) |
| Reporting automation | **Missing in decarb — now copied** |
| Public templates | **Missing in decarb — now copied** |
| Vault documents | **Missing in decarb — now copied** |
| Static data (featherlite.ts) | Present but should be retired |
| Lovable-era prompt files | Archived |

---

## Archived Files Summary

| File | Reason |
|---|---|
| `PROJECT_KNOWLEDGE.md` | Superseded by `CLAUDE.md` |
| `GHG_Lovable_Continuation_Prompt.md` | Lovable platform no longer used |
| `GHG_Combined_Lovable_Prompt.docx` | Lovable platform prompt, feature built |
| `GHG_DataCollection_Lovable_Prompt.docx` | Lovable platform prompt, feature built |
| `GHG_DataJourney_Lovable_Prompt.docx` | Lovable platform prompt, feature built |
| `GHG_DataSubmission_UX_Prompt.docx` | Lovable platform prompt, feature built |
| `GHG_Platform_Addendum.docx` | Lovable platform prompt, feature built |
| `GHG_Wizard_DataCollection_Prompt.docx` | Lovable platform prompt, feature built |

---

## Remaining Work (Priority Order)

### Immediate (before onboarding second client)
1. Move Groq API keys server-side (security)
2. Fix `_app.trends.tsx` runtime crash (YEARS/INV undefined)
3. Fix `users.role` ENUM — remove client-specific values
4. Fix `submissionsStore.ts` hardcoded slug
5. Wire remaining pages to API hooks

### Short-term (next sprint)
6. Extract large inline components from route files
7. Add pagination to list endpoints
8. Create `.env.example`
9. Archive legacy schema files
10. Add per-page error boundaries

### Medium-term (next quarter)
11. Implement flexible entity hierarchy
12. Onboarding wizard → DB persistence
13. Generic report templates
14. Migrate hosting to VPS

### Long-term (roadmap)
15. Replace Google Drive with S3-compatible storage
16. Add test suite (unit + E2E)
17. Admin UI for client onboarding (no SQL required)
18. Multi-hierarchy support (Org → Companies → Facilities)

---

## Suggested Roadmap

```
Now          │ Security fixes + critical bugs
             │
Week 1–2     │ Wire all pages to API → retire featherlite.ts
             │
Week 3–4     │ Extract components + add tests
             │
Month 2      │ Onboarding second client (Dolphin / Navitas)
             │ Validate multi-client isolation end-to-end
             │
Month 3      │ Flexible hierarchy model
             │ Migrate hosting
             │
Month 4–6    │ Admin-driven client onboarding
             │ SaaS launch readiness
```
