import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { FACILITIES, MONTHS, SCOPE3, equipmentSlots, facilitySlots, totalSlots } from "./registry";

export type Role = "client" | "admin";
export type CellStatus = "received" | "partial" | "missing" | "na";

export interface UploadedFile { name: string; size: number; driveLink?: string }

export interface CellEntry {
  value: number | null | (number | null)[];
  note?: string;
  files?: UploadedFile[];
  status?: CellStatus;
  updatedAt?: string;
  updatedBy?: Role;
  overriddenByAdmin?: boolean;
  unlocked?: boolean; // admin-unlocked for a re-entry after submit
}

export interface Scope3Entry {
  status: "not_started" | "in_progress" | "received";
  notes?: string;
  files?: UploadedFile[];
  updatedAt?: string;
  updatedBy?: Role;
}

export interface Scope3TableRow { [k: string]: string | number | null }

export interface Scope3Data {
  method?: string;
  rows: Scope3TableRow[];
  files: UploadedFile[];
  entryMode?: "upload" | "manual";
  submitted?: boolean;
  updatedAt?: string;
  reportingFrequency?: "monthly" | "quarterly" | "half-yearly" | "yearly";
  facilityScope?: string;
}

export interface CommuteResponse {
  facilityId: string;
  days: number;
  mode: string;
  distance: number;
  fuel?: string;
  carpool?: boolean;
  carpoolCount?: number;
  weeks: number;
  submittedAt: string;
}

