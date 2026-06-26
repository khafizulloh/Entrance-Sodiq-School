import Link from "next/link";
import Image from "next/image";

/**
 * Sodiq School logo: the shield mark (public/logo.svg) plus the wordmark.
 * Swap public/logo.svg for the official asset to use the exact artwork.
 */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/logo.svg"
        alt="Sodiq School logo"
        width={36}
        height={42}
        className="h-9 w-auto"
        priority
      />
      <span
        className={`text-lg font-bold leading-tight ${
          light ? "text-white" : "text-navy"
        }`}
      >
        Sodiq School
        <span className="block text-[10px] font-medium uppercase tracking-wider text-brand">
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
