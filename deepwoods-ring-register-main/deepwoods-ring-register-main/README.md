# Deepwoods Onboarding

Lovable Prompt — Deepwoods GHG Portal: Accounts-based Onboarding (Featherlite-aligned palette)

Paste everything below into Lovable as your project prompt. The process is unchanged from earlier passes (each legal entity/subsidiary is its own Account, created and managed independently; login gate; combined Overview; the Register in place of a flat Accounts table; Manage Team in place of Contacts). What's changed this time is only the color palette and typeface — pulled from the Featherlite report screenshot the client has already seen and approved, so the app reads consistent with reporting output they already like. Every structural/interaction decision from earlier passes (the growth-ring motif, the numbered ledger rows on the Register, the stamp-style status badges, the wizard stepper) stays exactly as designed — only its paint job changes.

Only build the onboarding + account-management flow described below, plus the one combined Overview dashboard described in its own section. Do not build out the other real feature pages (Carbon Footprint, Decarbonisation, etc.) — they only need to exist as locked/disabled nav items once inside an account.

For this design pass, remove mandatory-field enforcement everywhere. Required-field dots can stay on labels as a reference for later, but no field, anywhere in the wizard or Company Profile, should block a "Next," "Save," or "Submit" action just because it's empty. The goal right now is to review the flow and the design without validation getting in the way — real enforcement comes in a later build.

Naming note: the entity list is called "Register" in the UI and everywhere below — not "Accounts." "Accounts" got confusing once logins exist at both the group level and the per-entity level, so the page users browse to find their entities is the Register; the thing someone signs in with is a login. Internally in the data model it's still fine to call the array accounts[] — only the user-facing label, breadcrumb, and button text change.

Design direction

The structure and interaction patterns below are locked in from earlier design passes — a growth-ring motif standing in for dots/lines wherever there's a sequence or a status, numbered ledger rows on the Register instead of a flat table, stamp-style status badges. What changes here is only the color palette and typeface, taken from the Featherlite report screenshot: clean white cards on a very light page background, a dark forest green as the brand/primary color, a warm coral-red as the single "needs attention" accent (used for the active nav state, unfavorable trend arrows, and errors alike, the same way the reference does it), and bold black numerals — nothing else about layout or component shape is pulled from that screenshot.

Color palette

Token Hex Use Ink #111827 Primary text, bold numeric values, headings Canopy #1F4B3B Brand/primary color — sidebar section heading, primary buttons, numbered ring-stepper fill Meadow #1E9E5A Favorable/positive deltas, "Accepted" status stamp, good-outcome highlights (e.g. zero market-based emissions) Coral #E4572E The one "needs attention" accent, reused everywhere the reference reuses it — active sidebar nav state, unfavorable/negative trend arrows, validation and login errors, notification badges Amber #C97A2E "Pending review" status only — kept distinct from Coral so a status badge is never mistaken for a trend direction or an error Mint #DCEEE1 Pale tint behind small chips/tags (e.g. the fiscal-year chip) Coral tint #FDEAE3 Pale tint behind the active sidebar nav item Paper #F6F7F5 Page background White #FFFFFF Cards, sidebar background Border #E5E7E3 Hairlines, card borders, dividers Slate #6B7280 Muted uppercase micro-labels, captions, helper text

