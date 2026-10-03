import { redirect } from "next/navigation";
import { GroupRegisterView } from "@/components/attendance/GroupRegisterView";
import { getStaffSession } from "@/lib/attendance/auth";

export const metadata = { title: "Group register — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadGroupRegister({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ date?: string; period?: string; month?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");
  if (session.role !== "head") redirect("/attendance/teacher");

  const { groupId } = await params;
  const { date, period, month } = await searchParams;

  return (
    <GroupRegisterView
      groupId={groupId}
      session={session}
      date={date}
      period={period}
      month={month}
      backHref="/attendance/head/groups"
    />
  );
}
