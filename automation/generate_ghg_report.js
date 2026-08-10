#!/usr/bin/env node
/**
 * generate_ghg_report.js
 * ──────────────────────
 * Claude runs this script when asked "generate GHG report".
 *
 * Usage:
 *   node generate_ghg_report.js [--file <xlsx>] [--client <clientId>] [--url <url>] [--approve]
 *
 * Supported clients:
 *   FL-FOS-GHG-FY26   Featherlite Office Systems (19 data points)
 *   FL-FP-GHG-FY26    Featherlite Products       (14 data points)
 *
 * What it does:
 *   1. Reads the data submission XLSX from the current folder (or --file arg)
 *   2. Parses all data points and checks completeness
 *   3. Generates a DOCX (INTERIM if any missing, FINAL if all present)
 *   4. POSTs to the Apps Script web app to publish to Drive + send emails
 *   5. If --approve flag: also calls approveReport (final only)
 */

const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");
const XLSX  = require("xlsx");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, VerticalAlign,
} = require("docx");

// ── CONFIG ────────────────────────────────────────────────────────────────────
const WEB_APP_URL = process.env.GHG_WEBAPP_URL || "https://script.google.com/macros/s/AKfycbxIFTYIh42tk6DwSfwXSBpJVWW21MDWbOYbaOYQUFdMwuIDJlPElCYX9CoZZ0Qqkief/exec";
const CLIENT_ID   = process.env.GHG_CLIENT_ID  || "FL-FOS-GHG-FY26";

// ── Entity config — one entry per client ─────────────────────────────────────
const ENTITY_CONFIG = {
  "FL-FOS-GHG-FY26": {
    entityPrefix: "FOS",
    entityName:   "Featherlite Office Systems Pvt. Ltd.",
    entityShort:  "FOS",
    period:       "April 2025 – March 2026",
    s1Count: 9,   // expected Scope 1 data points
    s2Count: 4,   // expected Scope 2 data points
    s3Count: 6,   // expected Scope 3 data points
  },
  "FL-FP-GHG-FY26": {
    entityPrefix: "FP",
    entityName:   "Featherlite Products Pvt. Ltd.",
    entityShort:  "FP",
    period:       "April 2025 – March 2026",
    s1Count: 3,
    s2Count: 2,
    s3Count: 9,
  },
};

// ── CLI args ──────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const getArg   = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i+1] : null; };
const hasFlag  = (flag) => args.includes(flag);

const dataFile  = getArg("--file");
const clientId  = getArg("--client") || CLIENT_ID;
const webAppUrl = getArg("--url")    || WEB_APP_URL;
const doApprove = hasFlag("--approve");

const entityCfg = ENTITY_CONFIG[clientId];
if (!entityCfg) {
  console.error(`\n  ERROR: Unknown clientId "${clientId}". Valid values: ${Object.keys(ENTITY_CONFIG).join(", ")}`);
  process.exit(1);
}

// ── Emission factors ──────────────────────────────────────────────────────────
const EF = {
  DIESEL_L:        2.68,     // kgCO₂e/L  (IPCC AR6 stationary/mobile)
  LPG_KG:          2.983,    // kgCO₂e/kg (IPCC AR6)
  CO2_KG:          1.0,      // kgCO₂e/kg (CO₂ is 1:1)
  ELEC_KA:         0.82,     // kgCO₂e/kWh Karnataka (CEA v19 FY23-24)
  ELEC_TN:         0.75,     // kgCO₂e/kWh Tamil Nadu (CEA v19 FY23-24)
  S3_CAT4_ROAD:    0.000062, // tCO₂e/tonne-km (road freight, DEFRA)
  S3_CAT6_AIR:     0.000115, // tCO₂e/km (air travel avg, DEFRA)
  S3_CAT7_CAR:     0.000067, // tCO₂e/person-km (private car, DEFRA)
  S3_CAT9_ROAD:    0.000062, // tCO₂e/tonne-km (outbound logistics)
  S3_CAT1_STEEL:   0.42,     // tCO₂e/tonne (FOS raw materials, IPCC AR6 avg)
};

