import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { CardField, useStripe } from '@stripe/stripe-react-native'
import { ArrowLeft, Landmark, CheckCircle2 } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'
import useWalletBalance from '../hooks/useWalletBalance'
import { BANK_FLOW_AVAILABLE } from '../config/bankFlow'
import {
  stripClientSecret, takeClientSecret, confirmErrorMessage, isInFlight, walletCreditRow, showRetryNotice,
} from '../utils/topUpFlow'

// Wallet top-up by card (spec 001-wallet-top-up, T033/T034f).
//
// Flow: the server records a Pending top-up and creates a Stripe PaymentIntent, returning
// a one-time `client_secret`; this screen confirms it with Stripe's SDK (which also runs
// 3-D Secure), so card details go from the device straight to Stripe and never touch this
// app's backend. The client NEVER reports success: after confirming it only polls the
// top-up, and the wallet is treated as credited only when the server says Completed
// (which the server decides from a verified provider webhook).
//
// The client secret can complete a charge. It is kept in a ref for the duration of the
// confirmation, stripped from anything put in React state, and never logged or persisted.
//
// Bank (ACH) funding will use Stripe's own collector and mandate flow only (human decision
// 2026-09-19, T034d); manually entered bank accounts are never offered here.

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
const AMOUNT_RE = /^\d{1,9}(\.\d{1,2})?$/
const POLL_MS = 3000
const POLL_MAX = 20
const BTN = '#16A34A'

// CardField's `cardStyle` prop is native-only config, not RN's `style` — it must be a
// plain object; StyleSheet.create() refs resolve only for `style`.
const CARD_FIELD_STYLE = {
  backgroundColor: '#FFFFFF',
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
  borderRadius: 14,
  fontSize: 15,
  textColor: '#111827',
  placeholderColor: '#9CA3AF',
}

const STATUS_COPY = {
  Created:        { label: 'Starting',        hint: 'Setting up your top-up…' },
  Pending:        { label: 'Waiting',         hint: 'Your payment was submitted. Your balance updates automatically once it is confirmed.' },
  Processing:     { label: 'Processing',      hint: 'Your payment is being processed. Bank transfers can take a few business days.' },
  RequiresAction: { label: 'Action needed',   hint: 'Your bank or card needs one more step to finish this top-up.' },
  Completed:      { label: 'Added to wallet', hint: 'The money is in your wallet.' },
  Failed:         { label: 'Failed',          hint: 'This payment did not go through. You have not been charged and your balance is unchanged.' },
  Expired:        { label: 'Expired',         hint: 'This top-up expired before it was confirmed. Your balance is unchanged.' },
  Cancelled:      { label: 'Cancelled',       hint: 'This top-up was cancelled. Your balance is unchanged.' },
  UnderReview:    { label: 'Under review',    hint: 'We are reviewing this payment. Your balance will not change until the review is finished.' },
  Reversed:       { label: 'Reversed',        hint: 'This top-up was reversed.' },
}
const STALLED_HINT =
  'This is taking longer than usual. You can leave this screen; your balance updates automatically once the payment is confirmed.'

