import { redirect } from "next/navigation";
import { GroupRegisterView } from "@/components/attendance/GroupRegisterView";
import { getStaffSession } from "@/lib/attendance/auth";

export const metadata = { title: "Group register — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function TeacherGroupRegister({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ date?: string; period?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");

  const { groupId } = await params;
  const { date, period } = await searchParams;

  return (
    <GroupRegisterView
      groupId={groupId}
      session={session}
      date={date}
      period={period}
      backHref="/attendance/teacher"
    />
  );
}
