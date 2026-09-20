# Feature Specification: Wallet Top-Up

**Feature ID:** 001-wallet-top-up  
**Status:** Draft — business-rule clarifications resolved with documented assumptions (T002); production-provider selection, pricing, and regulatory limits remain open for human decision  
**Created:** 2026-08-17  
**Updated:** 2026-08-17 (T002)

## Problem Statement

Customers need a safe way to add money to a wallet. The platform must support asynchronous payment confirmation, prevent duplicate credit, maintain an auditable ledger, and provide operators with reconciliation information.

## Scope

### In scope

- Customer top-up initiation and status tracking
- Card/tokenized provider, bank transfer, mobile-money, and agent-cash provider abstractions
- Verified provider webhooks
- Double-entry ledger posting
- Fees, limits, cancellation, expiration, reversal, history, notifications, and reconciliation
- Mock provider for development and automated tests

### Out of scope for the first implementation

- Storing raw card data
- Unlicensed custody or settlement operations
- Cross-currency conversion
- A production provider adapter without official documentation and sandbox credentials
- Regulatory certification or a claim of compliance

## Actors

- **Customer:** Initiates and views top-ups.
- **Agent:** Accepts cash and transfers electronic float to a customer.
- **Payment provider:** Processes external funding and sends status events.
- **Operations user:** Reviews exceptions and reconciliation discrepancies.
- **System worker:** Expires transactions, processes notifications, and reconciles settlements.

## User Stories

### US1 — Customer initiates a top-up (Priority P1)

As an authenticated customer, I want to request a top-up using a supported funding method so that I can add money to my wallet.

**Independent acceptance:** A valid request creates exactly one pending transaction and returns a transaction reference and next action. Repeating the request with the same idempotency key does not create another transaction.

### US2 — Verified payment credits the wallet (Priority P1)

As a customer, I want my wallet credited after the provider confirms payment so that my balance is accurate.

**Independent acceptance:** A verified event completes the transaction and posts one balanced ledger transaction atomically. Duplicate events do not post again.

### US3 — Agent accepts a cash top-up (Priority P1)

As an authorized agent, I want to exchange my electronic float for customer cash so that the customer receives wallet funds.

**Independent acceptance:** With confirmation and sufficient float, the agent float is debited and customer wallet credited atomically; insufficient float causes no balance change.

### US4 — Customer views top-up history (Priority P2)

As a customer, I want to see status, amount, fees, and dates for my top-ups.

**Independent acceptance:** A customer can view only top-ups belonging to an authorized wallet, with pagination and without sensitive funding data.

### US5 — Operations reconciles settlement (Priority P2)

As an operations user, I want mismatches between provider settlement, internal transactions, and the ledger flagged for investigation.

**Independent acceptance:** A rerunnable reconciliation process identifies missing credits, unsupported credits, amount differences, duplicates, fees, and missing reversals.

## Functional Requirements

