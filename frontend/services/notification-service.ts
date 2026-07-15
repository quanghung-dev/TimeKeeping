import { apiRequest } from "@/lib/api/client";
import type { NotificationList, NotificationSettings } from "@/types/notification";

export const notificationService = {
  settings: () => apiRequest<NotificationSettings>("/notification-settings"),
  save: (input: NotificationSettings) => apiRequest<NotificationSettings>("/notification-settings", { method: "PUT", body: input }),
  list: () => apiRequest<NotificationList>("/notifications?page=1&pageSize=50"),
  read: (ids: string[]) => apiRequest<{ updated: number }>("/notifications/read", { method: "POST", body: { ids } }),
  subscribe: (subscription: PushSubscriptionJSON) => apiRequest<{ subscribed: boolean }>("/push/subscribe", { method: "POST", body: subscription }),
  unsubscribe: (endpoint: string) => apiRequest<{ unsubscribed: boolean }>("/push/unsubscribe", { method: "POST", body: { endpoint } }),
};
