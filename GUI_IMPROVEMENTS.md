# GUI / UX Improvement Tasks

Generated from a full review of the React Native wallet app.

## Legend

- `P0` = Critical usability blocker
- `P1` = High impact, easy confusion
- `P2` = Polish / accessibility / power-user improvements

---

## P0 — App-Wide

- [x] Fix bottom tab navigation: "Home" tab must navigate to `Dashboard`, not `SendMoney` (or rename the tab to "Send")
- [x] Standardize loading states: skeleton screens for list loading, button spinners for forms, overlay for heavy operations
- [x] Standardize error handling: one error component, field-level errors with red borders, friendly messages instead of raw API strings

- [x] Enforce minimum 44 x 44 px tap targets on all icon buttons, quick actions, and list items
- [ ] Audit color contrast (text on light gray, teal on white) to meet WCAG 4.5:1
- [x] Add `accessibilityLabel` to all icon-only buttons and tab icons
- [x] Create a reusable `EmptyState` component (icon, copy, primary CTA)
- [x] Stop silently swallowing API errors; show a retry/fallback state for every network call

---

## P1 — Auth & Onboarding

- [x] **LoginScreen**: add helper text under dial code (e.g. "Enter country code, e.g. +221")
- [x] **LoginScreen**: add "Show PIN" toggle and "Forgot PIN?" link
- [x] **LoginScreen**: show field-specific validation errors with red borders
- [x] **RegisterScreen**: add a step progress indicator (Role / Country / Details)
- [x] **RegisterScreen**: rewrite role labels to be self-explanatory ("I send money from abroad" vs "I receive money in Africa")
- [x] **RegisterScreen**: add search/filter to the country list
- [x] **RegisterScreen**: add real-time phone formatting and validation
- [x] **VerifyOTPScreen**: add code expiry countdown timer
- [x] **VerifyOTPScreen**: show masked phone number and "Didn't receive code?" help
- [x] **SetPINScreen**: add real-time PIN match indicator
- [x] **SetPINScreen**: add "Show PIN" toggle and explanation text

---

## P1 — Dashboard

- [x] Increase quick-action grid items to at least 44 px hit area and add more vertical padding
- [x] Make balance hide/show more discoverable (larger hit target or tappable row)
- [x] Add a "Pending transactions" section or badge for in-progress transfers
- [x] Add clear label to the rate ticker ("Live exchange rates") and last-updated timestamp
- [x] Improve empty transaction state with a CTA like "Send your first transfer"

---

## P0 — Send Money

- [x] Break the long form into stepped sections: Recipient -> Amount -> Delivery -> Payment
- [x] Mark required fields with an asterisk or "Required" label
- [x] Show fee breakdown (1.5% fee, total to pay, recipient gets) in real time
- [x] Warn the user before auto-switching from Wallet to Cash delivery, with an option to keep Wallet
- [x] Add saved recipient quick-select / "Recent recipients" list
- [x] Add real-time validation for phone and amount
- [x] Improve payment-method picker: clear "Pay with:" header, grouped sections, default badge
- [x] Make the confirmation sheet smaller: show summary first, expand for details

---

## P1 — Transactions

- [x] Add filter chips (All, Sent, Received, Pending, Failed)
- [x] Add search by recipient name or phone
- [x] Use distinct status badge colors: green completed, amber pending, red failed
- [x] Group transactions by date with section headers
- [x] Add CTA to empty state

---

## P1 — Exchange

- [x] Move the converter to the top as a hero section
- [x] Increase rate table font size to at least 14 px
- [x] Show "Last updated" timestamp
- [x] Add rate direction indicator (up/down vs yesterday)

---

## P1 — Profile & KYC

- [x] **ProfileScreen**: implement or remove the non-functional "Security" row
- [x] **ProfileScreen**: make the KYC banner actionable with "Complete now" and progress
- [x] **KYCScreen**: show accepted document types with examples
- [x] **KYCScreen**: use a bottom sheet for photo upload instead of Alert
- [x] **KYCScreen**: show photo thumbnails in the review step
- [x] **KYCScreen**: add expected review time ("Usually 1-2 business days")

---

## P1 — Payment Methods & Recipients

- [x] **PaymentMethodsScreen**: show fee and limit info per method, and a clear "Default" badge
- [x] **RecipientsScreen**: add "Import from contacts" and "Favorites" / tags
- [x] **AddRecipientScreen**: split long form into steps, show phone match confirmation text, add method tooltips

---

## P2 — Nice-to-Have

- [x] Add an onboarding walkthrough for first-time users
- [x] Add biometric login toggle on Login and Set PIN
- [ ] Add dark mode support
- [x] Pull-to-refresh visual polish
- [x] Add haptic feedback on key actions (send, confirm, error)
- [x] Add in-app help / FAQ entry point on every major screen

---

## Suggested Implementation Order

1. Navigation fix (P0)
2. Dashboard quick-action sizing and pending state (P1)
3. Send Money form grouping and fee breakdown (P0)
4. Login / Register validation helpers (P1)
5. Transactions filtering and status colors (P1)
6. App-wide error/loading standardization (P0)