- **FR-001:** The system MUST accept authenticated top-up requests containing wallet, amount, currency, funding method, funding token/reference when needed, and idempotency key.
- **FR-002:** The system MUST reject non-positive amounts, unsupported currencies or methods, inactive wallets, unauthorized wallets, and configured limit violations.
- **FR-003:** The system MUST calculate gross amount, fee, and net wallet credit using configurable rules.
- **FR-004:** The system MUST create a unique internal reference and initial `Pending` transaction before external processing.
- **FR-005:** The system MUST support `Created`, `Pending`, `Processing`, `RequiresAction`, `Completed`, `Failed`, `Expired`, `Cancelled`, `Reversed`, and `UnderReview` with explicitly allowed transitions per the State Transitions table below.
- **FR-006:** The system MUST call providers through an abstraction supporting initiation, status inquiry, webhook verification/parsing, and reversal where supported.
- **FR-007:** The system MUST verify webhook authenticity and replay controls using the provider's official protocol before changing financial state.
- **FR-008:** The system MUST store provider event identity and process repeated requests/events idempotently.
- **FR-009:** A verified completion MUST atomically post balanced ledger entries, update transaction state, update any balance projection, and create an audit event. If the provider-reported amount or currency does not exactly match the internal transaction, the system MUST NOT auto-complete or post any ledger entry; it MUST instead transition the transaction to `UnderReview` and create an audit event, leaving resolution to FR-017 reconciliation and manual operator action (T002 documented assumption: mismatches are a discrepancy to investigate, never an implicit request to credit a different amount). The `UnderReview` transition itself MUST NOT call the ledger-posting path under any circumstance — this keeps the mismatch path from ever touching posted entries, so it does not conflict with Constitution I's immutability requirement (T003 finding addressed: see Review: T003 in `review-log.md`).
- **FR-010:** Posted ledger entries MUST be immutable and linked to the source transaction.
- **FR-011:** Fees MUST be represented as separate ledger entries/accounts and remain balanced.
- **FR-012:** Agent cash top-up MUST authenticate and authorize the agent, validate customer confirmation, and atomically debit agent float and credit customer wallet. Customer confirmation MUST be a one-time code delivered to the customer out-of-band (T002 documented assumption: reuse the existing SMS-OTP generation/hash/verify pattern in `wallet-backend/handlers/auth.py` — SHA-256 with server-side pepper, short expiry — rather than inventing a new confirmation channel). If the confirmation code expires or the agent cancels before the float transfer commits, the transaction MUST move to `Cancelled` with no float or wallet balance change (see State Transitions table).
- **FR-013:** A reversal MUST create a new linked transaction and compensating entries without changing original ledger entries.
- **FR-014:** A duplicate reversal MUST have no additional financial effect.
- **FR-015:** The system MUST expose authorized top-up detail and paginated history without sensitive funding data.
- **FR-016:** Notifications MUST be queued only after the financial transaction commits; notification failure MUST NOT roll back money movement.
- **FR-017:** Reconciliation MUST compare provider settlement records, internal transactions, ledger entries, fees, and reversals and flag discrepancies.
- **FR-018:** All internal timestamps MUST use UTC.
- **FR-019:** The system MUST emit structured logs, metrics, correlation IDs, and audit events without secrets or sensitive payment data.
- **FR-020:** The system MUST rate-limit customer, agent, and webhook endpoints using policies appropriate to each actor.
- **FR-021:** Agent authorization for a cash top-up MUST be enforced by (a) the agent's authenticated role and active status, and (b) a fresh customer-confirmation code tied to the specific wallet and amount; no pre-linking between an agent and a customer wallet exists or is required. Absent an authenticated agent and a valid, unexpired confirmation code, the request MUST be rejected with no balance or float change.
- **FR-022:** Notification content queued under FR-016 MUST apply the same sensitive-data masking as FR-015 (no raw funding token, card/account number, or provider secret); amount, currency, status, and transaction reference are permitted.

## State Transitions (T002 documented assumption)

No transition table existed prior to T002; this table is a documented assumption grounded in the ten FR-005 states and the edge cases already listed in this spec, not an invented provider behavior. Reviewers should treat it as the source of truth for T007's state machine until superseded.

| From | Allowed To | Trigger |
|---|---|---|
| `Created` | `Pending`, `Failed` | Internal reference persisted → `Pending`; validation/provider-initiation error → `Failed` |
| `Pending` | `Processing`, `RequiresAction`, `Failed`, `Expired`, `Cancelled` | Provider accepted → `Processing`; provider needs customer step → `RequiresAction`; provider rejected → `Failed`; timeout → `Expired`; customer/agent cancel before provider confirmation → `Cancelled` |
| `Processing` | `Completed`, `Failed`, `UnderReview`, `Expired` | Verified webhook/confirmation with matching amount/currency → `Completed`; verified failure → `Failed`; verified but amount/currency mismatch (see FR-009 amendment below) → `UnderReview`; timeout with no terminal event → `Expired` |
| `RequiresAction` | `Processing`, `Failed`, `Expired`, `Cancelled` | Customer completes the required action → `Processing`; provider reports failure → `Failed`; action window elapses → `Expired`; customer/agent cancels → `Cancelled` |
| `Completed` | `Reversed` | Reversal workflow only (FR-013); `Completed` MUST NOT transition to `UnderReview`, `Failed`, or any other state — ledger entries are immutable per Constitution I |
| `Failed`, `Expired`, `Cancelled` | *(none)* | Terminal; no ledger posting ever occurred (SC-003) |
| `UnderReview` | `Completed`, `Failed` | Operator resolves the flagged mismatch after manual reconciliation; resolution MUST still go through the normal atomic ledger-posting or no-op path — `UnderReview` itself never posts |
| `Reversed` | *(none)* | Terminal for the original transaction; a duplicate reversal request has no additional effect (FR-014) |

