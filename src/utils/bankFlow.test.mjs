// T034d: pure logic behind the bank (ACH) top-up flow. Run with: node --test src/utils/bankFlow.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bankFlowConfig, mandateText, MANDATE_ACCEPT_LABEL, classifyCollectResult,
  classifyConfirmResult, bankErrorMessage, isStripeHostedUrl, formatArrivalDate, bankSummary,
} from './bankFlow.js'

// ---------------------------------------------------------------- configuration gate (fails closed)

test('the bank flow is enabled only when BOTH the business name and an https terms link are configured', () => {
  const ok = bankFlowConfig({ businessName: 'Acme Wallet', termsUrl: 'https://acme.example/terms' })
  assert.equal(ok.enabled, true)
  assert.equal(ok.businessName, 'Acme Wallet')
  assert.equal(ok.termsUrl, 'https://acme.example/terms')
})

test('a missing, blank or unusable value disables the bank flow', () => {
  const cases = [
    {},
    { businessName: 'Acme' },
    { termsUrl: 'https://acme.example/terms' },
    { businessName: '   ', termsUrl: 'https://acme.example/terms' },
    { businessName: 'Acme', termsUrl: '   ' },
    { businessName: 'Acme', termsUrl: 'http://acme.example/terms' },   // not https
    { businessName: 'Acme', termsUrl: 'javascript:alert(1)' },
    { businessName: 'Acme', termsUrl: 'not a url' },
    { businessName: 'x'.repeat(101), termsUrl: 'https://acme.example/terms' },
    { businessName: 'Ac\nme', termsUrl: 'https://acme.example/terms' }, // control character
    { businessName: 5, termsUrl: 'https://acme.example/terms' },
    undefined,
    null,
  ]
  for (const c of cases) assert.equal(bankFlowConfig(c).enabled, false, JSON.stringify(c))
})

test('surrounding whitespace in the configuration is tolerated', () => {
  const c = bankFlowConfig({ businessName: '  Acme Wallet ', termsUrl: ' https://acme.example/terms ' })
  assert.deepEqual([c.enabled, c.businessName, c.termsUrl], [true, 'Acme Wallet', 'https://acme.example/terms'])
})

// ---------------------------------------------------------------- mandate wording (Stripe's recommended text)

test('the mandate is Stripe\'s recommended one-time wording with the business name in every position', () => {
  const text = mandateText('Acme Wallet')
  assert.equal(
    text,
    "By clicking Agree and pay, you authorize Acme Wallet to debit the bank account specified above for any amount owed for charges arising from your use of Acme Wallet's services and/or purchase of products from Acme Wallet, pursuant to Acme Wallet's website and terms, until this authorization is revoked. You may amend or cancel this authorization at any time by providing notice to Acme Wallet with 30 (thirty) days notice.",
  )
  assert.equal(text.match(/Acme Wallet/g).length, 5)
  assert.ok(!text.includes('[Business Name]'))
  assert.ok(!text.includes('[accept]'))
})

test('the mandate names the button the customer actually taps', () => {
  assert.ok(mandateText('Acme', 'Accept').startsWith('By clicking Accept, you authorize Acme'))
  assert.ok(mandateText('Acme').includes(MANDATE_ACCEPT_LABEL))
})

test('the mandate never contains a placeholder even for tricky names', () => {
  assert.ok(!mandateText("O'Brien & Sons").includes('[Business Name]'))
})

// ---------------------------------------------------------------- results of collecting the bank account

const collected = (status, extra = {}) => ({
  paymentIntent: {
    status,
    paymentMethod: { USBankAccount: { bankName: 'STRIPE TEST BANK', last4: '6789' } },
    ...extra,
  },
})

test('a collected, verified account is ready for the mandate and confirmation', () => {
  const r = classifyCollectResult(collected('RequiresConfirmation'))
  assert.deepEqual(r, { step: 'mandate', bankName: 'STRIPE TEST BANK', last4: '6789' })
})

test('closing the bank collector is a cancellation, not an error', () => {
  assert.equal(classifyCollectResult({ error: { code: 'Canceled', message: 'x' } }).step, 'cancelled')
})

test('a collector failure carries a safe message', () => {
  const r = classifyCollectResult({ error: { code: 'Failed', message: 'Bank unavailable.' } })
  assert.deepEqual([r.step, r.message], ['error', 'Bank unavailable.'])
})

test('an account that still needs verification is reported as such', () => {
  assert.equal(classifyCollectResult(collected('RequiresAction')).step, 'verify')
})

test('any other collect status is unexpected and never proceeds to a debit', () => {
  for (const s of ['Succeeded', 'Processing', 'RequiresPaymentMethod', 'Canceled', 'Unknown', undefined]) {
    assert.equal(classifyCollectResult(collected(s)).step, 'unexpected', String(s))
  }
  assert.equal(classifyCollectResult(null).step, 'unexpected')
  assert.equal(classifyCollectResult({}).step, 'unexpected')
})

