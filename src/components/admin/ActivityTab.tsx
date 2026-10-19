import { Section, type ClientTabProps } from "@/components/admin/ui";
import { ActivityFeed } from "@/components/admin/f4-activity";

export function ActivityTab({ clientId, clientName }: ClientTabProps) {
  return (
    <Section title="Activity" description={`Recent changes Deepwoods staff made on ${clientName}, newest first.`}>
      <ActivityFeed clientId={clientId} />
    </Section>
  );
}
