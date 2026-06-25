import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/Brand";
import { LogoutButton } from "./LogoutButton";
import { AdminNav } from "./AdminNav";

/**
 * Server component that wraps every authenticated admin page with the
 * sidebar/header chrome. Reads the session for the admin's name.
 */
export async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-navy">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Logo light />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-300 sm:inline">
              {session?.name ?? "Admin"}
            </span>
            <LogoutButton />
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export { Link };
