# SendMoneyScreen Refactor Plan

This document captures the fix-and-refactor plan for `src/screens/SendMoneyScreen.jsx`, currently a 2,401-line single file.

## 1. Decompose the Screen into Sub-Components

Extract the following components into `src/components/sendMoney/`:

- [ ] `RecipientSelector` — phone input, country picker, saved-recipient auto-fill
- [ ] `AmountAndQuote` — send amount, fee/rate display, quote loading
- [ ] `DeliveryMethodPicker` — wallet / wave / cash selection
- [ ] `PaymentMethodPicker` — wallet, saved cards/ACH, add-new-card
- [ ] `CardEntryModal` — Stripe `CardField` form with save-card toggle
- [ ] `CashAgentSelector` — list and choose a cash-pickup agent
- [ ] `ConfirmSheet` — transfer summary, confirm/cancel
- [ ] `ReceiptView` — success screen and receipt

## 2. Extract Business Logic into Custom Hooks

Move state and API interaction into `src/hooks/`:

- [ ] `useTransferQuote(phone, amount, sendCcy, recvCcy)` — debounced quote + rate
- [ ] `usePaymentMethods()` — fetch and refresh saved payment methods
- [ ] `useWalletBalance()` — balance and transactions
- [ ] `useRecipients()` — saved recipients list
- [ ] `useTransfer()` — execute wallet/wave/cash transfer, loading and error state
- [ ] `useDeviceCurrency()` — locale to currency resolution

## 3. Replace Hard-Coded Data

- [ ] Move `DEST_COUNTRIES` to a backend endpoint or a shared config file (`src/data/countries.js` already exists; use it)
- [ ] Move `REGION_CURRENCY` mapping to the backend or a remote config
- [ ] Remove default `DEST_COUNTRIES[16]` (Gambia) and default to the user’s last used / home destination
- [ ] Remove client-side `FEE_RATE`; derive fee, net, and receive amounts from `transfer/quote` response only

## 4. Fix Core Logic Issues

- [ ] Use backend quote for fee, net, and exchange rate (single source of truth)
- [ ] Cash pickup: show agent list and let user select an agent instead of auto-picking `agents[0]`
- [ ] Phone validation: use a library like `libphonenumber-js` and enforce country dial code
- [ ] Amount validation: enforce backend min/max from the quote response
- [ ] Require `recipientName` for cash/wave where the backend needs it
- [ ] Stop swallowing errors in initial data load; show `Toast` or fallback UI
- [ ] Replace `Alert.alert` errors inside modal flow with in-sheet error banner or `Toast`

## 5. Stripe & Payment Clean-Up

- [ ] Deduplicate the two `stripe/pay` call paths (new card vs saved card)
- [ ] Ensure `payment_method_id` is passed consistently to `/transfer/*` endpoints
- [ ] Fix `saveCard` persistence: avoid best-effort card save that can hide failures

## 6. Backend Integration Hardening

- [ ] Remove or guard notification calls to endpoints that may not exist (`notifications/transfer-email`, `notifications/recipient-notify`)
- [ ] Move email/notification responsibility to the backend when possible
- [ ] Confirm `email/send` endpoint exists and handle failures gracefully

## 7. Code Quality & Maintainability

- [ ] Remove unused icon imports
- [ ] Replace `StyleSheet.create` in the same file with per-component styles or `styled-components` / Tailwind if used elsewhere
- [ ] Add basic TypeScript prop types (project already uses `@types/react`)
- [ ] Add unit tests or at least a simple test for `getDeviceCurrency` and the quote hook

## Suggested Order

1. Extract hooks and data config first to shrink `SendMoneyScreen`.
2. Extract `RecipientSelector`, `AmountAndQuote`, and `ConfirmSheet`.
3. Fix backend-driven quote/fee logic and validation.
4. Refactor payment and cash-agent flows.
5. Clean up imports, styles, and add basic tests.
