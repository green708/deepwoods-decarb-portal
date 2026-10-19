import type { ClientTabProps } from "@/components/admin/ui";
import { CycleSection } from "@/components/admin/DataTab.cycle";
import { GapsSection } from "@/components/admin/DataTab.gaps";
import { DocsSection } from "@/components/admin/DataTab.docs";
import { IoSection } from "@/components/admin/DataTab.io";

export function DataTab({ clientId, clientName, reportingPeriod, fy }: ClientTabProps) {
  return (
    <div className="space-y-6">
      <CycleSection clientId={clientId} fy={fy} />
      <GapsSection clientId={clientId} clientName={clientName} fy={fy} />
      <DocsSection clientId={clientId} clientName={clientName} reportingPeriod={reportingPeriod} fy={fy} />
      <IoSection clientId={clientId} clientName={clientName} reportingPeriod={reportingPeriod} fy={fy} />
    </div>
  );
}