const newKey = () => `topup-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
const money = (value, currency) => `${Number(value).toFixed(2)} ${currency}`
const apiMessage = (err, fallback) =>
  err.response?.data?.error?.message || err.response?.data?.detail || fallback

export default function TopUpScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { confirmPayment } = useStripe()
  const { wallet, loading: walletLoading, refresh: refreshWallet } = useWalletBalance()

  const [amount, setAmount] = useState('')
  const [cardComplete, setCardComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hasSession, setHasSession] = useState(false) // a top-up exists that still needs a successful confirmation
  const [topUp, setTopUp] = useState(null)             // server view, never contains the client secret
  const [stalled, setStalled] = useState(false)

  // One idempotency key per distinct request, so a retry after a timeout replays the same
  // top-up instead of creating a second one.
  const attempt = useRef({ fingerprint: null, key: null })
  // In-memory only: { walletId, topUpId, clientSecret } while the card is being confirmed.
  const session = useRef(null)
  const pollTimer = useRef(null)
  const mounted = useRef(true)

  const currency = wallet?.currency || 'USD'
  const amountValid = AMOUNT_RE.test(amount) && Number(amount) > 0
  const showPanel = topUp && !hasSession

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(pollTimer.current)
      session.current = null // the secret does not outlive the screen
    }
  }, [])

  const poll = useCallback((walletId, topUpId, count) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`wallets/${walletId}/top-ups/${topUpId}`)
        if (!mounted.current) return
        const next = stripClientSecret(data.top_up)
        setTopUp(next)
        if (next.status === 'Completed') {
          refreshWallet()
          Toast.show({ type: 'success', text1: 'Money added to your wallet' })
          return
        }
        if (!isInFlight(next.status)) return
      } catch {
        // Transient poll failure: keep trying until the poll budget is spent.
      }
      if (!mounted.current) return
      if (count < POLL_MAX) poll(walletId, topUpId, count + 1)
      else setStalled(true)
    }, POLL_MS)
  }, [refreshWallet])

  const endSession = () => {
    session.current = null
    attempt.current = { fingerprint: null, key: null }
    setHasSession(false)
  }

  // Confirm the PaymentIntent with the card entered in the CardField. Success here means
  // Stripe accepted the payment details, NOT that the wallet is credited.
  const confirmSession = async () => {
    const current = session.current
    if (!current) return
    const { error } = await confirmPayment(current.clientSecret, { paymentMethodType: 'Card' })
    if (!mounted.current) return
    if (error) {
      // Declined, cancelled 3-D Secure, etc. Keep the SAME top-up so a retry (perhaps with
      // another card) does not create another one.
      Toast.show({ type: 'error', text1: confirmErrorMessage(error) })
      return
    }
    const { walletId, topUpId } = current
    endSession()
    setStalled(false)
    // Show the server's view of the top-up (Pending until the verified webhook arrives).
    try {
      const { data } = await api.get(`wallets/${walletId}/top-ups/${topUpId}`)
      if (mounted.current) setTopUp(stripClientSecret(data.top_up))
    } catch {
      // The panel appears on the first successful poll.
    }
    poll(walletId, topUpId, 0)
  }

  const submit = async () => {
    if (!STRIPE_PK) return Toast.show({ type: 'error', text1: 'Card payments are not available in this build.' })
    if (!wallet?.wallet_id) return Toast.show({ type: 'error', text1: 'Wallet is not ready yet. Try again in a moment.' })
    if (!amountValid) return Toast.show({ type: 'error', text1: 'Enter a valid amount, e.g. 25.00' })
    if (!cardComplete) return Toast.show({ type: 'error', text1: 'Enter your complete card details' })

    setBusy(true)
    try {
      if (!session.current) {
        const normalized = Number(amount).toFixed(2)
        const fingerprint = `${wallet.wallet_id}|${normalized}|${currency}`
        if (attempt.current.fingerprint !== fingerprint) {
          attempt.current = { fingerprint, key: newKey() }
        }
        const { data } = await api.post(
          `wallets/${wallet.wallet_id}/top-ups`,
          { amount: normalized, currency, funding_method: 'card' }, // decimal string: the API rejects binary floats
          { headers: { 'Idempotency-Key': attempt.current.key } },
        )
        const secret = takeClientSecret(data.top_up)
        const safe = stripClientSecret(data.top_up)
        if (!secret) {
          // Nothing left to confirm on this device (already confirmed, failed, or no provider).
          attempt.current = { fingerprint: null, key: null }
          setTopUp(safe)
          if (isInFlight(safe.status)) poll(wallet.wallet_id, safe.id, 0)
          return
        }
        session.current = { walletId: wallet.wallet_id, topUpId: safe.id, clientSecret: secret }
        setHasSession(true)
      }
      await confirmSession()
    } catch (err) {
      Toast.show({ type: 'error', text1: apiMessage(err, 'Could not start your top-up. Please try again.') })
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  // Abandon a top-up whose card was never accepted (the secret is discarded, so it can
  // no longer be confirmed from this device).
  const abandon = async () => {
    const current = session.current
    endSession()
    if (!current) return
    try {
      await api.post(`wallets/${current.walletId}/top-ups/${current.topUpId}/cancel`)
    } catch {
      // Best effort: an unconfirmed top-up that cannot be cancelled is harmless.
    }
  }

  const reset = () => {
    clearTimeout(pollTimer.current)
    setTopUp(null)
    setStalled(false)
    setAmount('')
  }

  const status = topUp ? (STATUS_COPY[topUp.status] || { label: topUp.status, hint: '' }) : null
  const inFlight = topUp && isInFlight(topUp.status)
  const creditRow = topUp ? walletCreditRow(topUp.status) : null
  const canSubmit = amountValid && cardComplete && !!STRIPE_PK && !busy

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.title}>Add Money</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.content}>
          {showPanel ? (
            <View style={s.card}>
              <View style={s.statusRow}>
                {inFlight && !stalled
                  ? <Spinner size="sm" color={BTN} />
                  : <CheckCircle2 size={20} color={topUp.status === 'Completed' ? BTN : '#9CA3AF'} />}
                <Text style={s.statusLabel}>{status.label}</Text>
              </View>
              <Text style={s.hint}>{inFlight && stalled ? STALLED_HINT : status.hint}</Text>
              {topUp.next_action?.instructions
                ? <Text style={[s.hint, { color: '#111827' }]}>{topUp.next_action.instructions}</Text>
                : null}

              <View style={s.divider} />
              <Row label="You pay" value={money(topUp.gross_amount, topUp.currency)} />
              <Row label="Fee" value={money(topUp.fee_amount, topUp.currency)} />
              {creditRow
                ? <Row label={creditRow.label} value={money(topUp.net_amount, topUp.currency)} bold />
                : null}
              <Row label="Reference" value={topUp.reference} mono />

              {/* No cancel here on purpose: once the card has been submitted to Stripe the payment
                  can still succeed, and cancelling our record would leave it with nothing to credit. */}
              {!inFlight && (
                <TouchableOpacity style={[s.btn, { backgroundColor: BTN }]} onPress={reset}>
                  <Text style={s.btnText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={s.label}>Amount ({currency})</Text>
              <TextInput
                style={[s.input, hasSession && s.inputLocked]}
                placeholder="25.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                editable={!hasSession && !busy}
                maxLength={12}
              />
              <Text style={s.note}>The fee, if any, is shown after you confirm, before any money is added.</Text>

              <Text style={[s.label, { marginTop: 22 }]}>Card</Text>
              {STRIPE_PK ? (
                <CardField
                  postalCodeEnabled
                  placeholders={{ number: '1234 5678 9012 3456' }}
                  style={s.cardField}
                  cardStyle={CARD_FIELD_STYLE}
                  onCardChange={(details) => setCardComplete(!!details?.complete)}
                />
              ) : (
                <Text style={s.note}>Card payments are not available in this build.</Text>
              )}
              <Text style={s.note}>Debit or credit. Your card details go straight to Stripe and are never stored by this app.</Text>

              {BANK_FLOW_AVAILABLE ? (
                // Bank (ACH) has its own screen: Stripe links and verifies the account, and the
                // customer accepts the debit authorization there (T034d).
                <TouchableOpacity
                  style={s.method}
                  onPress={() => navigation.navigate('BankTopUp')}
                  disabled={hasSession || busy}
                  activeOpacity={0.8}
                >
                  <View style={s.methodIcon}><Landmark size={18} color="#374151" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.methodName}>Bank account (ACH)</Text>
                    <Text style={s.methodSub}>Up to 4 business days</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[s.method, s.methodDisabled]}>
                  <View style={s.methodIcon}><Landmark size={18} color="#9CA3AF" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.methodName, { color: '#9CA3AF' }]}>Bank account (ACH)</Text>
                    <Text style={s.methodSub}>Coming soon</Text>
                  </View>
                </View>
              )}

              {showRetryNotice({ hasSession, busy }) && (
                <Text style={[s.note, { color: '#B45309', marginTop: 14 }]}>
                  Your payment did not go through. Check your card or use another one, then try again.
                </Text>
              )}

              <TouchableOpacity
                style={[s.btn, { backgroundColor: BTN }, !canSubmit && s.btnDisabled]}
                onPress={submit}
                disabled={!canSubmit}
              >
                {busy
                  ? <Spinner size="sm" color="#fff" />
                  : <Text style={s.btnText}>
                      {hasSession ? 'Try again' : amountValid ? `Add ${money(amount, currency)}` : 'Add money'}
                    </Text>}
              </TouchableOpacity>

              {hasSession && !busy && (
                <TouchableOpacity style={s.secondaryBtn} onPress={abandon}>
                  <Text style={s.secondaryBtnText}>Cancel this top-up</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {walletLoading && !wallet ? <View style={{ paddingVertical: 12 }}><Spinner color={BTN} /></View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Row({ label, value, bold, mono }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, bold && { fontWeight: '800' }, mono && { fontFamily: 'monospace', fontSize: 12 }]}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F9FAFB' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn:    { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 18, fontWeight: '700', color: '#111827' },
  content:    { paddingHorizontal: 20, paddingBottom: 40 },
  label:      { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  note:       { fontSize: 12, color: '#6B7280', marginTop: 6 },
  input:      { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  inputLocked:{ backgroundColor: '#F3F4F6', color: '#6B7280' },
  cardField:  { height: 50, width: '100%' },
  method:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, marginTop: 18 },
  methodDisabled: { opacity: 0.6 },
  methodIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  methodName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  methodSub:  { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  btn:        { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn:     { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  secondaryBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  card:       { backgroundColor: '#fff', borderRadius: 18, padding: 18 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusLabel:{ fontSize: 18, fontWeight: '800', color: '#111827' },
  hint:       { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 6 },
  divider:    { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel:   { fontSize: 14, color: '#6B7280' },
  rowValue:   { fontSize: 14, color: '#111827', fontWeight: '600' },
})