test('missing bank details do not break the mandate step', () => {
  const r = classifyCollectResult({ paymentIntent: { status: 'RequiresConfirmation' } })
  assert.deepEqual([r.step, r.bankName, r.last4], ['mandate', null, null])
})

test('bankSummary renders the account shown "above" the mandate, without leaking more than last4', () => {
  assert.equal(bankSummary({ bankName: 'STRIPE TEST BANK', last4: '6789' }), 'STRIPE TEST BANK •••• 6789')
  assert.equal(bankSummary({ bankName: null, last4: '6789' }), 'Bank account •••• 6789')
  assert.equal(bankSummary({ bankName: 'B', last4: null }), 'B')
  assert.equal(bankSummary({ bankName: null, last4: '12345678' }), 'Bank account')
  assert.equal(bankSummary(null), 'Bank account')
})

// ---------------------------------------------------------------- results of confirming the debit

test('a submitted debit (processing) is only "submitted": the wallet is credited later, by the server', () => {
  assert.equal(classifyConfirmResult({ paymentIntent: { status: 'Processing' } }).step, 'submitted')
  assert.equal(classifyConfirmResult({ paymentIntent: { status: 'Succeeded' } }).step, 'submitted')
})

test('microdeposit verification is surfaced with the hosted page and expected arrival date', () => {
  const r = classifyConfirmResult({
    paymentIntent: {
      status: 'RequiresAction',
      nextAction: {
        type: 'verifyWithMicrodeposits', redirectUrl: 'https://payments.stripe.com/microdeposit/pay/abc',
        microdepositType: 'descriptor_code', arrivalDate: '1647586800',
      },
    },
  })
  assert.equal(r.step, 'verify')
  assert.equal(r.redirectUrl, 'https://payments.stripe.com/microdeposit/pay/abc')
  assert.equal(r.arrivalDate, '1647586800')
})

test('a required action that is not microdeposit verification is unexpected', () => {
  const r = classifyConfirmResult({ paymentIntent: { status: 'RequiresAction', nextAction: { type: 'urlRedirect', redirectUrl: 'https://x' } } })
  assert.equal(r.step, 'unexpected')
})

test('a confirm error is reported with a safe message', () => {
  const r = classifyConfirmResult({ error: { code: 'Failed', message: 'Debits are not authorized.' } })
  assert.deepEqual([r.step, r.message], ['error', 'Debits are not authorized.'])
  assert.equal(classifyConfirmResult({ error: { code: 'Canceled' } }).step, 'cancelled')
})

test('anything else after confirming is unexpected', () => {
  for (const s of ['RequiresPaymentMethod', 'RequiresConfirmation', 'Canceled', 'Unknown', undefined]) {
    assert.equal(classifyConfirmResult({ paymentIntent: { status: s } }).step, 'unexpected', String(s))
  }
  assert.equal(classifyConfirmResult(null).step, 'unexpected')
})

// ---------------------------------------------------------------- messages, links, dates

test('bank error messages: cancelled, provider text (bounded) and generic fallbacks', () => {
  assert.match(bankErrorMessage({ code: 'Canceled' }), /cancel/i)
  assert.equal(bankErrorMessage({ code: 'Failed', message: 'Bank unavailable.' }), 'Bank unavailable.')
  assert.match(bankErrorMessage({ code: 'Failed' }), /another (bank )?account/i)
  assert.match(bankErrorMessage({}), /try again/i)
  assert.match(bankErrorMessage(null), /try again/i)
  assert.ok(bankErrorMessage({ code: 'Failed', message: 'x'.repeat(5000) }).length <= 200)
})

test('only https links on stripe.com are ever opened for verification', () => {
  assert.equal(isStripeHostedUrl('https://payments.stripe.com/microdeposit/pay/abc'), true)
  assert.equal(isStripeHostedUrl('https://stripe.com/x'), true)
  for (const bad of [
    'http://payments.stripe.com/x', 'https://evilstripe.com/x', 'https://stripe.com.evil.example/x',
    'https://payments.stripe.com.evil.example/', 'javascript:alert(1)', 'ftp://payments.stripe.com/x',
    '', null, undefined, 42, 'not a url', 'https://user:pw@evil.example@payments.stripe.com/',
  ]) {
    assert.equal(isStripeHostedUrl(bad), false, String(bad))
  }
})

test('the arrival date renders from a unix-seconds string and is empty when unusable', () => {
  const out = formatArrivalDate('1647586800')
  assert.match(out, /Mar/)
  for (const bad of [undefined, null, '', 'abc', '-5', NaN, {}]) assert.equal(formatArrivalDate(bad), '', String(bad))
})
