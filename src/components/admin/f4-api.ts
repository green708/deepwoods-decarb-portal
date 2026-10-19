import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE, getToken } from "@/lib/auth";

export class FieldsError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.fields = fields;
  }
}

export async function sendJson<T = unknown>(path: string, method: "POST" | "DELETE" | "GET", body?: unknown): Promise<T> {
  const token = getToken();
  const viewAs = typeof window !== "undefined" ? localStorage.getItem("decarb_dwa_view") : null;
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(viewAs ? { "X-View-As": viewAs } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fields = data && typeof data.fields === "object" && data.fields ? (data.fields as Record<string, string>) : {};
    throw new FieldsError(data.error || `Request failed (${res.status})`, fields);
  }
  return data as T;
}

/** Keeps the cross-client inbox and portfolio badges fresh after a reply is sent from an embedded ThreadPanel. */
export function useRefreshInboxOnThreadChange() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      const key = event.query.queryKey;
      if (key[0] !== "ndc-threads" || event.query.state.dataUpdateCount < 2) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["admin-inbox"] });
        qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      }, 400);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, [qc]);
}