// ── tCO₂e calculation — keyed by DatapointID ─────────────────────────────────
function computeTCO2e(dpId, qty) {
  if (qty == null || qty === "" || isNaN(Number(qty))) return null;
  const q = Number(qty);

  // ── FOS Scope 1 ──────────────────────────────────────────────────────────
  if (dpId.includes("S1-FOS-001")) return q * EF.DIESEL_L / 1000;   // DG sets (L)
  if (dpId.includes("S1-FOS-002")) return q * EF.DIESEL_L / 1000;   // PC oven (L)
  if (dpId.includes("S1-FOS-003")) return q * EF.LPG_KG   / 1000;   // LPG (kg)
  if (dpId.includes("S1-FOS-004")) return q * EF.DIESEL_L / 1000;   // vehicles (L)
  if (dpId.includes("S1-FOS-005")) return q * EF.DIESEL_L / 1000;   // forklifts (L)
  if (dpId.includes("S1-FOS-006")) return q * EF.CO2_KG   / 1000;   // welding CO₂ (kg)
  if (dpId.includes("S1-FOS-007")) return q * EF.CO2_KG   / 1000;   // fire ext CO₂ (kg)
  if (dpId.includes("S1-FOS-008")) return q;                          // HFC (already tCO₂e)
  if (dpId.includes("S1-FOS-009")) return q;                          // HFC (already tCO₂e)
  // ── FOS Scope 2 ──────────────────────────────────────────────────────────
  if (dpId.includes("S2-FOS-001")) return q * EF.ELEC_KA  / 1000;   // Hejjala BESCOM (kWh)
  if (dpId.includes("S2-FOS-002")) return q * EF.ELEC_KA  / 1000;   // Kumbalagodu BESCOM (kWh)
  if (dpId.includes("S2-FOS-003")) return q * EF.ELEC_TN  / 1000;   // Sriperumbudur TNEB (kWh)
  if (dpId.includes("S2-FOS-004")) return 0;                          // solar — no emissions
  // ── FOS Scope 3 ──────────────────────────────────────────────────────────
  if (dpId.includes("S3-FOS-001")) return q * EF.S3_CAT1_STEEL;     // raw materials (tonne)
  if (dpId.includes("S3-FOS-002")) return q * EF.S3_CAT4_ROAD;      // inbound freight (t-km)
  if (dpId.includes("S3-FOS-003")) return q * EF.S3_CAT6_AIR;       // biz travel (km)
  if (dpId.includes("S3-FOS-004")) return q * EF.S3_CAT7_CAR;       // commute (p-km)
  if (dpId.includes("S3-FOS-005")) return q * EF.S3_CAT9_ROAD;      // outbound (t-km)
  if (dpId.includes("S3-FOS-006")) return q;                          // use-phase (tCO₂e)

  // ── FP Scope 1 ───────────────────────────────────────────────────────────
  if (dpId.includes("S1-FP-001"))  return q * EF.DIESEL_L / 1000;   // vehicles (L)
  if (dpId.includes("S1-FP-002"))  return q * EF.DIESEL_L / 1000;   // DG set (L)
  if (dpId.includes("S1-FP-003"))  return q * EF.CO2_KG   / 1000;   // fire ext CO₂ (kg)
  // ── FP Scope 2 ───────────────────────────────────────────────────────────
  if (dpId.includes("S2-FP-001"))  return q * EF.ELEC_KA  / 1000;   // Rajanakunte BESCOM (kWh)
  if (dpId.includes("S2-FP-002"))  return 0;                          // solar — no emissions
  // ── FP Scope 3 ───────────────────────────────────────────────────────────
  if (dpId.includes("S3-FP-004"))  return q * EF.S3_CAT4_ROAD;      // upstream freight (t-km)
  if (dpId.includes("S3-FP-006"))  return q * EF.S3_CAT6_AIR;       // biz travel (km)
  if (dpId.includes("S3-FP-007"))  return q * EF.S3_CAT7_CAR;       // commute (p-km)
  if (dpId.includes("S3-FP-008"))  return q * EF.S3_CAT9_ROAD;      // outbound (t-km)
  if (dpId.includes("S3-FP-"))     return q;                          // others: pass-through tCO₂e

  return null;
}

