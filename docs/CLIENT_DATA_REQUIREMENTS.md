# GHG Portal — Client Data Requirements Checklist

Master list of every data point needed to fully operate the Deepwoods GHG Portal
(all pages, all clusters). Use this as the onboarding pack for any new client.
Frequency: **M** = monthly, **A** = annual, **O** = once (update on change).

---

## 0. Organisation Setup (once)

| # | Data point | Detail | Freq |
|---|-----------|--------|------|
| 0.1 | Legal entity list | Every reporting company (e.g. FP, FOS) + which are data-entry vs consolidated views | O |
| 0.2 | Facility register | Name, address, state, entity, function (factory/office/warehouse), active/inactive, ownership/lease | O |
| 0.3 | Organisational boundary | Consolidation approach (operational control / equity share) + justification | O |
| 0.4 | Fiscal year convention | e.g. April–March | O |
| 0.5 | Base years | Scope 1&2 base year and Scope 3 base year + rationale | O |
| 0.6 | Company logo + brand colours | For portal branding | O |
| 0.7 | User list | Name, email, role (team / leadership / admin), entity access | O |
| 0.8 | Sector & product description | For org snapshot and intensity metrics | O |

## 1. Scope 1 — Direct Emissions

**Stationary combustion** (per facility, monthly)
- 1.1 DG set diesel consumption (litres) + purchase invoices
- 1.2 Process fuel: LPG (kg), PNG (SCM), furnace oil / HSD for ovens, boilers, coating lines
- 1.3 Equipment register: each DG set / oven / boiler / furnace — ID, type, fuel, capacity, facility, status (active/standby/decommissioned)

**Mobile combustion** (per facility, monthly)
- 1.4 Company-owned vehicle fuel (diesel/petrol, litres) + vehicle list (reg. no., type, fuel)
- 1.5 Forklift / material-handling diesel (litres) + fleet list

**Fugitive** (annual, or on refill)
- 1.6 Refrigerant top-ups: AC/chiller unit list, refrigerant type (R-410A, R-134a…), charge (kg), refill quantities + AMC/service records
- 1.7 CO2 fire-extinguisher discharges/refills (kg) + refill invoices
- 1.8 Process gases: welding CO2 cylinders (kg), other GHG-containing gases

## 2. Scope 2 — Purchased Electricity & Energy

- 2.1 Grid electricity per meter per month (kWh) + **all utility bills** (BESCOM/TNEB/etc.)
- 2.2 Meter register: connection ID, facility, discom, sanctioned load
- 2.3 On-site solar: capacity (kWp), commissioning date, monthly generation & self-consumption (kWh), inverter/meter logs
- 2.4 Third-party renewable PPAs (wind/solar): contracted MWh, monthly delivered units, contract copy
- 2.5 I-REC / REC instruments: certificate ID, registry, MWh, vintage, retirement statement (PDF)
- 2.6 Purchased steam/heat/cooling if any (kWh/GJ)

## 3. Scope 3 — Value Chain (per entity, annual)

| Cat | Data required | Source document |
|-----|--------------|-----------------|
| 1 | Purchase register: supplier, material/service, quantity, spend (₹) | Procurement/ERP extract |
| 2 | Fixed-asset additions: asset, category, spend (₹) | Fixed asset register |
| 3 | Derived from finalised Scope 1 & 2 (no extra client data) | — |
| 4 | Inbound freight: origin→destination, mode, weight, distance or spend | Freight invoices / logistics statements |
| 5 | Waste by stream: type (hazardous/non-haz/e-waste/wastewater), tonnes, treatment route (landfill/recycle/incinerate) | Waste manifests, scrap agreements |
| 6 | Business travel: air/rail/road trips (origin, destination, class) or travel spend | Travel agency report / expense claims |
| 7 | Employee commuting: headcount per site, commute survey (mode, one-way km, days/week), WFH days | HR survey |
| 8 | Upstream leased assets: leased asset list + energy use (mark Not Relevant if none) | Lease register |
| 9 | Outbound deliveries: monthly delivery data — destination, mode, weight/volume | Despatch/delivery register |
| 10 | Downstream processing of sold intermediates (usually Not Relevant) | — |
| 11 | Use of sold products: for powered products — power rating, lifetime, units sold | Product specs + sales volumes |
| 12 | End-of-life: units sold, product weight & material composition (bill of materials) | Sales register + BOM |
| 13–15 | Leased-out assets / franchises / investments (mark Not Relevant if none) | — |

Plus, once: **15-category relevancy screen** — Relevant / Not Relevant decision + justification per category per entity.

## 4. Intensity & Business Metrics (per entity, annual)

- 4.1 Revenue (₹ lakh) per fiscal year — including base year
- 4.2 Production output (units or tonnes) per fiscal year
- 4.3 Headcount (FTE) per fiscal year
- 4.4 Floor area (sq ft) — optional, for office-based intensity

## 5. Decarbonisation & Targets (Cluster 2)

- 5.1 Reduction target: % vs base year, target year, scopes covered, internal vs SBTi-validated
- 5.2 Net-zero ambition year (if declared)
- 5.3 Reduction measures register: measure, entity/facility, capex, expected tCO2e/yr saving, status, timeline (feeds Strategy levers)
- 5.4 Completed initiatives (Kaizens, LED retrofits, solar, EV shifts) with savings achieved
- 5.5 Carbon credits (if any): registry, project, tCO2e, vintage, retirement certificate
- 5.6 I-REC procurement plan for current year (MWh needed per entity)

## 6. Compliance, Reports & Vault

- 6.1 Prior-year GHG reports (PDF/HTML) — for the Reports & Vault pages
- 6.2 Calculation audit trails / workbooks per year
- 6.3 Assurance/verification statements (if any) + verifier and standard
- 6.4 Certificates: I-REC retirements, PPA contracts, green certifications (GreenPro, GreenCo…)
- 6.5 Sustainability / GRI reports (if any)
- 6.6 Google Drive root folder ID for portal uploads

## 7. Portal Operations (backend)

- 7.1 Hosting domain + Hostinger account access
- 7.2 MySQL database credentials
- 7.3 SMTP mailbox for password-reset emails
- 7.4 Google OAuth client (Drive uploads) + Drive-owning account
- 7.5 Notification items: pending actions & recent milestones to seed the Alert Centre

---

### Minimum viable dataset (to launch a portal with real numbers)
1. Facility register + entity list (0.1–0.2)
2. 12 months of fuel + electricity data with bills (1.1–1.5, 2.1)
3. Revenue & production for the same year + base year (4.1–4.2)
4. Scope 3 relevancy screen + Cat 1 purchase register (3)
5. Any prior GHG reports for the Vault (6.1)

Everything else can be phased in over the first quarter of the engagement.
