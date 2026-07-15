import type { Metadata } from "next";
import { OvertimeManager } from "@/features/overtime/components/overtime-manager";
export const metadata: Metadata = { title: "Làm thêm giờ" };
export default function OvertimePage() { return <OvertimeManager />; }
