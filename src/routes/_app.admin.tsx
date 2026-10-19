import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageBody, PageHeader, LockedState } from "@/components/portal";
import { getRole, ROLE_META, type Role } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_app/admin")({ component: AdminRoute });

function AdminRoute() {
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(getRole());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!role || !ROLE_META[role]?.canAdmin) {
    return (
      <>
        <PageHeader eyebrow="Deepwoods" title="Admin Console" />
        <PageBody>
          <LockedState title="Deepwoods staff only" message="The admin console is restricted to Deepwoods administrators and coordinators." />
        </PageBody>
      </>
    );
  }

  return <AdminShell isAdmin={role === "deepwoods_admin"} />;
}
