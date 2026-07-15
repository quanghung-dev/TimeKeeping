export interface OvertimeSession { id: string; startedAt: string; endedAt: string | null; overtimeType: "weekday" | "weekend" | "holiday"; multiplier: string; source: string; note: string | null; minutes: number | null; }
export interface OvertimeSummary { totalMinutes: number; weightedMinutes: number; byType: { weekday: number; weekend: number; holiday: number }; count: number; }
