import type { Metadata } from "next";
import { LeaveManager } from "@/features/leave/components/leave-manager";

export const metadata: Metadata = { title: "Nghỉ phép" };
export default function LeavesPage() {
  return <LeaveManager />;
}
