import React, { useState } from 'react';
import { Plus, Sun, Wind } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import type { Scope2Category, Scope2Source } from '@/lib/inventory-types';
import { FacilityGroupSection } from '@/components/inventory-boundary/shared/FacilityGroupSection';

const ON_SITE_CATS: Scope2Category[] = [
  'solar-generated',
  'solar-consumed',
  'solar-exported',
  'captive-wind',
];

const CAT_LABELS: Record<string, string> = {
  'solar-generated': 'Onsite Solar Generated',
  'solar-consumed':  'Onsite Solar Consumed',
  'solar-exported':  'Onsite Solar Exported',
  'captive-wind':    'Captive Wind',
};

const CAT_DESC: Record<string, string> = {
  'solar-generated': 'Total generation from onsite solar installation (kWh)',
  'solar-consumed':  'Onsite solar consumed in-house (kWh)',
  'solar-exported':  'Onsite solar exported to the grid (kWh)',
  'captive-wind':    'Total generation from captive wind installation (kWh)',
};

// ── Simple add form (inline modal) ───────────────────────────────────────────
interface AddFormProps {
  onClose: () => void;
}
function AddOnSiteGenerationForm({ onClose }: AddFormProps) {
  const { facilities, fiscalYear, addScope2Source } = useInventory();
  const [category, setCategory] = useState<Scope2Category>('solar-generated');
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? '');
  const [status, setStatus] = useState<'active' | 'monitor'>('active');
  const [saving, setSaving] = useState(false);

  const autoName = facilityId
    ? `${facilities.find(f => f.id === facilityId)?.name ?? facilityId} — ${CAT_LABELS[category]}`
    : CAT_LABELS[category];

  async function handleSave() {
    if (!facilityId) return;
    setSaving(true);
    try {
      await addScope2Source({
        scope: 'scope2',
        fiscalYear,
        category,
        name: autoName,
        facilityId,
        status,
        supplier: '',
      } as Omit<Scope2Source, 'id'>);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '440px', padding: '28px', borderRadius: '14px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '20px', color: 'var(--ink)' }}>
          Add On-site Generation Source
        </h3>

        <label style={{ display: 'block', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--slate)', display: 'block', marginBottom: '6px' }}>
            Generation type
          </span>
          <select
            className="input-field"
            value={category}
            onChange={(e) => setCategory(e.target.value as Scope2Category)}
          >
            {ON_SITE_CATS.map(c => (
              <option key={c} value={c}>{CAT_LABELS[c]}</option>
            ))}
          </select>
          <span style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px', display: 'block' }}>
            {CAT_DESC[category]}
          </span>
        </label>

        <label style={{ display: 'block', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--slate)', display: 'block', marginBottom: '6px' }}>
            Facility
          </span>
          <select
            className="input-field"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
          >
            {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--slate)', display: 'block', marginBottom: '6px' }}>
            Status
          </span>
          <select
            className="input-field"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'monitor')}
          >
            <option value="active">Active</option>
            <option value="monitor">Monitor</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            style={{ backgroundColor: 'var(--harbor)', borderColor: 'var(--harbor)' }}
            onClick={handleSave}
            disabled={saving || !facilityId}
          >
            {saving ? 'Saving…' : 'Add source'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function GenSourceRow({ source, onDelete }: { source: Scope2Source; onDelete: (id: string) => void }) {
  const isWind = source.category === 'captive-wind';
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {isWind
          ? <Wind size={16} color="var(--slate)" />
          : <Sun size={16} color="var(--slate)" />
        }
        <div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', marginBottom: '2px' }}>{source.name}</p>
          <p style={{ fontSize: '12px', color: 'var(--slate)' }}>{CAT_LABELS[source.category]} · kWh</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
            background: source.status === 'active' ? 'var(--canopy-tint)' : '#F1F5F9',
            color: source.status === 'active' ? 'var(--canopy)' : 'var(--slate)',
          }}
        >
          {source.status}
        </span>
        <button
          type="button"
          style={{ fontSize: '12px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={() => onDelete(source.id)}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export const OnSiteGenerationTab: React.FC = () => {
  const { scope2Sources, facilities, fiscalYear, deleteScope2Source } = useInventory();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentSources = scope2Sources.filter(
    (s) => s.fiscalYear === fiscalYear && ON_SITE_CATS.includes(s.category)
  );

  const facilitiesWithSources = facilities
    .map((fac) => ({
      facility: fac,
      sources: currentSources.filter((s) => s.facilityId === fac.id),
    }))
    .filter((g) => g.sources.length > 0);

  const defaultExpanded = facilitiesWithSources.length <= 3;

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '20px', gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <p style={{ fontSize: '14px', color: 'var(--slate)', flex: 1, minWidth: '280px' }}>
          Onsite renewable generation — solar generated, self-consumed, and exported, plus captive wind.
          These feed into your GHG energy balance and Scope 2 market-based adjustments.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ backgroundColor: 'var(--harbor)', borderColor: 'var(--harbor)' }}
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={16} /> Add generation source
        </button>
      </div>

      {facilitiesWithSources.length > 0 ? (
        facilitiesWithSources.map(({ facility, sources }) => (
          <FacilityGroupSection
            key={facility.id}
            facility={facility}
            assetCount={sources.length}
            defaultExpanded={defaultExpanded}
          >
            {sources.map((source) => (
              <GenSourceRow
                key={source.id}
                source={source}
                onDelete={(id) => deleteScope2Source(id)}
              />
            ))}
          </FacilityGroupSection>
        ))
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate)' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>
            No on-site generation sources for {fiscalYear}
          </p>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            Add your solar or captive wind installations to track generation, consumption, and export.
          </p>
          <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Add generation source
          </button>
        </div>
      )}

      {isModalOpen && <AddOnSiteGenerationForm onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};
