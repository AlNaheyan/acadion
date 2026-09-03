import Nav from "../../components/Nav";
import { SyllabusUploader } from "../../components/syllabus/SyllabusUploader";

export default function CourseHomegroundPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <header className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Course homeground
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Build your semester from the syllabus.
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg">
            Import the dates your professor provided, review anything uncertain, and prepare a calendar you can trust.
          </p>
        </header>
        <SyllabusUploader />
      </main>
    </div>
  );
}
