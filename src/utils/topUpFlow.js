// Pure logic behind the Add Money card flow (T034f). Kept free of React and native
// modules so it can be tested with `node --test src/utils/topUpFlow.test.mjs`.

// Statuses in which a top-up may still complete (mirrors the server's state machine).
const IN_FLIGHT = ['Created', 'Pending', 'Processing', 'RequiresAction']

export const isInFlight = (status) => IN_FLIGHT.includes(status)

// The "that did not work, try again" notice on the entry screens. A session exists from the moment the
// top-up is created, so `hasSession` alone is true while the attempt is still running; the notice belongs
// only to an attempt that has ended without success. Anything unexpected hides it.
export function showRetryNotice(state) {
  return Boolean(state) && state.hasSession === true && state.busy === false
}

// The summary row that describes the money going into the wallet. Only the server marking a top-up
// Completed means the money is there; an unknown or missing status must never claim a credit.
// Returns { label } or null (show no row).
export function walletCreditRow(status) {
  if (status === 'Completed') return { label: 'Added to wallet' }
  if (isInFlight(status)) return { label: 'You will receive' }
  return null
}

// The provider `client_secret` can complete a charge. It is returned once, on the
// initiation response, and must live only in memory for the duration of the
// confirmation. These two helpers keep it out of React state, logs and error reports.

// The secret, or null. Only a `confirm_with_provider` action carries one.
export function takeClientSecret(topUp) {
  const action = topUp && topUp.next_action
  if (!action || action.type !== 'confirm_with_provider') return null
  const secret = action.client_secret
  return typeof secret === 'string' && secret.trim() !== '' ? secret : null
}

// A copy of the top-up that is safe to store in state: same data, no secret. Pure.
export function stripClientSecret(topUp) {
  if (!topUp || !topUp.next_action) return topUp
  // eslint-disable-next-line no-unused-vars
  const { client_secret, ...safeAction } = topUp.next_action
  return { ...topUp, next_action: safeAction }
}

const MAX_MESSAGE = 200

// Customer-facing text for a failed `confirmPayment` (Stripe React Native error shape:
// { code: 'Failed' | 'Canceled' | 'Unknown', message, localizedMessage }).
export function confirmErrorMessage(error) {
  const code = error && error.code
  if (code === 'Canceled') return 'Payment cancelled. You can try again.'
  if (code === 'Failed') {
    const text = (error.localizedMessage || error.message || '').toString().trim()
    return text ? text.slice(0, MAX_MESSAGE) : 'Your card could not be charged. Try another card.'
  }
  return 'Something went wrong confirming your payment. Please try again.'
}
