export type FiscalYear = string;

export type ControlStatus =
  | 'ownedOperated'
  | 'leasedInOperating'
  | 'leasedInFinance'
  | 'leasedOut'
  | 'jointVenture';

export type Facility = {
  id: string;
  name: string;
  address: string;
  isHeadOffice: boolean;
  controlStatus: ControlStatus;
  entity?: string;
};

export type Status = 'active' | 'monitor' | 'flagForReplacement' | 'efficient';

// ── Scope 1 ──
export type Scope1Subcategory = 'stationary' | 'mobile' | 'fugitive' | 'process';

export type ProcessEmissionType =
  | 'calcination'          // cement, lime, magnesia
  | 'steam_reforming'      // hydrogen, ammonia, methanol
  | 'bayer_process'        // alumina refining
  | 'glass_melting'
  | 'chemical_reaction'    // general chemical manufacturing
  | 'fermentation'         // bioethanol, brewing
  | 'ore_smelting'         // iron, steel, non-ferrous metals
  | 'other';

export type CapacityUnit = 'kVA' | 'kW' | 'MW' | 'MMBtu/hr';

export type Scope1Asset = {
  id: string;
  fiscalYear: FiscalYear;
  scope: 'scope1';
  subcategory: Scope1Subcategory;
  name: string;
  facilityId: string;
  status: Status;

  // Stationary + Mobile
  fuelType?: string | undefined;
  isBiogenic?: boolean | undefined;

  // Stationary only
  equipmentType?: string | undefined;
  nameplateCapacity?: { value: number; unit: CapacityUnit } | undefined;
  commissioningDate?: string | undefined;

  // Mobile only
  vehicleType?: string | undefined;
  vehicleCount?: number | undefined;
  ownership?: 'owned' | 'longTermLease' | 'shortTermLease' | undefined;

  // Fugitive only
  refrigerantOrGas?: string | undefined;
  refrigerantChargeKg?: number | undefined;
  annualLeakagePct?: number | undefined;
  installationDate?: string | undefined;

  // Process only
  processEmissionType?: ProcessEmissionType | undefined;
  rawMaterial?: string | undefined;
  annualOutputQty?: number | undefined;
  outputUnit?: string | undefined;

  // All sources — emission factor documentation (ISO 14064 §7.3)
  efDataset?: string | undefined;   // e.g. "IPCC AR6", "MoEFCC 2024", "DEFRA 2024"
  efVintageYear?: string | undefined;

  // GHG Protocol / CDP C6.3 — biogenic CO₂ reported separately outside Scope 1
  biogenicCO2e?: number | undefined; // tCO₂e/year (memo item, not added to Scope 1 total)
};

// ── Scope 2 ──
export type Scope2Category =
  | 'electricity'
  | 'steam'
  | 'heating'
  | 'cooling'
  | 'solar-generated'
  | 'solar-consumed'
  | 'solar-exported'
  | 'captive-wind';

export type ProcurementInstrument =
  | 'iRec'
  | 'indianRec'
  | 'greenTariff'
  | 'physicalPPA'
  | 'vppa'
  | 'openAccessSolar'
  | 'openAccessWind'
  | 'otherBundled'
  | 'none';

export type RESourceType = 'solar' | 'wind' | 'hydro' | 'biomass' | 'geothermal' | 'other';
export type RELocation = 'onsite' | 'offsite';
export type REConnectionType = 'throughGrid' | 'direct' | 'notApplicable';
export type REOwnership = 'companyOwned' | 'landlordOwned';
export type REMetering = 'gross' | 'net';
export type ProcurementRoute =
  | 'selfGeneration'
  | 'physicalPPA'
  | 'vppa'
  | 'projectSpecific'
  | 'retailSupply';
export type AgreementType =
  | 'thirdPartyPPA'
  | 'greenTariff'
  | 'supplierPPA'
  | 'intrastateOpenAccess'
  | 'interstateOpenAccess'
  | 'noAgreement'
  | 'other';

