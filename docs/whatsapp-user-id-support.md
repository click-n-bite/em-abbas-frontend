# Phone and WhatsApp user-ID conversations

The portal consumes EMA's version 2 channel identity fields. `phone` is nullable
on conversations, leads, activity, and notifications. User IDs retain their case,
punctuation, and digits; they are never converted into phone numbers. Existing
phone-only responses remain supported.

Inbox, overview, lead labels, notification summaries, activity labels, and search
can use the external user ID when no phone is available. Avatars use canonical
conversation IDs. Country flags and country names use only the actual phone
field. Leads without a phone display “Phone number unavailable.” Contact CSV
exports retain an empty phone alongside separate channel/connection/identity and
conversation-ID columns.

Messages, takeover, handoff, rename, hide, and lead creation retain canonical
conversation-ID endpoints. This update does not add account linking or a Telegram
adapter. Channel and connection fields prepare the shared identity model for
later adapters; they do not imply that equal IDs belong to the same customer.

## Blocking

EMA's aggregate `blocked` field is authoritative. Refreshes and realtime updates
must not overwrite a local identity block using the phone-number block list.

Known phone numbers retain the existing WhatsApp phone-block controls and staff
permissions. For a contact without a phone, admins/superadmins can confirm a
local conversation block using `POST /conversations/{id}/identity-block` with
`{ "blocked": true }`. The dialog explains that this affects our system and
does not perform a Meta phone-number block. Agents cannot manage these local
blocks, matching the API's admin-only permission.

The local unblock action uses the same endpoint with `false` and applies the
returned conversation. If a separate phone block also exists, the conversation
remains blocked until that phone block is removed. API responses remain the source
of truth after phone unblock as well.

Deploy with the matching EMA API/V32 contract. This repo performs no database
migration. User-ID-only activation must stay off until the bridge is updated and
the full WhatsApp flow is tested.

## Checks

`node --test tests/channel-identity.test.mjs` runs identity and block-state checks
on Node 20+ and is included in CI. Run typecheck and the production build as usual.

`tests/channel-identity-browser.mjs` uses the same Playwright/Chrome setup as the
existing browser checks, with synthetic sessions and intercepted API responses.
It covers English desktop, Arabic mobile, opaque/numeric user IDs, country flags,
agent reply routing, admin local block/unblock, refresh persistence, and agent
permissions. It never contacts a real WhatsApp user.
