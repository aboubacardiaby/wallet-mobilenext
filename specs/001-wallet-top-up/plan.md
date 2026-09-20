# Implementation Plan: Wallet Top-Up

**Status:** Repository discovery complete (T001); amended with backend repository discovery
**Spec:** `spec.md`

## Technical Context

- **Repository topology:** This feature spans two sibling repositories: this Expo mobile client at `C:\projects\repos\wallet-mobilenext` and the authoritative API at `C:\projects\repos\wallet-backend`. Mobile UI and API consumption belong here; provider webhooks, ledger posting, transactional idempotency, reconciliation, authorization, and persistence migrations belong in `wallet-backend`.
- **Language/framework:** JavaScript with JSX on React 18.2 and React Native 0.74.5, managed by Expo SDK 51. TypeScript 5.3 is installed for dependency/tooling compatibility, but application source is JavaScript. React Navigation 6 provides native-stack and bottom-tab navigation. Native shells contain Kotlin/Gradle for Android and Objective-C/Objective-C++ plus CocoaPods for iOS.
- **Backend language/framework:** Python 3.12 container, FastAPI 0.115.5, Pydantic 2.9.2, Uvicorn 0.32.1, and HTTPX 0.27.2. `main.py` registers `/api/v1` routers from `handlers/`; business/provider helpers live in `services/`; SQLAlchemy declarations live in `models/`; runtime/database configuration lives in `config/`; cross-cutting auth and rate limiting live in `middleware/`.
- **Database/ORM:** PostgreSQL 12+ through SQLAlchemy 2.0 async sessions and asyncpg, with psycopg2 available for synchronous migration tooling. Alembic 1.14 migrations currently run from `0001` through `0017`; ORM models are the stated schema source of truth and `sql/schema.sql` is a generated empty-database bootstrap. The app also calls `Base.metadata.create_all()` at startup for missing tables, which must not substitute for reviewed top-up migrations. AsyncStorage in the mobile repository remains device-local session/preference storage only.
- **Authentication/authorization:** The client calls backend `auth/register`, `auth/verify-otp`, `auth/login`, refresh, and PIN/profile endpoints. The backend issues and verifies HS256 JWT bearer tokens using `JWT_SECRET`; PINs/admin passwords use bcrypt, OTP codes are SHA-256 hashed with a configured pepper, and refresh tokens are persisted. `verify_token`, `verify_admin_token`, and role dependencies are the established FastAPI authorization mechanisms. Existing user-scoped handlers derive the user UUID from JWT `sub`; top-up routes must additionally enforce wallet ownership and agent boundaries server-side.
- **API client:** Axios 1.7 with JSON requests. Base URL comes from `EXPO_PUBLIC_API_URL`, falling back to `http://10.0.0.72:8080/api/v1/`. Endpoint strings are generally relative to that `/api/v1/` base.
- **Payment/provider clients:** Stripe React Native 0.37.2 tokenizes card details in native `CardField`; the app submits Stripe payment-method identifiers to external `stripe/pay` and `payment-methods/card` endpoints. Wallet/mobile-money/cash delivery uses external `transfer/*` endpoints and provider definitions in `src/data/walletProviders.js`. `.env.example` also documents a separate Wave payout mock API, but that .NET project is not in this checkout.
- **Backend tests and commands:** Tests use Python `unittest` classes and mocks and are collected by pytest (10 tests covering runtime policy, Decimal wallet arithmetic, row locking, and handler allowlisting). From `wallet-backend`, use `python -m pytest -q` for the suite; the T001 discovery run produced 1 failure and 9 passes because the ACH credit test double lacks the handler's current `flush()` method. Install runtime dependencies with `python -m pip install -r requirements.txt`. Pytest is not pinned in `requirements.txt` and the Cloud Run workflow only builds the image, so CI/test dependencies and a test job must be made explicit before relying on this gate.
- **Mobile tests and commands:** No Jest, React Native Testing Library, Detox, test files, or test script is configured. `npm test --if-present` and `npm run lint --if-present` are CI no-ops today. Android's Fastlane `test` lane invokes Gradle `test`, but no repository-owned native test sources were found.
- **Available development commands:** `npm start`, `npm run android`, `npm run ios`, and `npm run web`. On Windows environments that block `npm.ps1`, use the equivalent `npm.cmd` commands. Dependency installation is `npm ci` from `package-lock.json`.
- **Build/deployment:** Expo/Metro and native Gradle/CocoaPods build the client; GitHub Actions deploys Android through Fastlane to Google Play. The backend Dockerfile runs one Uvicorn worker on port 8080 and GitHub Actions builds/pushes the image and deploys `kalipeh-wallet` to Google Cloud Run. Cloud Run injects `DATABASE_URL`, `JWT_SECRET`, `APP_ENV`, and CORS configuration.
- **Provider:** Mock first; production provider requires official documentation, sandbox credentials, and a backend repository/service boundary.

