import type { Metadata } from "next";
import { DashboardFoundation } from "@/features/dashboard/components/dashboard-foundation";

export const metadata: Metadata = { title: "Tổng quan" };
export default function DashboardPage() {
  return <DashboardFoundation />;
}
