import type { Metadata } from "next";
import { CalendarManager } from "@/features/calendar/components/calendar-manager";

export const metadata: Metadata = { title: "Lịch" };
export default function CalendarPage() { return <CalendarManager />; }
