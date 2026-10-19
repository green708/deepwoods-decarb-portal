import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import type { Scope2Source } from '@/lib/inventory-types';
import { FacilityGroupSection } from '@/components/inventory-boundary/shared/FacilityGroupSection';
import { Scope2SourceRow } from './Scope2SourceRow';
import { AddScope2SourceForm } from './AddScope2SourceForm';

export const CoolingTab: React.FC = () => {
  const { scope2Sources, facilities, fiscalYear, deleteScope2Source } = useInventory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Scope2Source | null>(null);

  const currentSources = scope2Sources.filter(
    (s) => s.fiscalYear === fiscalYear && s.category === 'cooling'
  );

  const facilitiesWithSources = facilities
    .map((fac) => ({ facility: fac, sources: currentSources.filter((s) => s.facilityId === fac.id) }))
    .filter((group) => group.sources.length > 0);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <p style={{ fontSize: '14px', color: 'var(--slate)', flex: 1, minWidth: '280px' }}>
          Chilled water or cooling supplied through a district cooling network or an external provider. Not on-site AC systems — those are in Scope 1 Fugitive Sources.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ backgroundColor: 'var(--harbor)', borderColor: 'var(--harbor)' }}
          onClick={() => { setEditingSource(null); setIsModalOpen(true); }}
        >
          <Plus size={16} /> Add cooling source
        </button>
      </div>

      {facilitiesWithSources.length > 0 ? (
        facilitiesWithSources.map(({ facility, sources }) => (
          <FacilityGroupSection key={facility.id} facility={facility} assetCount={sources.length} defaultExpanded={true}>
            {sources.map((source) => (
              <Scope2SourceRow
                key={source.id}
                source={source}
                onEdit={(s) => { setEditingSource(s); setIsModalOpen(true); }}
                onDelete={(id) => deleteScope2Source(id)}
              />
            ))}
          </FacilityGroupSection>
        ))
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate)' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>
            No purchased cooling sources recorded for {fiscalYear}.
          </p>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            If your facilities purchase chilled water from a district cooling network, add it here.
          </p>
          <button type="button" className="btn-secondary" onClick={() => { setEditingSource(null); setIsModalOpen(true); }}>
            <Plus size={16} /> Add Cooling Source
          </button>
        </div>
      )}

      {isModalOpen && (
        <AddScope2SourceForm
          category="cooling"
          initialSource={editingSource}
          onClose={() => { setIsModalOpen(false); setEditingSource(null); }}
        />
      )}
    </div>
  );
};
