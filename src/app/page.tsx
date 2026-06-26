import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/Brand";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex flex-1 items-center">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-dark">
              Online Entrance Test
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-navy md:text-5xl">
              Welcome to{" "}
              <span className="text-brand-dark">Sodiq School</span> Entrance Test
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Fill in your details, take a short multiple-choice test for your
              grade, and instantly receive your suggested placement level. Our
              team will contact you soon after.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/test" className="btn-brand text-base">
                Start the Test →
              </Link>
              <Link href="/admin/login" className="btn-outline text-base">
                Admin Login
              </Link>
            </div>
          </div>

          <div className="card border-navy/10 bg-gradient-to-br from-navy to-navy-light text-white">
            <h2 className="text-lg font-bold text-brand">How it works</h2>
            <ol className="mt-4 space-y-4 text-sm">
              {[
                "Enter your personal information.",
                "Answer the multiple-choice questions for your grade.",
                "A timer keeps the test fair — it submits automatically when time is up.",
                "Get your score, percentage, and suggested level.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-navy-dark">
                    {i + 1}
                  </span>
                  <span className="text-slate-100">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