Draft/inactive status uses a plain neutral gray (#9CA3AF), not one of the brand colors.

Typography

One family throughout — Inter (a clean humanist sans that matches the proportions in the reference screenshot; swap in the exact brand font file if the client has one licensed for these reports specifically).

Page titles / section headers: Inter, 600–700 weight, 28–34px for page titles, 18–20px for card titles.

Body copy, labels, buttons, helper text: Inter, 400–500 weight, 14px.

Numeric values (KPI figures, table numbers, tCO2e): Inter, 700 weight — bold within the same family, no separate monospace face this time, matching how the reference sets its numerals.

Small uppercase micro-labels (e.g. "TOTAL FOOTPRINT FY25," "REPORTING ENTITY"): Inter, 500 weight, 11px, ~0.05em letter-spacing, Slate color.

Signature element: the growth ring (unchanged, recolored)

Wizard stepper: nested rings side by side, each ~34–40px. Completed steps are solid Canopy-filled circles with a white step number; the current step is an unfilled circle with a thick Coral stroke (this pairs naturally, since Coral is already the "this one's active" color everywhere else); upcoming steps are thin Border-gray outlined circles. Label each with its step name in small Inter underneath.

Page watermark: a large, very faint (4–6% opacity) set of concentric Ink-colored rings bleeding off the top-right corner of the Register screen and the Home page inside an account. Decorative only, never interactive.

Nav bullets: each sidebar nav item gets a small hollow Border-gray ring bullet; the active item's ring fills solid Coral.

Do not use tree/leaf iconography beyond this — no literal leaf icons, no green gradient hero banners. The ring is the whole motif; keep everything else disciplined.

Component styling

Page layout: every screen fills the full content width to the right of the sidebar — Register, the registration wizard, and Company Profile are all full-page, edge to edge, not centered narrow cards or modals. This matches the approved reference screenshots.

Sidebar: switches to a white/near-white background (this is the one big change from earlier passes, matching the reference). Wordmark treated like a small lockup at the top: "DEEPWOODS" small-caps in Canopy, "GREEN" below it in Inter bold, a thin Border-gray hairline underneath separating it from the nav.

Nav items: Ink-colored text on white, rounded-rectangle rows; the active item gets a Coral-tint background, Coral text, and a thin Coral bar on its left edge — matching exactly how the reference highlights "Overview" in its own sidebar.

Buttons: primary buttons solid Canopy, white text, 6px corner radius. Secondary/outline buttons Coral-outlined. No neon, no gradients.

Links: Coral, underline on hover — not the default SaaS blue.

Status badges: outlined "stamp" style — small filled dot + label, outlined in the status color (Meadow/Amber/neutral gray) — same shape as earlier passes, just recolored.

KPI cards: white cards, thin Border-gray outline; the single headline metric (Total Footprint) gets a 3–4px solid Coral left-edge bar to draw the eye, exactly like the reference; favorable deltas in Meadow with a down-triangle, unfavorable deltas in Coral with an up-triangle.

Tables / ledger rows: white background, dashed Border-gray hairlines between rows, Slate uppercase micro-labels, Ink for values — all in Inter, bold for the numbers, no monospace treatment this time.

Cards (Home page "Registration outcome," "Get started"): white on Paper background, 10–12px radius, thin Border-gray outline, no drop shadow beyond a very soft one.

Empty/failure states: written in a plain, ledger-log voice — e.g. "No accounts logged yet." / "Nothing on record for that search." — never apologetic, never cutesy. Error/validation banners use Coral.

A floating "Help" button, bottom-right, on every screen — square-ish rounded corners (6px), Canopy background, white icon.

A static HTML reference mockup (field-ledger-mockup.html) from an earlier pass is still provided alongside this prompt for the ring motif and stamp-badge shapes, but its colors and font are now superseded by the palette and typeface above — use it for shape/motif reference only, not for exact colors.

Overall structure

The logged-in user here is FL (Featherlite Furnitures) — the parent umbrella. For this build, only one of its operating companies is being onboarded onto the portal: Featherlite Office Systems. FL itself has no facilities and never becomes an Account — it's purely the login context. What FL actually does is create one Account per real operating company it wants onboarded; the mechanism supports more than one, this build's seed data just reflects the one entity in scope right now.

There are four levels to this app:

Login screen — the true entry point, before anything else. Gates access to everything below.

Top level (FL's own context, before entering any account) — a sidebar with two sibling tabs: "Overview" (a combined dashboard across every Account FL has created — see the dedicated section below) and "Register" (the list of entities FL manages — currently just Featherlite Office Systems). Register stays the landing page after login, same as before; Overview sits right next to it in the sidebar.

Registration wizard — launched by "Register entity," used to set up one new entity end-to-end (its own company details, facilities, team, and payment).

Inside an account — once you open an entry from the Register, you enter that specific company's workspace: its own sidebar, its own Home, and its own Company Profile for edits.

0. Login screen

No sidebar here — this screen stands alone, before the app shell exists.

Full-height Paper background, the faint growth-ring watermark bleeding softly off one corner, same as elsewhere.

Centered white card (Border-gray outline, 10–12px radius, ~380px wide) containing:

The wordmark lockup at the top of the card: small-caps "DEEPWOODS" in Canopy over "GREEN" in Inter bold, same treatment as the sidebar.

Heading: "Sign in" (Inter, 600–700 weight).

Email or username field. Helper: "Use the username or email issued when your organisation was set up with Deepwoods."

Password field, with a show/hide toggle icon. Helper: none needed.

Primary button: "Sign in" (solid Canopy, full-width within the card).

A quiet "Forgot password?" link (Coral) underneath — stub only, opens a toast: "Contact your Deepwoods administrator to reset your password."

On a failed attempt, show an inline Coral banner above the fields: "That username or password doesn't match our records." — written plainly, no apology.

Below the card, in small muted text (demo-only, would not exist in production): "Demo credentials — Username: Featherlite Furnitures · Password: 123" — so whoever's demoing it doesn't have to remember them.

On success, route straight into the app shell landing on the Register (per the structure above). No session needs to persist across a page refresh for this demo — a simple in-memory loggedIn flag is enough.

1. Top-level Overview dashboard

This lives at the same level as "Register" in the sidebar — it's FL's own tab, not something you get to by opening a specific account. It shows GHG performance aggregated across every Account FL manages — right now that's just Featherlite Office Systems, since it's the only registered entity, but the aggregation logic should sum across however many accounts exist rather than assume exactly one, so it combines automatically the moment a second entity is registered. It reuses the KPI-band-plus-charts layout style the client has already seen in an existing Deepwoods report, and with no single company name anywhere in the header — this page is explicitly the group-level view, not any one entity's page.

Top strip: a small Mint-tinted chip showing the active fiscal year (e.g. "◆ FY25") with a dropdown to change it — no company name next to it, just the year. Do not reintroduce a breadcrumb or org name here.

Page heading: "Overview" in Inter, 600–700 weight, with a one-line Slate subtitle underneath describing methodology/base years, e.g. "GHG Protocol + ISO 14064-1, operational control. Scope 1 & 2 base year FY22 · Scope 3 base year FY26. Use the fiscal year selector above to change the reporting period." Word it generically (methodology/base year info), not tied to one entity.

KPI band (5 cards in a row): Total Footprint (selected FY), Scope 1, Scope 2, Scope 3, and a "YoY on Fixed Base Year" card — each with the tCO2e figure bold in Ink, a small up/down badge with % change (Meadow for favorable, Coral for unfavorable), and a one-line caption underneath (e.g. which baseline it's measured against). The Total Footprint card gets the Coral left-edge bar described above. Populate with plausible mock figures for demo purposes — real numbers come later from the calculation plugins.

Row of two charts: "Scope 1+2 (Market-Based) vs Reduction Pace" (line chart, actual vs. reference-pathway line) and "Gross-to-Net Waterfall" (bar/waterfall showing location-based footprint → market-based instruments applied → net position).

Row of three charts: "Scope Composition" (donut, Scope 1/2/3 split), "Scope 3 Category Contribution" (bar chart across Scope 3 categories, sorted largest first), and "Location-Based vs Market-Based Footprint" (comparison chart).

Row of two charts: "Emission Intensity — Nominal" and "Emission Intensity — Inflation-Adjusted" (both line charts, revenue-normalised, with a legend distinguishing location-based vs. market-based intensity).

Every chart card gets a "How to read it" caption band underneath, one or two plain-language sentences explaining what the chart shows and why it moved — same pattern as the reference report, restyled with a small ring-glyph number chip (Canopy fill, white numeral) instead of the reference's plain colored square, and Canopy/Meadow/Coral/Amber as the chart accent colors.

Since this is meant to be a combined, group-level view once there's more than one entity, word any explanatory captions generically — e.g. "Aggregated across all entities in your group" — rather than hardcoding today's single entity name, so nothing needs rewriting the moment a second account is registered.

2. Register screen

This is the page that most needed to stop looking like SBTi's — not just recolored, but structurally different from a header + search bar + flat multi-column table + pagination, since that generic pattern is what made it feel like a copy in the first place.

Sidebar: wordmark lockup at top, then two nav items — "Overview" and "Register" (Register highlighted/active here, Coral-tint background per the component styling above).

Page header: "Register" in Inter bold, large, with a one-line Slate subtitle underneath: "Every entity in your group, logged and dated." Beneath that, a small tally line, generated from the data rather than hardcoded: e.g. "1 entity · 1 accepted · 0 pending." The faint ring watermark bleeds off the top-right, same as before.

"+ Register entity" button top-right (solid Canopy, 6px radius) — this replaces "+ Create account."

Search bar below the header: magnifying-glass icon + placeholder "Search by company name", with a small filter/sort icon button to the right.

The list itself is a numbered ledger, not a flat table. Each entity renders as a single collapsed row:

Left: a small ring-glyph (Canopy fill) with the entry number inside it — "No. 001," "No. 002," etc. — instead of a generic table index.

Middle: company name in bold Ink, with its status stamp directly beneath it.

Right: a chevron to expand, and an "Open →" link (Coral, replacing "Show") — only active when status is Accepted, grayed out otherwise.

Clicking anywhere on the row (not just the chevron) expands it in place — a "flip the ledger entry open" interaction. The expanded panel is refined from the first pass — approved content, upgraded look:

The panel's background is Paper (a shade lighter than the row's white header above it), separated by a thin Border-gray top divider, so it visibly reads as "flipped open" rather than just more text under a line.

Instead of one flat, unlabeled grid of six fields, split it into two labeled clusters, each with a small Slate uppercase micro-label above it and a tiny icon (14–16px, Slate) next to each field's own label: "About this entity" — Organization type (building icon), Facility count (map-pin icon), Team members (people icon) — and "Activity" — Creation date, Last edit date, Updated by (small calendar/clock icons). These are small functional icons for scanability only, not a second decorative motif — they sit alongside the ring system described earlier, not instead of it. Figures (facility count, team member count) stay bold Ink; dates stay regular weight.

Plan & Billing gets its own bordered mini-card within the expanded panel, not just another grid row — since it's the one actionable item in an otherwise read-only panel, it should look distinct: plan name bold, its status stamp (Paid/Due) next to it, and "View invoices →" right-aligned inside that same mini-card, jumping straight to that entity's Company Profile → Billing tab.

Only after seeing all of this does the user click "Open →" to actually enter the account.

Rows are separated by a dashed Border-gray hairline. No visible column headers — the numbered-entry format replaces them.

Pagination footer: "Page X of Y" on the left, "Previous"/"Next" buttons on the right (disabled state when not applicable).

Sidebar footer: "User profile", then "Logout", separated by a thin Border-gray divider — no Company profile item here, since you're not inside any specific company yet.

Seed with exactly this one real row — no placeholder/fictitious companies, and no Featherlite Products entry (it's out of scope for this build):

No. Company name Status Open Organization type Industry 001 Featherlite Office Systems Pvt Ltd Accepted enabled Private Limited Furniture manufacturing

The row is Accepted with Open → clickable — don't seed a Pending or Draft row this time. If you want to demonstrate the Pending/Draft states, or a second entity, do it live by running "Register entity" in the demo rather than hardcoding extra fake rows.

3. Register entity → Registration wizard

Clicking "Register entity" opens the wizard as a full page, not a modal or a narrow centered card — it takes over the entire content area to the right of the sidebar, edge to edge, exactly like the approved reference screenshot. The growth-ring stepper (described above) runs across the full width of the top, all 5 steps visible at once, with a " Required fields"* legend beneath it (visual reference only — see the note above about skipping enforcement for now). Fields below the stepper lay out in a full-width two-column grid, not a narrow single column. Steps, in order:

Step 1 — Company Details

Every field below gets a short helper line underneath it, in the exact wording given — these are not optional decoration, they're what stops a user from guessing wrong on a form they usually fill in once a year:

Is your organisation registered in India? — Yes/No toggle. Helper: "This determines whether we ask for a GSTIN or a general business registration / tax ID."

GSTIN (label switches to "Business Registration Number / Tax ID" if "No" was selected) — required. Helper: "Your 15-character GST Identification Number, as shown on your GST registration certificate." / for the non-India label: "The primary business registration or tax ID issued in your country of incorporation."

Legal name of the organisation — required. Helper: "The exact registered name on your incorporation or registration certificate — this is what will appear on official reports."

Operating name of the organisation (if different) — Helper: "Name as you want it displayed across the portal and any reports, if different from the legal name above."

Industry — required dropdown (Manufacturing, Textiles & Apparel, Chemicals, Food & Beverage, IT/Technology, Financial Services, Real Estate & Construction, Logistics & Transportation, Other). Helper: "Choose the sector closest to your primary business activity — this affects the default emission factors used in your calculations."

Organisational Type — dropdown (Private Limited, Public Limited, LLP, Partnership, Sole Proprietorship, Other). Helper: "Your legal structure, as stated on your registration documents."

Is your organisation registered as an MSME? — Yes/No toggle → reveals "Udyam Registration Number" field if Yes. Helper: "Select Yes if you hold an Udyam (or equivalent) MSME registration." / Udyam field helper: "Format: UDYAM-XX-00-0000000."

Legal Address — required, textarea. Helper: "Your registered head office address. This will automatically become your first facility in the next step, so double-check it here."

Organisation Website — required. Helper: "Include https:// — this is used on client-facing reports."

Upload Company Logo — drag-and-drop upload box. Helper: "PNG or SVG with a transparent background works best. Used on your reports and in the portal header."

Style each field with a bold label + required-field dot, an outlined input box (Border-gray, Coral border on focus), and the helper text in small Slate directly underneath. Use a tooltip icon (ⓘ) next to fields that need extra explanation beyond the helper line.

Step 2 — Facilities

Since each subsidiary is now its own Account, this step is a flat list — no "do you have subsidiaries" question needed. But it needs two changes from a plain repeater, because "list your facilities" is exactly the kind of question people under-answer — they forget their own head office counts as a site:

Step intro helper text, above everything else on this step: "Include every physical location where this organisation operates — factories, offices, warehouses, retail sites, and so on. Your registered head office is already added below as Facility 1, using the address you gave in Company Details."

Facility 1 — Head Office card, auto-added and locked. As soon as the user reaches this step, generate the first facility card automatically from Step 1 data: name = "Head Office" (editable), location = the Legal Address entered in Company Details (read-only here, with a small "Edit in Company Details →" link that jumps back to Step 1 rather than letting the two copies drift out of sync). This card cannot be removed — no ✕ on it — and it's visually labelled "Facility 1 · Head Office" so it's obviously not one the user typed in themselves. This is the mechanism that makes skipping the head office impossible rather than just discouraged.

"How many additional facilities do you have?" — a required number input, directly below the Head Office card. Helper text: "Count every site besides your head office — you'll fill in a name and address for each one next." Whatever number N the user enters, render exactly N more facility cards underneath (Facility 2, Facility 3, … Facility N+1), each with:

Facility name — Helper: "A short, recognisable name for the site, e.g. 'Chennai Plant' or 'Mumbai Warehouse'."

Facility location / address — Helper: "Full physical address — used to determine the correct regional grid emission factor for this site."

If the user changes the number afterward, add or remove cards from the bottom to match rather than clearing what's already filled in.

Keep a "+ Add another facility" link beneath the generated cards too, for the case where someone realizes they need one more without going back to edit the count field — it should just increment the count and add a card.

No validation blocks "Next" on this step for now, per the note above — an empty facility card is fine to leave and revisit later.

Step 3 — Manage Team

This replaces the old "Contacts" step. Instead of just collecting who to reach out to, this is where the Group Admin (or whoever's running this entity's setup) grants specific people access to this specific entity's data — nothing else in the group.

Step intro helper text: "Add the people who should have access to this entity. Each person's access is scoped to this entity only — they won't be able to see or edit any other account in the group."

Repeating team member cards, each with:

Full name — Helper: "The person who'll receive this invite and role."

Email — Helper: "They'll get an invite scoped to this entity only — not to the rest of the group."

Role — dropdown: Account Admin (can manage this entity's team and edit all its data), Data Contributor (can fill in and edit data, can't manage the team), Viewer (can see dashboards and reports, can't edit anything). Helper: "Account Admin can manage this entity's team and data. Data Contributor can fill in and edit data. Viewer can see dashboards and reports but can't edit anything."

"+ Add team member" button; remove (✕) per card.

No minimum team member count is enforced for now, per the note above — this step can be left empty and revisited.

This exact card UI (add/edit/remove/change role) is reused, unchanged, on the Company Profile → Manage Team tab described below — team membership is editable at any time after registration, not just during signup.

Step 4 — Payment

Plan summary card: "Deepwoods GHG Portal — Annual Access", bullet list of what's included, and a note that pricing is confirmed manually and the team will reach out to complete payment — no automatic charge.

"Proceed to Payment" button.

Step 5 — Submit

Read-only review of everything entered in steps 1–4 — Company Details, Facilities, Manage Team, Payment — grouped under mini section headers.

"Submit registration" button → creates the new row in the Register with status "Pending review", and returns the user to the Register. This button is never blocked by missing fields for now.

Include a small demo-only control (e.g. a floating button) to simulate Deepwoods admin approving the account, which flips its status to "Accepted" and makes "Open →" clickable for that entry.

4. Inside an account (after opening an Accepted entry from the Register)

Breadcrumb at the top of the sidebar/content area: "Register › [Company Name]" (Register is a clickable link back to the list).

Sidebar now shows this company's nav: Home (unlocked, ring bullet filled), then the rest of the portal's tabs — Carbon Footprint, Decarbonisation, Peer Study, Green Finance, Compliance, Data Submission, Document Vault, Methodology, Priority Actions — all shown but locked/disabled (hollow ring bullet, muted text, non-clickable, tooltip on click: "This section isn't part of this build yet").

Sidebar footer (only visible while inside an account): "User profile", "Company profile" (new item that only appears at this level), then "Logout".

Home page content:

Heading: "Welcome to the Deepwoods GHG Portal" + a one-line Slate subtitle, with the faint ring watermark bleeding off the corner as on the Register.

A "Registration outcome" card: a row of key/value summaries — Organization type, Facility count, Team member count, Plan/pricing tier — plus a short paragraph of supporting context underneath. No edit link on this card — editing now happens only through the Company Profile tab in the sidebar footer.

A "Get started" section below with one card: "Continue to Inventory Boundary Setup →" (stub action/toast for now, not a real screen in this build).

Company Profile screen (from the sidebar footer): full-width, same treatment as the registration wizard — not a narrower centered card. Four tabs — Company Details, Facilities, Manage Team, and Billing — the first three reuse the exact forms and card UI from the registration wizard, pre-filled for this specific account, each with its own "Save changes" button. This is now the only place to edit any of this account's registration data, and it's where the Group Admin or an Account Admin comes back later to add, remove, or re-role team members.

Billing tab:

A current plan card: "Deepwoods GHG Portal — Annual Access," the active period (e.g. FY27), a status stamp (Paid/Due), and — while a period is unpaid — a "Pay for [period] →" button. Same note as the wizard's Payment step: pricing is confirmed manually, no automatic charge; for this build the button is a stub that flips that period's invoice from Due to Paid and stamps today's date.

An invoice history table below it, newest period first: columns Invoice No., Period, Amount, Status (stamp: Paid/Due), Date paid, and a "Download →" action (stub — toast: "Invoice downloads aren't part of this build yet").

User profile screen (global, same across all accounts): name, email, role (read-only), password change field, Save button.

Real client seed data — Featherlite

Use this exact data to pre-populate the account (via the wizard's underlying data model, not necessarily re-run through the wizard UI by hand) so opening the entry from the Register lands on a realistic Company Profile / Facilities / Billing screen instead of empty forms.

Featherlite Office Systems Pvt Ltd ("FOS")

Registered in India: Yes · Organisational Type: Private Limited · Industry: Furniture manufacturing · MSME: No

Legal Address (Head Office — Hejjala): "Survey No. 83 & 88/1, Bengaluru-Mysuru Road, Hejjala Post, Bidadi Hobli, Ramanagaram Taluk, Bengaluru 562109, Karnataka, India"

Facilities:

Hejjala (Head Office) — auto-added Facility 1, address as above.

Vasanth Nagar — "No. 16A, KKMP Building, Millers Rd, Kaverappa Layout, Vasanth Nagar, Bengaluru, Karnataka 560052, India"

Ramohalli — "Unit II, Survey No. 28, Plot No. 9A, Chikkeluru Ramapura Village, Tavarekere Hobli, Bangalore South, Bangalore 562130, India"

Sriperumbudur — "No. K-11/1 Phase-2, Sipcot Industrial Area, Mambakkam Post, Sriperumbudur Taluk, Kancheepuram District, Tamil Nadu 602106, India"

Kumbalgudu — "Unit IV, #21F, Kumbalgudu Industrial Area, 2nd Phase Mysore Road Bengaluru 560074, India"

"How many additional facilities do you have?" = 4

Billing: current plan "Deepwoods GHG Portal — Annual Access." Two invoice rows:

FY26 — Paid. Invoice No. "INV-FOS-FY26-001," Amount "₹75,000" (demo placeholder figure only — not real pricing), Date paid "15 Apr 2026."

FY27 — Due. Same amount, no date paid yet — this is the row with the active "Pay for FY27 →" button, so the demo can show the stub payment flow end-to-end.

No team data is seeded beyond one placeholder Account Admin (not provided by the client yet) — leave that as a generic demo value.

State/logic notes

No real backend needed — track accounts as an in-memory list of objects: { id, companyName, status ('draft'|'pending'|'accepted'), createdDate, lastEditDate, updatedBy, orgType, companyDetails, facilities[], team[], invoices[] }. team[] replaces the old contacts[]: { id, fullName, email, role: 'accountAdmin'|'dataContributor'|'viewer' }. invoices[]: { id, period, amount, status: 'paid'|'due', datePaid }.

The "Pay for [period] →" button (on the Billing tab and, as a shortcut, from the Register's expanded row) is a stub: it flips that period's invoice status from due to paid and sets datePaid to today — no real payment processing in this build.

facilities[0] is always the auto-generated Head Office entry, derived from companyDetails.legalAddress the moment Step 2 mounts, and stays in sync if the user edits the address back in Step 1. facilities[1..N] are generated to match the "how many additional facilities" number, and are the only ones that are user-authored and removable.

The registration wizard writes into a new account object; submitting adds it to the accounts array with status pending. No step in the wizard blocks progression on empty fields for this build.

Clicking a locked sidebar item shows a toast, same behavior as before — don't build the actual target pages.

Reuse one "locked nav item" component across every account's sidebar rather than duplicating logic.

Reuse one "ring stepper" component, one "stamp badge" component, and one "team member card" component (add/edit/remove/role) across the wizard, the Register, and Company Profile — rather than duplicating markup per screen.

The Overview dashboard reads from every account's mock data and combines them — it is not scoped to a single account, so it lives outside the Register › [Company Name] breadcrumb entirely, at the same top level as the Register itself.

FL (Featherlite Furnitures) is never itself an item in the accounts array — it's just the identity the user is logged in as. Don't build a sign-up flow for FL as a company; assume the credentials below are the only login that exists.

Auth is a single hardcoded check, no real backend: username/email === "Featherlite Furnitures" and password === "123" → set loggedIn = true and route to the Register. Any other combination → keep the user on the login screen and show the Coral error banner. That's the entire auth model for this build — this doesn't need to wire up real per-team-member logins yet, but the team[] model above is the shape that future per-account logins will map onto, so don't design around a single shared credential long-term.

This build does not need to enforce the cross-entity data isolation itself (e.g. a Data Contributor on FP actually being blocked from FOS's data) — that's a real-auth concern for a later phase. What matters for this pass is that the Manage Team data model exists and is scoped per account, so the isolation has somewhere to attach to when real auth is built.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://deepwoods-ring-register.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d5a7064a-cfee-4a99-88ab-777d5db58a9f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