## Repository Architecture and Existing Patterns

The application is organized by UI responsibility rather than backend clean-architecture layers:

1. **Bootstrap/navigation:** `index.js`, `App.js`, and `src/navigation/index.js` compose Expo, context providers, authentication flow, native stacks, and tabs.
2. **Screens/components:** `src/screens/*.jsx` owns presentation and currently performs orchestration/API calls directly; `src/components/*.jsx` contains reusable UI.
3. **Client state:** React hooks and `src/context/AuthContext.js` manage in-memory screen/session state. AsyncStorage persists the bearer token, serialized user, and preferences.
4. **API boundary:** `src/api/client.js` is the shared Axios instance and authentication interceptor. Feature hooks under `src/hooks/` wrap recurring reads such as wallet balance, transactions, recipients, quotes, countries, and payment methods.
5. **Static integration metadata:** `src/data/` defines currencies, regions, countries, and mobile-wallet providers/endpoints.
6. **Native/deployment:** `android/`, `ios/`, `.github/workflows/android-release.yml`, and `android/fastlane/` contain platform build and release integration.

Client-side balance checks and validation are usability aids only and cannot satisfy the specification's financial invariants or authorization requirements.

### Backend architecture (`C:\projects\repos\wallet-backend`)

1. **Application composition:** `main.py` configures lifespan/database startup, CORS, rate limiting, health/readiness, and all `/api/v1` routers.
2. **HTTP handlers:** `handlers/*.py` combines Pydantic request/response models, authorization dependencies, orchestration, SQL queries, and transaction commits. This is the established controller boundary, although financial orchestration should be extracted into services to keep provider logic out of handlers.
3. **Services:** `services/` contains Decimal wallet policy, ACH, card/Talence, Stripe, Wave, SMS, and Twilio integrations. `services/wallet_policy.py` quantizes monetary operations to `Decimal("0.01")` with half-up rounding.
4. **Persistence:** `models/` contains SQLAlchemy declarative models; `config/database.py` owns the async engine/session; `alembic/versions/` owns migration history; PostgreSQL row locks (`with_for_update`) are already used by sensitive wallet mutations.
5. **Security/operations:** `middleware/auth.py`, `middleware/ratelimit.py`, `utils/audit.py`, environment configuration, Docker, and Cloud Run deployment provide the current cross-cutting foundation.

Current persistence has `Wallet`, `Agent`, and a generic `Transaction` plus audit/notification/payment-method/configuration tables. It does not contain immutable ledger transaction/entry tables, dedicated top-up/provider-event/reversal/reconciliation/outbox tables, or database-enforced top-up idempotency constraints.

## Constitution Check

