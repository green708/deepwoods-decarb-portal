import React, { useState } from 'react';
import { X } from 'lucide-react';
import type {
  Scope1Asset,
  Scope1Subcategory,
  Status,
  CapacityUnit,
  FiscalYear,
} from '@/lib/inventory-types';
import { useInventory } from '@/context/InventoryContext';
import {
  FOSSIL_FUELS,
  BIOGENIC_FUELS,
  REFRIGERANT_GROUPS,
} from '@/lib/inventory-data';

interface AddScope1AssetFormProps {
  subcategory: Scope1Subcategory;
  initialAsset?: Scope1Asset | null;
  onClose: () => void;
}

export const AddScope1AssetForm: React.FC<AddScope1AssetFormProps> = ({
  subcategory,
  initialAsset,
  onClose,
}) => {
  const { facilities, fiscalYear, addScope1Asset, updateScope1Asset } = useInventory();

  const [name, setName] = useState(initialAsset?.name || '');
  const [facilityId, setFacilityId] = useState(
    initialAsset?.facilityId || (facilities[0]?.id ?? '')
  );
  const [status, setStatus] = useState<Status>(initialAsset?.status || 'active');

  const [equipmentType, setEquipmentType] = useState(initialAsset?.equipmentType || '');
  const [fuelType, setFuelType] = useState(initialAsset?.fuelType || '');
  const [capacityValue, setCapacityValue] = useState<string>(
    initialAsset?.nameplateCapacity?.value !== undefined
      ? String(initialAsset.nameplateCapacity.value)
      : ''
  );
  const [capacityUnit, setCapacityUnit] = useState<CapacityUnit>(
    initialAsset?.nameplateCapacity?.unit || 'kVA'
  );
  const [commissioningDate, setCommissioningDate] = useState(initialAsset?.commissioningDate || '');

  const [vehicleType, setVehicleType] = useState(initialAsset?.vehicleType || '');
  const [vehicleTypeOther, setVehicleTypeOther] = useState('');
  const [vehicleCount, setVehicleCount] = useState<string>(
    initialAsset?.vehicleCount !== undefined ? String(initialAsset.vehicleCount) : ''
  );
  const [ownership, setOwnership] = useState<'owned' | 'longTermLease' | 'shortTermLease' | 'unknown'>(
    initialAsset?.ownership || 'owned'
  );
  const [fuelTypeOther, setFuelTypeOther] = useState('');

  const [refrigerantOrGas, setRefrigerantOrGas] = useState(initialAsset?.refrigerantOrGas || '');
  const [refrigerantChargeKg, setRefrigerantChargeKg] = useState<string>(
    initialAsset?.refrigerantChargeKg !== undefined ? String(initialAsset.refrigerantChargeKg) : ''
  );
  const [annualLeakagePct, setAnnualLeakagePct] = useState<string>(
    initialAsset?.annualLeakagePct !== undefined ? String(initialAsset.annualLeakagePct) : ''
  );
  const [installationDate, setInstallationDate] = useState(initialAsset?.installationDate || '');
  const [biogenicCO2e, setBiogenicCO2e] = useState<string>(
    initialAsset?.biogenicCO2e !== undefined ? String(initialAsset.biogenicCO2e) : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const isBiogenic = BIOGENIC_FUELS.includes(fuelType);

    const baseData = {
      fiscalYear: (initialAsset?.fiscalYear || fiscalYear) as FiscalYear,
      scope: 'scope1' as const,
      subcategory,
      name: name.trim(),
      facilityId,
      status,
    };

    let subcategoryData: Partial<Scope1Asset> = {};

    if (subcategory === 'stationary') {
      subcategoryData = {
        equipmentType: equipmentType || undefined,
        fuelType: fuelType || undefined,
        isBiogenic,
        nameplateCapacity: capacityValue
          ? { value: Number(capacityValue), unit: capacityUnit }
          : undefined,
        commissioningDate: commissioningDate || undefined,
        biogenicCO2e: isBiogenic && biogenicCO2e ? Number(biogenicCO2e) : undefined,
      };
    } else if (subcategory === 'mobile') {
      subcategoryData = {
        vehicleType: vehicleType || undefined,
        vehicleCount: vehicleCount ? Number(vehicleCount) : undefined,
        fuelType: fuelType || undefined,
        isBiogenic,
        ownership: ownership === 'unknown' ? undefined : ownership,
      };
    } else if (subcategory === 'fugitive') {
      subcategoryData = {
        equipmentType: equipmentType || undefined,
        refrigerantOrGas: refrigerantOrGas || undefined,
        refrigerantChargeKg: refrigerantChargeKg ? Number(refrigerantChargeKg) : undefined,
        annualLeakagePct: annualLeakagePct ? Number(annualLeakagePct) : undefined,
        installationDate: installationDate || undefined,
      };
    }

    if (initialAsset) {
      updateScope1Asset(initialAsset.id, { ...baseData, ...subcategoryData });
    } else {
      addScope1Asset({ ...baseData, ...subcategoryData });
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
            {initialAsset ? 'Edit Scope 1 Asset' : 'Add Scope 1 Asset'} ·{' '}
            <span style={{ color: 'var(--canopy)', textTransform: 'capitalize' }}>
              {subcategory}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Asset Name <span style={{ color: 'var(--coral)' }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder={
                  subcategory === 'stationary'
                    ? 'e.g. DG Set 250 kVA — Utility Shed'
                    : subcategory === 'mobile'
                    ? 'e.g. Sedan Fleet — Sales Team'
                    : 'e.g. R-410A HVAC — Building B'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Facility <span style={{ color: 'var(--coral)' }}>*</span>
              </label>
              <select
                className="input-field"
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              >
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} {fac.isHeadOffice ? '(HQ)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {subcategory === 'stationary' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Equipment Type <span style={{ color: 'var(--coral)' }}>*</span>
                  </label>
                  <select
                    className="input-field"
                    value={equipmentType}
                    required
                    onChange={(e) => setEquipmentType(e.target.value)}
                  >
                    <option value="">Select equipment type...</option>
                    <option value="Diesel Generator">Diesel Generator</option>
                    <option value="Boiler">Boiler</option>
                    <option value="Furnace">Furnace</option>
                    <option value="Kiln">Kiln</option>
                    <option value="Oven">Oven</option>
                    <option value="Process Burner">Process Burner</option>
                    <option value="Water Heater">Water Heater</option>
                    <option value="Other stationary equipment">Other stationary equipment</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Fuel Type <span style={{ color: 'var(--coral)' }}>*</span>
                  </label>
                  <select
                    className="input-field"
                    value={fuelType}
                    required
                    onChange={(e) => { setFuelType(e.target.value); if (e.target.value !== 'Other fossil') setFuelTypeOther(''); }}
                  >
                    <option value="">Select fuel type...</option>
                    <optgroup label="Fossil Fuels">
                      {FOSSIL_FUELS.map((fuel) => (
                        <option key={fuel} value={fuel}>{fuel}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Biogenic Fuels">
                      {BIOGENIC_FUELS.map((fuel) => (
                        <option key={fuel} value={fuel}>{fuel} 🌱</option>
                      ))}
                    </optgroup>
                  </select>
                  {fuelType === 'Other fossil' && (
                    <input
                      type="text"
                      className="input-field"
                      style={{ marginTop: '8px' }}
                      placeholder="Describe the fuel type..."
                      value={fuelTypeOther}
                      onChange={(e) => setFuelTypeOther(e.target.value)}
                    />
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px', display: 'block' }}>
                    Biogenic fuels are reported as a memo item outside Scope 1 (CO₂), while CH₄ and N₂O stay inside Scope 1.
                  </span>
                </div>

                {BIOGENIC_FUELS.includes(fuelType) && (
                  <div style={{ background: 'var(--canopy-tint)', border: '1px solid #C4D6CB', borderRadius: '8px', padding: '12px 16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--canopy)' }}>
                      Estimated Biogenic CO₂ (tCO₂e / year) — Optional
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-field"
                      placeholder="e.g. 12.5"
                      value={biogenicCO2e}
                      onChange={(e) => setBiogenicCO2e(e.target.value)}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px', display: 'block' }}>
                      GHG Protocol & CDP C6.3 require this to be disclosed as a separate memo item, not added to your Scope 1 total. Enter an estimate now and refine during data collection.
                    </span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Nameplate Capacity (Optional)
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="e.g. 250"
                      value={capacityValue}
                      onChange={(e) => setCapacityValue(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Unit
                    </label>
                    <select
                      className="input-field"
                      value={capacityUnit}
                      onChange={(e) => setCapacityUnit(e.target.value as CapacityUnit)}
                    >
                      <option value="kVA">kVA</option>
                      <option value="kW">kW</option>
                      <option value="MW">MW</option>
                      <option value="MMBtu/hr">MMBtu/hr</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Commissioning Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={commissioningDate}
                    onChange={(e) => setCommissioningDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {subcategory === 'mobile' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Vehicle Type
                  </label>
                  <select
                    className="input-field"
                    value={vehicleType}
                    onChange={(e) => { setVehicleType(e.target.value); if (e.target.value !== 'Other mobile source') setVehicleTypeOther(''); }}
                  >
                    <option value="">Select vehicle type...</option>
                    <option value="Passenger Car">Passenger Car</option>
                    <option value="Light Commercial Vehicle">Light Commercial Vehicle</option>
                    <option value="Heavy-Duty Truck">Heavy-Duty Truck</option>
                    <option value="Bus">Bus</option>
                    <option value="Two-Wheeler">Two-Wheeler</option>
                    <option value="Forklift">Forklift</option>
                    <option value="Tractor">Tractor</option>
                    <option value="Off-road Equipment">Off-road Equipment</option>
                    <option value="Ship / Boat">Ship / Boat</option>
                    <option value="Other mobile source">Other mobile source</option>
                  </select>
                  {vehicleType === 'Other mobile source' && (
                    <input
                      type="text"
                      className="input-field"
                      style={{ marginTop: '8px' }}
                      placeholder="Describe the vehicle or mobile source..."
                      value={vehicleTypeOther}
                      onChange={(e) => setVehicleTypeOther(e.target.value)}
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Vehicle Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      placeholder="e.g. 5"
                      value={vehicleCount}
                      onChange={(e) => setVehicleCount(e.target.value)}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px', display: 'block' }}>
                      Leave blank to assume 1
                    </span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Ownership
                    </label>
                    <select
                      className="input-field"
                      value={ownership}
                      onChange={(e) => setOwnership(e.target.value as typeof ownership)}
                    >
                      <option value="owned">Owned</option>
                      <option value="longTermLease">Long-term Lease</option>
                      <option value="shortTermLease">Short-term Lease</option>
                      <option value="unknown">Unknown / Not tracked</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Fuel Type <span style={{ color: 'var(--coral)' }}>*</span>
                  </label>
                  <select
                    className="input-field"
                    value={fuelType}
                    required
                    onChange={(e) => { setFuelType(e.target.value); if (e.target.value !== 'Other fossil') setFuelTypeOther(''); }}
                  >
                    <option value="">Select fuel type...</option>
                    <optgroup label="Fossil Fuels">
                      {FOSSIL_FUELS.map((fuel) => (
                        <option key={fuel} value={fuel}>{fuel}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Biogenic Fuels">
                      {BIOGENIC_FUELS.map((fuel) => (
                        <option key={fuel} value={fuel}>{fuel} 🌱</option>
                      ))}
                    </optgroup>
                  </select>
                  {fuelType === 'Other fossil' && (
                    <input
                      type="text"
                      className="input-field"
                      style={{ marginTop: '8px' }}
                      placeholder="Describe the fuel type..."
                      value={fuelTypeOther}
                      onChange={(e) => setFuelTypeOther(e.target.value)}
                    />
                  )}
                </div>
              </>
            )}

            {subcategory === 'fugitive' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Equipment Type
                  </label>
                  <select
                    className="input-field"
                    value={equipmentType}
                    onChange={(e) => setEquipmentType(e.target.value)}
                  >
                    <option value="">Select equipment type...</option>
                    <option value="Split AC">Split AC</option>
                    <option value="Central AC / HVAC">Central AC / HVAC</option>
                    <option value="Chiller">Chiller</option>
                    <option value="Cold Storage">Cold Storage</option>
                    <option value="Industrial Refrigeration">Industrial Refrigeration</option>
                    <option value="Switchgear (SF₆)">Switchgear (SF₆)</option>
                    <option value="Fire Suppression System">Fire Suppression System</option>
                    <option value="Fire Extinguisher (Portable)">Fire Extinguisher (Portable)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Refrigerant / Gas
                  </label>
                  <select
                    className="input-field"
                    value={refrigerantOrGas}
                    onChange={(e) => setRefrigerantOrGas(e.target.value)}
                  >
                    <option value="">Select refrigerant / gas...</option>
                    {REFRIGERANT_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.items.map((gas) => (
                          <option key={gas} value={gas}>{gas}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px', display: 'block' }}>
                    Each gas has its own Global Warming Potential (GWP) applied for reporting.
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Refrigerant Charge (kg)
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="input-field"
                      placeholder="Optional"
                      value={refrigerantChargeKg}
                      onChange={(e) => setRefrigerantChargeKg(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                      Est. Annual Leakage %
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="input-field"
                      placeholder="Optional"
                      value={annualLeakagePct}
                      onChange={(e) => setAnnualLeakagePct(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Installation Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={installationDate}
                    onChange={(e) => setInstallationDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Status
              </label>
              <select
                className="input-field"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                <option value="active">Active</option>
                <option value="monitor">Monitor</option>
                <option value="flagForReplacement">Flag for Replacement</option>
                <option value="efficient">Efficient</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {initialAsset ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
