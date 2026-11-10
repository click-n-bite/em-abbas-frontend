# Lead notifications

The existing `/notify-phones` route is now titled **Lead notifications**. Admins and superadmins see two tabs:

- **Notification numbers** retains add/edit/delete and future-notification enable/disable.
- **Resend open leads** previews all open leads for a destination, confirms sending, and shows live batch progress and history. Resending does not subscribe the destination to future notifications.

The tab and selected batch are shareable as `/notify-phones?tab=resend&batch=<id>`. Reloading or selecting a history entry only reads the batch. Access is checked after authentication is ready, before either tab mounts or makes protected API calls. Agents have no controls or API requests for this page.

The form uses the existing country selector and phone validation, with an optional name of at most 128 characters. Previewing sends nothing. A separate confirmation shows the destination and snapshot count. Empty or expired previews cannot be sent. Failed starts preserve the same batch ID for a deliberate retry; the UI never creates a replacement automatically.

The UI uses `/api/leads/resend-batches` for preview, start, paginated history, progress, paginated/status-filtered items, retry-failed, and cancel. Polls run every five seconds while visible, with cancellation on navigation and stale-response protection after actions. Item links open lead details. Automatic retries and exhausted failures are shown separately. `Sent` means accepted for sending, not a WhatsApp delivery or read receipt. Cancellation explains that in-flight sends may finish.

English and Arabic RTL are supported, including phone direction, mobile cards, dialogs, validation, and errors.

## Deployment

Deploy the EMA API resend backend with migration V29 before this frontend. The existing API URL and authentication are reused; no new frontend environment variables or WhatsApp templates are required. Number management uses its original endpoints.

## Validation

`tests/lead-resends-browser.mjs` intercepts all API traffic with synthetic data. It covers recipient CRUD, preview validation, confirmation, polling, HTTP 503 and network errors with the same batch ID, retry/cancel, reload without resending, empty/expired previews, history/item pagination, status filtering, agent denial, unavailable backend, and superadmin Arabic mobile layout. No notifications are sent.

Start Next on a local port, then run:

```powershell
$env:LEAD_PREVIEW_URL = 'http://127.0.0.1:3107'
# Optional external installation; Playwright is not an application dependency.
$env:PLAYWRIGHT_MODULE_PATH = 'C:\tools\node_modules\playwright'
node tests/lead-resends-browser.mjs
```

Screenshots go under the ignored `node_modules/.cache/lead-resend-preview` directory.

## Resend layout

A three-step indicator distinguishes choosing a destination, reviewing, and tracking
results. The setup form is replaced by the selected preview/send; New resend
returns to setup without starting or cancelling work. History sits beside the
workspace on wide screens and below it on mobile. Drafts show the count to review
without empty progress counters. Started sends show Total, Sent, Waiting, and
Failed, with nonzero secondary states underneath. Cancelled sends explain how
many notifications were sent and not sent. Phone-only recipients display once.
