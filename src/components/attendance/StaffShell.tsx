import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "./LogoutButton";
import type { StaffRole } from "@/lib/attendance/auth";

/**
 * The frame every attendance page sits in: Sodiq School shield and wordmark,
 * navy bar, orange accents, and the nav for the signed-in role.
 */

const TEACHER_NAV = [
  { href: "/attendance/teacher", label: "Dashboard" },
  { href: "/attendance/teacher/groups", label: "My groups" },
  { href: "/attendance/teacher/requests", label: "My requests" },
];

const HEAD_NAV = [
  { href: "/attendance/head", label: "Dashboard" },
  { href: "/attendance/head/moves", label: "Move requests" },
  { href: "/attendance/head/groups", label: "Groups" },
  { href: "/attendance/head/students", label: "Students" },
  { href: "/attendance/head/teachers", label: "Teachers" },
  { href: "/attendance/head/timetable", label: "Timetable" },
  { href: "/attendance/head/uploads", label: "Uploads" },
  { href: "/attendance/head/reports", label: "Reports" },
];

export function StaffShell({
  role,
  name,
  active,
  pendingMoves = 0,
  children,
}: {
  role: StaffRole;
  name: string;
  active?: string;
  pendingMoves?: number;
  children: React.ReactNode;
}) {
  const nav = role === "head" ? HEAD_NAV : TEACHER_NAV;
  const home = role === "head" ? "/attendance/head" : "/attendance/teacher";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href={home} className="flex items-center gap-2.5">
            <Image
              src="/logo.svg"
              alt="Sodiq School"
              width={36}
              height={42}
              className="h-9 w-auto"
              priority
            />
            <span className="text-lg font-bold leading-tight">
              Sodiq School
              <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-brand">
                Attendance
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block font-semibold">{name}</span>
              <span className="block text-[11px] uppercase tracking-wider text-brand">
                {role === "head" ? "Head teacher" : "Teacher"}
              </span>
            </span>
            <LogoutButton />
          </div>
        </div>

        <nav className="border-t border-white/10 bg-navy-dark">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 py-1.5">
            {nav.map((item) => {
              const isActive = active === item.href;
              const showBadge = item.href.endsWith("/moves") && pendingMoves > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand text-navy-dark"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                  {showBadge && (
                    <span
                      className={`rounded-full px-1.5 text-[11px] font-bold ${
                        isActive ? "bg-navy-dark text-brand" : "bg-brand text-navy-dark"
                      }`}
                    >
                      {pendingMoves}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-navy/10 bg-white py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Sodiq School — attendance tracker
        </div>
      </footer>
    </div>
  );
}

/** Page heading used inside the shell. */
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
