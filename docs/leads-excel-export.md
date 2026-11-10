# Leads Excel download

The leads page toolbar includes **Export Excel** for every role that can view
leads, including agents. The dialog offers:

- **Export filtered leads** (default): all matching results across every page,
  using the current status, source, service, dates, mine-only setting, search and
  sort. The default Open tab therefore exports open leads.
- **Export all leads**: all open and closed leads, ignoring current filters and
  retaining the selected sort order.

The workbook language follows the Portal language. The API creates the summary
and service-specific sheets; the browser downloads the returned `.xlsx` without
rebuilding or paginating it locally. The dialog preserves the filters present
when it was opened. Closing it while preparing aborts the browser request and
prevents a later download; server-side generation may already be underway.

## API and authentication

`leadsApi.export()` calls `GET /api/leads/export` with `scope=filtered|all` and
`language=en|ar`. Pagination parameters are always omitted. For `all`, the client
also omits all filter parameters.

The shared `fetchAuthorizedDownload()` helper uses the existing authenticated
fetch/token-refresh path. It does not send the JSON-only `Accept` header. It
preserves API error messages, handles expired sessions, and reads the download
filename from `Content-Disposition` (including UTF-8 filenames). If that header
is unavailable, the download uses `leads-YYYY-MM-DD.xlsx` instead. The leads API
checks the response MIME type so a successful HTML/JSON response is not saved
as a workbook.

While preparing, the download button and scope choices are disabled. Cancel
remains available. Errors appear inside the dialog with retry available. Once
the download starts, the dialog closes and a success toast appears. Temporary
browser object URLs are released after the download is triggered.

## Deployment

Deploy the EMA API Excel-export endpoint before this Portal version. Its response
must be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
The backend already exposes `Content-Disposition` through CORS.

The backend must have the browser-visible `EMA_PORTAL_BASE_URL` and
`EMA_PUBLIC_API_URL` configured for links inside the workbook. These are backend
variables; the Portal continues to use its existing API-origin configuration.
No additional frontend runtime variable or application dependency is required.

Backend contract: EMA API's `docs/LEADS-EXCEL-EXPORT.md`.

## Verification

```powershell
npx tsc --noEmit --incremental false
npx eslint src/lib/http.ts src/lib/features/leads/api.ts src/lib/features/leads/types.ts src/components/leads/lead-export-modal.tsx "src/app/(app)/leads/page.tsx" src/i18n/en.ts src/i18n/ar.ts tests/lead-export-browser.mjs
npm run build
```

For the intercepted browser scenarios, start Next locally, then:

```powershell
$env:LEAD_PREVIEW_URL = 'http://127.0.0.1:3107'
# Set PLAYWRIGHT_MODULE_PATH when Playwright is supplied externally.
node tests/lead-export-browser.mjs
```

These checks use synthetic sessions and binary responses, with all API traffic
intercepted. They verify download handling, filter parity with the list, absence
of pagination, all-scope behavior, agent access, English/Arabic, 320/390/1440px
layouts, filename fallback, token refresh, API errors, rejection of unexpected
JSON, busy-state controls and cancellation. Real workbook contents are covered
by the backend export tests.
