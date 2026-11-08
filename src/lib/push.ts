import { STORAGE_KEYS } from "./config";
import type { PushSubscriptionPayload } from "./features/push/types";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const raw = window.atob(base64);

  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);

  return output;
}

function toBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";

  const bytes = new Uint8Array(buffer);

  let binary = "";

  for (let i = 0; i < bytes.byteLength; i += 1)
    binary += String.fromCharCode(bytes[i]);

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function serializeSubscription(
  subscription: PushSubscription,
): PushSubscriptionPayload {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: toBase64Url(subscription.getKey("p256dh")),
      auth: toBase64Url(subscription.getKey("auth")),
    },
  };
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

const subscriptionKey = (userId: string) =>
  `${STORAGE_KEYS.pushSubscription}.${userId}`;

export function readLocalSubscriptionId(userId: string): number | null {
  try {
    const raw = window.localStorage.getItem(subscriptionKey(userId));

    if (!raw) return null;

    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalSubscriptionId(
  userId: string,
  id: number | null,
): void {
  try {
    if (id === null) window.localStorage.removeItem(subscriptionKey(userId));
    else window.localStorage.setItem(subscriptionKey(userId), String(id));
  } catch {
    // Storage unavailable (private mode) — reconciled on the next startup.
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");

  if (existing) return existing;

  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function unsubscribeBrowser(): Promise<void> {
  if (!pushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");

    const subscription = await registration?.pushManager.getSubscription();

    await subscription?.unsubscribe();
  } catch {
    // Non-fatal.
  }
}

export function clearLocalPushState(): void {
  try {
    const prefix = `${STORAGE_KEYS.pushSubscription}.`;

    const keys: string[] = [];

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);

      if (key && key.startsWith(prefix)) keys.push(key);
    }

    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Non-fatal.
  }
}
