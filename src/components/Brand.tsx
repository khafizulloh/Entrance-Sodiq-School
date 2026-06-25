import Link from "next/link";

/** Sodiq School logo mark (text-based, no external image dependency). */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold font-bold text-navy-dark">
        S
      </span>
      <span
        className={`text-lg font-bold leading-tight ${
          light ? "text-white" : "text-navy"
        }`}
      >
        Sodiq School
        <span className="block text-[10px] font-medium uppercase tracking-wider text-gold">
          Entrance Test
        </span>
      </span>
    </Link>
  );
}

/** Public header used on student-facing pages. */
export function PublicHeader() {
  return (
    <header className="border-b border-navy/10 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Logo />
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-navy/10 bg-white py-5">
      <div className="mx-auto max-w-5xl px-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Sodiq School. All rights reserved.
      </div>
    </footer>
  );
}
