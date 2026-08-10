# Component Map

All frontend components, their locations, and usage.

---

## Page Layout Primitives — `src/components/portal.tsx`

Used by virtually every route page as the foundational layout system.

| Export | Purpose | Props |
|---|---|---|
| `PageHeader` | Top card with eyebrow badge, title, description, optional right slot | `eyebrow?`, `title`, `description?`, `right?` |
| `PageBody` | Max-width content wrapper with horizontal padding | `children` |
| `Section` | Section with green left-bar accent | `title`, `subtitle?`, `right?`, `children` |
| `Card` | Rounded white card with shadow | `children`, `className?` |
| `StatCard` | KPI tile with label, value, unit, delta | `label`, `value`, `unit?`, `delta?`, `tone?` |
| `LockedState` | Role-restricted access UI | `title` (required), `message` (required) |
| `fmt` | Number formatter (default 3 decimal places) | `(n: number \| null, dp?: number) => string` |
| `fmtInt` | Integer formatter | `(n: number) => string` |

**`StatCard` tone variants:** `default`, `green`, `navy`, `success`, `warning`, `alert`

**`StatCard` delta prop:** `{ pct: number; direction: "up" | "down"; good?: boolean }` — note: `good` drives colour (green/red), separate from direction.

---

## AI Assistant — `src/components/DeecarbAI.tsx`

Floating chat widget that appears on all authenticated pages.

- Calls **Groq API** (`llama-3.3-70b-versatile` model)
- Uses a pool of 5 hardcoded Groq API keys with round-robin rotation for rate limiting
- System prompt is dynamically built with:
  - Client entity names and GHG data
  - Current entity and fiscal year context
  - Inventory totals (S1, S2, S3)
  - Decarbonisation levers
- Collapsible panel (bottom-right corner)
- Messages use streaming-style display

**Key issue (Phase 8):** API keys are hardcoded in the component file — should be server-side.

---

## Decarbonisation Shared — `src/components/decarb/shared.tsx`

Shared primitives for the decarbonisation feature group.

| Export | Purpose |
|---|---|
| `PageHeader` | Decarb-styled page header — `{ title, description, right? }` (note: `description` is required here, unlike `portal.tsx`) |
| `Card` | Decarb-styled card |
| `CardHeader` | Card header with title, subtitle, right slot |
| `ScopeBadge` | Scope badge — `{ scope: 0\|1\|2\|3 }` where 0 = "Enabler" |
| `HowToRead` | Callout block explaining how to interpret a chart |
| `DNF` | "Data not found" — `{ block?: boolean, label?: string }` — can be inline or block |
| `fmt` | Indian-locale number formatter — `(n: number, d?: number) => string` |
| `ScenarioProvider` | Context provider for scenario lever state |
| `useScenario` | Hook to read/write scenario state (throws if outside ScenarioProvider) |
| `abatementFor(action, pct)` | Computes abatement tCO2e — uses `action.impactMin/impactMax/costPerT` (fields not yet in `DecarbAction` type — see TODO CT-2) |
| `costFor(action, pct)` | Computes cost — uses `abatementFor` × `action.costPerT` |
| `ScenarioCtx` | Raw React context object (use `useScenario()` instead) |

Note: `fmt` in this file uses `en-IN` locale (Indian number formatting). The `fmt` in `portal.tsx` uses the browser default locale. They are not interchangeable.

---

## Sidebar & Shell — `src/routes/_app.tsx`

The authenticated layout shell. Not a component file but contains major inline components:

| Inline component | Purpose |
|---|---|
| `AppSidebar` | Full sidebar with nav groups, entity/FY bar, collapse logic |
| `EntityBar` | Top bar showing current entity + FY with switchers |
| `ChangePasswordModal` | Forced password change dialog (on `mustChangePassword` flag) |
| Nav item groups | Carbon Footprint / Decarbonisation / Green Finance / Compliance / Reporting Cycle |

---

## UI Primitives — `src/components/ui/` (46 components)

All from **shadcn/ui** (New York style). These are copy-pasted primitives, not a dependency — they live in the repo and can be modified.

| Component | Radix Primitive | Usage |
|---|---|---|
| `accordion` | Radix Accordion | Expandable sections |
| `alert` | — | Status messages |
| `alert-dialog` | Radix AlertDialog | Confirmation dialogs |
| `aspect-ratio` | Radix AspectRatio | Fixed ratio containers |
| `avatar` | Radix Avatar | User avatars |
| `badge` | — | Status tags, scope labels |
| `breadcrumb` | — | Page path |
| `button` | Radix Slot | All buttons |
| `calendar` | react-day-picker | Date selection |
| `card` | — | Generic cards |
| `carousel` | embla-carousel-react | Image carousels |
| `chart` | recharts | Chart wrapper utilities |
| `checkbox` | Radix Checkbox | Form checkboxes |
| `collapsible` | Radix Collapsible | Collapsible sections |
| `command` | cmdk | Command palette |
| `context-menu` | Radix ContextMenu | Right-click menus |
| `dialog` | Radix Dialog | Modal dialogs |
| `drawer` | vaul | Bottom/side drawers |
| `dropdown-menu` | Radix DropdownMenu | Dropdown menus |
| `form` | react-hook-form | Form containers with validation |
| `hover-card` | Radix HoverCard | Tooltip-like hover panels |
| `input` | — | Text inputs |
| `input-otp` | input-otp | OTP code entry |
| `label` | Radix Label | Form labels |
| `menubar` | Radix Menubar | Menu bars |
| `navigation-menu` | Radix NavigationMenu | Multi-level nav |
| `pagination` | — | Page pagination |
| `popover` | Radix Popover | Popovers |
| `progress` | Radix Progress | Progress bars |
| `radio-group` | Radix RadioGroup | Radio button groups |
| `resizable` | react-resizable-panels | Resizable panels |
| `scroll-area` | Radix ScrollArea | Custom scrollbars |
| `select` | Radix Select | Dropdowns |
| `separator` | Radix Separator | Horizontal/vertical rules |
| `sheet` | Radix Dialog | Side sheets/drawers |
| `sidebar` | — | App sidebar scaffolding |
| `skeleton` | — | Loading placeholder |
| `slider` | Radix Slider | Range sliders |
| `sonner` | sonner | Toast notifications |
| `switch` | Radix Switch | Toggle switches |
| `table` | — | Data tables |
| `tabs` | Radix Tabs | Tabbed panels |
| `textarea` | — | Multi-line text |
| `toggle` | Radix Toggle | Toggle buttons |
| `toggle-group` | Radix ToggleGroup | Toggle button groups |
| `tooltip` | Radix Tooltip | Hover tooltips |

