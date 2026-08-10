# Team Guidelines

How every contributor — human or AI — should work on the Decarb Platform.

---

## Before You Start

1. Read `CLAUDE_ONBOARDING.md` (project root)
2. Read `docs/SESSION_HANDOFF.md` — know what was last worked on
3. Run `npx tsc --noEmit` — confirm 0 TypeScript errors as your baseline
4. Check `git status` — understand any uncommitted state before adding to it
5. For any new feature or design decision: verify it serves at least one of the six platform goals — helps Deepwoods manage more clients, improves consulting quality, reduces manual work, improves client collaboration, helps clients become carbon neutral, or helps the client understand their next step without contacting Deepwoods (full list in `docs/PROJECT_CHARTER.md`)

---

## Coding Rules

### General

- **Scope**: Only build what the current task requires. No refactoring, no "while I'm here" improvements, no premature abstractions. A bug fix doesn't need surrounding cleanup.
- **Comments**: Only add a comment when the WHY is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug. Never explain what code does. Never reference the current task in comments.
- **No dead code**: Don't rename variables to `_unused`, add `// removed` comments, or create compatibility shims for deleted code. If something is removed, remove it completely.
- **Error handling**: Only validate at system boundaries (user input, external APIs). Trust internal code and framework guarantees. Don't add defensive checks for scenarios that can't happen.
- **No console.log**: Remove all debug logging before committing.

### TypeScript Rules

- Strict mode is on. 0 errors at all times — this is a hard requirement, not a target.
- Use `unknown` over `any`. If `any` is unavoidable, add a brief comment explaining why.
- Prefer explicit return types on exported functions.
- Use type guards (`is` predicates) rather than type assertions (`as`) where possible.
- No `// @ts-ignore` without a comment explaining the specific exception.

### React Rules

- All data fetching uses TanStack Query hooks from `src/lib/api.ts`. Do not call `authFetch()` directly from route components for queries.
- For mutations (POST/PATCH/DELETE), use `authFetch()` directly inside event handlers — `useMutation()` is optional for simple cases.
- Follow React rules-of-hooks strictly. No hook calls inside conditions or loops.
- Avoid prop drilling beyond 2 levels — use context or co-locate state.
- All new route files follow the existing naming convention: `_app.[name].tsx` for authenticated routes.

### PHP Rules

- Every PHP file begins with `declare(strict_types=1);`
- Every API endpoint starts with `require __DIR__ . '/db.php';`
- Every authenticated endpoint calls `$authUser = dolphin_require_auth();` before any logic
- `$clientId` is ALWAYS set from `$authUser['client_id']` — never from `$_GET`, `$_POST`, or `$_REQUEST`
- All DB queries use PDO prepared statements — no raw string interpolation in SQL
- Use `dolphin_send_json($data, $status)` for all responses
- Handle method restrictions explicitly: `if ($_SERVER['REQUEST_METHOD'] !== 'POST') { dolphin_send_json(['error' => 'POST only'], 405); }`

### SQL Rules

- All data tables have `client_id INT NOT NULL FK → clients(id)`
- Every SELECT on a data table includes `WHERE [table].client_id = ?` bound to `$clientId`
- Use `WHERE ... AND` to filter — never remove the `client_id` filter even for admin endpoints (admins can filter by a specific `client_id` they select)
- No `SELECT *` in production queries — enumerate required columns
- Index on `(client_id, [sort_field])` for frequently-queried tables

---

## Multi-Tenant Rules

These are security rules, not style preferences.

1. **Source of truth for client identity**: `$authUser['client_id']` from `dolphin_require_auth()`. Always.
2. **No client slug from caller**: API endpoints do not accept `client_slug`, `client_id`, or similar parameters from the request to determine data scope. These are derived from the auth session.
3. **Entity validation**: When an entity code is received from the frontend, validate it exists for the authenticated client: `SELECT code FROM client_entities WHERE client_id = ? AND code = ?`
4. **Consolidated entity check**: `SELECT code FROM client_entities WHERE client_id = ? AND is_consolidated = 1` — not `=== "FL"`.
5. **Frontend context**: Entity codes, base years, config values, and target values always come from `useClientContext()`. Never hardcode them.

---

## Documentation Rules

- **CHANGELOG.md**: Add an entry for every sprint or significant change session. Format: `## YYYY-MM-DD — Description` followed by bullet points. Newest entries first.
- **SESSION_HANDOFF.md**: Update the "Last Updated", "Completed This Session", "Currently Working On", and "Files Recently Changed" sections at the end of every working session.
- **TODO.md**: Add new discovered issues here. Mark items as resolved when fixed. Prioritize the list after each sprint.
- **ADRs**: Write a new ADR in `docs/ADRs/` for any major architectural decision. Follow the existing ADR format.
- **Do not create** new documentation files unless explicitly asked. Don't add READMEs to subdirectories, don't write inline docs in code files.
- **Do not update** existing docs for minor code changes — only update docs when the documented behavior actually changes.

