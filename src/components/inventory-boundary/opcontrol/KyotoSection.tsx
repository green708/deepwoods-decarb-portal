import React from 'react';
import { Check } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import type { KyotoStatus, OperationalControl } from '@/lib/inventory-types';

export const KyotoSection: React.FC = () => {
  const { opControl, updateKyotoGas, scope1Assets, facilities } = useInventory();

  const getDeclaredFacilities = (gasKey: keyof OperationalControl['kyoto']) => {
    let matchingFacilityIds = new Set<string>();

    if (gasKey === 'co2' || gasKey === 'ch4' || gasKey === 'n2o') {
      scope1Assets
        .filter((a) => a.subcategory === 'stationary' || a.subcategory === 'mobile')
        .forEach((a) => matchingFacilityIds.add(a.facilityId));
    } else if (gasKey === 'hfcs') {
      scope1Assets
        .filter(
          (a) =>
            a.subcategory === 'fugitive' &&
            a.refrigerantOrGas &&
            (a.refrigerantOrGas.startsWith('R-4') ||
              a.refrigerantOrGas.startsWith('R-1') ||
              a.refrigerantOrGas.includes('HFC'))
        )
        .forEach((a) => matchingFacilityIds.add(a.facilityId));
    } else if (gasKey === 'sf6') {
      scope1Assets
        .filter((a) => a.refrigerantOrGas === 'SF₆')
        .forEach((a) => matchingFacilityIds.add(a.facilityId));
    } else if (gasKey === 'nf3') {
      scope1Assets
        .filter((a) => a.refrigerantOrGas === 'NF₃')
        .forEach((a) => matchingFacilityIds.add(a.facilityId));
    }

    return facilities
      .filter((f) => matchingFacilityIds.has(f.id))
      .map((f) => f.name.replace(' (HQ)', ''));
  };

  const gasesList: Array<{ key: keyof OperationalControl['kyoto']; name: string; formula: string }> = [
    { key: 'co2', name: 'Carbon Dioxide', formula: 'CO₂' },
    { key: 'ch4', name: 'Methane', formula: 'CH₄' },
    { key: 'n2o', name: 'Nitrous Oxide', formula: 'N₂O' },
    { key: 'hfcs', name: 'Hydrofluorocarbons', formula: 'HFCs' },
    { key: 'pfcs', name: 'Perfluorocarbons', formula: 'PFCs' },
    { key: 'sf6', name: 'Sulfur Hexafluoride', formula: 'SF₆' },
    { key: 'nf3', name: 'Nitrogen Trifluoride', formula: 'NF₃' },
  ];

  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
        Kyoto Gases Screening
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--slate)', marginBottom: '20px' }}>
        GHG Protocol and ISO 14064-1 require the seven Kyoto gases to be screened, even if some come back zero. Statuses set here appear in your inventory report as declared boundary information.
      </p>

      <div
        style={{
          backgroundColor: 'var(--canopy-tint)',
          borderLeft: '4px solid var(--canopy)',
          borderTop: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--canopy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            <Check size={14} color="#FFF" />
          </div>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
              Default reporting basis: tCO₂e (aggregate)
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--slate)', lineHeight: '1.5' }}>
              By default, all your emissions are aggregated and reported as tonnes of carbon dioxide equivalent (tCO₂e). This is the standard reporting basis when gas-specific measurement isn't separately available. If you have separately measured any individual gases (e.g. HFC leakage tracked at the equipment level, SF₆ balance from switchgear), use the table below to declare them separately.
            </p>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--slate)',
            backgroundColor: 'var(--slate-tint)',
            padding: '4px 10px',
            borderRadius: '9999px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          Always on
        </span>
      </div>

      <div
        style={{
          backgroundColor: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--paper)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--slate)',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <th style={{ padding: '12px 16px' }}>Gas</th>
              <th style={{ padding: '12px 16px' }}>Formula</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Currently Declared At</th>
            </tr>
          </thead>
          <tbody>
            {gasesList.map((gas) => {
              const currentStatus = opControl.kyoto[gas.key];
              const declaredFacilities = getDeclaredFacilities(gas.key);

              return (
                <tr
                  key={gas.key}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s ease' }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--ink)' }}>{gas.name}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--slate)', fontWeight: 500 }}>{gas.formula}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <select
                      className="input-field"
                      style={{ width: '220px', padding: '6px 10px', fontSize: '13px' }}
                      value={currentStatus}
                      onChange={(e) => updateKyotoGas(gas.key, e.target.value as KyotoStatus)}
                    >
                      <option value="reportedAsCO2e">Reported as CO₂e (default)</option>
                      <option value="quantifiedSeparately">Quantified separately</option>
                      <option value="screenedImmaterial">Screened — immaterial</option>
                      <option value="notPresent">Not present</option>
                    </select>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {declaredFacilities.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {declaredFacilities.map((facName) => (
                          <span
                            key={facName}
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              color: 'var(--canopy)',
                              backgroundColor: 'var(--canopy-tint)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {facName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--slate)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
