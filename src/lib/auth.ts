// Real auth — backed by backend/api/login.php etc. Session token is stored in
// localStorage and sent as `Authorization: Bearer <token>` on every API call.
//
// Multi-client: login response now includes client_id + role.
// ClientContext is cleared on logout so the next login loads fresh context.

import { clearClientContext } from "@/lib/client-context";

export type Role =
  | "sustainability_team"    // client read-only (dashboards)
  | "client_uploader"        // client data-entry
  | "client_leadership"      // client read-only (leadership)
  | "deepwoods_admin"        // Deepwoods full access
  | "deepwoods_coordinator"; // Deepwoods read-only

export const ROLE_META: Record<Role, { label: string; blurb: string; canVault: boolean; canUpload: boolean; canAdmin: boolean }> = {
  sustainability_team: {
    label: "Sustainability Team",
    blurb: "GHG dashboards, data submission, and decarbonisation planning.",
    canVault: true, canUpload: true, canAdmin: false,
  },
  client_uploader: {
    label: "Data Submission Team",
    blurb: "View everything, upload data, browse vault.",
    canVault: true, canUpload: true, canAdmin: false,
  },
  client_leadership: {
    label: "Leadership",
    blurb: "Read-only dashboards and KPIs.",
    canVault: false, canUpload: false, canAdmin: false,
  },
  deepwoods_admin: {
    label: "Deepwoods Admin",
    blurb: "Full access + review queue and audit log.",
    canVault: true, canUpload: false, canAdmin: true,
  },
  deepwoods_coordinator: {
    label: "Deepwoods Coordinator",
    blurb: "Read-only access across all clients.",
    canVault: false, canUpload: false, canAdmin: false,
  },
};

// Roles that belong to Deepwoods (not a client) — see Deepwoods branding
export const DEEPWOODS_ROLES: Role[] = ["deepwoods_admin", "deepwoods_coordinator"];

export const API_BASE = "/backend/api";

// ── Demo mode ────────────────────────────────────────────────────────────────
// A zero-backend demo session: one click on the login page signs you in as the
// demo sustainability team account. All API calls are served from local mocks
// (submissions persist in localStorage), so the full portal works without MySQL,
// Drive or SMTP being configured.
const DEMO_KEY = "fl_demo_mode";
const DEMO_SUBS_KEY = "fl_demo_submissions";

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_KEY) === "1";
}

export function loginDemo(): void {
  localStorage.setItem(DEMO_KEY, "1");
  setSession("demo-token", "sustainability_team", "demo@example.com", false);
}

function demoSubs(): any[] {
  try { return JSON.parse(localStorage.getItem(DEMO_SUBS_KEY) ?? "[]"); } catch { return []; }
}
function saveDemoSubs(subs: any[]) {
  localStorage.setItem(DEMO_SUBS_KEY, JSON.stringify(subs));
}

// Serves the known API endpoints locally while in demo mode.
async function demoFetch(path: string, options: RequestInit): Promise<any> {
  const endpoint = path.split("?")[0];
  switch (endpoint) {
    case "me.php": {
      const storedRole = localStorage.getItem("fl_role") ?? "sustainability_team";
      const storedEmail = localStorage.getItem("fl_email") ?? "demo@example.com";
      return { email: storedEmail, role: storedRole };
    }
    case "logout.php":
      localStorage.removeItem(DEMO_KEY);
      return { ok: true };
    case "submissions.php": {
      const qs = new URLSearchParams(path.split("?")[1] ?? "");
      let subs = demoSubs();
      const status = qs.get("status"), entity = qs.get("entity");
      if (status) subs = subs.filter((s: any) => s.status === status);
      if (entity) subs = subs.filter((s: any) => s.entity === entity);
      return subs;
    }
    case "audit-log.php":
      return [];
    case "submit.php": {
      const form = options.body as FormData;
      const files: any[] = [];
      const dataFile = form.get("dataFile") as File | null;
      if (dataFile && dataFile.name) files.push({ original_name: dataFile.name, drive_file_link: "#demo", kind: "data" });
      for (const doc of form.getAll("documents[]")) {
        const f = doc as File;
        if (f && f.name) files.push({ original_name: f.name, drive_file_link: "#demo", kind: "document" });
      }
      const sub = {
        id: Date.now(),
        entity: form.get("entity"),
        version: form.get("version"),
        datasetId: form.get("dataset_id"),
        datasetName: form.get("dataset_name"),
        tag: form.get("tag"),
        year: form.get("year"),
        unit: form.get("unit"),
        notes: form.get("notes"),
        status: "Pending",
        submittedBy: "demo@example.com",
        date: new Date().toISOString().slice(0, 10),
        files,
      };
      saveDemoSubs([sub, ...demoSubs()]);
      return sub;
    }
    case "review.php":
    case "change-password.php":
    case "forgot-password.php":
    case "reset-password.php":
      return { ok: true, demo: true };
    default:
      return { ok: true, demo: true };
  }
}

const TOKEN_KEY = "fl_session_token";
const ROLE_KEY = "fl_role";
const EMAIL_KEY = "fl_email";
const MUST_CHANGE_KEY = "fl_must_change_password";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(ROLE_KEY) as Role) || null;
}
export function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}
export function getMustChangePassword(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUST_CHANGE_KEY) === "1";
}
export function setMustChangePassword(v: boolean) {
  localStorage.setItem(MUST_CHANGE_KEY, v ? "1" : "0");
}

function setSession(token: string, role: Role, email: string, mustChangePassword: boolean) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(EMAIL_KEY, email);
  localStorage.setItem(MUST_CHANGE_KEY, mustChangePassword ? "1" : "0");
}

function clearSession() {
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(MUST_CHANGE_KEY);
  clearClientContext(); // wipe cached ClientContext so next login loads fresh
}

// Shared fetch helper — attaches the session token, throws with the
// server's error message on failure.
export async function authFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (isDemo()) return demoFetch(path, options);
  const token = getToken();
  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function login(email: string, password: string): Promise<void> {
  const data = await authFetch("login.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setSession(data.token, data.role, data.email, data.mustChangePassword);
}

export async function logout(): Promise<void> {
  try {
    await authFetch("logout.php", { method: "POST" });
  } catch {
    // even if the server call fails, still clear the local session
  }
  clearSession();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authFetch("change-password.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  setMustChangePassword(false);
}

export async function forgotPassword(email: string): Promise<void> {
  await authFetch("forgot-password.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await authFetch("reset-password.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
}