---

## Git Rules

- **Commit often**: Small, focused commits are better than large, mixed ones.
- **New commits only**: Never amend an existing commit unless the commit has not been pushed and the user explicitly asks.
- **No `--no-verify`**: Never skip pre-commit hooks.
- **No force push to main**: Always ask the user before force-pushing.
- **Staged files**: Review `git status` before `git add` — don't accidentally stage `.env`, large binaries, or credentials.
- **Commit message format**: Imperative mood, present tense. Explain the WHY, not the WHAT. Example: "Fix cross-tenant data leak in submissions endpoint" not "Changed submissions.php to use client_id".
- **Co-authored-by**: When Claude creates a commit, include: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Review Process

### Before Requesting Review

- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] `npm run build:fresh` succeeds without warnings
- [ ] All new PHP endpoints follow the `dolphin_require_auth()` + `$clientId` pattern
- [ ] No hardcoded client names, entity codes, or base years introduced
- [ ] CHANGELOG.md updated with the changes
- [ ] SESSION_HANDOFF.md updated

### Code Review Checklist

- [ ] Product purpose: does this serve at least one of the six platform goals (manage more clients / consulting quality / reduce manual work / client collaboration / carbon neutrality / client self-direction)?
- [ ] Multi-tenant: does every new query filter by `client_id`?
- [ ] Security: is `client_id` derived from auth session, not request params?
- [ ] TypeScript: 0 errors?
- [ ] No hardcoded client-specific values?
- [ ] Comments: only present for non-obvious WHY?
- [ ] Scope: does the change stay within the stated task?
- [ ] Tests: are the Epic's testing checklist items verified?

---

## QA Process

There is no automated test suite (yet). QA relies on:

1. **TypeScript check**: `npx tsc --noEmit` — always run before calling work complete
2. **Build check**: `npm run build:fresh` — always run before deploying
3. **Manual testing**: Test the golden path and edge cases for every changed feature
4. **Multi-tenant check**: Test with at least one Featherlite user after any auth/data change
5. **Epic testing checklists**: Each Epic in `docs/IMPLEMENTATION_BACKLOG.md` has a specific testing checklist — complete every item before marking the Epic done

### Testing Login States
- Test as `deepwoods_admin` — sees all clients
- Test as `sustainability_team` for the relevant client — sees only their data
- Test as `client_uploader` — restricted to data submission only
- Demo mode: `loginDemo()` in console — uses mock data, no backend required

---

## Architecture Rules

- **No new backend languages**: Backend is PHP 8 on Hostinger. Do not introduce Node.js, Python, or any other backend language.
- **No new infrastructure**: No Docker, no cloud services, no CI/CD pipelines without explicit decision-making.
- **New API endpoints**: Follow the existing pattern — `dolphin_require_auth()`, `dolphin_db()`, prepared statements, `dolphin_send_json()`.
- **New frontend hooks**: Add to `src/lib/api.ts`. Follow the existing `useQuery` pattern.
- **New routes**: Add to `src/routes/` following the `_app.[name].tsx` naming convention for authenticated routes.
- **Database changes**: Write a migration script in `database/migrations/`. Update `database/schema_combined.sql`. Document in `docs/DATABASE_SCHEMA.md`.

---

## UI Consistency Rules

- Use shadcn/ui components as the foundation. Do not create one-off custom components for things shadcn/ui covers.
- Follow Tailwind CSS v4 conventions. No inline styles. No `style={{}}` props.
- Page layout: use `<PageHeader>` and `<PageBody>` from `src/components/portal.tsx`.
- Data display: use `<StatCard>` and `<Section>` from `src/components/portal.tsx`.
- Loading states: use skeleton loaders consistent with existing pages.
- Empty states: guide the user to the next action — never show a blank white area without explanation.
- Error states: explain what went wrong and what the user can do — no "Something went wrong" without a recovery path.

---

## Definition of Done

A feature, Epic, or task is Done when:

1. ✅ The stated functionality works as described in the Definition of Done section of the Epic
2. ✅ `npx tsc --noEmit` returns 0 errors
3. ✅ `npm run build:fresh` succeeds
4. ✅ All items in the Epic's testing checklist are verified
5. ✅ No hardcoded client-specific values introduced
6. ✅ No cross-tenant data leakage introduced
7. ✅ CHANGELOG.md updated
8. ✅ SESSION_HANDOFF.md updated
9. ✅ Featherlite (existing client) still works correctly — regression verified
