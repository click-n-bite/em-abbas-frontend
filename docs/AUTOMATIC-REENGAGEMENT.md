# Automatic re-engagement UI

Requires the coordinated EMA API migration and bridge delivery ledger. The portal
keeps the original bubble while it waits and while it is automatically resent.
Queue metadata and error reasons are merged from both HTTP and live events; older
delivery versions do not regress a newer attempt.

A known closed customer window shows a composer notice. Sending remains enabled
because the bridge queues the original and attempts the configured approved
template. There is no manual template selector in this change.

Waiting, resending, expired, and unknown-outcome sends have distinct English/Arabic
labels. An original message can link to its separate automatic template bubble,
whose own delivery/failure status must be inspected. Waiting does not mean a
template was delivered, and template acceptance does not reopen the window.

Before rollout verify: unknown/open/closed windows; a text and voice queued outside
the window; template acceptance and later rejection; customer reply; original
bubble delivery without a duplicate; failed/expired queues; reconnect/catch-up
with out-of-order delivery versions. Configure the approved template on the
bridge only after Meta approves it. Missing request variables are not collected
by this UI and must come from the original request integration.
