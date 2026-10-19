// xlsxHelpers.ts — Scope 3 template generator with full formatting
// Uses xlsx-js-style (drop-in xlsx replacement with cell styling support).
import * as XLSX from "xlsx-js-style";
import type { ColDef, CategorySchema, MethodDef, SubTableDef } from "./scope3Schemas";
import { buildPeriodOptions } from "./periodUtils";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  GREEN:       "1E6F5C",   // portal primary — mandatory column headers
  GREEN_DARK:  "155447",   // title bar background
  AMBER:       "B8860B",   // optional column headers
  SAMPLE_BG:   "E8F5F0",   // sample rows (light green)
  WHITE:       "FFFFFF",
  DARK:        "1A1A1A",
  MUTED:       "666666",
  BORDER:      "C8D8D4",   // subtle green-tinted border
  LEGEND_AMBER:"CC8800",   // amber legend text
};

// ── Style helpers ─────────────────────────────────────────────────────────────
type CS = Parameters<typeof Object.assign>[0]; // cell style shorthand

const THIN = (rgb = C.BORDER) => ({
  top:    { style: "thin" as const, color: { rgb } },
  bottom: { style: "thin" as const, color: { rgb } },
  left:   { style: "thin" as const, color: { rgb } },
  right:  { style: "thin" as const, color: { rgb } },
});