**T034b amendment (requires independent review; approved in principle by the human owner 2026-09-19).** The table above is unchanged. What changes is how verified provider events are applied, because real providers do not always emit an intermediate event and may deliver events out of order or repeatedly:

- A verified provider `Processing` or `RequiresAction` event advances the top-up (`Pending` -> `Processing`, `Pending` -> `RequiresAction`, `RequiresAction` -> `Processing`) and moves no money. An event that would be a backwards or sideways move (for example `RequiresAction` after `Processing`, a repeated `Processing`, or any event for a terminal top-up) is a no-op, never an error and never a regression.
- A verified completion (or failure) for a top-up still in `Pending` or `RequiresAction` is accepted: the implied `Processing` transition is applied first, in the same atomic transaction, then the terminal one. If anything after that fails, the whole transaction rolls back, including the implied hop. `Pending` -> `Failed` was already allowed by the table ("provider rejected") but the implementation refused it; it now honors the table. A top-up in `Created` still accepts neither.
- A provider-amount or currency mismatch on such a top-up still routes to `UnderReview` with no ledger posting (FR-009).

**Webhook response contract (T034b).** Providers such as Stripe redeliver on any non-2xx and stop on any 2xx, so the status is part of the financial contract: `202` handled, authentic-but-ignored, or exact duplicate; `401` signature did not verify; `400` payload unusable or provider unsupported; `404` verified event for an unknown top-up (not acknowledged, so the provider retries instead of dropping it); `503` provider not configured (fail closed); `500` failure on our side. `mock` is not served when `APP_ENV=production`.

**Concurrent completion/cancellation (edge case):** the transaction row lock at completion time is authoritative. Whichever event (verified completion or cancellation) acquires the lock first and observes a non-terminal state wins; the loser sees an already-terminal state and takes no financial action. This follows from Constitution III (atomicity) and does not require a new mechanism beyond the row locking already used elsewhere in `wallet-backend`.

## API Behavior

The implementation plan MUST adapt routes to existing project conventions while preserving these operations:

- `POST /api/wallets/{walletId}/top-ups`
- `GET /api/wallets/{walletId}/top-ups/{topUpId}`
- `GET /api/wallets/{walletId}/top-ups`
- `POST /api/wallets/{walletId}/top-ups/{topUpId}/cancel`
- `POST /api/webhooks/payments/{providerName}`
- `POST /api/agents/top-ups`

### Provider-backed initiation (T034c)

For `card` and `bank_transfer` (USD, Stripe), `POST /wallets/{walletId}/top-ups` records the `Pending` top-up and commits it, then creates the provider payment (a Stripe PaymentIntent) and stores its id in `provider_transaction_reference`. The response's `next_action` is `confirm_with_provider` carrying `provider` and a `client_secret`; the customer's device completes the payment with the provider's SDK, so card numbers, bank details and mandate acceptance never reach this backend (Constitution IV). Creating or confirming a payment credits nothing: only a verified webhook completes a top-up (Constitution II).

