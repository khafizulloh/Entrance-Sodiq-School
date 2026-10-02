/** PENDING / APPROVED / REJECTED pill. */
export function MoveStatusBadge({ status }: { status: string }) {
  const style =
    status === "APPROVED"
      ? "bg-green-100 text-green-800"
      : status === "REJECTED"
        ? "bg-red-100 text-red-700"
        : "bg-brand/20 text-brand-dark";
  const label =
    status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Waiting";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}
