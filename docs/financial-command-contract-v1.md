# Financial command contract v1

Status: implementation contract, 2026-09-05. Deploy only with the coordinated backend and Local Agent release below.

## Ownership and compatibility

POS sends physical financial operations to its paired Local Agent. A remote backend URL is not a fallback for payment, fiscal registration, refund, expense, or shift mutations.

Before a new command or an authorized command retry, POS requires `GET /system/status` to return `status.agent.financialCommandVersion: 1`. Missing capability, an old Agent, or unavailable status blocks POST and tells the operator to update/reconnect the Agent. A semantic version alone does not authorize the operation.

The coordinated release requires backend durable inbox event version 2 and Local Agent financial command version 1 with schema 7. Backend migrations/inbox support must be installed before the Agent produces v2 events. Deploy the capable Agent before this POS build. Preserve Agent database and fiscal service data during updates; restarting must recover unfinished command state. Verify these capabilities against the built artifacts, not source branch names.

## Immutable command

POS stores a UUID command ID, endpoint, owner origin, canonical original JSON body, SHA-256 of that body, and creation time in browser storage **before POST**. Its storage scope is terminal + restaurant + signed-in user + endpoint. Storage failure or damaged payload blocks execution. Sensitive session credentials are not stored in this record.

Each POST includes `X-Edge-Operation-ID`. Retries use the same ID and original payload. Changing amount, tender, manual override, notes, or quote while a command remains unresolved is blocked. The Agent computes its own canonical request hash, including method and path. POS does not send a hash header with a different canonicalization scheme.

One active command per scope is serialized with browser locks when available and with an in-process lock. Different users do not recover each other's commands. An owner-origin change requires reconnecting to the original owner. The Agent's durable journal is authoritative; clearing browser storage is not a recovery procedure.

## Lookup and recovery

`GET /pos/financial-commands/{operationId}/` returns:

```json
{
  "commandId": "pos:uuid",
  "state": "unknown",
  "stage": "fiscal",
  "responseStatus": 409,
  "response": { "code": "EXAMPLE", "detail": "Original endpoint response" },
  "retryAllowed": true,
  "manualConfirmationAllowed": false
}
```

| Result | POS behavior |
| --- | --- |
| `succeeded` with original 2xx response | Recover the original result without executing again. |
| `failed` | Display confirmed failure and original business error; a subsequent corrected attempt may use a new ID. |
| `processing` / `unknown` | Preserve command, display unknown outcome, query status. Retry only when the Agent explicitly permits it, with the same ID/body. |
| HTTP 404 + exact `FINANCIAL_COMMAND_NOT_FOUND` | Preserve ID; explicit recovery may resend the same original command after capability check. |
| Generic 404, unavailable lookup, malformed success | Preserve unknown state. Do not infer that execution never happened. |

POST errors may contain `financialCommand` metadata without `responseStatus` or `response`. POS keeps the enclosing HTTP status and original body, including business codes such as `SERVICE_FEE_QUOTE_STALE`. A transport error alone never means confirmed financial failure.

Payment and shift pages check saved commands on reload without mutation. The operator's status action may continue an Agent-authorized retry. Fiscal retry for an existing payment uses its own endpoint and the Agent's payment-owned receipt/TXID intent. It must not charge the card again. Manual card completion is visible only for a confirmed payment-stage failure with explicit `manualConfirmationAllowed: true`; current Agent v1 always returns false.

## Financial visibility

Unknown fiscal outcomes are distinct from failed receipts, and incomplete fiscal retry responses cannot show success or printing. `closing` is a close barrier. `closed-local` / `closed_local` with `closeState: closed_local` and `syncState: pending` means the shift is durably closed on the device and awaits server projection. `pendingClosedShifts` remains visible and cannot be closed again.

Backend outbox health and OFD receipt queue health are separate. A missing fiscal count is shown as unknown. Financial unknowns, operator actions, quarantine, and stale/unavailable fiscal queue reads remain visible in the health badge even when routine pending sync is suppressed.

## Release verification

- Replay lost HTTP responses with the original command ID, including a page reload and Agent restart; assert one terminal/fiscal side effect.
- Reject changed payload, missing capability, generic status 404, unavailable storage, malformed success, and remote financial fallback before any new POST.
- Test unknown card result, fiscal timeout after registration, confirmed decline, cash/card/mixed payments, partial payment continuation, refund evidence identity, and shift close blocked by unresolved financial work.
- Close with WAN unavailable, retain local report and pending-sync status, restart, replay payment/refund/close facts into the original cloud shift, and require matching totals before cloud closure.
- Require backend durable-receipt versus applied status and replay dependencies to agree with the Agent. A durable receipt acknowledgement is not permission to forget unresolved evidence or repeat physical work.
- Build/type-check/test the three components together, then verify one complete POS flow in a real browser against the built Agent and fiscal HTTP emulator. Hardware field validation remains a separate release gate.

Browser storage cannot protect against disk loss or an operator clearing site data. The Agent journal and fiscal service database must survive upgrades. The vendor's same-TXID retry guarantee must not be extended to fiscal service database loss without evidence.