| Gate | Plan response |
|---|---|
| Ledger integrity | Immutable double-entry posting service with balance invariant |
| Server verification | Backend confirmation only; signed webhook or trusted internal transfer |
| Atomicity | Single database transaction for state, ledger, and balance projection |
| Idempotency | Unique keys plus transactional conflict handling |
| Test-first controls | Contract/integration tests precede financial implementation |
| Independent review | Cross-agent review recorded in `review-log.md` |
| Recoverability | Forward/rollback migration procedure documented |

## Required Cross-Repository Architecture Boundaries

Backend work targets `C:\projects\repos\wallet-backend`; client work targets this repository. Backend-only tasks must not be implemented in the mobile client.

1. **API layer:** Authentication, authorization, DTO validation, correlation IDs, and response mapping.
2. **Application layer:** Top-up orchestration, status transitions, limits, fees, idempotency, and use cases.
3. **Domain layer:** Money, top-up state machine, ledger invariants, and business rules.
4. **Infrastructure layer:** Persistence, provider adapters, queues, notifications, reconciliation import, metrics, and secrets.

Provider-specific code MUST remain outside controllers and core ledger logic.

## Proposed Backend Components (To Add in `wallet-backend`)

- `TopUpService`
- `LedgerPostingService`
- `TopUpStateMachine`
- `PaymentProvider` interface
- `MockPaymentProvider`
- `WebhookProcessor`
- `AgentCashTopUpService`
- `ReversalService`
- `ReconciliationService`
- `NotificationOutbox` or equivalent post-commit publisher

Adapt names to the existing Python layout: HTTP contracts/routes under `handlers/`, orchestration and provider abstractions under `services/`, persistence under `models/`, and revisions under `alembic/versions/`. Only mobile presentation, API-contract consumption, and safe tokenized payment collection belong in this repository.

## Existing Integration Points

