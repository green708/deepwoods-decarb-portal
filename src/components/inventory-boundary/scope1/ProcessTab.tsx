import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import type { Scope1Asset, ProcessEmissionType } from '@/lib/inventory-types';


const PROCESS_TYPES: { value: ProcessEmissionType; label: string; example: string }[] = [
  { value: 'calcination',       label: 'Calcination',          example: 'Cement, lime, magnesia, soda ash production' },
  { value: 'steam_reforming',   label: 'Steam Reforming',      example: 'Hydrogen, ammonia, methanol production' },
  { value: 'bayer_process',     label: 'Bayer Process',        example: 'Alumina refining' },
  { value: 'glass_melting',     label: 'Glass Melting',        example: 'Float glass, container glass, fibreglass' },
  { value: 'ore_smelting',      label: 'Ore Smelting',         example: 'Iron, steel, copper, zinc production' },
  { value: 'fermentation',      label: 'Fermentation',         example: 'Bioethanol, brewing, yeast production' },
  { value: 'chemical_reaction', label: 'Chemical Reaction',    example: 'Nitric acid, adipic acid, other chemical synthesis' },
  { value: 'other',             label: 'Other Process',        example: 'Any other non-combustion industrial process' },
];

const EF_DATASETS = ['IPCC AR6 (2021)', 'IPCC AR5 (2014)', 'MoEFCC India (2024)', 'DEFRA UK (2024)', 'USEPA (2024)', 'Other'];

let _seq = 0;
const genId = () => `proc${Date.now()}_${++_seq}`;

function emptyAsset(fiscalYear: string, facilityId: string): Scope1Asset {
  return {
    id: genId(),
    fiscalYear,
    scope: 'scope1',
    subcategory: 'process',
    name: '',
    facilityId,
    status: 'active',
    processEmissionType: undefined,
    rawMaterial: '',
    annualOutputQty: undefined,
    outputUnit: '',
    efDataset: '',
    efVintageYear: '',
  };
}

