import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { InventoryProvider, useInventory } from "@/context/InventoryContext";
import { useClientContext } from "@/lib/client-context";
import type { FiscalYear, Scope1Subcategory, Scope2Category } from "@/lib/inventory-types";

import { RingBullet } from "@/components/inventory-boundary/shared/RingBullet";
import { StationaryTab } from "@/components/inventory-boundary/scope1/StationaryTab";
import { MobileTab } from "@/components/inventory-boundary/scope1/MobileTab";
import { FugitiveTab } from "@/components/inventory-boundary/scope1/FugitiveTab";
import { ElectricityTab } from "@/components/inventory-boundary/scope2/ElectricityTab";
import { SteamTab } from "@/components/inventory-boundary/scope2/SteamTab";
import { HeatingTab } from "@/components/inventory-boundary/scope2/HeatingTab";
import { CoolingTab } from "@/components/inventory-boundary/scope2/CoolingTab";
import { OnSiteGenerationTab } from "@/components/inventory-boundary/scope2/OnSiteGenerationTab";
import { KyotoSection } from "@/components/inventory-boundary/opcontrol/KyotoSection";
import { Scope3Section } from "@/components/inventory-boundary/opcontrol/Scope3Section";
import { Scope3Questionnaire } from "@/components/inventory-boundary/scope3/Scope3Questionnaire";
import { YearTiles } from "@/components/inventory-boundary/history/YearTiles";
import { YearSnapshot } from "@/components/inventory-boundary/history/YearSnapshot";
import { ProcessTab } from "@/components/inventory-boundary/scope1/ProcessTab";

export const Route = createFileRoute("/_app/inventory-boundary")({ component: InventoryBoundary });

type MainTab = "scope1" | "scope2" | "scope3" | "opcontrol" | "history";

// ── FY selector chip ──────────────────────────────────────────────────────────

function FYChip() {
  const { fiscalYear, setFiscalYear } = useInventory();
  const ctx = useClientContext();
  const years = ctx.reporting_years.length > 0
    ? [...ctx.reporting_years].reverse()
    : [fiscalYear];

  return (
    <div style={{ display: 'inline-block', marginBottom: '12px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'var(--mint-tint)',
          border: '1px solid var(--mint)',
          color: 'var(--canopy)',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: '10px' }}>◆</span>
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(e.target.value as FiscalYear)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--canopy)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {years.map((fy) => (
            <option key={fy} value={fy}>{fy}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Auto-save status indicator ────────────────────────────────────────────────

function SaveButton({ section }: { section: 'scope1' | 'scope2' | 'opcontrol' }) {
  const { saveStatus } = useInventory();
  const st = saveStatus[section];

  if (st === 'saving') return (
    <span style={{ fontSize: '12px', color: 'var(--slate)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#94A3B8', animation: 'pulse 1s ease-in-out infinite' }} />
      Saving…
    </span>
  );
  if (st === 'saved') return (
    <span style={{ fontSize: '12px', color: 'var(--canopy)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--canopy)' }} />
      All changes saved
    </span>
  );
  if (st === 'error') return (
    <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
      Save failed — retrying automatically…
    </span>
  );
  return null;
}

// ── Scope 1 Page ──────────────────────────────────────────────────────────────

function Scope1Page() {
  const [activeTab, setActiveTab] = useState<Scope1Subcategory>('stationary');

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>


      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <FYChip />
          <SaveButton section="scope1" />
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Scope 1 · Direct Emissions
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--slate)', maxWidth: '780px' }}>
          Emissions from sources your organisation owns or controls directly — fuels burned on-site, company vehicles, and refrigerants that can leak into the atmosphere.
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--canopy-tint)',
          border: '1px solid #C4D6CB',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '32px',
          maxWidth: '820px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ marginTop: '4px' }}>
          <RingBullet active={true} size={10} />
        </div>
        <div style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '10px' }}>
            <strong>What you're setting up here:</strong> the list of every direct-emission source at your facilities. This isn't where you enter fuel consumption or usage data — that comes later during data collection. Right now, we're identifying <em>what exists</em>: every generator, vehicle, and refrigerant-containing system that belongs in your Scope 1 boundary.
          </p>
          <p>
            <strong>Three categories, three sub-tabs below.</strong> Use whichever match what you physically have at your sites. If you're not sure something belongs in Scope 1, add it anyway — we can refine the categorisation together during review.
          </p>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {(['stationary', 'mobile', 'fugitive', 'process'] as const).map((tab, idx) => {
          const labels = ['Stationary Combustion', 'Mobile Combustion', 'Fugitive Sources', 'Process Emissions'];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 4px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2.5px solid var(--canopy)' : '2.5px solid transparent',
                color: isActive ? 'var(--canopy)' : 'var(--slate)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {labels[idx]}
            </button>
          );
        })}
      </div>

      {activeTab === 'stationary' && <StationaryTab />}
      {activeTab === 'mobile' && <MobileTab />}
      {activeTab === 'fugitive' && <FugitiveTab />}
      {activeTab === 'process' && <ProcessTab />}

      <BiogenicSummaryPanel />
    </div>
  );
}