// ── Datapoint metadata — full name, unit, scope per ID ───────────────────────
const DP_META = {
  // ── FOS ────────────────────────────────────────────────────────────────────
  "GHG-S1-FOS-001": { scope:"Scope 1", subcat:"Stationary", name:"Diesel - DG sets (all locations)",              unit:"L" },
  "GHG-S1-FOS-002": { scope:"Scope 1", subcat:"Stationary", name:"Diesel - PC oven (Kumbalagodu)",                unit:"L" },
  "GHG-S1-FOS-003": { scope:"Scope 1", subcat:"Stationary", name:"LPG (Kumbalagodu)",                             unit:"kg" },
  "GHG-S1-FOS-004": { scope:"Scope 1", subcat:"Mobile",     name:"Diesel - vehicles (Hejjala)",                   unit:"L" },
  "GHG-S1-FOS-005": { scope:"Scope 1", subcat:"Mobile",     name:"Diesel - forklifts (Hejjala + Sriperumbudur)",  unit:"L" },
  "GHG-S1-FOS-006": { scope:"Scope 1", subcat:"Fugitive",   name:"CO2 - welding cylinders",                       unit:"kg" },
  "GHG-S1-FOS-007": { scope:"Scope 1", subcat:"Fugitive",   name:"CO2 - fire extinguishers",                      unit:"kg" },
  "GHG-S1-FOS-008": { scope:"Scope 1", subcat:"Fugitive",   name:"HFC foam blowing - Hejjala",                    unit:"tCO2e" },
  "GHG-S1-FOS-009": { scope:"Scope 1", subcat:"Fugitive",   name:"HFC foam blowing - Kumbalagodu",                unit:"tCO2e" },
  "GHG-S2-FOS-001": { scope:"Scope 2", subcat:"Electricity",name:"Electricity - Hejjala (BESCOM)",                unit:"kWh" },
  "GHG-S2-FOS-002": { scope:"Scope 2", subcat:"Electricity",name:"Electricity - Kumbalagodu (BESCOM)",            unit:"kWh" },
  "GHG-S2-FOS-003": { scope:"Scope 2", subcat:"Electricity",name:"Electricity - Sriperumbudur (TNEB)",            unit:"kWh" },
  "GHG-S2-FOS-004": { scope:"Scope 2", subcat:"Renewable",  name:"Solar generation - rooftop",                    unit:"kWh" },
  "GHG-S3-FOS-001": { scope:"Scope 3", subcat:"Cat 1 Purchased Goods",     name:"Raw materials - steel & hardware",unit:"tonne" },
  "GHG-S3-FOS-002": { scope:"Scope 3", subcat:"Cat 4 Upstream Transport",  name:"Inbound freight",                 unit:"t-km" },
  "GHG-S3-FOS-003": { scope:"Scope 3", subcat:"Cat 6 Business Travel",     name:"Air & rail travel",               unit:"km" },
  "GHG-S3-FOS-004": { scope:"Scope 3", subcat:"Cat 7 Employee Commute",    name:"Employee commute",                unit:"p-km" },
  "GHG-S3-FOS-005": { scope:"Scope 3", subcat:"Cat 9 Downstream Transport",name:"Outbound logistics",              unit:"t-km" },
  "GHG-S3-FOS-006": { scope:"Scope 3", subcat:"Cat 11 Use of Products",    name:"Product in-use emissions",        unit:"tCO2e" },
  // ── FP ─────────────────────────────────────────────────────────────────────
  "GHG-S1-FP-001":  { scope:"Scope 1", subcat:"Mobile",      name:"Diesel - company vehicles (Rajanakunte)",   unit:"L" },
  "GHG-S1-FP-002":  { scope:"Scope 1", subcat:"Stationary",  name:"Diesel - DG set (Rajanakunte)",             unit:"L" },
  "GHG-S1-FP-003":  { scope:"Scope 1", subcat:"Fugitive",    name:"CO2 - fire extinguishers (Rajanakunte)",    unit:"kg" },
  "GHG-S2-FP-001":  { scope:"Scope 2", subcat:"Electricity", name:"Electricity - Rajanakunte (BESCOM)",        unit:"kWh" },
  "GHG-S2-FP-002":  { scope:"Scope 2", subcat:"Renewable",   name:"Solar generation - rooftop (Rajanakunte)",  unit:"kWh" },
  "GHG-S3-FP-001":  { scope:"Scope 3", subcat:"Cat 1 Purchased Goods",         name:"Purchased goods & services",       unit:"tCO2e" },
  "GHG-S3-FP-002":  { scope:"Scope 3", subcat:"Cat 2 Capital Goods",           name:"Capital goods",                    unit:"tCO2e" },
  "GHG-S3-FP-003":  { scope:"Scope 3", subcat:"Cat 3 Fuel & Energy-Related",   name:"WTT & T&D losses",                 unit:"tCO2e" },
  "GHG-S3-FP-004":  { scope:"Scope 3", subcat:"Cat 4 Upstream Transport",      name:"Inbound freight",                  unit:"t-km" },
  "GHG-S3-FP-005":  { scope:"Scope 3", subcat:"Cat 5 Waste in Operations",     name:"Waste generated in operations",    unit:"tCO2e" },
  "GHG-S3-FP-006":  { scope:"Scope 3", subcat:"Cat 6 Business Travel",         name:"Air & rail travel",                unit:"km" },
  "GHG-S3-FP-007":  { scope:"Scope 3", subcat:"Cat 7 Employee Commute",        name:"Employee commute",                 unit:"p-km" },
  "GHG-S3-FP-008":  { scope:"Scope 3", subcat:"Cat 9 Downstream Transport",    name:"Outbound logistics",               unit:"t-km" },
  "GHG-S3-FP-009":  { scope:"Scope 3", subcat:"Cat 12 End-of-Life Products",   name:"End-of-life of sold products",     unit:"tCO2e" },
};

// ── Expand short XLSX ID (e.g. "S1001") → full DatapointID ───────────────────
// entityPrefix: "FOS" or "FP" — derived from the clientId config
function expandDpId(shortId, entityPrefix) {
  const m = shortId.match(/^S(\d)(\d+)$/i);
  if (!m) return null;
  const scope = m[1];
  const num   = m[2].padStart(3, "0");
  return `GHG-S${scope}-${entityPrefix}-${num}`;
}