- **Secret handling.** The `client_secret` can complete a charge. It appears only on the initiation response (including an idempotent replay of it), is never stored, never appears on detail or history responses (FR-015), is excluded from `repr()`, and clients MUST NOT log or persist it.
- **Idempotency and duplicate payments.** The provider idempotency key is the top-up's unique internal reference, never the client's `Idempotency-Key` (client keys are per wallet; Stripe's are account-wide). A replay of a top-up that already has a provider payment re-fetches its secret and MUST NOT create another payment (a second one could be charged with nothing to credit). A replay of a `Pending` top-up that never got one finishes initiation.
- **Failure handling.** The provider definitively refusing the request fails the top-up (`Pending -> Failed`, `failure_code` `provider_rejected`, no `next_action`). An unreachable provider or unknown outcome answers `503 provider_unavailable`, leaves the top-up `Pending` with no provider payment, and retrying with the same `Idempotency-Key` is safe.
- **Fail closed, and validated.** `STRIPE_WEBHOOK_SECRET` must be a Stripe signing secret (`whsec_...`, per Stripe's documentation) and `STRIPE_SECRET_KEY` a secret or restricted key (`sk_`/`rk_`); any other value (a publishable key in the wrong slot was supplied once) is refused because it can never authenticate a webhook. Initiation and the webhook route normalize surrounding whitespace identically and reject identically, so payments can never start while every webhook would be refused. Initiation requires both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (never create a payment the system could not later confirm). Without a key: development keeps the legacy Pending-only behavior, production answers 503. A live (`sk_live_`) key outside production is refused. `agent_cash` and `mobile_money` never reach the provider.
- **Cancellation.** Cancelling a top-up that has a provider payment cancels that payment at the provider FIRST; the local record becomes `Cancelled` only after the provider confirms it is cancelled (cancelling an already-cancelled payment counts as success). If the provider says it can no longer be cancelled (`succeeded`/`processing`), the provider is unavailable, or no provider is configured, the cancel is refused (`409 invalid_state` / `503 provider_unavailable`) and the top-up is left as it was, because a payment that cannot be proven cancelled may still be charged and a later verified success would find a terminal `Cancelled` top-up. No provider call is made while a row lock is held.
- **Events (Stripe).** The endpoint (or `stripe listen --events`) must subscribe to `payment_intent.processing`, `payment_intent.requires_action`, `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.canceled`. `succeeded` completes; `processing`/`requires_action` advance; `payment_failed` is a failed attempt (audited, top-up unchanged); `canceled` fails the top-up. Any other authentic event type is acknowledged and ignored.
- **Not in this task.** Stripe Customer objects and saved/reusable payment methods (a one-time PaymentIntent needs neither), ACH mandate display and verification (T034d), card confirmation on the device (T034f), and status inquiry (`get_status`).

## Edge Cases

- Provider accepts payment but webhook delivery is delayed.
- The same webhook is delivered concurrently to multiple workers.
- The client retries after a timeout with the same idempotency key.
- Same idempotency key is reused with different request data.
- Provider amount/currency differs from the internal transaction.
- Completion and cancellation arrive concurrently.
- Reversal occurs after the customer spends the credited funds.
- Agent float changes between validation and commit.
- Notification or reconciliation infrastructure is unavailable.

## Success Criteria

- **SC-001:** A repeated request/event produces no duplicate wallet credit in all automated concurrency tests.
- **SC-002:** Every completed top-up has balanced debits and credits in the same currency.
- **SC-003:** Failed, expired, and cancelled top-ups make no wallet-credit ledger posting.
- **SC-004:** 100% of protected API authorization tests prevent cross-wallet access.
- **SC-005:** Reconciliation detects every seeded discrepancy in the integration test dataset.
- **SC-006:** No secrets, raw card data, PINs, or OTPs appear in persisted records or captured test logs.

## Clarifications (T002)

Per Constitution V, each item below is either resolved with a documented assumption grounded in the existing `wallet-mobilenext`/`wallet-backend` codebase (T001 discovery), or left as `[NEEDS CLARIFICATION]` because resolving it would mean inventing financial, pricing, regulatory, or production-provider behavior that does not exist anywhere in either repository today. No item below invents provider signature algorithms, production endpoints, or pricing.

### Resolved with documented assumption

- **Target backend stack and repository architecture** — Resolved by T001: FastAPI/Python 3.12, PostgreSQL via SQLAlchemy async/Alembic, at `C:\projects\repos\wallet-backend`, called from this Expo client over `EXPO_PUBLIC_API_URL`. See `plan.md` Technical Context.
- **Supported currency set and minor-unit rules** — Assumption: a top-up MUST be denominated in the target wallet's own `currency` (no cross-currency conversion, matching the existing out-of-scope item). Minor-unit precision reuses the existing backend convention — `Numeric(18,2)` with half-up rounding via `services/wallet_policy.py` — applied uniformly to all currencies. **Known limitation, not resolved by this assumption:** this is factually imprecise for zero-decimal ISO 4217 currencies already in use (e.g. `XOF`, the default `wallets.currency`) and is an existing inherited property of the backend, not something introduced or fixed here; flagged for the human owner rather than silently changed.
- **Fee mechanism (not fee values)** — Assumption: top-up fees follow the same configurable rule shape already used for transfers (`wallet-backend/models/fee_rule.py`: rate + flat + min/max clamp, priority-ordered, currency/amount filters), and — consistent with FR-003's existing "net wallet credit" wording — the fee reduces the customer's wallet credit rather than increasing the amount charged at the funding source. The actual rate/flat/min/max **values** for top-up are a pricing decision and remain `[NEEDS CLARIFICATION]`.
- **Limits (mechanism, not values or KYC tiers)** — Assumption: top-up limit enforcement reuses the existing per-wallet `daily_limit`/`monthly_limit`/`daily_spent`/`monthly_spent` fields (`wallet-backend/models/wallet.py`); there is no weekly limit field and no KYC-tier field today, so the first implementation MUST NOT assume tiered limits exist. Whether KYC tiers are required and the actual limit **values** are regulatory/business decisions and remain `[NEEDS CLARIFICATION]`.
- **Customer confirmation mechanism for agent deposits** — Resolved; see FR-012 amendment above (reuse of the existing SMS-OTP pattern, with expiry/cancel outcome defined in the State Transitions table).
- **Agent authorization boundary** — Resolved; see new FR-021. No agent-to-wallet pre-linking exists in the schema (`Agent` has no wallet/customer link), so the confirmation code itself — not a pre-existing relationship — is the authorization boundary.
- **Notification channel (first implementation)** — Assumption: use only the existing in-app `Notification` record (`wallet-backend/models/notification.py`: type/title/message/data, queued post-commit) for the first implementation; SMS/push delivery for top-up events specifically is not required now. Content masking is resolved by new FR-022.
- **State transitions** — Resolved; see the new State Transitions table and FR-009 amendment (provider amount/currency mismatch routes to `UnderReview`, never an implicit auto-adjustment).

### Human decision (2026-09-19)

- **US funding scope and provider:** for US customers, a wallet MUST be fundable from a debit card, a credit card, and a bank account (`funding_method` `card` and `bank_transfer`, currency `USD`). The human owner chose **Stripe** as the US provider. Stripe's webhook signature scheme and sandbox credentials are still required before the adapter is written (T034); this decision does not authorize inventing either.

- **ACH crediting (decided 2026-09-19):** an ACH top-up is credited when Stripe reports `payment_intent.succeeded` (its documented fulfillment signal), with no additional hold. The human owner accepts the resulting return/clawback risk. Consequences that are still open are listed below (what happens when a return arrives after the funds are spent, and any per-customer ACH limits). T034a already implements this mapping.
- **Bank funding uses Stripe's flow only (decided 2026-09-19):** bank (ACH) top-ups MUST be collected, mandate-authorized and verified through Stripe's own collector (`collectBankAccountForPayment` / `confirmPayment`). The app MUST NOT offer a manually entered bank account as a top-up funding source, and this system MUST NOT take a routing/account number for top-up funding (Constitution IV). Scope: this applies to top-ups only. The existing manual bank form is still used by Send Money's separate ACH path (`SendMoneyScreen` `savedACH`, `/ach/debit`); whether to retire it there is a separate decision (it also stores a routing number, which Constitution IV disfavors).

- **Declined card and retry (decided 2026-09-19, option A):** a failed payment ATTEMPT does not end a top-up. Providers such as Stripe report every failed attempt (a declined card) while leaving the payment payable, so the customer retries on the same top-up and a later verified success credits it. A failed attempt is audited (`topup_payment_attempt_failed`, with a sanitized provider error code, never the message) and leaves the top-up in its current state. A top-up becomes `Failed` only when the provider reports the payment cancelled (`payment_intent.canceled`). Found in the first real end-to-end run: treating the attempt as terminal `Failed` left a retried payment charged ($3.00) and never credited. Bank (ACH) debits have their own rule, see "Failed bank debit" below.

- **Bank (ACH) mandate wording (decided 2026-09-19):** the app displays Stripe's recommended authorization text VERBATIM (https://docs.stripe.com/payments/ach-direct-debit, "Collect mandates") and the customer must accept it before the payment is confirmed. The business name and terms link are read from configuration (`EXPO_PUBLIC_MANDATE_BUSINESS_NAME`, `EXPO_PUBLIC_TERMS_URL`); the bank option stays disabled unless BOTH are set, so nothing can ship without real values. A clearly fake placeholder is used for local testing only. **Counsel must approve the real wording, name and terms before production**; that approval is a release gate (T032), not something this system decides. Top-ups are one-time (no reusable authorization), so only the one-time paragraph is shown.
- **Bank verification (decided 2026-09-19):** allow both Stripe methods (its default): instant verification through the customer's bank login (Financial Connections) with a microdeposit fallback (1-2 business days, verified by a code the customer receives, 10-day timeout).
- **Bank linking needed a newer Stripe native library (found 2026-09-19, resolved 2026-09-20 by tasks.md T034j).** With `@stripe/stripe-react-native` 0.37.2 (native Stripe Android 20.40.4) Stripe's bank-linking sheet failed to start because the consent-screen field `data_access_notice` was required there and is optional from 20.41. The SDK is now pinned to 0.37.3 (native 20.41.1) and the bank flow was verified on an Android emulator (`expo.install.exclude` keeps Expo tooling from reverting the pin). The bank option is still disabled unless `EXPO_PUBLIC_MANDATE_BUSINESS_NAME` and `EXPO_PUBLIC_TERMS_URL` are set, which must not happen for a release until counsel approves the wording (T032). iOS is not verified.
- **Failed bank debit (decided 2026-09-19):** for a `bank_transfer` top-up a failed debit (`payment_intent.payment_failed`, which can arrive days later: insufficient funds, closed account, failed microdeposit verification) ENDS the top-up as `Failed`, and the Stripe payment is cancelled so it cannot be paid later. A retry is a NEW top-up with a new authorization. Cards keep their own rule (a failed attempt is recorded and the customer retries on the same top-up). Cancelling the Stripe payment is best effort after the top-up is durably `Failed`; if it fails, an audit record is written, and a later verified success would be flagged by the late-success audit (`topup_late_success_on_terminal_top_up`).

### Still needs clarification (human/business/regulatory decision — not resolved here)

- [NEEDS CLARIFICATION] Stripe **webhook signing secret** (`whsec_...`). A sandbox secret key was supplied 2026-09-19 and verified (US account, USD, card and ACH payments active), but the value supplied as the webhook secret was a publishable key (`pk_test_...`), which cannot verify webhooks. A real `whsec_` comes from a registered endpoint (needs a public HTTPS URL and the T034b route) or from `stripe listen` (Stripe CLI, not installed here). Until then T034a has only been proven against locally signed payloads. Mock-first per `plan.md` still applies to anything that would credit a wallet.
- [NEEDS CLARIFICATION] **ACH returns after credit** (crediting itself is decided, see above). Stripe facts (https://docs.stripe.com/payments/ach-direct-debit): an account holder can dispute for up to 60 calendar days on a personal account (2 business days on a business account), disputes are final with no appeal, and in rare cases the bank's failure arrives *after* `succeeded` as a dispute (`insufficient_funds`, `incorrect_account_details`, `bank_cannot_process`) with a Stripe failure fee. Still open: what happens when a return arrives after the customer has spent the funds (ties to the overdraft `[NEEDS CLARIFICATION]` above; the interim default there blocks an automatic reversal and audits it for operator follow-up), and whether ACH top-ups get their own per-customer limits given the risk now accepted. T034e may proceed under the interim default once T019 is approved.
- [NEEDS CLARIFICATION] **Money received for a top-up that can no longer be credited.** A verified provider success can still arrive for a top-up that is `Cancelled`, `Failed` or `Expired` (cancelled before the T034g fix, or a race). Today it is neither credited nor refunded: the state stays terminal (the table forbids leaving terminal states), an error is logged, and an audit record `topup_late_success_on_terminal_top_up` is written so an operator, and the reconciliation job (T023), can find it. Decide the policy: automatic refund through the provider, an operator-driven refund/credit with its own audited path, or routing to `UnderReview` (which would need a reviewed change to the transition table). No refund behavior is implemented until decided.
- [NEEDS CLARIFICATION] Card funding limits and fees for debit vs credit cards. Whether credit-card funding is permitted at all, and at what fee, is a pricing/risk decision (card networks classify some wallet loads paid by credit card as cash-advance-like).
- [NEEDS CLARIFICATION] Actual fee rate/flat/min/max values for top-up (mechanism above is resolved; values are pricing policy).
- [NEEDS CLARIFICATION] Whether KYC tiers are required for top-up and the actual daily/monthly (and any weekly) limit values.
- [NEEDS CLARIFICATION] Whether a reversal is ever permitted to drive a wallet balance negative (overdraft policy) when the customer has already spent the credited funds. **Interim safe default assumption**, consistent with Constitution I/III and `tasks.md` T019's "insufficient-balance policy hook" framing: if the current balance is insufficient to reverse in full, the system MUST block the automatic reversal rather than allow a negative balance. **T019 implementation note (resolves a wording conflict in this same clarification, 2026-08-23):** this bullet's original text said a blocked reversal should "route the transaction to `UnderReview`" — but the State Transitions table above is explicit that `Completed` MUST NOT transition to `UnderReview` (or anything but `Reversed`), since its ledger entries are already posted and immutable per Constitution I. `T019` follows the table, not this bullet's looser prose: a blocked reversal leaves the original `Completed` and untouched, and instead writes an audit-log entry (`topup_reversal_blocked_insufficient_balance`) for manual operator follow-up. This default MUST be implemented behind a policy hook (`services/topup/reversal.py`'s `policy_hook` parameter, threaded through `services/topup/reversal_workflow.py`) so a human-approved overdraft policy can later replace it without changing ledger core logic.
- [NEEDS CLARIFICATION] Which actor may trigger a reversal, and its HTTP contract (route, request/response shape, idempotency key). No user story or endpoint table in this spec names one — only FR-013/FR-014's ledger-level behavior. `T019` implements the DB-integrated workflow function (`services/topup/reversal_workflow.py`'s `reverse_completed_topup()`) that FR-013/FR-014 actually govern, but deliberately does not invent an HTTP route or admin-authorization contract for it, per CLAUDE.md's "Do not invent provider signature algorithms or production endpoints" instruction extended to the same spirit for un-specified internal endpoints. The "Operations user" actor (line 36) is the likely caller, mirroring `handlers/admin.py`'s existing `verify_admin_token` pattern, but that wiring needs an explicit decision (and its own task) before it is built.
- [NEEDS CLARIFICATION] Reconciliation input format (provider settlement file/API shape). This is inherently dependent on the production provider decision above; the mock provider MUST instead use a deterministic mock settlement export fixture for reconciliation tests (FR-017, SC-005) until a real provider is chosen.