export interface EditRequest {
  id: string;
  scope: "s12" | "s3";
  equipmentId?: string;
  equipmentName?: string;
  facility?: string;
  months?: string[];         // monthKeys (or ["annual"])
  monthLabel?: string;       // single-month display
  categoryId?: string;       // s3
  categoryName?: string;
  currentValue?: string;
  correctedValue?: string;
  reason: string;
  file?: UploadedFile;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface StoreState {
  cells: Record<string, CellEntry>;
  s3: Record<string, Scope3Entry>;
  s3Data: Record<string, Scope3Data>;
  notesByEquipment: Record<string, string>;
  submission: { submittedAt: string; submittedBy: Role } | null;
  editRequests: EditRequest[];
  commuteResponses: CommuteResponse[];
  relevantS3: string[]; // marked "Relevant" in wizard; defaults to all
}


function cellKey(equipmentId: string, monthOrAnnual: string) {
  return `${equipmentId}:${monthOrAnnual}`;
}

function countFilledSubValues(v: CellEntry["value"]): { filled: number; total: number } {
  if (Array.isArray(v)) return { filled: v.filter((x) => x !== null && x !== undefined).length, total: v.length };
  return { filled: v === null || v === undefined ? 0 : 1, total: 1 };
}

interface StoreCtx {
  role: Role;
  setRole: (r: Role) => void;
  state: StoreState;
  getCell: (equipmentId: string, monthKey: string) => CellEntry | undefined;
  setCell: (equipmentId: string, monthKey: string, next: Partial<CellEntry>) => void;
  clearCell: (equipmentId: string, monthKey: string) => void;
  setEquipmentNote: (equipmentId: string, note: string) => void;
  getS3: (id: string) => Scope3Entry | undefined;
  setS3: (id: string, next: Partial<Scope3Entry>) => void;
  getS3Data: (id: string) => Scope3Data;
  setS3Data: (id: string, next: Partial<Scope3Data>) => void;
  addS3Row: (id: string, row: Scope3TableRow) => void;
  updateS3Row: (id: string, idx: number, row: Scope3TableRow) => void;
  removeS3Row: (id: string, idx: number) => void;
  addS3Files: (id: string, files: UploadedFile[]) => void;
  submitS3Category: (id: string) => void;
  submitAll: () => void;
  unsubmit: () => void;
  addEditRequest: (r: Omit<EditRequest, "id" | "createdAt" | "status">) => void;
  approveEditRequest: (id: string) => void;
  rejectEditRequest: (id: string, note: string) => void;
  addCommuteResponse: (r: Omit<CommuteResponse, "submittedAt">) => void;
  toggleRelevantS3: (id: string) => void;
  overallProgress: number;
  facilityProgress: (facilityId: string) => number;
  equipmentProgress: (equipmentId: string) => number;
  filledSlots: number;
  totalSlotsCount: number;
  resetAll: () => void;
  seedDemo: () => void;
  isLocked: (equipmentId?: string, monthKey?: string) => boolean;
}

const Ctx = createContext<StoreCtx | null>(null);

const EMPTY: StoreState = {
  cells: {}, s3: {}, s3Data: {}, notesByEquipment: {},
  submission: null, editRequests: [], commuteResponses: [],
  relevantS3: SCOPE3.map((c) => c.id),
};

export function GhgStoreProvider({ children, storageKey = "ghg-v3" }: { children: ReactNode; storageKey?: string }) {
  // Pin the keys at mount time — changing storageKey prop after mount has no effect.
  const SK = useRef(storageKey).current;
  const RK = useRef(`${storageKey}-role`).current;

  const [state, setState] = useState<StoreState>(EMPTY);
  const [role, setRoleState] = useState<Role>("client");
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SK);
      if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
      const r = localStorage.getItem(RK) as Role | null;
      if (r === "client" || r === "admin") setRoleState(r);
    } catch { /* ignore */ }
    hydrated.current = true;
  }, [SK, RK]);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(SK, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, SK]);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try { localStorage.setItem(RK, r); } catch { /* ignore */ }
  }, [RK]);

  const getCell = useCallback(
    (equipmentId: string, monthKey: string) => state.cells[cellKey(equipmentId, monthKey)],
    [state.cells],
  );

  const setCell = useCallback((equipmentId: string, monthKey: string, next: Partial<CellEntry>) => {
    setState((prev) => {
      const k = cellKey(equipmentId, monthKey);
      const existing = prev.cells[k];
      const merged: CellEntry = {
        ...existing, ...next,
        updatedAt: new Date().toISOString(),
        updatedBy: role,
      };
      if (existing && role === "admin" && existing.updatedBy === "client") merged.overriddenByAdmin = true;
      // Auto re-lock after client re-enters into an admin-unlocked cell
      if (existing?.unlocked && role === "client") merged.unlocked = false;
      return { ...prev, cells: { ...prev.cells, [k]: merged } };
    });
  }, [role]);

  const clearCell = useCallback((equipmentId: string, monthKey: string) => {
    setState((prev) => {
      const k = cellKey(equipmentId, monthKey);
      const { [k]: _, ...rest } = prev.cells;
      return { ...prev, cells: rest };
    });
  }, []);

  const setEquipmentNote = useCallback((equipmentId: string, note: string) => {
    setState((prev) => ({ ...prev, notesByEquipment: { ...prev.notesByEquipment, [equipmentId]: note } }));
  }, []);

  const getS3 = useCallback((id: string) => state.s3[id], [state.s3]);
  const setS3 = useCallback((id: string, next: Partial<Scope3Entry>) => {
    setState((prev) => {
      const existing = prev.s3[id] ?? { status: "not_started" as const };
      return {
        ...prev,
        s3: { ...prev.s3, [id]: { ...existing, ...next, updatedAt: new Date().toISOString(), updatedBy: role } },
      };
    });
  }, [role]);

  const getS3Data = useCallback((id: string): Scope3Data => {
    return state.s3Data[id] ?? { rows: [], files: [] };
  }, [state.s3Data]);

  const setS3Data = useCallback((id: string, next: Partial<Scope3Data>) => {
    setState((prev) => {
      const existing = prev.s3Data[id] ?? { rows: [], files: [] };
      return {
        ...prev,
        s3Data: { ...prev.s3Data, [id]: { ...existing, ...next, updatedAt: new Date().toISOString() } },
      };
    });
  }, []);

  const addS3Row = useCallback((id: string, row: Scope3TableRow) => {
    setState((prev) => {
      const ex = prev.s3Data[id] ?? { rows: [], files: [] };
      return { ...prev, s3Data: { ...prev.s3Data, [id]: { ...ex, rows: [...ex.rows, row], updatedAt: new Date().toISOString() } } };
    });
  }, []);
  const updateS3Row = useCallback((id: string, idx: number, row: Scope3TableRow) => {
    setState((prev) => {
      const ex = prev.s3Data[id] ?? { rows: [], files: [] };
      const rows = ex.rows.slice();
      rows[idx] = row;
      return { ...prev, s3Data: { ...prev.s3Data, [id]: { ...ex, rows } } };
    });
  }, []);
  const removeS3Row = useCallback((id: string, idx: number) => {
    setState((prev) => {
      const ex = prev.s3Data[id] ?? { rows: [], files: [] };
      return { ...prev, s3Data: { ...prev.s3Data, [id]: { ...ex, rows: ex.rows.filter((_, i) => i !== idx) } } };
    });
  }, []);
  const addS3Files = useCallback((id: string, files: UploadedFile[]) => {
    setState((prev) => {
      const ex = prev.s3Data[id] ?? { rows: [], files: [] };
      // Deduplicate by filename — prevents the same file appearing twice if the
      // upload handler fires concurrently (stale-closure race) or a retry runs.
      const existingNames = new Set(ex.files.map((f) => f.name));
      const newFiles = files.filter((f) => !existingNames.has(f.name));
      if (newFiles.length === 0) return prev;
      return { ...prev, s3Data: { ...prev.s3Data, [id]: { ...ex, files: [...ex.files, ...newFiles], updatedAt: new Date().toISOString() } } };
    });
  }, []);
  const submitS3Category = useCallback((id: string) => {
    setState((prev) => {
      const ex = prev.s3Data[id] ?? { rows: [], files: [] };
      return { ...prev, s3Data: { ...prev.s3Data, [id]: { ...ex, submitted: true } } };
    });
  }, []);

  const submitAll = useCallback(() => {
    setState((prev) => ({ ...prev, submission: { submittedAt: new Date().toISOString(), submittedBy: role } }));
  }, [role]);
  const unsubmit = useCallback(() => {
    setState((prev) => ({ ...prev, submission: null }));
  }, []);

  const addEditRequest = useCallback((r: Omit<EditRequest, "id" | "createdAt" | "status">) => {
    setState((prev) => ({
      ...prev,
      editRequests: [
        ...prev.editRequests,
        { ...r, id: `er_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString(), status: "pending" },
      ],
    }));
  }, []);

  const approveEditRequest = useCallback((id: string) => {
    setState((prev) => {
      const req = prev.editRequests.find((r) => r.id === id);
      if (!req) return prev;
      let cells = prev.cells;
      if (req.equipmentId && req.months) {
        cells = { ...cells };
        for (const mk of req.months) {
          const k = cellKey(req.equipmentId, mk);
          const ex = cells[k];
          cells[k] = { ...(ex ?? { value: null }), unlocked: true };
        }
      }
      return {
        ...prev,
        cells,
        editRequests: prev.editRequests.map((r) =>
          r.id === id ? { ...r, status: "approved", resolvedAt: new Date().toISOString() } : r,
        ),
      };
    });
  }, []);

  const rejectEditRequest = useCallback((id: string, note: string) => {
    setState((prev) => ({
      ...prev,
      editRequests: prev.editRequests.map((r) =>
        r.id === id ? { ...r, status: "rejected", adminNote: note, resolvedAt: new Date().toISOString() } : r,
      ),
    }));
  }, []);

  const addCommuteResponse = useCallback((r: Omit<CommuteResponse, "submittedAt">) => {
    setState((prev) => ({ ...prev, commuteResponses: [...prev.commuteResponses, { ...r, submittedAt: new Date().toISOString() }] }));
  }, []);

  const toggleRelevantS3 = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      relevantS3: prev.relevantS3.includes(id) ? prev.relevantS3.filter((x) => x !== id) : [...prev.relevantS3, id],
    }));
  }, []);

  const { filledSlots, totalSlotsCount } = useMemo(() => {
    const totalCount = totalSlots();
    let filled = 0;
    for (const f of FACILITIES) {
      for (const e of f.equipment) {
        if (e.mode === "annual") {
          const c = state.cells[cellKey(e.id, "annual")];
          if (c && c.value !== null && c.value !== undefined) filled += 1;
        } else {
          for (const m of MONTHS) {
            const c = state.cells[cellKey(e.id, m.key)];
            if (c) filled += countFilledSubValues(c.value).filled;
          }
        }
      }
    }
    return { filledSlots: filled, totalSlotsCount: totalCount };
  }, [state.cells]);

  const overallProgress = totalSlotsCount === 0 ? 0 : filledSlots / totalSlotsCount;

  const facilityProgress = useCallback((facilityId: string) => {
    const total = facilitySlots(facilityId);
    if (total === 0) return 0;
    const f = FACILITIES.find((x) => x.id === facilityId)!;
    let filled = 0;
    for (const e of f.equipment) {
      if (e.mode === "annual") {
        const c = state.cells[cellKey(e.id, "annual")];
        if (c && c.value !== null && c.value !== undefined) filled += 1;
      } else {
        for (const m of MONTHS) {
          const c = state.cells[cellKey(e.id, m.key)];
          if (c) filled += countFilledSubValues(c.value).filled;
        }
      }
    }
    return filled / total;
  }, [state.cells]);

  const equipmentProgress = useCallback((equipmentId: string) => {
    for (const f of FACILITIES) {
      const e = f.equipment.find((x) => x.id === equipmentId);
      if (!e) continue;
      const total = equipmentSlots(e);
      let filled = 0;
      if (e.mode === "annual") {
        const c = state.cells[cellKey(e.id, "annual")];
        if (c && c.value !== null && c.value !== undefined) filled += 1;
      } else {
        for (const m of MONTHS) {
          const c = state.cells[cellKey(e.id, m.key)];
          if (c) filled += countFilledSubValues(c.value).filled;
        }
      }
      return total === 0 ? 0 : filled / total;
    }
    return 0;
  }, [state.cells]);

  const isLocked = useCallback((equipmentId?: string, monthKey?: string) => {
    if (!state.submission) return false;
    if (role === "admin") return false;
    if (equipmentId && monthKey) {
      const c = state.cells[cellKey(equipmentId, monthKey)];
      if (c?.unlocked) return false;
    }
    return true;
  }, [state.submission, state.cells, role]);

  const resetAll = useCallback(() => setState(EMPTY), []);

  const seedDemo = useCallback(() => {
    setState((prev) => {
      const cells = { ...prev.cells };
      const put = (id: string, monthKey: string, value: CellEntry["value"], by: Role = "client") => {
        cells[cellKey(id, monthKey)] = { value, updatedAt: new Date().toISOString(), updatedBy: by };
      };
      put("FOS-HJ-DG-001", "2025-04", [1200, 400]);
      put("FOS-HJ-DG-001", "2025-05", [980, 350]);
      put("FOS-HJ-DG-001", "2025-06", [1050, 380]);
      put("FOS-HJ-VH-001", "2025-04", 2450);
      put("FOS-HJ-VH-001", "2025-05", 2260);
      put("FOS-HJ-SL-001", "2025-04", [103344, 54584, 48760]);
      put("FOS-HJ-SL-001", "2025-05", [98120, 51200, 46920]);
      put("FOS-HJ-GR-001", "2025-04", 184500);
      put("FOS-HJ-GR-001", "2025-05", 191220);
      put("FOS-HJ-FE-001", "annual", 12);
      put("FOS-KB-OV-001", "2025-04", 6200);
      put("FOS-KB-LP-001", "2025-04", 480);
      put("FOS-KB-GR-001", "2025-04", 122400);
      return { ...prev, cells };
    });
    setState((prev) => ({
      ...prev,
      s3: {
        ...prev.s3,
        c1: { status: "received", notes: "GRN Register FY26 (Apr-Jun) uploaded", updatedBy: "admin", updatedAt: new Date().toISOString() },
        c2: { status: "in_progress", updatedBy: "client", updatedAt: new Date().toISOString() },
      },
      s3Data: {
        ...prev.s3Data,
        c1: {
          rows: [
            { supplier: "Tata Steel Ltd", country: "India", category: "Steel sheet", naics: "331110", spend: 42000000, currency: "INR" },
            { supplier: "Asian Paints", country: "India", category: "Coatings", naics: "325510", spend: 8400000, currency: "INR" },
          ],
          files: [{ name: "Purchase_Register_FY26.xlsx", size: 245678 }],
          method: "spend", entryMode: "upload",
        },
      },
    }));
  }, []);

  const value: StoreCtx = {
    role, setRole, state,
    getCell, setCell, clearCell, setEquipmentNote,
    getS3, setS3,
    getS3Data, setS3Data, addS3Row, updateS3Row, removeS3Row, addS3Files, submitS3Category,
    submitAll, unsubmit,
    addEditRequest, approveEditRequest, rejectEditRequest,
    addCommuteResponse, toggleRelevantS3,
    overallProgress, facilityProgress, equipmentProgress,
    filledSlots, totalSlotsCount,
    resetAll, seedDemo, isLocked,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGhgStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGhgStore must be used within GhgStoreProvider");
  return v;
}

export function completionColor(pct: number): "grey" | "red" | "amber" | "green" {
  if (pct <= 0) return "grey";
  if (pct < 0.25) return "red";
  if (pct < 0.8) return "amber";
  return "green";
}

export { SCOPE3, FACILITIES, MONTHS };
