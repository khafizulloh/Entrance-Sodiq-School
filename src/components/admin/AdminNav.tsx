"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/questions", label: "Tests & Questions" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-white/10 bg-navy-dark">
      <div className="mx-auto flex max-w-7xl gap-1 px-2">
        {links.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-gold text-gold"
                  : "border-transparent text-slate-300 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