---

## Context & State Components

### `src/lib/entity.tsx`
| Export | Purpose |
|---|---|
| `EntityProvider` | Wraps app; persists entity in `localStorage` key `decarb_entity` |
| `useEntity()` | Returns `{ entity, setEntity }` |
| `FiscalYearProvider` | Wraps app; persists FY in `localStorage` key `decarb_fy`; defaults to last year in `useAnalysisYears()` |
| `useFiscalYear()` | Returns `{ fy, setFY }` — note capital Y in `setFY` |
| `EntitySwitcher` | Pill-button switcher showing all entities from context | 
| `FiscalYearSwitcher` | Pill-button switcher showing analysis years from context |
| `EntityBadge` | Badge showing `entity.short` (not `code`); shows consolidated children for rollup entities |

### `src/lib/client-context.tsx`
| Export | Purpose |
|---|---|
| `ClientContextProvider` | Fetches `context.php` on mount; caches in `sessionStorage` key `decarb_client_ctx` |
| `useClientContext()` | Returns full `ClientContext`; suspends (throws Promise) while loading |
| `useClientContextSafe()` | Non-throwing version; returns `{ status: "loading"|"ready"|"error", data? }` |
| `clearClientContext()` | Wipes cached context from sessionStorage — called on logout |
| `useDataEntryEntities()` | Returns non-consolidated entities only |
| `useConsolidatedEntity()` | Returns the consolidated entity (or `undefined`) |
| `useAnalysisYears()` | Returns analysis years (excludes current open year by default) |
| `useCurrencySymbol()` | Returns `₹` or `$` based on client.currency |
| `entityColor(sortOrder: number)` | Returns palette color for a given sort_order position (not entity code!) |
| `useEntityColor()` | Returns a `(code: string) => string` function that resolves color for any entity code |

---

## Hooks — `src/lib/`

| File | Export | Purpose |
|---|---|---|
| `src/lib/use-mobile.tsx` | `useIsMobile()` | Returns `true` when viewport < 768px (breakpoint 768px) |

Note: there is no `src/hooks/` directory — `use-mobile.tsx` lives in `src/lib/`.

---

## Other `src/lib/` Files

| File | Purpose |
|---|---|
| `src/lib/utils.ts` | Tailwind class-merge utility (`cn()` helper from shadcn/ui) |
| `src/lib/error-capture.ts` | Error capture wrapper (used by error boundaries) |
| `src/lib/error-page.ts` | Error page renderer helper |
| `src/lib/lovable-error-reporting.ts` | **Dead code** — reports to `window.__lovableEvents` (Lovable platform hook). No longer relevant; safe to delete (see ARC-TD7) |
| `src/lib/ghg-config.ts` | Apps Script integration config (documented separately in AUTOMATIONS.md) |
| `src/lib/submissionsStore.ts` | Typed submission API client (documented separately in API_MAP.md) |

## Other `src/data/` Files

| File | Purpose |
|---|---|
| `src/data/featherlite.ts` | Auto-generated Featherlite-specific GHG constants (being retired — see CT-2) |
| `src/data/decarb-data.ts` | Featherlite decarbonisation mock data with hardcoded entities and facilities (being retired — see CT-2) |
| `src/data/datasets.ts` | Dataset definitions re-exported via `master.ts` |
| `src/data/master.ts` | Platform-level constants: `CARBON_PRICES`, `IREC_FACTOR`, `IREC_COST_PER_MWH`, `GROQ_MODEL`, `REPORTING_WORKFLOW`. Re-exports from `datasets.ts`. |

---

## Page-Level Component Inventory

Large inline components defined within route files (not extracted yet):

| Route File | Notable Inline Components |
|---|---|
| `_app.dashboard.tsx` | `S2WaterfallChart`, `S2SankeyChart`, `FuelPieChart` |
| `_app.inventory.tsx` | `AssetDrawer`, `FacilityCard`, `SparklineChart` |
| `_app.action-plan.tsx` | `LeverCard`, `ScenarioPanel`, `AbatementChart` |
| `_app.green-finance.tsx` | `CarbonPriceCard`, `PnLChart`, `CBAMTable` |
| `_app.reporting.tsx` | `DayCycleTimeline`, `EmailEventLog`, `TestControlBar` |
| `_app.submissions.tsx` | `DatasetCard`, `FileUploadZone`, `SubmissionTable` |

**Refactoring opportunity:** These large inline components should be extracted to `src/components/features/` as the codebase grows. See `docs/ARCHITECTURE_REVIEW.md`.