// ── Parse XLSX data submission file ──────────────────────────────────────────
function parseDataFile(filePath, entityPrefix) {
  console.log(`\nReading: ${filePath}`);
  const wb     = XLSX.readFile(filePath);
  const wsName = wb.SheetNames.find(n => n.includes("GHG")) || wb.SheetNames[0];
  const ws     = wb.Sheets[wsName];
  const rows   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header row (first row whose first cell is exactly "#")
  let hdrRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] ?? "").trim() === "#") { hdrRow = i; break; }
  }
  if (hdrRow === -1) throw new Error("Cannot find header row in XLSX. Expected '#' in column A.");

  const dataPoints = [];
  for (let i = hdrRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const shortId = String(row[0]).trim();
    if (shortId.startsWith("─") || shortId.startsWith("SUMMARY")) continue;

    const dpId  = expandDpId(shortId, entityPrefix) || shortId;
    const meta  = DP_META[dpId] || {};
    const qty   = row[5];                            // col F = FY2026 Value
    const hasVal = qty !== null && qty !== "" && qty !== undefined;
    const tco2e  = hasVal ? computeTCO2e(dpId, qty) : null;

    dataPoints.push({
      id:        dpId,
      scope:     (String(row[1] ?? "").trim() || meta.scope   || ""),
      subcat:    (String(row[2] ?? "").trim() || meta.subcat  || ""),
      name:      (String(row[3] ?? "").trim() || meta.name    || ""),
      unit:      (String(row[4] ?? "").trim() || meta.unit    || ""),
      value:     hasVal ? qty : null,
      tco2e:     tco2e != null ? Math.round(tco2e * 10) / 10 : null,
      status:    hasVal ? "Collected" : "Missing",
      priorYear: row[7] || null,                     // col H = Prior Year
    });
  }
  return dataPoints;
}

// ── Format number with commas ─────────────────────────────────────────────────
function fmt(n, decimals = 1) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ── DOCX helpers ─────────────────────────────────────────────────────────────
const hp = (pt) => pt * 2;
const tw = (pt) => pt * 20;
const cm = (c)  => Math.round(c * 567);

const GRN   = "1E6F5C";
const GRN_L = "E6F4EF";
const NAVY  = "1E293B";
const RED   = "D90429";
const RED_L = "FECACA";
const AMB   = "D97706";
const AMB_L = "FEF3C7";
const BLU   = "2563EB";
const BLU_L = "DBEAFE";
const PUR   = "6D28D9";
const PUR_L = "EDE9FE";
const GREY  = "F8FAFC";
const WHT   = "FFFFFF";

function tr(text, { size=10, bold=false, italic=false, color=NAVY, break:br=0 }={}) {
  return new TextRun({ text: String(text??''), font:"Arial", size:hp(size), bold, italics:italic, color, break:br });
}
function p(content, { align=AlignmentType.LEFT, before=0, after=4,
  bold=false, italic=false, size=10, color=NAVY, borderBottom=false }={}) {
  const runs = typeof content==="string"
    ? [tr(content,{bold,italic,size,color})] : content;
  return new Paragraph({
    children:runs, alignment:align,
    spacing:{before:tw(before),after:tw(after)},
    border: borderBottom ? {bottom:{color:borderBottom===true?GRN:borderBottom,size:6,style:BorderStyle.SINGLE,space:4}} : undefined,
  });
}
function h1(text,color=GRN) { return p([tr(text,{bold:true,size:13,color})],{before:10,after:5,borderBottom:color}); }
function h2(text,color=NAVY){ return p([tr(text,{bold:true,size:11,color})],{before:7,after:3}); }
function rule() { return p("",{borderBottom:"CCCCCC",after:5}); }
function blank(){ return p("",{after:0}); }
function tc(text,{bg=WHT,bold=false,color=NAVY,size=9,align=AlignmentType.LEFT,width=1000,span}={}) {
  const lines = String(text??'').split("\n");
  return new TableCell({
    children: lines.map(line=>new Paragraph({
      children:[tr(line,{bold,color,size})], alignment:align,
      spacing:{before:tw(1.5),after:tw(1.5)},
    })),
    width:{size:width,type:WidthType.DXA}, verticalAlign:VerticalAlign.CENTER,
    shading:{type:ShadingType.CLEAR,color:"auto",fill:bg}, columnSpan:span,
    margins:{top:tw(1.5),bottom:tw(1.5),left:tw(3),right:tw(3)},
  });
}
function hrow(labels,widths,bg=GRN) {
  return new TableRow({ tableHeader:true, children:labels.map((l,i)=>
    tc(l,{bg,bold:true,color:WHT,size:9,align:AlignmentType.CENTER,width:widths[i]}))});
}
function drow(vals,widths,bg=WHT,perCell=[]) {
  return new TableRow({children:vals.map((v,i)=>
    tc(String(v??'—'),{bg,width:widths[i],...(perCell[i]||{})}))});
}
function tbl(rows,widths) {
  return new Table({width:{size:widths.reduce((a,b)=>a+b,0),type:WidthType.DXA},columnWidths:widths,rows});
}
const RIGHT = { align:AlignmentType.RIGHT };
const C_RED = { color:RED,bold:true };
const C_GRN = { color:GRN,bold:true };
const C_AMB = { color:AMB,bold:true };