const S = {
  TITLE: {
    fill: { fgColor: { rgb: C.GREEN_DARK } },
    font: { bold: true, sz: 14, color: { rgb: C.WHITE } },
    alignment: { horizontal: "left" as const, vertical: "center" as const, wrapText: true },
  },
  SUBTITLE: {
    font: { sz: 9, color: { rgb: C.MUTED }, italic: true },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  },
  BODY: {
    font: { sz: 10, color: { rgb: C.DARK } },
    alignment: { horizontal: "left" as const, vertical: "top" as const, wrapText: true },
  },
  SECTION_HEAD: {
    font: { bold: true, sz: 11, color: { rgb: C.GREEN } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  },
  TH_GREEN: {
    fill: { fgColor: { rgb: C.GREEN } },
    font: { bold: true, sz: 10, color: { rgb: C.WHITE } },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: THIN(),
  },
  TH_AMBER: {
    fill: { fgColor: { rgb: C.AMBER } },
    font: { bold: true, sz: 10, color: { rgb: C.WHITE } },
    alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
    border: THIN(),
  },
  SAMPLE: {
    fill: { fgColor: { rgb: C.SAMPLE_BG } },
    font: { italic: true, sz: 10, color: { rgb: C.MUTED } },
    alignment: { horizontal: "left" as const, vertical: "center" as const, wrapText: true },
    border: THIN(),
  },
  DATA: {
    font: { sz: 10, color: { rgb: C.DARK } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
    border: THIN(),
  },
  NOTE: {
    font: { italic: true, sz: 9, color: { rgb: C.MUTED } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  },
  LEGEND_GREEN: {
    font: { bold: true, sz: 10, color: { rgb: C.GREEN } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  },
  LEGEND_AMBER: {
    font: { bold: true, sz: 10, color: { rgb: C.LEGEND_AMBER } },
    alignment: { horizontal: "left" as const, vertical: "center" as const },
  },
  OV_TH: {
    fill: { fgColor: { rgb: C.GREEN } },
    font: { bold: true, sz: 10, color: { rgb: C.WHITE } },
    alignment: { horizontal: "left" as const, vertical: "center" as const, wrapText: true },
    border: THIN(),
  },
  OV_ROW_NUM: {
    fill: { fgColor: { rgb: C.SAMPLE_BG } },
    font: { sz: 10, color: { rgb: C.DARK } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: THIN(),
  },
  OV_ROW: {
    font: { sz: 10, color: { rgb: C.DARK } },
    alignment: { horizontal: "left" as const, vertical: "top" as const, wrapText: true },
    border: THIN(),
  },
} satisfies Record<string, CS>;

// ── Low-level cell factory ────────────────────────────────────────────────────
function mk(v: string | number | null, s: CS, t?: "s" | "n"): XLSX.CellObject {
  const type = t ?? (typeof v === "number" ? "n" : "s");
  return { v: v ?? "", t: type, s } as XLSX.CellObject;
}
const empty = () => mk("", {});

// ── Write cells into an existing worksheet ─────────────────────────────────
function writeWs(
  ws: XLSX.WorkSheet,
  cells: { r: number; c: number; cell: XLSX.CellObject }[],
  merges: XLSX.Range[],
  cols: { wch: number }[],
  rowHeights?: number[],
) {
  let maxR = 0, maxC = 0;
  for (const { r, c, cell } of cells) {
    ws[XLSX.utils.encode_cell({ r, c })] = cell;
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, c);
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  ws["!merges"] = [...(ws["!merges"] ?? []), ...merges];
  ws["!cols"] = cols;
  if (rowHeights) ws["!rows"] = rowHeights.map((h) => (h > 0 ? { hpt: h } : {}));
}

// ── Overview / How-to sheet ───────────────────────────────────────────────────
function buildOverview(
  schema: CategorySchema,
  methods: { label: string; desc: string; priority: number }[],
  fy = "FY26",
  entityName = "",
  reportingPeriod: "FY" | "CY" = "FY",
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const cells: { r: number; c: number; cell: XLSX.CellObject }[] = [];
  const merges: XLSX.Range[] = [];
  const W = 10; // merge width (columns 0–9)

  const put = (r: number, c: number, cell: XLSX.CellObject) => cells.push({ r, c, cell });
  const merge = (r1: number, c1: number, r2: number, c2: number) =>
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  const span = (r: number, v: string, s: CS) => {
    put(r, 0, mk(v, s));
    merge(r, 0, r, W - 1);
  };

  // Row 0: Title
  span(0, `Scope 3 — ${schema.code}: ${schema.name}`, S.TITLE);
  // Row 1: Subtitle
  const pOpts = buildPeriodOptions(fy, reportingPeriod);
  const periodRange = reportingPeriod === "CY"
    ? `Jan ${pOpts.startYear} – Dec ${pOpts.endYear}`
    : `Apr ${pOpts.startYear} – Mar ${pOpts.endYear}`;
  const sub = `Scope 3 data collection template${entityName ? ` · ${entityName}` : ""} · ${pOpts.yearLabel} (${periodRange})`;
  span(1, sub, S.SUBTITLE);
  // Row 2: empty
  span(2, "", {});
  // Row 3: Boundary / description
  span(3, schema.boundary ?? schema.whatIs ?? "", S.BODY);
  // Row 4: empty
  span(4, "", {});
  // Row 5: Legend
  put(5, 0, mk("●  Mandatory field", S.LEGEND_GREEN));
  put(5, 4, mk("●  Optional field",  S.LEGEND_AMBER));
  // Row 6: empty
  span(6, "", {});
  // Row 7: How to use heading
  span(7, "How to use this workbook", S.SECTION_HEAD);
  // Row 8: Instructions
  span(8,
    "Each tab is one way to calculate this category. " +
    "Tab 1 is the easiest to get right — use it if you can. " +
    "Only move to the next tab if you don't have the data for the one before it. " +
    "Each tab has an example row filled in (in light green) — delete it and add your own data underneath.",
    S.BODY,
  );
  // Row 9: empty
  span(9, "", {});
  // Row 10: Methods heading
  span(10, "Methods in this workbook (try them in this order)", S.SECTION_HEAD);
  // Row 11: Table headers
  put(11, 0, mk("Order",          S.OV_TH));
  put(11, 1, mk("Method",         S.OV_TH));
  merge(11, 2, 11, W - 1);
  put(11, 2, mk("What it covers", S.OV_TH));
  // Rows 12+: One row per method
  methods.forEach((m, i) => {
    const r = 12 + i;
    put(r, 0, mk(m.priority, S.OV_ROW_NUM, "n"));
    put(r, 1, mk(m.label, S.OV_ROW));
    merge(r, 2, r, W - 1);
    put(r, 2, mk(m.desc, S.OV_ROW));
  });

  writeWs(ws, cells, merges,
    [{ wch: 7 }, { wch: 28 }, { wch: 50 }, ...Array(W - 3).fill({ wch: 10 })],
    [28, 14, 5, 52, 5, 16, 5, 16, 52, 5, 16, 20, ...methods.map(() => 22)],
  );
  return ws;
}

// ── Per-method data sheet ─────────────────────────────────────────────────────
function buildDataSheet(
  schema: CategorySchema,
  method: MethodDef,
  columns: ColDef[],
  exampleRow: Record<string, string | number | null> | undefined,
  sheetLabel: string,
  sheetIndex: number,   // 1-based
  totalSheets: number,
  periodLabel?: string,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const cells: { r: number; c: number; cell: XLSX.CellObject }[] = [];
  const merges: XLSX.Range[] = [];

  const put = (r: number, c: number, cell: XLSX.CellObject) => cells.push({ r, c, cell });
  const merge = (r1: number, c1: number, r2: number, c2: number) =>
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });

  // Build effective column list (prepend Period if needed)
  const hasPeriod = !!periodLabel;
  type EffCol = { key: string; label: string; unit?: string; required: boolean; type: string; options?: string[] };
  const effectiveCols: EffCol[] = [
    ...(hasPeriod ? [{ key: "__period__", label: "Period", required: true, type: "text" }] : []),
    ...columns.map(c => ({ ...c, required: c.required !== false })),
  ];
  const N = Math.max(effectiveCols.length, 4); // total columns

  const title = `${schema.code} — ${schema.name}: ${sheetLabel}`;
  const methodLine = `Method ${sheetIndex} of ${totalSheets}${sheetIndex === 1 ? " — start here, it's the easiest to get right" : ""}`;
  const descLine = method.plainDesc ?? method.label;

  // Row 0: Title
  put(0, 0, mk(title, S.TITLE));
  merge(0, 0, 0, N - 1);
  // Row 1: Method line
  put(1, 0, mk(methodLine, S.SUBTITLE));
  merge(1, 0, 1, N - 1);
  // Row 2: Description / formula
  put(2, 0, mk(descLine, S.BODY));
  merge(2, 0, 2, N - 1);
  // Row 3: empty
  merge(3, 0, 3, N - 1); put(3, 0, empty());
  // Row 4: Legend
  put(4, 0, mk("●  Mandatory field", S.LEGEND_GREEN));
  if (effectiveCols.some(c => !c.required)) {
    put(4, Math.min(4, N - 1), mk("●  Optional field", S.LEGEND_AMBER));
  }
  // Row 5: Column headers
  effectiveCols.forEach((col, c) => {
    const label = col.unit ? `${col.label} (${col.unit})` : col.label;
    put(5, c, mk(label, col.required ? S.TH_GREEN : S.TH_AMBER));
  });
  // Rows 6-7: Sample rows (two examples)
  [0, 1].forEach((sampleIdx) => {
    const r = 6 + sampleIdx;
    effectiveCols.forEach((col, c) => {
      if (col.key === "__period__") {
        put(r, c, mk(periodLabel ?? "April 2025", S.SAMPLE));
        return;
      }
      const val = exampleRow?.[col.key];
      let v: string | number = "—";
      if (val !== undefined && val !== null) v = val as string | number;
      else if (col.options && col.options.length > 0) v = col.options[sampleIdx % col.options.length];
      else if (col.type === "number") v = 0;
      put(r, c, mk(v, S.SAMPLE, typeof v === "number" ? "n" : "s"));
    });
  });
  // Row 8: Sample note
  put(8, 0, mk(
    "* Sample rows shown in light green for illustration only — delete them and enter your own data below.",
    S.NOTE,
  ));
  merge(8, 0, 8, N - 1);
  // Rows 9+: 25 empty data rows
  for (let i = 0; i < 25; i++) {
    effectiveCols.forEach((_, c) => put(9 + i, c, mk("", S.DATA)));
  }

  const colWidths = effectiveCols.map(c =>
    c.key === "__period__" ? { wch: 20 }
    : c.type === "number" ? { wch: 16 }
    : c.label.length > 25 ? { wch: 32 }
    : { wch: 24 }
  );

  writeWs(ws, cells, merges, colWidths,
    [26, 14, 36, 5, 16, 36, 18, 18, 14, ...Array(25).fill(18)],
  );
  return ws;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface TemplateSheet {
  name: string;
  columns: ColDef[];
  exampleRow?: Record<string, string | number | null>;
  periodLabel?: string;
}

export interface TemplateOptions {
  entityName?: string;
  fy?: string;
  reportingPeriod?: "FY" | "CY";
}

// ── Main export ───────────────────────────────────────────────────────────────

export function downloadTemplateXLSX(
  filename: string,
  schema: CategorySchema,
  method: MethodDef,
  options: TemplateOptions = {},
  periodLabel?: string,
) {
  const wb = XLSX.utils.book_new();

  // Collect sheets: handle subtables (one sheet per sub-table)
  type SheetSpec = {
    label: string;
    columns: ColDef[];
    exampleRow: Record<string, string | number | null> | undefined;
  };

  const sheets: SheetSpec[] = [];
  if (method.subtables && method.subtables.length > 0) {
    for (const st of method.subtables) {
      sheets.push({ label: st.title, columns: st.columns, exampleRow: st.exampleRow });
    }
  } else {
    sheets.push({
      label: method.plainLabel ?? method.label,
      columns: method.columns,
      exampleRow: method.exampleRow,
    });
  }

  // Overview sheet
  const overviewMethods = sheets.map((s, i) => ({
    priority: i + 1,
    label: s.label,
    desc: s.columns.filter(c => c.required !== false).map(c => c.label).slice(0, 5).join(", ") +
          (s.columns.filter(c => c.required !== false).length > 5 ? "…" : ""),
  }));
  const ov = buildOverview(schema, overviewMethods, options.fy ?? "FY26", options.entityName, options.reportingPeriod ?? "FY");
  XLSX.utils.book_append_sheet(wb, ov, "Overview");

  // Data sheets
  sheets.forEach((s, i) => {
    const ws = buildDataSheet(
      schema,
      method,
      s.columns,
      s.exampleRow as Record<string, string | number | null> | undefined,
      s.label,
      i + 1,
      sheets.length,
      periodLabel,
    );
    const tabName = (`P${i + 1} ${s.label}`).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, tabName);
  });

  XLSX.writeFile(wb, filename);
}

// ── Legacy helper (used elsewhere in the codebase) ────────────────────────────
export function downloadAOAsXLSX(filename: string, sheets: { name: string; rows: (string | number)[][] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}
