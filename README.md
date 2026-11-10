# EMA Portal

Agent + admin console for the **EMA WhatsApp API**, built with Next.js 14 (App Router),
TypeScript, Tailwind CSS. Fully bilingual **English / Arabic** with true RTL mirroring,
light & dark themes, live chat, notifications, user management, notification phone
numbers, a raw realtime log viewer and a country blacklist with a real phone-number
picker.

---

## 1. Quick start

```bash
npm install
cp .env.example .env.local
npm run dev                    # http://localhost:3000
```

Production:

```bash
npm run build
npm start                      # http://localhost:3000
```

Useful checks:

```bash
npm run typecheck              # tsc --noEmit
npm run lint                   # ESLint (next/core-web-vitals)
npm run format                 # Prettier (fetched on demand via npx)
npm run format:check
```

Prettier is **not** a project dependency, so `npm install` needs nothing beyond what
Next.js itself requires; the format scripts pull Prettier through `npx` the first time
you run them. Formatting rules live in `.prettierrc`.

Requires **Node.js 18.17+** (Node 20 LTS recommended).

### Demo credentials

```
agent@ema.local / Agent123!
```

---

## 2. Environment variables

All variables live in `.env.local` (template in `.env.example`). Everything is
`NEXT_PUBLIC_*` because the browser talks to the EMA API directly.

| Variable                        | Default                                | Purpose                                                             |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | `http://84.247.174.83:4000`            | EMA API base URL, no trailing slash.                                |
| `NEXT_PUBLIC_WS_URL`            | derived from the API URL (`ws://…/ws`) | STOMP/WebSocket endpoint. Only set it if the realtime host differs. |
| `NEXT_PUBLIC_DEFAULT_LOCALE`    | `en`                                   | First-visit language (`en` or `ar`).                                |
| `NEXT_PUBLIC_SUPERADMIN_EMAILS` | `agent@ema.local`                      | Comma-separated e-mails bootstrapped as **super admin**.            |
| `NEXT_PUBLIC_ADMIN_EMAILS`      | `agent2@ema.local`                     | Comma-separated e-mails bootstrapped as **admin**.                  |

---

## 3. Features

### Live chat (`/conversations`)

- Conversation list with filters (all / waiting / AI / mine) and search by name or phone.
- Thread view with day separators, message status ticks, customer / AI / agent styling.
- Each agent gets a **stable colour of their own** for their bubbles (derived from the
  agent id/name), so multi-agent threads are easy to follow; bubbles from other agents
  are labelled with the agent's name.
- **Take over** (`/takeover`) and **hand back to AI** (`/handoff`) with optimistic UI
  and server-error rollback.
- Realtime through STOMP over WebSocket with a SockJS fallback; if both fail the UI
  degrades to polling and the header shows _Offline — polling_.
- Sending is disabled with an explanatory hint when the chat is in AI mode or owned
  by another agent.

### Notifications (`/notifications`)

- Handoff requests and queue updates, unread badge in the top bar, mark one / all as read.
- Read state is stored per browser (`ema.notifications.read`).

### Notification phones (`/notify-phones`) — super admin & admin only

- The WhatsApp numbers that receive handoff / queue alerts: add, label, enable or
  disable, and delete.
- Numbers go through the shared country picker (**libphonenumber-js**) and are stored in
  E.164; duplicates are rejected.
- Deleting asks for confirmation through the shared confirm dialog.

### Overview (`/overview`)

Queue counters (waiting, AI-handled, assigned to me, totals, unread, blocked countries,
portal users) plus the latest activity feed.

### Users (`/users`) — super admin & admin only

- Table on desktop, cards on mobile: avatar, e-mail, phone with flag, role, status, created date.
- Create / edit / delete with validation; only a super admin can grant the super admin role;
  you cannot delete your own account.
- Phone numbers use the same country picker as the blacklist and are stored in E.164.

### Blocked countries (`/blacklist`) — super admin & admin only

- Country picker built from **libphonenumber-js** metadata: searchable list, flag emoji,
  localized country name, real calling code; already-blocked entries are greyed out.
- Optional reason, who blocked it and when.
- **Test a number** panel: type any number and see instantly whether it would be
  _allowed_, _blocked_ (with the matched country) or _not a valid number_.

### Settings (`/settings`)

Session card with role badge and sign-out, theme switch, language switch, and the
resolved API / realtime endpoints with copy buttons.

### Internationalisation & RTL

- Dictionaries in `src/i18n/en.ts` and `src/i18n/ar.ts`. **`ar.ts` is typed against
  `en.ts`**, so a missing Arabic key fails `npm run typecheck`.
- Switching to Arabic sets `<html lang="ar" dir="rtl">`; the layout uses logical CSS
  properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`) so it mirrors
  automatically. Phone numbers, e-mails and URLs stay `dir="ltr"`.
- Dates, times and relative timestamps are formatted with `Intl` in the active locale.

---

## 4. Architecture

```
src/
  app/
    layout.tsx, providers.tsx, page.tsx        # shell + provider stack + redirect
    login/page.tsx
    (app)/layout.tsx                           # auth guard for every private page
    (app)/{overview,conversations,notifications,users,
           blacklist,notify-phones,logs,settings}/page.tsx
    api/users/…                                # portal-side user store (route handlers)
    api/blocked-countries/…                    # portal-side blacklist store
    api/notify-phones/…                        # portal-side notification-phone store
  components/  ui/, layout/, chat/, users/ + country-select, phone-input, …
  hooks/       use-poll, use-realtime
  i18n/        en, ar, index
  lib/
    http.ts                                    # single fetch wrapper (auth, abort, errors)
    features/<feature>/{api,types}.ts          # one folder per feature
    api.ts, types.ts                           # barrels re-exporting the features
    config, countries, errors, utils
  providers/   auth, i18n, theme, toast, notifications
  server/      store (JSON persistence), guard (role check)
```

The network layer is split per feature under `src/lib/features/` — `auth`,
`conversations`, `notifications`, `users`, `blacklist`, `notify-phones` — each with its
own `api.ts` and `types.ts`. Every request goes through the single wrapper in
`src/lib/http.ts` (base URL, bearer token, abort support, JSON parsing, envelope
unwrapping and normalised errors). `src/lib/api.ts` and `src/lib/types.ts` are thin
barrels, so existing imports such as `import { conversationsApi } from '@/lib/api'`
keep working. `src/lib/errors.ts` maps API error codes (`MODE_NOT_AGENT`,
`NOT_ASSIGNEE`, `ALREADY_CLAIMED`, …) to translated messages.

List endpoints that the API wraps in an envelope (`{ conversations: […] }`,
`{ notifications: […] }`) are unwrapped inside the feature API, so components always
receive plain arrays.
