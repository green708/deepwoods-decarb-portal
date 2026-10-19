import { useState } from 'react';
import { MoreHorizontal, Edit2, Trash2, ChevronUp } from 'lucide-react';
import type { Scope1Asset } from '@/lib/inventory-types';
import { StatusStamp } from '@/components/inventory-boundary/shared/StatusStamp';
import { FlagChip } from '@/components/inventory-boundary/shared/FlagChip';

interface Scope1AssetRowProps {
  asset: Scope1Asset;
  onEdit: (asset: Scope1Asset) => void;
  onDelete: (id: string) => void;
}

export const Scope1AssetRow: React.FC<Scope1AssetRowProps> = ({
  asset,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const needsData =
    (asset.subcategory === 'stationary' && (!asset.fuelType || !asset.equipmentType)) ||
    (asset.subcategory === 'mobile' && (!asset.fuelType || !asset.vehicleType)) ||
    (asset.subcategory === 'fugitive' && (!asset.refrigerantOrGas || !asset.equipmentType));

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        backgroundColor: 'var(--white)',
        marginBottom: '8px',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {asset.name}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {asset.isBiogenic && <FlagChip type="biogenic" />}
            {needsData && <FlagChip type="needsData" />}
          </div>
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'var(--slate)',
            flexShrink: 0,
            textAlign: 'right',
            marginRight: '12px',
          }}
        >
          {asset.subcategory === 'stationary' && (
            <span>
              {asset.equipmentType ? `${asset.equipmentType} · ` : ''}
              {asset.fuelType || 'No fuel selected'}
              {asset.nameplateCapacity ? ` (${asset.nameplateCapacity.value} ${asset.nameplateCapacity.unit})` : ''}
            </span>
          )}
          {asset.subcategory === 'mobile' && (
            <span>
              {asset.vehicleType ? `${asset.vehicleType} ` : ''}
              {asset.vehicleCount ? `(${asset.vehicleCount}) · ` : ''}
              {asset.fuelType || 'No fuel selected'}
            </span>
          )}
          {asset.subcategory === 'fugitive' && (
            <span>
              {asset.equipmentType ? `${asset.equipmentType} · ` : ''}
              {asset.refrigerantOrGas || 'No gas selected'}
              {asset.refrigerantChargeKg ? ` (${asset.refrigerantChargeKg} kg)` : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <StatusStamp status={asset.status} size="sm" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--slate)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <MoreHorizontal size={18} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--slate-tint)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '13px',
            }}
          >
            <div>
              <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                Asset Category
              </span>
              <span style={{ fontWeight: 500 }}>
                {asset.subcategory === 'stationary'
                  ? 'Stationary Combustion'
                  : asset.subcategory === 'mobile'
                  ? 'Mobile Combustion'
                  : 'Fugitive Sources'}
              </span>
            </div>

            {asset.equipmentType && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Equipment Type
                </span>
                <span style={{ fontWeight: 500 }}>{asset.equipmentType}</span>
              </div>
            )}

            {asset.fuelType && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Fuel Type
                </span>
                <span style={{ fontWeight: 500 }}>
                  {asset.fuelType} {asset.isBiogenic ? '(Biogenic)' : ''}
                </span>
              </div>
            )}

            {asset.nameplateCapacity && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Nameplate Capacity
                </span>
                <span style={{ fontWeight: 500 }}>
                  {asset.nameplateCapacity.value} {asset.nameplateCapacity.unit}
                </span>
              </div>
            )}

            {asset.vehicleType && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Vehicle Type / Count
                </span>
                <span style={{ fontWeight: 500 }}>
                  {asset.vehicleType} ({asset.vehicleCount || 1} units)
                </span>
              </div>
            )}

            {asset.ownership && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Ownership
                </span>
                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                  {asset.ownership}
                </span>
              </div>
            )}

            {asset.subcategory === 'fugitive' && asset.refrigerantOrGas && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Refrigerant / Gas
                </span>
                <span style={{ fontWeight: 500 }}>{asset.refrigerantOrGas}</span>
              </div>
            )}

            {asset.subcategory === 'fugitive' && asset.refrigerantChargeKg != null && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Refrigerant Charge
                </span>
                <span style={{ fontWeight: 500 }}>{asset.refrigerantChargeKg} kg</span>
              </div>
            )}

            {asset.subcategory === 'fugitive' && asset.annualLeakagePct != null && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Est. Annual Leakage
                </span>
                <span style={{ fontWeight: 500 }}>{asset.annualLeakagePct}%</span>
              </div>
            )}

            {asset.commissioningDate && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Commissioning Date
                </span>
                <span style={{ fontWeight: 500 }}>{asset.commissioningDate}</span>
              </div>
            )}

            {asset.subcategory === 'fugitive' && asset.installationDate && (
              <div>
                <span className="micro-label" style={{ display: 'block', marginBottom: '2px' }}>
                  Installation Date
                </span>
                <span style={{ fontWeight: 500 }}>{asset.installationDate}</span>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              paddingTop: '8px',
            }}
          >
            <button
              type="button"
              className="btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(asset);
              }}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              <Edit2 size={14} /> Edit Asset
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(asset.id);
              }}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
