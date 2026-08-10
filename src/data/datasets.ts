// Backing dataset list used by the Data Submission flows.
// Every submission must additionally be tagged FP or FOS (see submissionsStore).

export type DatasetId =
  | "energy"
  | "production"
  | "fugitive"
  | "cat1_purchases"
  | "cat2_assets"
  | "cat4_upstream"
  | "cat5_waste"
  | "cat6_travel"
  | "cat7_commute"
  | "cat9_downstream"
  | "cat11_use"
  | "cat12_eol"
  | "scope1" | "scope2" | "scope3";

export type Dataset = {
  id: DatasetId;
  name: string;
  tag: string;
  desc: string;
  documents: string[];
  template: string;
};

export const DATASETS: Dataset[] = [
  {
    id: "energy",
    name: "Energy Consumption",
    tag: "Scope 1 & 2",
    desc: "Grid electricity, diesel (DG/vehicles/forklifts), LPG and PC-oven fuel per facility.",
    documents: ["Monthly electricity bills (BESCOM/TNEB)", "Diesel/LPG purchase invoices"],
    template: "Template_EnergyConsumption.xlsx",
  },
  {
    id: "production",
    name: "Production & Revenue Data",
    tag: "Intensity",
    desc: "Monthly production output (units) and revenue for intensity metrics.",
    documents: ["Production/despatch register", "Revenue statement"],
    template: "Template_ProductionData.xlsx",
  },
  {
    id: "fugitive",
    name: "Fugitive Sources",
    tag: "Scope 1 · Fugitive",
    desc: "CO2 fire extinguisher discharges, welding CO2 cylinders, refrigerant top-ups.",
    documents: ["Refill invoices or AMC/service records"],
    template: "Template_Fugitive.xlsx",
  },
  {
    id: "cat1_purchases",
    name: "Cat 1 — Purchased Goods & Services",
    tag: "Scope 3 · Cat 1",
    desc: "Purchase register — boards, steel, aluminium, fabric, hardware and services.",
    documents: ["Purchase register / procurement extract"],
    template: "Template_Cat1_Purchases.xlsx",
  },
  {
    id: "cat2_assets",
    name: "Cat 2 — Capital Goods",
    tag: "Scope 3 · Cat 2",
    desc: "Fixed-asset additions in the reporting period.",
    documents: ["Fixed asset additions register", "Capex invoices"],
    template: "Template_Cat2_CapitalGoods.xlsx",
  },
  {
    id: "cat4_upstream",
    name: "Cat 4 — Upstream Transport",
    tag: "Scope 3 · Cat 4",
    desc: "Inbound freight for raw materials and components.",
    documents: ["Freight/transportation invoices", "Logistics provider statements"],
    template: "Template_Cat4_UpstreamFreight.xlsx",
  },
  {
    id: "cat5_waste",
    name: "Cat 5 — Waste",
    tag: "Scope 3 · Cat 5",
    desc: "Waste generated in operations and disposal route (incl. hazardous waste).",
    documents: ["Waste disposal manifest / weighbridge slip", "Scrap agreement"],
    template: "Template_Cat5_Waste.xlsx",
  },
  {
    id: "cat6_travel",
    name: "Cat 6 — Business Travel",
    tag: "Scope 3 · Cat 6",
    desc: "Employee air, rail and taxi travel.",
    documents: ["Travel tickets or expense claims"],
    template: "Template_Cat6_BusinessTravel.xlsx",
  },
  {
    id: "cat7_commute",
    name: "Cat 7 — Employee Commuting",
    tag: "Scope 3 · Cat 7",
    desc: "Daily employee commute mode and distance (survey-based).",
    documents: ["HR commute survey records", "Headcount by site"],
    template: "Template_Cat7_Commuting.xlsx",
  },
  {
    id: "cat9_downstream",
    name: "Cat 9 — Downstream Transport",
    tag: "Scope 3 · Cat 9",
    desc: "Outbound delivery of finished furniture to customers/dealers.",
    documents: ["Monthly delivery data", "Freight invoices"],
    template: "Template_Cat9_DownstreamFreight.xlsx",
  },
  {
    id: "cat11_use",
    name: "Cat 11 — Use of Sold Products",
    tag: "Scope 3 · Cat 11",
    desc: "Electric height-adjustable table power consumption & sales volumes (FOS).",
    documents: ["HAT power consumption & production details"],
    template: "Template_Cat11_UsePhase.xlsx",
  },
  {
    id: "cat12_eol",
    name: "Cat 12 — End-of-Life",
    tag: "Scope 3 · Cat 12",
    desc: "Product sales volumes and material composition for end-of-life treatment.",
    documents: ["Sales volume register", "Bill of materials"],
    template: "Template_Cat12_EndOfLife.xlsx",
  },
];

export const getDataset = (id: DatasetId): Dataset | undefined =>
  DATASETS.find((d) => d.id === id);