// ── Biogenic CO₂ summary panel (GHG Protocol / CDP C6.3) ─────────────────────
function BiogenicSummaryPanel() {
  const { scope1Assets, fiscalYear } = useInventory();
  const biogenicAssets = scope1Assets.filter(
    a => a.fiscalYear === fiscalYear && a.isBiogenic && a.biogenicCO2e != null
  );
  const total = biogenicAssets.reduce((sum, a) => sum + (a.biogenicCO2e ?? 0), 0);

  return (
    <div style={{
      marginTop: '36px',
      border: '1px solid #C4D6CB',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--canopy-tint)',
        padding: '14px 20px',
        borderBottom: '1px solid #C4D6CB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--canopy)', marginBottom: '2px' }}>
            🌱 Biogenic CO₂ — Memo Item (Outside Scope 1)
          </p>
          <p style={{ fontSize: '12px', color: 'var(--slate)' }}>
            GHG Protocol §4.3.3 · CDP C6.3 · GRI 305-1 — disclosed separately, not added to your Scope 1 total
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--canopy)', letterSpacing: '-0.02em' }}>
            {biogenicAssets.length > 0 ? total.toFixed(2) : '—'} <span style={{ fontSize: '13px', fontWeight: 500 }}>tCO₂e</span>
          </p>
          <p style={{ fontSize: '11px', color: 'var(--slate)' }}>{biogenicAssets.length} source{biogenicAssets.length !== 1 ? 's' : ''} with estimate</p>
        </div>
      </div>
      {biogenicAssets.length > 0 ? (
        <div style={{ padding: '16px 20px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {biogenicAssets.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--ink)' }}>
              <span>{a.name} <span style={{ color: 'var(--slate)', fontSize: '12px' }}>· {a.fuelType}</span></span>
              <span style={{ fontWeight: 600 }}>{(a.biogenicCO2e ?? 0).toFixed(2)} tCO₂e</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '16px 20px', background: 'var(--surface)', fontSize: '13px', color: 'var(--slate)' }}>
          No biogenic fuel sources with CO₂ estimates yet. When you add a biogenic fuel asset (wood, biomass, biogas), an optional estimate field will appear in the form.
        </div>
      )}
    </div>
  );
}

// ── Scope 2 Page ──────────────────────────────────────────────────────────────

type Scope2Tab = Scope2Category | 'onsite-generation';

