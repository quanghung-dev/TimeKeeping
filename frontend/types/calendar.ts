export interface CalendarItem {
  id: string;
  itemType: "work" | "remote" | "business_trip" | "day_off" | "custom" | "attendance" | "leave" | "holiday";
  title: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  status: string | null;
  actualMinutes: number | null;
}

export interface CalendarEventInput {
  title: string;
  eventType: "work" | "remote" | "business_trip" | "day_off" | "custom";
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  note: string | null;
}
