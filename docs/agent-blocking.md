# Individual-number blocking for agents

Agents, admins and superadmins can open **Blocked numbers** and list, search,
block and unblock individual customer WhatsApp numbers. The page is visible in
the sidebar for all three roles. The existing blocked/unblocked/all filters,
phone validation, reason entry and unblock confirmation are reused.

`canManageBlockedNumbers` is a dedicated authenticated-session permission in the
auth provider. `canManageUsers` is unchanged. The chat More actions menu exposes
Block to agents; Hide and Clear remain admin-only. The existing blocked-chat
Unblock action now succeeds for agents because the backend permits it.

The API routes remain `/api/admin/blocked-whatsapp-numbers` and
`/api/admin/blocked-whatsapp-numbers/{id}/unblock`. Their historical `/admin/`
prefix does not imply their current role policy: EMA API authorizes all portal
roles for these number actions, including the DELETE unblock alias. Bot and
unauthenticated callers cannot use these Portal endpoints. Staff actor IDs
continue through the backend's existing activity/audit flow.

Country blocking, user administration, notification-number administration and
conversation hiding/clearing retain their existing restrictions. No environment
variable, migration or WhatsApp middleware change is needed. Deploy the EMA API
permission update before the Portal to avoid 403 responses for new agent actions.

Browser check (synthetic sessions and intercepted API requests only):

```powershell
# Start the local Next server first, and supply an external Playwright path if needed.
$env:LEAD_PREVIEW_URL = 'http://127.0.0.1:3107'
node tests/agent-blocking-browser.mjs
```

The test covers all three portal roles, Arabic mobile UI, listing/blocking/
unblocking, hidden admin navigation, direct denial screens for users/countries,
and an agent chat menu that contains only the block action.
