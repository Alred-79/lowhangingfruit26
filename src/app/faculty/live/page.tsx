import AppShell from "@/components/AppShell";
import LiveConsole from "@/components/courses/LiveConsole";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function LivePage() {
  const user = await requireUser("faculty");
  return (
    <AppShell user={user}>
      <PageHeader
        eyebrow={
          <>
            <span className="live-dot h-2 w-2 rounded-full bg-[var(--color-live)]" aria-hidden />
            Live assist
          </>
        }
        title="Live visits"
        subtitle="Visits in progress right now. Only visits from assignments with live assist turned on appear here; students are told when an instructor can watch."
      />
      <LiveConsole />
    </AppShell>
  );
}
