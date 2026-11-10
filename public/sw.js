/* EMA portal service worker — Web Push.
 *
 * Must be able to display a notification WITHOUT calling the EMA API, without
 * an access token, and without reading page localStorage.
 */

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-72.png";
const FALLBACK_TITLE = "EM ABBASS";
const FALLBACK_BODY = "Open the portal to view the details.";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Map the backend payload to a portal route. */
function routeFor(payload) {
  if (!payload) return "/overview";

  if (payload.conversationId)
    return `/conversations?id=${encodeURIComponent(payload.conversationId)}`;

  if (payload.entityType === "conversation" && payload.entityId)
    return `/conversations?id=${encodeURIComponent(payload.entityId)}`;

  if (payload.entityType === "lead" || payload.eventType === "NEW_LEAD")
    return "/leads";

  if (
    payload.eventType === "HANDOFF_REQUESTED" ||
    payload.eventType === "CONVERSATION_ASSIGNED"
  )
    return "/conversations";

  return "/notifications";
}

self.addEventListener("push", (event) => {
  let payload = null;

  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }

  const title = (payload && payload.title) || FALLBACK_TITLE;
  const body = (payload && payload.body) || FALLBACK_BODY;
  const tag = (payload && payload.tag) || "ema-notification";

  event.waitUntil(
    self.registration
      .showNotification(title, {
        body,
        tag,
        icon: ICON,
        badge: BADGE,
        data: {
          url: routeFor(payload),
          notificationId: payload ? payload.notificationId : undefined,
          eventType: payload ? payload.eventType : undefined,
        },
      })
      .then(() =>
        self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        }),
      )
      .then((windows) => {
        windows.forEach((client) => {
          client.postMessage({ type: "ema-notification" });
        });
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  const target = data.url || "/overview";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            if ("navigate" in client) {
              return client
                .navigate(target)
                .then((navigated) =>
                  navigated ? navigated.focus() : client.focus(),
                )
                .catch(() => client.focus());
            }

            return client.focus();
          }
        }

        return self.clients.openWindow(target);
      }),
  );
});
