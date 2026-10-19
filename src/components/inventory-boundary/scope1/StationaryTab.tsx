import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import type { Scope1Asset } from '@/lib/inventory-types';
import { FacilityGroupSection } from '@/components/inventory-boundary/shared/FacilityGroupSection';
import { Scope1AssetRow } from './Scope1AssetRow';
import { AddScope1AssetForm } from './AddScope1AssetForm';

export const StationaryTab: React.FC = () => {
  const { scope1Assets, facilities, fiscalYear, deleteScope1Asset } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [fuelFilter, setFuelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Scope1Asset | null>(null);

  const currentAssets = scope1Assets.filter(
    (a) => a.fiscalYear === fiscalYear && a.subcategory === 'stationary'
  );

  const filteredAssets = currentAssets.filter((asset) => {
    if (searchTerm && !asset.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (facilityFilter !== 'all' && asset.facilityId !== facilityFilter) return false;
    if (fuelFilter !== 'all' && asset.fuelType !== fuelFilter) return false;
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
    return true;
  });

  const facilitiesWithAssets = facilities
    .map((fac) => ({ facility: fac, assets: filteredAssets.filter((a) => a.facilityId === fac.id) }))
    .filter((group) => group.assets.length > 0);

  const defaultExpanded = facilitiesWithAssets.length <= 3;

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
          Anything at your facilities that burns fuel on-site to produce heat, steam, or power — generators, boilers, furnaces, ovens, water heaters, process burners.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}
        >
          <Plus size={16} /> Add asset
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select className="input-field" value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
          <option value="all">All Facilities</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <select className="input-field" value={fuelFilter} onChange={(e) => setFuelFilter(e.target.value)}>
          <option value="all">All Fuel Types</option>
          <option value="HSD Diesel">HSD Diesel</option>
          <option value="LPG">LPG</option>
          <option value="Wood / Woody Biomass">Wood / Woody Biomass (Biogenic)</option>
          <option value="Natural Gas / PNG">Natural Gas / PNG</option>
        </select>

        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="monitor">Monitor</option>
          <option value="flagForReplacement">Flag for Replacement</option>
          <option value="efficient">Efficient</option>
        </select>
      </div>

      {facilitiesWithAssets.length > 0 ? (
        facilitiesWithAssets.map(({ facility, assets }) => (
          <FacilityGroupSection key={facility.id} facility={facility} assetCount={assets.length} defaultExpanded={defaultExpanded}>
            {assets.map((asset) => (
              <Scope1AssetRow
                key={asset.id}
                asset={asset}
                onEdit={(a) => { setEditingAsset(a); setIsModalOpen(true); }}
                onDelete={(id) => deleteScope1Asset(id)}
              />
            ))}
          </FacilityGroupSection>
        ))
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate)' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>No stationary combustion assets found</p>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            {searchTerm || facilityFilter !== 'all' || fuelFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Add your generators, boilers, process burners, or heaters for ' + fiscalYear + '.'}
          </p>
          <button type="button" className="btn-secondary" onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}>
            <Plus size={16} /> Add Stationary Asset
          </button>
        </div>
      )}

      {isModalOpen && (
        <AddScope1AssetForm
          subcategory="stationary"
          initialAsset={editingAsset}
          onClose={() => { setIsModalOpen(false); setEditingAsset(null); }}
        />
      )}
    </div>
  );
};
