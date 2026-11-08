# Web Push — portal implementation

Implements the EMA Web Push handoff. Staff receive system notifications for
`NEW_LEAD`, `HANDOFF_REQUESTED`, and `CONVERSATION_ASSIGNED`, including when every
portal tab is closed.

## What was added

| File | Role |
|---|---|
| `public/sw.js` | Service worker: `push` → `showNotification`, `notificationclick` → focus/open the portal |
| `public/manifest.json` | Web app manifest (required for iPhone/iPad Home Screen push) |
| `public/icons/` | Icon placeholders — **replace before shipping** (see the README there) |
| `src/lib/features/push/types.ts` | `PushConfig`, `PushSubscriptionRecord`, `PushState` |
| `src/lib/features/push/api.ts` | The four endpoints, via the existing `request` + `unwrapItem` helpers |
| `src/lib/push.ts` | VAPID key conversion, subscription serialization, per-account local state |
| `src/hooks/use-web-push.ts` | State machine: enable / disable / test / reconcile |
| `src/components/settings/push-settings-card.tsx` | Settings UI |

## What was changed

- `src/lib/config.ts` — added `STORAGE_KEYS.pushSubscription`.
- `src/lib/api.ts` — exports `pushApi` and the push types.
- `src/app/layout.tsx` — links the manifest, adds `appleWebApp` metadata.
- `src/app/(app)/settings/page.tsx` — renders `<PushSettingsCard />`.
- `src/providers/auth-provider.tsx` — logout unsubscribes the browser and clears
  local push state.
- `src/i18n/en.ts`, `src/i18n/ar.ts` — added the `push` block (both stay in sync,
  which `Dictionary = typeof en` enforces).
- `next.config.mjs` — `/sw.js` is served `no-cache` so a deploy can't leave a
  stale worker handling pushes.

## Flow

1. After sign-in, `useWebPush` calls `GET /api/push/config`. Disabled or 503 →
   the card shows the unavailable state and stops.
2. The user clicks **Enable notifications**. Permission is requested *only* from
   that click — never on page load.
3. The service worker registers, a `PushSubscription` is created with
   `userVisibleOnly: true` and the VAPID key from the config call.
4. `POST /api/push/subscriptions` registers it. The card flips to enabled only
   after the backend confirms.
5. On every later login, `reconcile()` re-registers a granted subscription
   silently, so the endpoint follows the account that is actually signed in.

## Before this works

1. **Backend team must enable the feature** in the target environment. It's off
   by default — `GET /api/push/config` returns `enabled: false` until then and
   registration will fail.
2. The portal origin must be in EMA's CORS allowlist.
3. Must be served over HTTPS (your Caddy edge already does this).
4. Replace the icon placeholders in `public/icons/`.

The VAPID public key is fetched at runtime from `/api/push/config` — deliberately
not hardcoded, so a backend key rotation doesn't silently break subscriptions.

## Note on duplicates

The service worker shows every push, including while a tab is open. The portal
currently creates no desktop notifications from WebSocket events, so there's
nothing to remove. If you add one later for these three event types, agents will
get two notifications per event, one per open tab. In-app toasts, the sound, and
the inbox badge are separate and unaffected.

## Testing the closed-tab case

A closed page can't call the test API, so the **Send a test** button only proves
the pipe works while the portal is open. For the real case, sign in as the same
account elsewhere, trigger a genuine `NEW_LEAD`, and have every portal tab closed
on the first device.

Delivery also depends on OS/browser background support — force-stopping the
browser or disabling notifications at the OS level prevents it, and a queued push
accepted by the provider is not proof the user saw it.
