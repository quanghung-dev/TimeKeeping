import { notificationService } from "@/services/notification-service";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export async function enablePushNotifications(): Promise<"subscribed" | "local-only"> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Trình duyệt không hỗ trợ thông báo");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Trình duyệt chưa cấp quyền thông báo");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return "local-only";
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
  await notificationService.subscribe(subscription.toJSON());
  return "subscribed";
}

export async function disablePushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await notificationService.unsubscribe(subscription.endpoint);
  await subscription.unsubscribe();
}