function Scope2Page() {
  const [activeTab, setActiveTab] = useState<Scope2Tab>('electricity');

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>


      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <FYChip />
          <SaveButton section="scope2" />
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Scope 2 · Indirect Energy Emissions
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--slate)', maxWidth: '780px' }}>
          Emissions from the generation of energy you purchase and consume — grid electricity, purchased steam, heating, and cooling.
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'var(--canopy-tint)',
          border: '1px solid #C4D6CB',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '32px',
          maxWidth: '820px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ marginTop: '4px' }}>
          <RingBullet active={true} size={10} />
        </div>
        <div style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '10px' }}>
            <strong>Dual reporting is required.</strong> Under the GHG Protocol Scope 2 Guidance, if you operate in a market where renewable energy attributes are available (India qualifies), you must report Scope 2 two ways: <strong>location-based</strong> (using the average emissions of the grid you're connected to) and <strong>market-based</strong> (accounting for any renewable energy you've specifically procured through contracts, certificates, or green tariffs).
          </p>
          <p>
            <strong>You don't have to choose which one to report.</strong> The questions we ask below capture both. During data collection you'll provide total consumption in kWh (for location-based), and here you tell us about any renewable procurement arrangements you have (for market-based). We handle the calculations.
          </p>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {(
          [
            ['electricity',       'Purchased Electricity'],
            ['steam',             'Purchased Steam'],
            ['heating',           'Purchased Heating'],
            ['cooling',           'Purchased Cooling'],
            ['onsite-generation', 'On-site Generation'],
          ] as [Scope2Tab, string][]
        ).map(([tab, label]) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 4px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2.5px solid var(--harbor)' : '2.5px solid transparent',
                color: isActive ? 'var(--harbor)' : 'var(--slate)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === 'electricity'       && <ElectricityTab />}
      {activeTab === 'steam'             && <SteamTab />}
      {activeTab === 'heating'           && <HeatingTab />}
      {activeTab === 'cooling'           && <CoolingTab />}
      {activeTab === 'onsite-generation' && <OnSiteGenerationTab />}

      <DualReportingStatusPanel />
    </div>
  );
}

// ── Scope 2 Dual Reporting Status (GHG Protocol S2G 2015) ────────────────────
function DualReportingStatusPanel() {
  const { scope2Sources, fiscalYear } = useInventory();
  const elecSources = scope2Sources.filter(s => s.fiscalYear === fiscalYear && s.category === 'electricity');
  const lbReady = elecSources.length > 0;
  const mbReady = elecSources.some(s => s.renewableProcurement?.hasInstrument);
  const mbCount = elecSources.filter(s => s.renewableProcurement?.hasInstrument).length;

  const StatusTile = ({ label, ready, detail, tooltip }: { label: string; ready: boolean; detail: string; tooltip?: string }) => (
    <div style={{
      flex: 1,
      minWidth: '220px',
      padding: '16px 18px',
      border: `1.5px solid ${ready ? '#C4D6CB' : 'var(--border)'}`,
      borderRadius: '10px',
      background: ready ? 'var(--canopy-tint)' : 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: ready ? 'var(--canopy)' : '#94A3B8',
        }} />
        <p
          style={{ fontSize: '13px', fontWeight: 700, color: ready ? 'var(--canopy)' : 'var(--slate)', cursor: tooltip ? 'help' : 'default' }}
          title={tooltip}
        >{label}</p>
        <span style={{
          marginLeft: 'auto', fontSize: '10px', fontWeight: 600, padding: '2px 7px',
          borderRadius: '9999px',
          background: ready ? 'var(--canopy)' : '#E2E8F0',
          color: ready ? '#fff' : '#64748B',
        }}>{ready ? 'Ready' : 'Not set up'}</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--slate)', lineHeight: '1.5' }}>{detail}</p>
    </div>
  );

  return (
    <div style={{ marginTop: '36px' }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
        Dual Reporting Status
      </p>
      <p style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '14px' }}>
        GHG Protocol Scope 2 Guidance · CDP C7.3 — both methods required when energy attribute certificates are in use
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatusTile
          label="Location-Based (LB)"
          ready={lbReady}
          detail={lbReady
            ? `${elecSources.length} electricity connection${elecSources.length !== 1 ? 's' : ''} entered. Grid EF applied per region during data collection.`
            : 'Add at least one purchased electricity source above to enable LB reporting.'}
        />
        <StatusTile
          label="Market-Based (MB)"
          ready={mbReady}
          detail={mbReady
            ? `${mbCount} source${mbCount !== 1 ? 's' : ''} with renewable procurement instrument${mbCount !== 1 ? 's' : ''} (I-REC, REC, PPA, green tariff). Supplier EF applied for MB calculation.`
            : 'No renewable procurement instruments entered yet. Edit an electricity source and enable the renewable procurement toggle.'}
          tooltip="Market-based Scope 2 accounts for renewable energy specifically procured through contracts, certificates (I-RECs, RECs), or green tariffs. Reported separately from location-based Scope 2 per GHG Protocol Scope 2 Guidance. Enable renewable procurement on an electricity source to activate this method."
        />
      </div>
    </div>
  );
}

