import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function FacultyHome() {
  const user = await requireUser("faculty");
  return (
    <AppShell user={user}>
      <PageHeader title="Faculty home" subtitle="Your dashboard is being set up." />
    </AppShell>
  );
}
