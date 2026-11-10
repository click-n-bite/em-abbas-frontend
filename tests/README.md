# Lead detail checks

## Channel identity

Run `node --test tests/channel-identity.test.mjs` for phone/user-ID and block-state
checks. `tests/channel-identity-browser.mjs` uses the Playwright setup below for
English desktop/Arabic mobile, missing phones, numeric IDs, replies, and local
blocking. See [the identity update](../docs/whatsapp-user-id-support.md).

## Phone country

The leads list (desktop and mobile) and lead details show the phone-number country
under the number, independently of the customer's stated country. Names follow
the Portal language. Invalid, local-only and non-geographic numbers display an
unknown-country label.

```powershell
node --experimental-strip-types --test tests/phone-country.test.mjs
```

Checks cover international prefixes, stored numbers without `+`, US/Canada
sharing `+1`, Arabic/English labels, and unknown/non-geographic numbers.

## Agent number blocking

`node tests/agent-blocking-browser.mjs` uses the same local-server/Playwright
setup below. It intercepts every API request and tests individual-number list,
block and unblock actions for agent/admin/superadmin, Arabic mobile layout,
restricted user/country pages, and the agent's chat menu. See
[agent blocking](../docs/agent-blocking.md) for the permission scope and deployment order.

## Excel export

`node tests/lead-export-browser.mjs` checks the leads-page Export Excel dialog
against synthetic, intercepted API responses. It uses the same Playwright,
Chrome, `LEAD_PREVIEW_URL`, `PLAYWRIGHT_MODULE_PATH`, and optional
`LEAD_PREVIEW_OUTPUT` setup described below.

It covers filtered versus all scope, exact filter/date/sort parity with the
list, exports beyond the selected page, English/Arabic and mobile layouts,
agent access, binary downloads and filenames, token refresh, backend errors,
unexpected JSON responses, and cancellation while preparing. Workbook content
generation is tested in EMA API. See [the integration guide](../docs/leads-excel-export.md).

The redesign separates shared profile answers, dynamic service answers and
attachments, and previous-contact information. Unknown service questions remain
visible; the UI does not require a hard-coded list of service names.

## Field grouping

With Node 22.6+ and the project dependencies installed:

```powershell
node --experimental-strip-types --test tests/lead-collected-fields.test.mjs
```

Checks cover historical and new fields, stable profile order, separate image
groups, skipped/empty answers, duplicate and unresolved references, and URL
protocol handling. Node may print a module-detection warning for the TypeScript
import; changing the application's module format is not required.

## Browser and responsive layout

Start the local Next development server. This script requires Chrome and an
available Playwright package; `PLAYWRIGHT_MODULE_PATH` can point to an externally
provided package without adding it to application dependencies.

```powershell
$env:LEAD_PREVIEW_URL = 'http://127.0.0.1:3000'
# Optional: $env:PLAYWRIGHT_MODULE_PATH = 'C:\tools\node_modules\playwright'
# Optional: $env:LEAD_PREVIEW_OUTPUT = 'C:\screenshots\lead-details'
node tests/lead-details-responsive.mjs
```

The script uses a synthetic session and intercepts API requests. It does not log
in to a real account, send messages, or modify server data. It exercises palm,
text-question, long-answer/failed-image, empty, and legacy urgent-consultation
leads across widths 320, 390, 768, 1440, and 1920, in English, Arabic RTL, and
Arabic dark mode (75 combinations). It checks horizontal overflow, bounded
label widths, consistent value alignment across Arabic/English text and numbers,
content gutters within 32px and readable long-answer widths on wide screens,
image containment, keyboard preview close and focus restoration,
notes, close/reopen, chat navigation, and agent permissions. Optional screenshots
are labelled previews and contain synthetic data.

Static validation:

```powershell
npx tsc --noEmit --incremental false
npx eslint "src/app/(app)/leads/[id]/page.tsx" src/components/leads/lead-collected-information.tsx src/components/leads/lead-photo.tsx src/lib/features/leads/collected-fields.ts
```


## Lead notification management

See [lead-notifications.md](../docs/lead-notifications.md) for the API contract and
`node tests/lead-resends-browser.mjs` for synthetic recipient CRUD, batch resend,
error/retry, pagination, permissions, and Arabic mobile checks.