// ── Operational Control Page ──────────────────────────────────────────────────

function OperationalControlPage() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>

      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <h1 style={{ fontSize: '30px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Operational Control
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--slate)', maxWidth: '780px' }}>
              Declare which Kyoto gases are present in your inventory, and screen all 15 GHG Protocol Scope 3 categories for relevance to your operations.
            </p>
          </div>
          <SaveButton section="opcontrol" />
        </div>
      </div>
      <KyotoSection />
      <Scope3Section />
    </div>
  );
}

// ── History Log Page ──────────────────────────────────────────────────────────

function HistoryLogPage() {
  const [snapshotYear, setSnapshotYear] = useState<FiscalYear | null>(null);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>


      {snapshotYear === null && (
        <>
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '30px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              History Log
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--slate)', maxWidth: '780px' }}>
              Each fiscal year's inventory boundary, frozen at the close of the reporting period. Click any tile to open a read-only snapshot.
            </p>
          </div>
          <YearTiles onSelectYear={(year) => setSnapshotYear(year)} />
        </>
      )}

      {snapshotYear !== null && (
        <YearSnapshot
          year={snapshotYear}
          onSelectYear={(year) => setSnapshotYear(year)}
          onBack={() => setSnapshotYear(null)}
        />
      )}
    </div>
  );
}

// ── Main route component ──────────────────────────────────────────────────────

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "scope1",    label: "Scope 1" },
  { id: "scope2",    label: "Scope 2" },
  { id: "scope3",    label: "Scope 3" },
  { id: "opcontrol", label: "Operational Control" },
  { id: "history",   label: "History" },
];

function InventoryBoundaryInner() {
  const [activeTab, setActiveTab] = useState<MainTab>("scope1");
  const { isLoading } = useInventory();

  return (
    <>
      <PageHeader
        eyebrow="Carbon Footprint"
        title="Inventory Boundary"
        description="Define every Scope 1 and Scope 2 source, screen Kyoto gases and Scope 3 categories, and view historical boundary snapshots."
      />

      <div style={{ borderBottom: '1px solid var(--border)', paddingLeft: '24px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {MAIN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid var(--canopy)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--canopy)' : 'var(--slate)',
                fontWeight: activeTab === t.id ? 600 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '-1px',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <PageBody>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '24px' }}>
            {['60%', '45%', '75%', '50%'].map((w, i) => (
              <div
                key={i}
                style={{
                  height: '20px',
                  width: w,
                  maxWidth: '100%',
                  borderRadius: '6px',
                  background: 'var(--border)',
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {activeTab === "scope1"    && <Scope1Page />}
            {activeTab === "scope2"    && <Scope2Page />}
            {activeTab === "scope3"    && <Scope3Questionnaire />}
            {activeTab === "opcontrol" && <OperationalControlPage />}
            {activeTab === "history"   && <HistoryLogPage />}
          </>
        )}
      </PageBody>
    </>
  );
}

function InventoryBoundary() {
  return (
    <InventoryProvider>
      <InventoryBoundaryInner />
    </InventoryProvider>
  );
}
