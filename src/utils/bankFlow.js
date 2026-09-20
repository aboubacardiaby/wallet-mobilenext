// Pure logic behind the bank (ACH) top-up flow (T034d). No React or native modules, so it can be
// tested with `node --test src/utils/bankFlow.test.mjs`.
//
// The bank account itself is collected, verified and authorized through Stripe's own screens
// (human decision 2026-09-19: Stripe's flow only). This module only decides what the app shows
// around them: whether the flow is allowed at all, the authorization wording, and what a Stripe
// result means for the next step. It never decides that money arrived: only the server does.

export const MANDATE_ACCEPT_LABEL = 'Agree and pay'

const MAX_ERROR = 200
const MAX_NAME = 100
// https://host[:port][/path] with no userinfo ('@') in the authority.
const HTTPS_URL = /^https:\/\/([^\s/?#@:]+)(?::\d+)?(?:[/?#]\S*)?$/
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

// The bank option is offered only when BOTH values are configured and usable: the business name
// and a terms link are legal content that must never be invented or defaulted in code. The
// authorization text below cannot be shown without them, so without them the flow stays off.
export function bankFlowConfig(input) {
  const off = { enabled: false, businessName: '', termsUrl: '' }
  const name = input && typeof input.businessName === 'string' ? input.businessName.trim() : ''
  const url = input && typeof input.termsUrl === 'string' ? input.termsUrl.trim() : ''
  if (!name || name.length > MAX_NAME || CONTROL_CHARS.test(name)) return off
  if (!HTTPS_URL.test(url)) return off
  return { enabled: true, businessName: name, termsUrl: url }
}

// Stripe's recommended authorization for a ONE-TIME debit, verbatim
// (https://docs.stripe.com/payments/ach-direct-debit, "Collect mandates"), with the business name
// and the name of the button the customer actually taps filled in. The second paragraph Stripe
// gives for reusable authorizations is deliberately absent: top-ups are one-time.
// Counsel must approve the real wording, name and terms before production (spec.md, T032).
export function mandateText(businessName, acceptLabel = MANDATE_ACCEPT_LABEL) {
  const b = businessName
  return (
    `By clicking ${acceptLabel}, you authorize ${b} to debit the bank account specified above for any amount ` +
    `owed for charges arising from your use of ${b}'s services and/or purchase of products from ${b}, ` +
    `pursuant to ${b}'s website and terms, until this authorization is revoked. You may amend or cancel ` +
    `this authorization at any time by providing notice to ${b} with 30 (thirty) days notice.`
  )
}

// Customer-facing text for a failed or closed bank collection/confirmation step.
export function bankErrorMessage(error) {
  const code = error && error.code
  if (code === 'Canceled') return 'Bank account linking was cancelled. You can try again.'
  if (code === 'Failed') {
    const text = (error.localizedMessage || error.message || '').toString().trim()
    return text ? text.slice(0, MAX_ERROR) : 'We could not use that bank account. Try another account.'
  }
  return 'Something went wrong with your bank account. Please try again.'
}

// "STRIPE TEST BANK •••• 6789": the account "specified above" the authorization. Only the bank
// name and the last four digits are ever shown.
export function bankSummary(bank) {
  const name = bank && typeof bank.bankName === 'string' && bank.bankName.trim() ? bank.bankName.trim() : null
  const last4 = bank && typeof bank.last4 === 'string' && /^\d{4}$/.test(bank.last4) ? bank.last4 : null
  if (name && last4) return `${name} •••• ${last4}`
  if (last4) return `Bank account •••• ${last4}`
  return name || 'Bank account'
}

const bankDetails = (paymentIntent) => {
  const usba = paymentIntent && paymentIntent.paymentMethod && paymentIntent.paymentMethod.USBankAccount
  return { bankName: (usba && usba.bankName) || null, last4: (usba && usba.last4) || null }
}

const failureOrCancel = (error) =>
  error.code === 'Canceled' ? { step: 'cancelled' } : { step: 'error', message: bankErrorMessage(error) }

// What Stripe's bank collector returned. Only a collected and verified account proceeds to the
// authorization; anything unexpected never leads to a debit.
export function classifyCollectResult(result) {
  if (result && result.error) return failureOrCancel(result.error)
  const pi = result && result.paymentIntent
  if (!pi) return { step: 'unexpected' }
  if (pi.status === 'RequiresConfirmation') return { step: 'mandate', ...bankDetails(pi) }
  if (pi.status === 'RequiresAction') return { step: 'verify' }
  return { step: 'unexpected' }
}

// What Stripe returned after the customer accepted the authorization and the debit was submitted.
// "submitted" is NOT "credited": a bank debit takes days and the server decides when it is done.
export function classifyConfirmResult(result) {
  if (result && result.error) return failureOrCancel(result.error)
  const pi = result && result.paymentIntent
  if (!pi) return { step: 'unexpected' }
  if (pi.status === 'Processing' || pi.status === 'Succeeded') return { step: 'submitted' }
  if (pi.status === 'RequiresAction' && pi.nextAction && pi.nextAction.type === 'verifyWithMicrodeposits') {
    return {
      step: 'verify',
      redirectUrl: pi.nextAction.redirectUrl,
      arrivalDate: pi.nextAction.arrivalDate,
      microdepositType: pi.nextAction.microdepositType,
    }
  }
  return { step: 'unexpected' }
}

// Only Stripe's own https pages are ever opened for account verification.
export function isStripeHostedUrl(url) {
  if (typeof url !== 'string') return false
  const m = HTTPS_URL.exec(url.trim())
  if (!m) return false
  const host = m[1].toLowerCase()
  return host === 'stripe.com' || host.endsWith('.stripe.com')
}

// Stripe reports the expected microdeposit arrival as a unix timestamp in seconds.
export function formatArrivalDate(value) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : value
  if (typeof text !== 'string' || !/^\d{1,12}$/.test(text)) return ''
  return new Date(Number(text) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
