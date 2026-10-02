import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/attendance/LoginForm";

export const metadata = { title: "Sign in — Sodiq School Attendance" };

export default function AttendanceLoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-navy">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/logo.svg"
              alt="Sodiq School"
              width={56}
              height={65}
              className="h-14 w-auto"
              priority
            />
            <h1 className="mt-3 text-xl font-bold text-white">Sodiq School</h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
              Attendance tracker
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-1 text-lg font-bold text-navy">Sign in</h2>
            <p className="mb-5 text-sm text-slate-500">
              Use the login id and password the head teacher gave you.
            </p>
            <Suspense
              fallback={<div className="h-48 animate-pulse rounded-lg bg-slate-100" />}
            >
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-5 text-center text-xs text-white/60">
            Forgot your password? Ask the head teacher to set a new one.
          </p>
        </div>
      </div>
    </div>
  );
}
