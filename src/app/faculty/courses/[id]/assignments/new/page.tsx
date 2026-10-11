import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import AssignmentBuilder from "@/components/courses/AssignmentBuilder";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { courseFor, publishedCaseBriefs, publishedJourneys } from "@/lib/courses";
import { professions } from "@/lib/professions";

export default async function NewAssignment({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("faculty");
  const course = courseFor(user, (await params).id);
  if (!course) notFound();
  return (
    <AppShell user={user}>
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[12.5px] font-semibold text-ink-3">
        <Link href="/faculty/courses" className="hover:text-brand-700">
          Courses
        </Link>
        <span aria-hidden>›</span>
        <Link href={`/faculty/courses/${course.id}`} className="hover:text-brand-700">
          {course.name}
        </Link>
        <span aria-hidden>›</span> New assignment
      </nav>
      <PageHeader title="New assignment" subtitle="Ask the guide for a starting point, or fill in the form yourself. Either way you decide every setting." />
      <AssignmentBuilder
        courseId={course.id}
        courseProfession={course.profession_id}
        cases={publishedCaseBriefs()}
        journeys={publishedJourneys().map((j) => ({ id: j.id, title: j.title }))}
        professionNames={Object.fromEntries(professions().map((p) => [p.id, p.name]))}
      />
    </AppShell>
  );
}
