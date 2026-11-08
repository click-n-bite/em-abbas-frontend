# Lead detail checks

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