// ── DOCX builder — entity-aware ───────────────────────────────────────────────
function buildDocx(dataPoints, clientId, fy = "FY2026", cfg = {}) {
  const entityName = cfg.entityName  || "Featherlite";
  const entityShort= cfg.entityShort || "Featherlite";
  const period     = cfg.period      || "April 2025 – March 2026";
  const s1Max      = cfg.s1Count     || 9;
  const s2Max      = cfg.s2Count     || 4;
  const s3Max      = cfg.s3Count     || 6;

  const collected  = dataPoints.filter(d => d.status === "Collected");
  const missing    = dataPoints.filter(d => d.status === "Missing");
  const pct        = Math.round(collected.length / dataPoints.length * 100);
  const isComplete = missing.length === 0;

  const s1Points   = collected.filter(d => d.scope.includes("Scope 1"));
  const s2Points   = collected.filter(d => d.scope.includes("Scope 2"));
  const s3Points   = collected.filter(d => d.scope.includes("Scope 3"));

  const s1Total    = s1Points.reduce((sum,d) => sum + (d.tco2e||0), 0);
  const s2Total    = s2Points.reduce((sum,d) => sum + (d.tco2e||0), 0);
  const s3Total    = s3Points.reduce((sum,d) => sum + (d.tco2e||0), 0);
  const grandTotal = s1Total + s2Total + s3Total;

  const S1W = [1800,3400,700,900,900,1300];
  const S2W = [2700,700,1000,1200,1200,1200];
  const S3W = [2100,3000,900,1200,1000,800];

  const toS1Row = (d) => [d.subcat, d.name, d.unit, fmt(d.value,0), fmt(d.tco2e), "Submitted"];
  const toS2Row = (d) => [d.name, d.unit, fmt(d.value,0), fmt(d.tco2e), "0.0", "Submitted"];
  const toS3Row = (d) => [d.subcat, d.name, d.unit, fmt(d.value,0), fmt(d.tco2e), "EF applied"];

  const s3StatusStr = s3Points.length
    ? `${s3Points.length}/${s3Max} data points`
    : `0/${s3Max} — DATA MISSING`;

  const body = [
    // ── Cover ──────────────────────────────────────────────────────────────
    p([tr(entityName.toUpperCase(), {bold:true,size:18,color:GRN})],
      {align:AlignmentType.CENTER,before:24,after:6}),
    p([tr(`GHG Emissions Report  |  ${fy}  |  ${period}`, {bold:true,size:13,color:NAVY})],
      {align:AlignmentType.CENTER,after:4}),
    ...(isComplete ? [] : [
      p([tr(`INTERIM DRAFT  |  Data ${pct}% Complete  |  NOT FOR PUBLIC DISTRIBUTION`,{bold:true,size:11,color:RED})],
        {align:AlignmentType.CENTER,after:4}),
    ]),
    p([tr("Prepared by Deepwoods Green Consulting  |  Auto-generated",{italic:true,size:9,color:"777777"})],
      {align:AlignmentType.CENTER,after:0}),
    blank(),

    // ── KPI cards ──────────────────────────────────────────────────────────
    tbl([
      new TableRow({children:[
        tc(`Scope 1\n${fmt(s1Total)} tCO2e`,{bg:GRN,bold:true,color:WHT,width:2250,align:AlignmentType.CENTER}),
        tc(`Scope 2 (LB)\n${fmt(s2Total)} tCO2e`,{bg:BLU,bold:true,color:WHT,width:2250,align:AlignmentType.CENTER}),
        tc(`Scope 3\n${s3Points.length ? fmt(s3Total)+" tCO2e" : "NOT SUBMITTED"}`,
           {bg:s3Points.length?PUR:RED,bold:true,color:WHT,width:2250,align:AlignmentType.CENTER}),
        tc(`TOTAL\n${fmt(grandTotal)} tCO2e`,{bg:NAVY,bold:true,color:WHT,width:2250,align:AlignmentType.CENTER}),
      ]}),
      new TableRow({children:[
        tc(`${s1Points.length}/${s1Max} data points`,{bg:GRN_L,size:8,color:GRN,width:2250,align:AlignmentType.CENTER}),
        tc(`${s2Points.length}/${s2Max} data points`,{bg:BLU_L,size:8,color:BLU,width:2250,align:AlignmentType.CENTER}),
        tc(s3Points.length?`${s3Points.length}/${s3Max} data points`:`0/${s3Max} — DATA MISSING`,
           {bg:s3Points.length?PUR_L:RED_L,size:8,color:s3Points.length?PUR:RED,width:2250,align:AlignmentType.CENTER}),
        tc(`${pct}% complete`,{bg:GREY,size:8,color:NAVY,width:2250,align:AlignmentType.CENTER}),
      ]}),
    ],[2250,2250,2250,2250]),

    ...(!isComplete ? [
      blank(),
      tbl([new TableRow({children:[tc(
        `INTERIM REPORT — ${pct}% of required data received.  ` +
        `${missing.length} data point(s) missing (see Section 5).  ` +
        `This document is NOT cleared for external disclosure.`,
        {bg:RED_L,bold:true,color:RED,size:9,width:9000})]})],[9000]),
    ] : []),
    blank(),
    rule(),

    // ── 1. GHG Summary ─────────────────────────────────────────────────────
    h1("1.  GHG Summary"),
    tbl([
      hrow(["Scope","Location-Based (tCO2e)","Market-Based (tCO2e)","Status"],[3600,2000,2000,1400]),
      drow(["Scope 1  Direct",fmt(s1Total),fmt(s1Total),
            s1Points.length===s1Max?"Complete":`${s1Points.length}/${s1Max} points`],
           [3600,2000,2000,1400],GREY,[{},RIGHT,RIGHT,
            s1Points.length===s1Max?C_GRN:{color:AMB,bold:true}]),
      drow(["Scope 2  Electricity",fmt(s2Total),"0.0 (I-RECs / Solar)",
            s2Points.length===s2Max?"Complete":`${s2Points.length}/${s2Max} points`],
           [3600,2000,2000,1400],WHT,[{},RIGHT,RIGHT,
            s2Points.length===s2Max?C_GRN:{color:AMB,bold:true}]),
      drow(["Scope 3  Value Chain",
            s3Points.length?fmt(s3Total):"NOT SUBMITTED",
            s3Points.length?fmt(s3Total):"NOT SUBMITTED",
            s3Points.length===s3Max?"Complete":s3Points.length?`${s3Points.length}/${s3Max}`:"MISSING"],
           [3600,2000,2000,1400],s3Points.length<s3Max?RED_L:GREY,
           [{},s3Points.length?RIGHT:C_RED,s3Points.length?RIGHT:C_RED,
            s3Points.length===s3Max?C_GRN:C_RED]),
      new TableRow({children:[
        tc(isComplete?"TOTAL":"INTERIM TOTAL",{bg:GRN_L,bold:true,width:3600}),
        tc(fmt(grandTotal),{bg:GRN_L,bold:true,color:GRN,width:2000,align:AlignmentType.RIGHT}),
        tc(fmt(s1Total+s2Total),{bg:GRN_L,bold:true,color:GRN,width:2000,align:AlignmentType.RIGHT}),
        tc(isComplete?"Complete":`${pct}% complete`,{bg:GRN_L,bold:true,color:isComplete?GRN:AMB,width:1400}),
      ]}),
    ],[3600,2000,2000,1400]),
    blank(),

    // ── 2. Scope 1 ─────────────────────────────────────────────────────────
    ...(s1Points.length ? [
      h1("2.  Scope 1  —  Direct GHG Emissions"),
      p([tr("Total Scope 1: ",{bold:true}),tr(`${fmt(s1Total)} tCO2e`,{bold:true,size:12,color:GRN})]),
      blank(),
      tbl([
        hrow(["Sub-category","Source","Unit","Quantity","tCO2e","Source"],S1W),
        ...s1Points.map((d,i)=>drow(toS1Row(d),S1W,i%2===0?WHT:GREY,[{},{},{},{},RIGHT,{}])),
        new TableRow({children:[
          tc("TOTAL SCOPE 1",{bg:GRN_L,bold:true,width:S1W[0]+S1W[1]+S1W[2]+S1W[3],span:4}),
          tc(fmt(s1Total),{bg:GRN_L,bold:true,color:GRN,width:S1W[4],align:AlignmentType.RIGHT}),
          tc("tCO2e",{bg:GRN_L,width:S1W[5]}),
        ]}),
      ],S1W),
      blank(),
    ] : [
      h1("2.  Scope 1  —  DATA NOT SUBMITTED",RED),
      p("No Scope 1 data was provided in this submission.",{color:RED}),
      blank(),
    ]),

    // ── 3. Scope 2 ─────────────────────────────────────────────────────────
    ...(s2Points.length ? [
      h1("3.  Scope 2  —  Indirect GHG Emissions (Electricity)"),
      p([tr("Location-based: ",{bold:true}),tr(`${fmt(s2Total)} tCO2e   |   `),
         tr("Market-based: ",{bold:true}),tr("0.0 tCO2e (I-REC / On-site Solar)")]),
      blank(),
      tbl([
        hrow(["Facility","Unit","Consumption","LB tCO2e","MB tCO2e","Source"],S2W,BLU),
        ...s2Points.map((d,i)=>drow(toS2Row(d),S2W,i%2===0?WHT:GREY,[{},{},{},RIGHT,RIGHT,{}])),
        new TableRow({children:[
          tc("TOTAL SCOPE 2",{bg:BLU_L,bold:true,width:S2W[0]+S2W[1]+S2W[2],span:3}),
          tc(fmt(s2Total),{bg:BLU_L,bold:true,color:BLU,width:S2W[3],align:AlignmentType.RIGHT}),
          tc("0.0",{bg:BLU_L,bold:true,width:S2W[4],align:AlignmentType.RIGHT}),
          tc("tCO2e",{bg:BLU_L,width:S2W[5]}),
        ]}),
      ],S2W),
      blank(),
    ] : [
      h1("3.  Scope 2  —  DATA NOT SUBMITTED",RED),
      p("No Scope 2 data was provided in this submission.",{color:RED}),
      blank(),
    ]),

    // ── 4. Scope 3 ─────────────────────────────────────────────────────────
    ...(s3Points.length ? [
      h1("4.  Scope 3  —  Value Chain GHG Emissions"),
      p([tr("Total Scope 3: ",{bold:true}),tr(`${fmt(s3Total)} tCO2e  (${s3Points.length} of ${s3Max} categories)`,{bold:true,size:12,color:PUR})]),
      blank(),
      tbl([
        hrow(["GHG Category","Description","Unit","Activity Data","tCO2e","EF"],S3W,PUR),
        ...s3Points.map((d,i)=>drow(toS3Row(d),S3W,i%2===0?WHT:PUR_L,[{},{},{},RIGHT,RIGHT,{}])),
        new TableRow({children:[
          tc("TOTAL SCOPE 3",{bg:PUR_L,bold:true,width:S3W[0]+S3W[1]+S3W[2]+S3W[3],span:4}),
          tc(fmt(s3Total),{bg:PUR_L,bold:true,color:PUR,width:S3W[4],align:AlignmentType.RIGHT}),
          tc("tCO2e",{bg:PUR_L,width:S3W[5]}),
        ]}),
      ],S3W),
      blank(),
    ] : [
      h1("4.  Scope 3  —  DATA NOT SUBMITTED",RED),
      tbl([new TableRow({children:[tc(
        `SCOPE 3 DATA HAS NOT BEEN SUBMITTED.  ${s3Max} categories are required for this entity.`,
        {bg:RED_L,bold:true,color:RED,size:9,width:9000})]})],[9000]),
      blank(),
    ]),

    // ── 5. Missing data table ───────────────────────────────────────────────
    ...(missing.length ? [
      h1("5.  Missing Data  —  Required for Final Report",RED),
      tbl([new TableRow({children:[tc(
        `${missing.length} data point(s) were not submitted.  ` +
        `Please provide the following data for the final report.`,
        {bg:AMB_L,bold:true,color:AMB,size:9,width:9000})]})],[9000]),
      blank(),
      tbl([
        hrow(["DatapointID","Category","Data Point","Unit","FY25 Reference"],[1800,1800,3200,700,1500],RED),
        ...missing.map((d,i)=>drow(
          [d.id, d.scope||"", d.name||"", d.unit||"", d.priorYear!=null?fmt(d.priorYear,0):"See sheet"],
          [1800,1800,3200,700,1500], i%2===0?WHT:RED_L)),
      ],[1800,1800,3200,700,1500]),
      blank(),
    ] : []),

    // ── Footer ─────────────────────────────────────────────────────────────
    rule(),
    p([tr("PREPARED BY:  ",{bold:true,size:9}),tr("Deepwoods Green Consulting  |  Auto-generated  |  "+new Date().toLocaleDateString("en-IN"),{size:9,color:"777777"})]),
    ...(isComplete ? [] : [
      p([tr("CLASSIFICATION:  ",{bold:true,size:9}),
         tr("CONFIDENTIAL  —  INTERIM DRAFT  —  NOT FOR PUBLIC USE",{bold:true,size:9,color:RED})]),
    ]),
  ];

  return new Document({
    styles:{default:{document:{run:{font:"Arial",size:hp(10),color:NAVY}}}},
    sections:[{
      properties:{page:{margin:{top:cm(2),bottom:cm(2),left:cm(2.5),right:cm(2)}}},
      headers:{default:new Header({children:[
        p([tr(`${entityShort}  |  GHG Report ${fy}  |  ${isComplete?"Final":"INTERIM DRAFT"}`,{size:8,color:"999999"})],{after:0}),
      ]})},
      footers:{default:new Footer({children:[
        new Paragraph({
          children:[
            tr("Deepwoods Green Consulting  |  GHG Protocol Compliant  |  Page ",{size:8,color:"999999"}),
            new TextRun({children:[PageNumber.CURRENT],font:"Arial",size:hp(8),color:"999999"}),
          ],
          alignment:AlignmentType.RIGHT,spacing:{before:0,after:0},
        }),
      ]})},
      children:body,
    }],
  });
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** Raw GET — follows redirects, returns response body string */
function getRaw(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(getRaw(res.headers.location));
        return;
      }
      let data = "";
      res.on("data", c => data += c);
      res.on("end",  () => resolve(data));
    }).on("error", reject);
  });
}

