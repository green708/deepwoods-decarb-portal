// Submissions store — talks to the PHP + MySQL + Google Drive backend under
// backend/. Files are uploaded to Drive; submission records and audit history
// live in MySQL. See backend/schema_combined.sql.
//
// Multi-entity: every submission is tagged FP or FOS (FL is view-only and can
// never receive data). The Admin review queue and the Submissions page can
// filter by entity.
//
// All functions accept clientSlug as the first argument. Callers must supply it
// from useClientContext().client.slug — never hardcode it here.

import { authFetch } from "./auth";


export type DataEntryEntity = string;

export type SubmissionVersion = "V1" | "V2" | "V3";
export type SubmissionStatus = "Pending" | "Approved" | "Rejected";

export type SubmissionFile = {
  name?: string;
  original_name?: string;
  driveLink?: string;
  drive_file_link?: string;
  kind: "data" | "document";
};

export type Submission = {
  id: number;
  version: SubmissionVersion;
  entity: string;
  datasetId: string;
  datasetName: string;
  tag: string;
  year: string;
  unit: string;
  notes: string;
  status: SubmissionStatus;
  date: string;
  submittedBy: string;
  files: SubmissionFile[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
};

export type AuditLogEntry = {
  id: number;
  submission_id: number;
  action: "Approved" | "Rejected" | "Reassigned";
  actor: string;
  notes: string | null;
  created_at: string;
  dataset_name: string;
  year: string;
  entity?: DataEntryEntity;
};

export async function loadSubmissions(clientSlug: string, status?: SubmissionStatus, entity?: DataEntryEntity): Promise<Submission[]> {
  const qs = new URLSearchParams({
    client_slug: clientSlug,
    ...(status ? { status } : {}),
    ...(entity ? { entity } : {}),
  });
  return authFetch(`submissions.php?${qs}`);
}

export async function loadAuditLog(clientSlug: string): Promise<AuditLogEntry[]> {
  const qs = new URLSearchParams({ client_slug: clientSlug });
  return authFetch(`audit-log.php?${qs}`);
}

export type NewSubmission = {
  version: SubmissionVersion;
  entity: string;
  datasetId: string;
  datasetName: string;
  tag: string;
  year: string;
  unit: string;
  notes: string;
  dataFile?: File | null;
  documents?: File[];
};

export async function addSubmission(clientSlug: string, s: NewSubmission): Promise<Submission> {
  const form = new FormData();
  form.set("client_slug", clientSlug);
  form.set("version", s.version);
  form.set("entity", s.entity);
  form.set("dataset_id", s.datasetId);
  form.set("dataset_name", s.datasetName);
  form.set("tag", s.tag);
  form.set("year", s.year);
  form.set("unit", s.unit);
  form.set("notes", s.notes);
  if (s.dataFile) form.set("dataFile", s.dataFile);
  for (const doc of s.documents ?? []) form.append("documents[]", doc);

  return authFetch("submit.php", { method: "POST", body: form });
}

export async function reviewSubmission(
  submissionId: number,
  action: "Approved" | "Rejected" | "Reassigned",
  notes?: string
): Promise<void> {
  await authFetch("review.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, action, notes }),
  });
}