export type RenewableProcurement = {
  hasInstrument: boolean;
  // 1 — Source & location
  reSourceType?: RESourceType | undefined;
  reLocation?: RELocation | undefined;
  connectionType?: REConnectionType | undefined;
  linkedGridConnectionName?: string | undefined;
  // 2 — Ownership & procurement route
  reOwnership?: REOwnership | undefined;
  metering?: REMetering | undefined;
  procurementRoute?: ProcurementRoute | undefined;
  agreementType?: AgreementType | undefined;
  // 3 — Contractual instrument / certificate
  instrumentType?: ProcurementInstrument | undefined;
  coverage?: 'full' | 'partial' | undefined;
  coveragePercent?: number | undefined;
  issuingBody?: string | undefined;
  vintageYear?: string | undefined;
  contractReference?: string | undefined;
};

export type Scope2Source = {
  id: string;
  fiscalYear: FiscalYear;
  scope: 'scope2';
  category: Scope2Category;
  name: string;
  facilityId: string;
  status: Status;
  supplier: string;

  // Electricity only
  gridConnectionType?: 'HT' | 'LT' | 'EHT' | 'captive' | undefined;
  gridRegion?: string | undefined;
  consumerNumber?: string | undefined;
  renewableProcurement?: RenewableProcurement | undefined;

  // Steam / Heating / Cooling
  contractType?: string | undefined;
  sourceDescription?: string | undefined;
  isLowCarbon?: boolean | undefined;
};

export type Source = Scope1Asset | Scope2Source;

// ── Operational Control ──
export type KyotoStatus =
  | 'reportedAsCO2e'
  | 'quantifiedSeparately'
  | 'screenedImmaterial'
  | 'notPresent';

export type Scope3Status =
  | 'inScope'
  | 'screenedNotApplicable'
  | 'screenedImmaterial'
  | 'deferred';

export type Scope3CategoryItem = {
  categoryNumber: number;
  categoryName: string;
  status: Scope3Status;
  rationale: string;
  manuallyEdited: boolean;
};

export type OperationalControl = {
  kyoto: {
    co2: KyotoStatus;
    ch4: KyotoStatus;
    n2o: KyotoStatus;
    hfcs: KyotoStatus;
    pfcs: KyotoStatus;
    sf6: KyotoStatus;
    nf3: KyotoStatus;
  };
  scope3: Array<Scope3CategoryItem>;
};

// ── Standards compliance support types ──────────────────────────

/** ISO 14064-3 / CDP C10 */
export type VerificationRecord = {
  reportingYear: string;
  assuranceLevel: 'limited' | 'reasonable' | 'none';
  standard: 'ISAE3410' | 'ISO14064-3' | 'AA1000AS' | 'other';
  provider: string;
  scopeCovered: string;
};

/** BRSR Core / CDP C8 / GRI 302-3 */
export type IntensityDenominators = {
  fiscalYear: string;
  revenueInr?: number;
  revenueUsd?: number;
  primaryOutputQty?: number;
  primaryOutputUnit?: string;
  totalFloorAreaSqm?: number;
  employeeCount?: number;
};

/** BRSR Core / GRI 303 / CDP Water */
export type WaterWithdrawalSource =
  | 'municipal_supply'
  | 'groundwater_borewell'
  | 'surface_water'
  | 'rainwater_harvesting'
  | 'sea_water'
  | 'third_party_treated';

export type WaterData = {
  fiscalYear: string;
  facilityId?: string;
  withdrawalBySource: Partial<Record<WaterWithdrawalSource, number>>; // kL
  totalDischargeKL?: number;
  dischargeDestination?: string;
  totalConsumedKL?: number;
  isWaterStressedArea?: boolean;
};

/** BRSR P6 / GRI 306 */
export type WasteDisposalMethod =
  | 'recycled'
  | 'reused'
  | 'composted'
  | 'recovered_energy'
  | 'incinerated_no_recovery'
  | 'landfill'
  | 'other_disposal';

export type WasteHierarchy = {
  fiscalYear: string;
  facilityId?: string;
  totalHazardousTonnes?: number;
  totalNonHazardousTonnes?: number;
  disposalByMethod: Partial<Record<WasteDisposalMethod, number>>; // tonnes
};

/** CDP C11.2 / BRSR */
export type CarbonPricingInfo = {
  subjectToEts: boolean;
  etsName?: string;
  subjectToCarbonTax: boolean;
  carbonTaxName?: string;
  patObligated: boolean;
  usesInternalCarbonPrice: boolean;
  internalCarbonPriceInr?: number; // INR per tCO2e
};