/**
 * POST to Apps Script exec URL.
 * Apps Script always returns 302 → echo URL (GET-only response server).
 * Step 1: POST to exec, capture redirect.
 * Step 2: GET the Location URL to retrieve the JSON result.
 */
function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const lib  = url.startsWith("https") ? https : http;
    const req  = lib.request(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      // Follow redirect with GET (Apps Script echo URL is GET-only)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); // drain the body
        getRaw(res.headers.location).then(data => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error(`Bad JSON (after redirect): ${data.slice(0,200)}`)); }
        }).catch(reject);
        return;
      }
      let data = "";
      res.on("data", c => data += c);
      res.on("end",  () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`Bad JSON response: ${data.slice(0,200)}`)); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Interactive confirmation ──────────────────────────────────────────────────
function askUser(question) {
  return new Promise(resolve => {
    process.stdout.write(`\n${question} [y/N] `);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (d) => resolve(d.trim().toLowerCase() === "y"));
  });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log(  "║   Featherlite GHG Report Generator  —  Deepwoods    ║");
  console.log(  "╚══════════════════════════════════════════════════════╝\n");
  console.log(`  Entity:   ${entityCfg.entityName}`);
  console.log(`  ClientID: ${clientId}`);

  // 1. Find data file
  let filePath = dataFile;
  if (!filePath) {
    const files = fs.readdirSync(".").filter(f => f.endsWith(".xlsx") && !f.startsWith("~") && !f.startsWith("node_modules"));
    if (files.length === 0) throw new Error("No .xlsx file found in current folder. Use --file <path>.");
    if (files.length > 1) {
      console.log("  Multiple XLSX files found:", files);
      console.log("  Using first one. Pass --file <path> to specify.");
    }
    filePath = files[0];
  }

  // 2. Parse
  const dataPoints = parseDataFile(filePath, entityCfg.entityPrefix);
  const collected  = dataPoints.filter(d => d.status === "Collected");
  const missing    = dataPoints.filter(d => d.status === "Missing");
  const pct        = Math.round(collected.length / dataPoints.length * 100);
  const isComplete = missing.length === 0;
  const reportType = isComplete ? "FINAL" : "INTERIM";

  console.log(`\n  Data file:    ${filePath}`);
  console.log(`  Total points: ${dataPoints.length}`);
  console.log(`  Collected:    ${collected.length} (${pct}%)`);
  console.log(`  Missing:      ${missing.length}`);
  console.log(`  Report type:  ${reportType}`);

  if (missing.length > 0) {
    console.log("\n  Missing data points:");
    missing.forEach(d => console.log(`    - [${d.id}] ${d.name} (${d.unit})`));
  }

  // 3. Save parsed data points to Google Sheet (replaces any previous submission)
  if (webAppUrl !== "<<PASTE_WEB_APP_URL_HERE>>") {
    console.log("\n  Saving data points to sheet...");
    try {
      const saveResult = await postJson(webAppUrl, {
        action:      "saveDatapoints",
        clientId,
        fiscalYear:  "FY2026",
        submittedBy: "generate_ghg_report.js",
        dataPoints:  dataPoints.map(d => ({
          id:        d.id,
          scope:     d.scope,
          subcat:    d.subcat,
          name:      d.name,
          unit:      d.unit,
          value:     d.value,
          tco2e:     d.tco2e,
          status:    d.status,
          priorYear: d.priorYear,
        })),
      });
      if (saveResult.error) throw new Error(saveResult.error);
      console.log(`  Sheet updated: ${saveResult.written} rows written (${saveResult.completionPct}% complete).`);
    } catch(e) {
      console.warn(`  ⚠  Could not save to sheet: ${e.message} — continuing with report generation.`);
    }
  }

  // 4. Generate DOCX
  const dateStr  = new Date().toISOString().split("T")[0].replace(/-/g,"");
  const prefix   = entityCfg.entityPrefix;  // FOS or FP
  const fileName = `GHG_Report_${prefix}_FY26_${reportType}_${dateStr}.docx`;
  console.log(`\n  Generating: ${fileName} ...`);

  const doc = buildDocx(dataPoints, clientId, "FY2026", entityCfg);
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(fileName, buf);
  console.log(`  Saved locally: ${fileName}  (${(buf.length/1024).toFixed(0)} KB)`);

  // 5. Publish to Drive (if web app URL configured)
  if (webAppUrl === "<<PASTE_WEB_APP_URL_HERE>>") {
    console.log("\n  ⚠  WEB_APP_URL not set — skipping Drive publish.");
    console.log("     Set it via: GHG_WEBAPP_URL=<url> node generate_ghg_report.js");
    console.log("     Or use: --url <url>");
    console.log("     Report saved locally — share manually from this folder.\n");
    process.exit(0);
  }

  console.log(`\n  Publishing to Drive via Apps Script...`);
  const fileBase64 = buf.toString("base64");
  const result = await postJson(webAppUrl, {
    action:        "publishReport",
    clientId,
    fileName,
    fileBase64,
    isComplete,
    missingItems:  missing.map(d => ({ id:d.id, scope:d.scope, name:d.name, unit:d.unit })),
    reportType,
    completionPct: pct,
  });

  if (result.error) {
    console.error("\n  ERROR from web app:", result.error);
    process.exit(1);
  }

  console.log(`\n  Published!`);
  console.log(`  Drive URL:  ${result.driveUrl}`);
  console.log(`  Emails sent to consultant + client.`);
  console.log(`  Portal notification added.`);

  // 6. Approval (final reports only)
  if (isComplete) {
    console.log("\n  ✅ All data is present — this is a FINAL report.");
    const approve = doApprove || await askUser("  Approve and send final report to client?");
    if (approve) {
      console.log("\n  Approving report...");
      const approvalResult = await postJson(webAppUrl, {
        action:   "approveReport",
        clientId,
        notes:    `Report reviewed and approved via generate_ghg_report.js — ${entityCfg.entityName}`,
      });
      if (approvalResult.error) {
        console.error("  ERROR approving:", approvalResult.error);
      } else {
        console.log(`  ✅ Approved! Client email sent.`);
        console.log(`  Approved URL: ${approvalResult.approvedUrl}`);
        console.log(`  Cycle status: Complete.`);
      }
    } else {
      console.log("\n  Report published to Drive for review. Run with --approve when ready.");
    }
  } else {
    console.log(`\n  ⚠  Interim report published.  ${missing.length} data gap(s) flagged.`);
    console.log("  Client and consultant have been emailed.");
    console.log("  Once client resubmits, re-run this script to generate the final report.");
  }

  console.log("\n  Done.\n");
  process.exit(0);
}

main().catch(err => {
  console.error("\n  FATAL:", err.message);
  process.exit(1);
});
