// T034f: pure logic behind the Add Money card flow. Run with: node --test src/utils/topUpFlow.test.mjs
// (no test framework is configured for this app; this uses Node's built-in runner).
import test from 'node:test'
import assert from 'node:assert/strict'
import { stripClientSecret, takeClientSecret, confirmErrorMessage, isInFlight, walletCreditRow, showRetryNotice } from './topUpFlow.js'

const SECRET = 'pi_123_secret_must_never_be_stored_or_logged'
const serverTopUp = () => ({
  id: 't1',
  status: 'Pending',
  gross_amount: '5.00',
  next_action: { type: 'confirm_with_provider', provider: 'stripe', client_secret: SECRET },
})

test('takeClientSecret returns the secret only for a confirm_with_provider action', () => {
  assert.equal(takeClientSecret(serverTopUp()), SECRET)
  assert.equal(takeClientSecret({ next_action: { type: 'await_provider' } }), null)
  assert.equal(takeClientSecret({ next_action: null }), null)
  assert.equal(takeClientSecret({}), null)
  assert.equal(takeClientSecret(null), null)
  assert.equal(takeClientSecret(undefined), null)
})

test('takeClientSecret ignores a blank or non-string secret', () => {
  for (const bad of ['', '   ', 123, {}, null, undefined]) {
    assert.equal(
      takeClientSecret({ next_action: { type: 'confirm_with_provider', client_secret: bad } }),
      null,
    )
  }
})

test('stripClientSecret removes the secret from everything that could be stored or logged', () => {
  const stripped = stripClientSecret(serverTopUp())
  assert.ok(!JSON.stringify(stripped).includes(SECRET))
  assert.ok(!JSON.stringify(stripped).includes('client_secret'))
})

test('stripClientSecret keeps the rest of the top-up, including the non-secret next action', () => {
  const stripped = stripClientSecret(serverTopUp())
  assert.equal(stripped.id, 't1')
  assert.equal(stripped.status, 'Pending')
  assert.equal(stripped.gross_amount, '5.00')
  assert.equal(stripped.next_action.type, 'confirm_with_provider')
  assert.equal(stripped.next_action.provider, 'stripe')
})

test('stripClientSecret does not mutate its input', () => {
  const original = serverTopUp()
  stripClientSecret(original)
  assert.equal(original.next_action.client_secret, SECRET)
})

test('stripClientSecret passes through top-ups with no next action', () => {
  assert.deepEqual(stripClientSecret({ id: 't2', next_action: null }), { id: 't2', next_action: null })
  assert.deepEqual(stripClientSecret({ id: 't3' }), { id: 't3' })
  assert.equal(stripClientSecret(null), null)
})

test('confirmErrorMessage: a cancelled challenge invites a retry', () => {
  assert.match(confirmErrorMessage({ code: 'Canceled', message: 'x' }), /cancel/i)
})

test('confirmErrorMessage: a failed payment shows the card issuer message', () => {
  assert.equal(
    confirmErrorMessage({ code: 'Failed', message: 'Your card was declined.' }),
    'Your card was declined.',
  )
  assert.equal(
    confirmErrorMessage({ code: 'Failed', localizedMessage: 'Card declined (localized).', message: 'x' }),
    'Card declined (localized).',
  )
})

test('confirmErrorMessage: falls back to generic copy for unknown or empty errors', () => {
  assert.match(confirmErrorMessage({ code: 'Unknown' }), /try again/i)
  assert.match(confirmErrorMessage({}), /try again/i)
  assert.match(confirmErrorMessage(null), /try again/i)
  assert.match(confirmErrorMessage({ code: 'Failed' }), /another card/i)
})

test('confirmErrorMessage never exceeds a sane length', () => {
  assert.ok(confirmErrorMessage({ code: 'Failed', message: 'x'.repeat(5000) }).length <= 200)
})

test('isInFlight matches the statuses that may still complete', () => {
  for (const s of ['Created', 'Pending', 'Processing', 'RequiresAction']) assert.equal(isInFlight(s), true)
  for (const s of ['Completed', 'Failed', 'Expired', 'Cancelled', 'UnderReview', 'Reversed', undefined, '']) {
    assert.equal(isInFlight(s), false)
  }
})

// T034k: the summary row that describes the money must never claim a credit that did not happen.
test('walletCreditRow: only a Completed top-up says the money was added', () => {
  assert.deepEqual(walletCreditRow('Completed'), { label: 'Added to wallet' })
})

test('walletCreditRow: an in-flight top-up says what the customer will receive, not that it arrived', () => {
  for (const s of ['Created', 'Pending', 'Processing', 'RequiresAction']) {
    assert.deepEqual(walletCreditRow(s), { label: 'You will receive' }, s)
  }
})

test('walletCreditRow: a top-up that did not credit the wallet shows no credit row', () => {
  for (const s of ['Failed', 'Expired', 'Cancelled', 'Reversed', 'UnderReview']) {
    assert.equal(walletCreditRow(s), null, s)
  }
})

test('walletCreditRow fails safe: an unknown or missing status never claims a credit', () => {
  for (const s of [undefined, null, '', 'completed', 'Settled', 42, {}]) {
    assert.equal(walletCreditRow(s), null, String(s))
  }
})

// T034l: the "that did not work, try again" notice must not flash while an attempt is still running.
test('showRetryNotice: shown only when a session exists and no attempt is running', () => {
  assert.equal(showRetryNotice({ hasSession: true, busy: false }), true)
})

test('showRetryNotice: hidden while the attempt is in progress (the session exists from the moment the top-up is created)', () => {
  assert.equal(showRetryNotice({ hasSession: true, busy: true }), false)
})

test('showRetryNotice: hidden when there is no session, busy or not', () => {
  assert.equal(showRetryNotice({ hasSession: false, busy: false }), false)
  assert.equal(showRetryNotice({ hasSession: false, busy: true }), false)
})

test('showRetryNotice fails safe: missing or non-boolean inputs never show a failure notice', () => {
  for (const v of [undefined, null, {}, { hasSession: 'yes', busy: false }, { hasSession: 1, busy: 0 }, { busy: false }]) {
    assert.equal(showRetryNotice(v), false, JSON.stringify(v))
  }
})
