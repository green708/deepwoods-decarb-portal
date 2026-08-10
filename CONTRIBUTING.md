# Contributing Guide

Standards and conventions for all code contributed to the Decarb Platform.

---

## Non-negotiable rules

These apply to every change, no exceptions:

### 1. No hardcoded client data

Never add to the codebase:
- Client names: "Featherlite", "Kreenz", or any other
- Entity codes as string literals: `=== "FL"`, `=== "FP"`, `=== "FOS"`
- Facility names: "Rajanakunte", "Hejjala", etc.
- Customer emails: `ghg@featherlite.com`, etc.
- GHG client IDs: `FL-FOS-GHG-FY26`

**Use instead:**
```typescript
// Entity check
ctx.entities.find(e => e.is_consolidated)?.code  // NOT === "FL"

// Client name
ctx.client.name  // NOT "Featherlite"

// Data
useInventory()   // NOT import from featherlite.ts
```

### 2. No static client data files

`src/data/` contains only platform-wide constants (`master.ts`, `datasets.ts`).
Never add files like `featherlite.ts`, `client-data.ts`, or `inventory-snapshot.ts`.
All client data lives in MySQL and is fetched via API hooks.

### 3. Auth on every PHP endpoint

Every `backend/api/*.php` file must call `dolphin_require_auth()` as its first action.

```php
require_once __DIR__ . "/../auth_middleware.php";
$user = dolphin_require_auth();
```

### 4. Multi-tenant queries

Every database query that reads or writes data must filter by `client_id`:

```php
$stmt = $pdo->prepare("SELECT * FROM submissions WHERE client_id = ? AND ...");
$stmt->execute([$user->client_id, ...]);
```

---

## TypeScript conventions

- **Path aliases:** Use `@/` for `src/`. Never use relative `../../` imports.
- **API hooks:** Add new data hooks to `src/lib/api.ts`. Return type must be explicit.
- **Component files:** One component per file. File name matches component name.
- **No `any`:** Avoid `any` types. Use `unknown` and narrow with guards.
- **Comments:** Only add a comment when the WHY is non-obvious. No `// TODO` without
  an issue reference.

## PHP conventions

- **One file per endpoint** under `backend/api/`
- **JSON output always:** `header("Content-Type: application/json");`
- **Prepared statements always:** Never interpolate user input into SQL
- **Error format:** `{"error": "descriptive message"}` with appropriate HTTP status code
- **No framework:** Plain PHP 8 only — no Composer, no dependencies

## CSS conventions

- **Tailwind CSS v4 only** — no raw CSS unless it's in `src/styles.css`
- **Design tokens:** Use CSS variables (`--primary`, `--navy`, `--success`) not hex values
- **shadcn/ui components:** Don't modify files in `src/components/ui/` directly.
  Override via Tailwind classes at the call site.

---

## Branch strategy

```
main          Production-ready code only. No direct commits.
feature/*     New features
fix/*         Bug fixes
docs/*        Documentation changes
refactor/*    Code improvements with no behaviour change
```

## Commit message format

```
type: short description (max 72 chars)

Longer explanation if needed. Focus on WHY, not WHAT.
```

Types: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`

Examples:
```
feat: add pagination to submissions endpoint
fix: correct scope 2 market-based calculation for zero-REC case
docs: update DEPLOYMENT_GUIDE with proxy config instructions
refactor: extract GHG calculation helpers from dashboard route
```

## Pull requests

Every PR must:
1. Reference a task or issue in the description
2. Include a one-paragraph summary of what changed and why
3. List how the change was tested (even if manually)
4. Pass `npx tsc --noEmit` with zero errors
5. Have no new `featherlite` string literals in `src/`

## Code review

Reviews should check:
- Does this add any hardcoded client data? (block)
- Does every new PHP endpoint call `dolphin_require_auth()`? (block)
- Is new client data fetched from the API, not hardcoded? (block)
- Are there any new security vulnerabilities? (block)
- Is the code readable without comments? (style feedback)

---

## Testing

Currently manual. When running a change:
1. Start `npm run dev`
2. Test the affected route in the browser
3. Check the browser console for errors
4. Check the network tab for failed API calls

See `tests/README.md` for the planned automated test setup.