- **Wallet reads:** `wallet/balance` and paginated `wallet/transactions` are consumed by dashboard, transaction, and transfer flows.
- **Authentication/profile:** `auth/register`, `auth/verify-otp`, `auth/login`, `user/pin`, and `user/profile` establish and refresh the client session.
- **Funding methods:** `payment-methods`, `payment-methods/card`, `payment-methods/bank`, `payment-methods/paypal`, and `payment-methods/digital-wallet` manage external representations of payment methods. Raw card details remain inside Stripe's SDK field.
- **Card funding:** Backend `handlers/payment.py` exposes `payment-methods/card`, `payment-methods/card/pay`, and `stripe/pay`, delegating to card/Talence services. Existing flows can lock and credit a wallet and create a generic transaction, but they are not the spec's asynchronous, webhook-verified, ledger-backed top-up workflow.
- **Transfers/providers:** `transfer/quote`, `transfer/send`, `transfer/wave`, `transfer/cash-pickup`, `transfer/agents`, and provider-specific endpoints from `walletProviders.js` are existing adjacent contracts. They are transfer-oriented, not the top-up routes specified in `spec.md`.
- **Existing top-up/funding APIs:** Backend `POST /payment-methods/{pm_id}/top-up` is explicitly simulated and development-gated by `ALLOW_SIMULATED_FUNDING`; `POST /ach/debit` and `POST /ach/credit` integrate an ACH service. These routes mutate the balance projection and generic transaction records but do not satisfy the new state-machine, ledger, webhook, reversal, or reconciliation requirements.
- **Cash/agent:** Backend `cash/in`, `cash/out`, `agents/nearby`, `transfer/agents`, and `transfer/cash-pickup` are the existing contracts. They provide an integration starting point but do not model agent electronic float or the customer-confirmation invariant required by FR-012.
- **Provider services:** `services/ach.py`, `card_payment.py`, `stripe_payment.py`, `wave.py`, and `wave_processor.py` are existing adapters/helpers. No inbound payment webhook route or persisted provider-event replay control was found.
- **Notifications/receipt:** `notifications/*` and the configurable `EXPO_PUBLIC_RECEIPT_EMAIL_ENDPOINT` call the external API.
- **Configuration:** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_WAVE_API_URL`, `EXPO_PUBLIC_WAVE_API_KEY`, and `EXPO_PUBLIC_RECEIPT_EMAIL_ENDPOINT` are documented. A value prefixed `EXPO_PUBLIC_` is bundled into the client and therefore must never contain a production secret; the documented Wave API key is suitable only for a local mock.

The dedicated top-up routes in `spec.md` do not currently exist in either repository. They should be added under the backend's `/api/v1` router convention and then consumed through the mobile Axios client.

## Data Model

### Existing backend foundation

- `wallets`: one wallet per user, `NUMERIC(18,2)` balance/limits/counters, currency and status; row locking is used by existing mutations but there is no version column.
- `agents`: user link and operational cash-in/cash-out limits; no electronic-float balance.
- `transactions`: unique reference, type/status, parties, amount/fee/total/currency, agent and JSON metadata; this is a mutable operational record, not a double-entry ledger.
- `payment_methods`, `notifications`, `audit_logs`, fee/rate configuration, users/auth, and provider configuration support adjacent behavior.

### Required additions

- Wallet and/or account balance projection with concurrency token
- Top-up transaction
- Ledger transaction and ledger entry
- Provider webhook event
- Reversal relationship
- Reconciliation record
- Notification outbox record if the project does not already offer reliable post-commit messaging

Required uniqueness includes idempotency key scope, provider event ID, provider transaction reference where applicable, and ledger source reference.

## Transaction Strategy

- Create pending top-up before external initiation.
- Do not hold a database transaction open during provider network calls.
- On verified completion, begin a short transaction, lock/version required records, verify state and idempotency, post balanced entries, update projection and status, write audit/outbox, and commit.
- Treat unique-constraint or concurrency conflicts as safe duplicate/conflict paths, then return the canonical transaction result.

## Test Strategy

### Current verification baseline

- `npm ci` installs the locked JavaScript dependency graph.
- `npm run lint --if-present` and `npm test --if-present` are the commands used by CI, but currently execute nothing because `package.json` defines neither script.
- `npm start`, `npm run android`, `npm run ios`, and `npm run web` are development launch commands, not automated verification.
- `cd android && gradlew.bat test` (or Fastlane's `test` lane) is the native Android unit-test entry point; no project-owned test sources are present.
- The Android release workflow builds with `gradlew bundleRelease` and `gradlew assembleRelease` after injecting public build configuration and signing material.
- From `C:\projects\repos\wallet-backend`: `python -m pytest -q` is the discovered backend test command; `python -m unittest discover -s tests -v` is compatible with the current unittest-based files. Tests currently mock persistence and external services; no PostgreSQL migration/concurrency integration harness exists.
- Backend migrations use `alembic upgrade head`; schema/head inspection uses `alembic current` and `alembic heads`. Migration verification requires a disposable PostgreSQL database and an explicit downgrade/forward-recovery check.
- Backend development uses `uvicorn main:app --reload --port 8080`; production uses the Dockerfile/Cloud Run command with one worker.

The backend is now identified; server financial controls must be implemented and proven there. A client test framework still must be selected for mobile contract/UI work.

Test creation order:

1. API/provider contracts
2. Domain invariants and state transitions
3. Persistence and concurrency integration tests
4. API authorization and idempotency tests
5. End-to-end mock-provider flows
6. Reconciliation and operational tests

External providers MUST be represented by deterministic mocks until official sandbox integration is available.

## Stripe integration design (T034)

Grounded in Stripe's official documentation read on 2026-09-19 (webhooks: https://docs.stripe.com/webhooks; ACH: https://docs.stripe.com/payments/ach-direct-debit and its React Native accept-a-payment guide). Human decision: Stripe is the US provider (spec.md, Human decision 2026-09-19).

**Flow (card and ACH).** Server creates a PaymentIntent (`usd`) and returns its `client_secret` to the app in a new `NextAction`; the app completes collection/confirmation with `@stripe/stripe-react-native` (already installed); Stripe reports outcome by signed webhook; only a verified webhook completes the top-up (Constitution II). For ACH the app must (1) collect the bank in Stripe's collector, (2) show the Nacha mandate and get acceptance, (3) confirm, and (4) handle `RequiresAction` for microdeposit verification. The client never reports success.

**Event mapping (T034a, implemented).** `payment_intent.processing` -> `Processing`, `payment_intent.requires_action` -> `RequiresAction`, `payment_intent.succeeded` -> `Completed` (amount = `amount_received`), `payment_intent.payment_failed` -> a failed ATTEMPT (audited, top-up unchanged; T034i, option A), `payment_intent.canceled` -> `Failed`. Every other authentic event type is acknowledged as ignored (Stripe retries non-2xx for up to 3 days). Stripe does not guarantee event order and may repeat events; identity is the `evt_` id, already stored by the webhook processor (FR-008).

**State-machine gap (fixed in T034b, pending independent review).** The pinned transition table only allows `Completed` from `Processing`, and nothing moved a top-up out of `Pending` (the webhook processor merely acknowledged `Processing`/`RequiresAction`; the T017 end-to-end test set `Processing` by hand). With a real provider a verified `succeeded` for a `Pending` top-up failed with an illegal transition, so a paid-for top-up was never credited. Card payments can also go straight to `succeeded` with no `processing` event, and Stripe does not guarantee order. T034b keeps the table unchanged and (1) applies verified `Processing`/`RequiresAction` events (`apply_verified_progress`, non-financial, backwards/repeated events are no-ops), (2) lets a verified completion or failure for a `Pending`/`RequiresAction` top-up apply the implied `Processing` hop atomically in the same transaction. See spec.md, State Transitions, "T034b amendment".

**Data model: no migration needed (corrects earlier notes).** `top_ups` already has `provider_name` and `provider_transaction_reference` with a unique constraint; the PaymentIntent id belongs there. Initiation simply never sets them; that is T034c. Whether a funding-source reference should also be stored on the top-up (for masked history display, FR-015) is a T034c decision, not a prerequisite.

**Initiation (T034c, pending independent review).** See spec.md, "Provider-backed initiation". The server creates the PaymentIntent (no Stripe Customer needed for a one-time payment) and the device confirms it with `@stripe/stripe-react-native`; the backend never sees card or bank details. Verified against the real Stripe sandbox on 2026-09-19.

**Configuration.** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from the environment only, never in code or logs. Webhook route (T034b): provider registry (`mock`, `stripe`); each provider has its own signature header (`Stripe-Signature` for Stripe); `STRIPE_WEBHOOK_SECRET` unset means 503 (fail closed); `mock` is refused when `APP_ENV=production` because its signing secret is hardcoded in the repository. Also IP-allowlisting Stripe's published webhook addresses is recommended by Stripe in addition to signature checks.

**Not in scope until decided.** ACH returns/disputes after `succeeded` (T034e), mandate text, and verification-method choice (spec.md Clarifications).

## Delivery Phases

1. Discovery and clarification
2. Domain and persistence foundation
3. Provider abstraction and customer top-up
4. Webhook completion and ledger posting
5. Agent cash top-up and reversal
6. History, notifications, reconciliation, and observability
7. Security review, convergence, and release readiness

## Complexity and Exceptions

No constitutional exception is approved. The backend repository is identified, but its existing direct-balance/generic-transaction funding paths do not satisfy the constitution's immutable double-entry, provider-verification, atomicity, or idempotency gates. New top-up work must not treat those legacy paths as proof of compliance. The duplicate nested `wallet-backend/` snapshot, unpinned pytest dependency, startup `create_all()`, lack of a CI test job, and absence of integration-test database setup are delivery risks to resolve in later assigned tasks. Any required exception MUST be added here with the violated principle, justification, rejected alternatives, risk, and human approval.
