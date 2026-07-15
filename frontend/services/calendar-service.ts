import { apiRequest } from "@/lib/api/client";
import type { CalendarEventInput, CalendarItem } from "@/types/calendar";

export const calendarService = {
  list: (start: string, end: string) => apiRequest<CalendarItem[]>(`/calendar?start=${start}&end=${end}`),
  create: (input: CalendarEventInput) => apiRequest("/calendar/events", { method: "POST", body: input }),
  remove: (id: string) => apiRequest<void>(`/calendar/events/${id}`, { method: "DELETE" }),
};
