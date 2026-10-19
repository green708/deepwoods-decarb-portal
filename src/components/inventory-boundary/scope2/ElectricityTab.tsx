import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import type { Scope2Source } from '@/lib/inventory-types';
import { FacilityGroupSection } from '@/components/inventory-boundary/shared/FacilityGroupSection';
import { Scope2SourceRow } from './Scope2SourceRow';
import { AddScope2SourceForm } from './AddScope2SourceForm';

export const ElectricityTab: React.FC = () => {
  const { scope2Sources, facilities, fiscalYear, deleteScope2Source } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [renewableFilter, setRenewableFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Scope2Source | null>(null);

  const currentSources = scope2Sources.filter(
    (s) => s.fiscalYear === fiscalYear && s.category === 'electricity'
  );

  const filteredSources = currentSources.filter((source) => {
    if (searchTerm && !source.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (facilityFilter !== 'all' && source.facilityId !== facilityFilter) return false;
    if (supplierFilter !== 'all' && source.supplier !== supplierFilter) return false;
    if (renewableFilter === 'yes' && !source.renewableProcurement?.hasInstrument) return false;
    if (renewableFilter === 'no' && source.renewableProcurement?.hasInstrument) return false;
    if (statusFilter !== 'all' && source.status !== statusFilter) return false;
    return true;
  });

  const facilitiesWithSources = facilities
    .map((fac) => ({ facility: fac, sources: filteredSources.filter((s) => s.facilityId === fac.id) }))
    .filter((group) => group.sources.length > 0);

  const defaultExpanded = facilitiesWithSources.length <= 3;

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
          Every electricity connection to your facilities — utility supply (BESCOM, TANGEDCO, etc.), open-access power, and any renewable-backed arrangements like PPAs or green tariffs.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ backgroundColor: 'var(--harbor)', borderColor: 'var(--harbor)' }}
          onClick={() => { setEditingSource(null); setIsModalOpen(true); }}
        >
          <Plus size={16} /> Add electricity source
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--slate)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '32px' }}
            placeholder="Search connections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select className="input-field" value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
          <option value="all">All Facilities</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <select className="input-field" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
          <option value="all">All Suppliers</option>
          <option value="BESCOM">BESCOM</option>
          <option value="TANGEDCO">TANGEDCO</option>
        </select>

        <select
          className="input-field"
          value={renewableFilter}
          onChange={(e) => setRenewableFilter(e.target.value as 'all' | 'yes' | 'no')}
        >
          <option value="all">Renewable Proc.: All</option>
          <option value="yes">Renewable Proc.: Yes</option>
          <option value="no">Renewable Proc.: No</option>
        </select>

        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="monitor">Monitor</option>
        </select>
      </div>

      {facilitiesWithSources.length > 0 ? (
        facilitiesWithSources.map(({ facility, sources }) => (
          <FacilityGroupSection key={facility.id} facility={facility} assetCount={sources.length} defaultExpanded={defaultExpanded}>
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
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>No electricity connections found</p>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            {searchTerm || facilityFilter !== 'all' || supplierFilter !== 'all' || renewableFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Add your utility grid connections or PPAs for ' + fiscalYear + '.'}
          </p>
          <button type="button" className="btn-secondary" onClick={() => { setEditingSource(null); setIsModalOpen(true); }}>
            <Plus size={16} /> Add Electricity Source
          </button>
        </div>
      )}

      {isModalOpen && (
        <AddScope2SourceForm
          category="electricity"
          initialSource={editingSource}
          onClose={() => { setIsModalOpen(false); setEditingSource(null); }}
        />
      )}
    </div>
  );
};