function ProcessAssetCard({
  asset,
  facilityName,
  onDelete,
}: {
  asset: Scope1Asset;
  facilityName: string;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = PROCESS_TYPES.find(t => t.value === asset.processEmissionType)?.label ?? '—';

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: 'var(--surface)', cursor: 'pointer',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {asset.name || '(unnamed process)'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
            {typeLabel} · {facilityName}
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, background: 'var(--mint-tint)', color: 'var(--canopy)', padding: '2px 8px', borderRadius: 12 }}>
          Process
        </div>
        {expanded ? <ChevronUp size={15} color="var(--slate)" /> : <ChevronDown size={15} color="var(--slate)" />}
      </div>
      {expanded && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--canvas)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Process type</div>
            <div style={{ fontSize: 13 }}>{typeLabel}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Raw material</div>
            <div style={{ fontSize: 13 }}>{asset.rawMaterial || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Annual output</div>
            <div style={{ fontSize: 13 }}>{asset.annualOutputQty != null ? `${asset.annualOutputQty.toLocaleString()} ${asset.outputUnit ?? ''}` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>EF dataset</div>
            <div style={{ fontSize: 13 }}>{asset.efDataset || '—'}{asset.efVintageYear ? ` (${asset.efVintageYear})` : ''}</div>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            >
              <Trash2 size={13} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddProcessForm({
  fiscalYear,
  facilities,
  onAdd,
  onCancel,
}: {
  fiscalYear: string;
  facilities: { id: string; name: string }[];
  onAdd: (a: Scope1Asset) => void;
  onCancel: () => void;
}) {
  const defaultFacilityId = facilities[0]?.id ?? '';
  const [draft, setDraft] = useState<Scope1Asset>(() => emptyAsset(fiscalYear, defaultFacilityId));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update(patch: Partial<Scope1Asset>) {
    setDraft(d => ({ ...d, ...patch }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!draft.name.trim()) e.name = 'Required';
    if (!draft.facilityId) e.facilityId = 'Required';
    if (!draft.processEmissionType) e.processEmissionType = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAdd() {
    if (validate()) onAdd(draft);
  }

  const inp = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: '100%', padding: '8px 12px',
    border: `1px solid var(--border)`, borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--ink)',
    background: 'var(--surface)',
    ...extra,
  });

  const sel = (): React.CSSProperties => ({
    ...inp(), appearance: 'auto', cursor: 'pointer',
  });

  return (
    <div style={{ border: '1.5px solid var(--canopy)', borderRadius: 12, padding: 20, background: 'var(--canvas)', marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>Add process emission source</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', display: 'block', marginBottom: 5 }}>Source name *</label>
          <input style={inp()} placeholder="e.g. Lime kiln — Unit 1" value={draft.name} onChange={e => update({ name: e.target.value })} />
          {errors.name && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.name}</div>}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', display: 'block', marginBottom: 5 }}>Facility *</label>
          <select style={sel()} value={draft.facilityId} onChange={e => update({ facilityId: e.target.value })}>
            {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {errors.facilityId && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.facilityId}</div>}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', display: 'block', marginBottom: 5 }}>Process emission type *</label>
          <select style={sel()} value={draft.processEmissionType ?? ''} onChange={e => update({ processEmissionType: e.target.value as ProcessEmissionType })}>
            <option value="">— Select type —</option>
            {PROCESS_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label} — {t.example}</option>
            ))}
          </select>
          {errors.processEmissionType && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.processEmissionType}</div>}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', display: 'block', marginBottom: 5 }}>Primary raw material / feedstock</label>
          <input style={inp()} placeholder="e.g. Limestone, Natural gas" value={draft.rawMaterial ?? ''} onChange={e => update({ rawMaterial: e.target.value })} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', display: 'block', marginBottom: 5 }}>Annual output quantity</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" min={0}
              style={{ ...inp(), width: 130 }}
              placeholder="Quantity"
              value={draft.annualOutputQty ?? ''}
              onChange={e => update({ annualOutputQty: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
            />
            <input style={{ ...inp(), flex: 1 }} placeholder="Unit (e.g. tonnes)" value={draft.outputUnit ?? ''} onChange={e => update({ outputUnit: e.target.value })} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', display: 'block', marginBottom: 5 }}>Emission factor dataset (ISO 14064)</label>
          <select style={sel()} value={draft.efDataset ?? ''} onChange={e => update({ efDataset: e.target.value })}>
            <option value="">— Select dataset —</option>
            {EF_DATASETS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', display: 'block', marginBottom: 5 }}>EF vintage year</label>
          <input style={inp()} placeholder="e.g. 2024" value={draft.efVintageYear ?? ''} onChange={e => update({ efVintageYear: e.target.value })} />
        </div>

      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--slate)' }}>
          Cancel
        </button>
        <button type="button" onClick={handleAdd}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--forest), var(--canopy))', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Add source
        </button>
      </div>
    </div>
  );
}

export const ProcessTab: React.FC = () => {
  const { scope1Assets, facilities, fiscalYear, addScope1Asset, deleteScope1Asset } = useInventory();
  const [showForm, setShowForm] = useState(false);

  const processAssets = scope1Assets.filter(
    a => a.fiscalYear === fiscalYear && a.subcategory === 'process'
  );

  function getFacilityName(id: string) {
    return facilities.find(f => f.id === id)?.name ?? id;
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6, marginBottom: 8 }}>
            Emissions from industrial chemical or physical transformations — distinct from combustion. Examples: CO₂ released during limestone calcination (cement/lime), CO₂ from steam reforming of natural gas (hydrogen production), and process gases from ore smelting.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 8 }}>
            <Info size={14} color="#A16207" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, color: '#713F12', lineHeight: 1.5, margin: 0 }}>
              <strong>GHG Protocol Scope 1 Category 2.</strong> These emissions are often larger than combustion emissions in manufacturing industries. If you're unsure whether your process creates CO₂, ask your Deepwoods coordinator — we'll help identify the right emission factor.
            </p>
          </div>
        </div>
        {!showForm && (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add process source
          </button>
        )}
      </div>

      {processAssets.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: '1.5px dashed var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 12 }}>No process emission sources added yet</div>
          <div style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
            If your operations don't involve industrial chemical or physical transformations (e.g. you're in services, light assembly, or retail), you can leave this section empty.
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add process source
          </button>
        </div>
      )}

      {processAssets.map(asset => (
        <ProcessAssetCard
          key={asset.id}
          asset={asset}
          facilityName={getFacilityName(asset.facilityId)}
          onDelete={() => deleteScope1Asset(asset.id)}
        />
      ))}

      {showForm && (
        <AddProcessForm
          fiscalYear={fiscalYear}
          facilities={facilities}
          onAdd={a => { addScope1Asset(a); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};
