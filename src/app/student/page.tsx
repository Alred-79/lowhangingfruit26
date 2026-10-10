import AppShell from "@/components/AppShell";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function StudentHome() {
  const user = await requireUser();
  return (
    <AppShell user={user}>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Your dashboard is being set up." />
    </AppShell>
  );
}
