import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Linking,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { useStripe } from '@stripe/stripe-react-native'
import { ArrowLeft, Landmark, CheckCircle2 } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'
import useWalletBalance from '../hooks/useWalletBalance'
import { useAuth } from '../context/AuthContext'
import { BANK_FLOW, BANK_FLOW_AVAILABLE } from '../config/bankFlow'
import {
  stripClientSecret, takeClientSecret, isInFlight, walletCreditRow, showRetryNotice,
} from '../utils/topUpFlow'
import {
  MANDATE_ACCEPT_LABEL, mandateText, classifyCollectResult, classifyConfirmResult,
  bankSummary, isStripeHostedUrl, formatArrivalDate,
} from '../utils/bankFlow'

// Wallet top-up from a US bank account (spec 001-wallet-top-up, T034d).
//
// Stripe's own screens link and verify the bank (`collectBankAccountForPayment`); this screen then
// shows the Nacha authorization (Stripe's recommended wording, business name and terms link from
// configuration) and only after the customer accepts it confirms the debit (`confirmPayment`).
// Bank details never reach this app's backend. The client NEVER reports success: a debit is only
// ever "submitted" here, takes up to ~4 business days, and the wallet is credited when the server
// says Completed (decided from a verified provider webhook). The client secret lives in a ref, is
// stripped from React state, and is never logged or persisted.
//
// A failed bank debit ends the top-up (human decision 2026-09-19): trying again is a NEW top-up.

const AMOUNT_RE = /^\d{1,9}(\.\d{1,2})?$/
const POLL_MS = 3000
const POLL_MAX = 20
const BTN = '#16A34A'

const STATUS_COPY = {
  Created:        { label: 'Starting',        hint: 'Setting up your bank transfer…' },
  Pending:        { label: 'Submitted',       hint: 'Your bank transfer was submitted. It can take up to 4 business days. Your balance updates automatically once it is confirmed.' },
  Processing:     { label: 'Processing',      hint: 'Your bank is processing this transfer. It can take up to 4 business days. Your balance updates automatically once it is confirmed.' },
  RequiresAction: { label: 'Verify your bank', hint: 'Your bank account needs one more verification step before the transfer can go ahead.' },
  Completed:      { label: 'Added to wallet', hint: 'The money is in your wallet.' },
  Failed:         { label: 'Failed',          hint: 'The bank transfer did not go through. You have not been charged and your balance is unchanged. You can start a new top-up.' },
  Expired:        { label: 'Expired',         hint: 'This top-up expired before it was confirmed. Your balance is unchanged.' },
  Cancelled:      { label: 'Cancelled',       hint: 'This top-up was cancelled. Your balance is unchanged.' },
  UnderReview:    { label: 'Under review',    hint: 'We are reviewing this payment. Your balance will not change until the review is finished.' },
  Reversed:       { label: 'Reversed',        hint: 'This top-up was reversed.' },
}
const STALLED_HINT =
  'Bank transfers take a few business days. You can leave this screen; your balance updates automatically once the transfer is confirmed.'

const newKey = () => `topup-bank-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
const money = (value, currency) => `${Number(value).toFixed(2)} ${currency}`
const apiMessage = (err, fallback) =>
  err.response?.data?.error?.message || err.response?.data?.detail || fallback

export default function BankTopUpScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { collectBankAccountForPayment, confirmPayment } = useStripe()
  const { wallet, refresh: refreshWallet } = useWalletBalance()

  const [amount, setAmount] = useState('')
  const [holder, setHolder] = useState(user?.full_name || '')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('form')        // form | mandate | verify | result
  const [hasSession, setHasSession] = useState(false)
  const [bank, setBank] = useState(null)          // { bankName, last4 }, shown "above" the authorization
  const [verifyInfo, setVerifyInfo] = useState(null)
  const [topUp, setTopUp] = useState(null)        // server view, never contains the client secret
  const [stalled, setStalled] = useState(false)

  const attempt = useRef({ fingerprint: null, key: null })
  const session = useRef(null)                    // { walletId, topUpId, clientSecret } (memory only)
  const pollTimer = useRef(null)
  const mounted = useRef(true)

  const currency = wallet?.currency || 'USD'
  const amountValid = AMOUNT_RE.test(amount) && Number(amount) > 0
  const holderValid = holder.trim().length >= 2 && holder.trim().length <= 100
  const canStart = amountValid && holderValid && !busy && BANK_FLOW_AVAILABLE

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

  // After the debit is submitted (or needs verification) the server owns the outcome: show its
  // view of the top-up and keep polling for a while.
  const trackTopUp = async (walletId, topUpId) => {
    setStalled(false)
    try {
      const { data } = await api.get(`wallets/${walletId}/top-ups/${topUpId}`)
      if (mounted.current) setTopUp(stripClientSecret(data.top_up))
    } catch {
      // The panel appears on the first successful poll.
    }
    poll(walletId, topUpId, 0)
  }

  const collectBank = async () => {
    const current = session.current
    if (!current) return
    const billingDetails = { name: holder.trim(), ...(user?.email ? { email: user.email } : {}) }
    const result = classifyCollectResult(
      await collectBankAccountForPayment(current.clientSecret, {
        paymentMethodType: 'USBankAccount',
        paymentMethodData: { billingDetails },
      }),
    )
    if (!mounted.current) return
    if (result.step === 'mandate') {
      setBank({ bankName: result.bankName, last4: result.last4 })
      setStep('mandate')
    } else if (result.step === 'verify') {
      const { walletId, topUpId } = current
      endSession()
      setVerifyInfo({ redirectUrl: null, arrivalDate: null })
      setStep('verify')
      await trackTopUp(walletId, topUpId)
    } else if (result.step === 'cancelled') {
      Toast.show({ type: 'error', text1: 'Bank account linking was cancelled. You can try again.' })
    } else {
      Toast.show({ type: 'error', text1: result.message || 'Something went wrong with your bank account. Please try again.' })
    }
  }

  const start = async () => {
    if (!BANK_FLOW_AVAILABLE) return Toast.show({ type: 'error', text1: 'Bank transfers are not available yet.' })
    if (!wallet?.wallet_id) return Toast.show({ type: 'error', text1: 'Wallet is not ready yet. Try again in a moment.' })
    if (!amountValid) return Toast.show({ type: 'error', text1: 'Enter a valid amount, e.g. 25.00' })
    if (!holderValid) return Toast.show({ type: 'error', text1: 'Enter the account holder name' })

    setBusy(true)
    try {
      if (!session.current) {
        const normalized = Number(amount).toFixed(2)
        const fingerprint = `${wallet.wallet_id}|bank|${normalized}|${currency}`
        if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: newKey() }
        const { data } = await api.post(
          `wallets/${wallet.wallet_id}/top-ups`,
          { amount: normalized, currency, funding_method: 'bank_transfer' }, // decimal string: the API rejects binary floats
          { headers: { 'Idempotency-Key': attempt.current.key } },
        )
        const secret = takeClientSecret(data.top_up)
        const safe = stripClientSecret(data.top_up)
        if (!secret) {
          // Nothing left to do on this device (already submitted, failed, or no provider).
          attempt.current = { fingerprint: null, key: null }
          setTopUp(safe)
          setStep('result')
          if (isInFlight(safe.status)) poll(wallet.wallet_id, safe.id, 0)
          return
        }
        session.current = { walletId: wallet.wallet_id, topUpId: safe.id, clientSecret: secret }
        setHasSession(true)
      }
      await collectBank()
    } catch (err) {
      Toast.show({ type: 'error', text1: apiMessage(err, 'Could not start your bank transfer. Please try again.') })
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  // The customer accepted the authorization: only now is the debit confirmed.
  const agreeAndPay = async () => {
    const current = session.current
    if (!current) return
    setBusy(true)
    try {
      const result = classifyConfirmResult(
        await confirmPayment(current.clientSecret, { paymentMethodType: 'USBankAccount' }),
      )
      if (!mounted.current) return
      const { walletId, topUpId } = current
      if (result.step === 'submitted') {
        endSession()
        setStep('result')
        await trackTopUp(walletId, topUpId)
      } else if (result.step === 'verify') {
        endSession()
        setVerifyInfo({
          redirectUrl: isStripeHostedUrl(result.redirectUrl) ? result.redirectUrl : null,
          arrivalDate: formatArrivalDate(result.arrivalDate),
        })
        setStep('verify')
        await trackTopUp(walletId, topUpId)
      } else if (result.step === 'cancelled') {
        Toast.show({ type: 'error', text1: 'Cancelled. You can try again.' })
      } else {
        Toast.show({ type: 'error', text1: result.message || 'Something went wrong confirming your transfer. Please try again.' })
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Something went wrong confirming your transfer. Please try again.' })
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  // Abandon a top-up whose debit was never authorized (the secret is discarded; the server cancels
  // the payment at Stripe first).
  const abandon = async () => {
    const current = session.current
    endSession()
    setBank(null)
    setStep('form')
    if (!current) return
    try {
      await api.post(`wallets/${current.walletId}/top-ups/${current.topUpId}/cancel`)
    } catch {
      // Best effort: an unauthorized top-up that cannot be cancelled is harmless.
    }
  }

  const finish = () => {
    clearTimeout(pollTimer.current)
    navigation.goBack()
  }

  const status = topUp ? (STATUS_COPY[topUp.status] || { label: topUp.status, hint: '' }) : null
  const inFlight = topUp && isInFlight(topUp.status)
  const creditRow = topUp ? walletCreditRow(topUp.status) : null
  const amountLabel = amountValid ? money(amount, currency) : ''

  const TopUpPanel = topUp ? (
    <View style={s.card}>
      <View style={s.statusRow}>
        {inFlight && !stalled
          ? <Spinner size="sm" color={BTN} />
          : <CheckCircle2 size={20} color={topUp.status === 'Completed' ? BTN : '#9CA3AF'} />}
        <Text style={s.statusLabel}>{status.label}</Text>
      </View>
      <Text style={s.hint}>{inFlight && stalled ? STALLED_HINT : status.hint}</Text>
      <View style={s.divider} />
      <Row label="You pay" value={money(topUp.gross_amount, topUp.currency)} />
      <Row label="Fee" value={money(topUp.fee_amount, topUp.currency)} />
      {creditRow
        ? <Row label={creditRow.label} value={money(topUp.net_amount, topUp.currency)} bold />
        : null}
      <Row label="Reference" value={topUp.reference} mono />
      <TouchableOpacity style={[s.btn, { backgroundColor: BTN }]} onPress={finish}>
        <Text style={s.btnText}>Done</Text>
      </TouchableOpacity>
    </View>
  ) : null

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.title}>Bank transfer</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.content}>
          {!BANK_FLOW_AVAILABLE ? (
            <Text style={s.note}>Bank transfers are not available yet.</Text>
          ) : step === 'result' ? (
            TopUpPanel || <View style={{ paddingVertical: 24 }}><Spinner color={BTN} /></View>
          ) : step === 'verify' ? (
            <View>
              <View style={s.card}>
                <Text style={s.statusLabel}>Verify your bank account</Text>
                <Text style={[s.hint, { marginTop: 8 }]}>
                  Stripe will make a small deposit to your account{verifyInfo?.arrivalDate ? `, expected around ${verifyInfo.arrivalDate}` : ' within 1-2 business days'}.
                  Once it arrives, confirm it with the link Stripe emails you, or on Stripe's verification page. Your transfer goes ahead after that.
                </Text>
                {verifyInfo?.redirectUrl ? (
                  <TouchableOpacity
                    style={[s.btn, { backgroundColor: BTN }]}
                    onPress={() => Linking.openURL(verifyInfo.redirectUrl)}
                  >
                    <Text style={s.btnText}>Open verification page</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={{ height: 16 }} />
              {TopUpPanel}
            </View>
          ) : step === 'mandate' ? (
            <View style={s.card}>
              <Text style={s.statusLabel}>Authorize this transfer</Text>
              <View style={s.bankRow}>
                <Landmark size={18} color="#374151" />
                <Text style={s.bankName}>{bankSummary(bank)}</Text>
              </View>
              <Row label="Amount" value={amountLabel} bold />
              <View style={s.divider} />
              <Text style={s.mandate}>{mandateText(BANK_FLOW.businessName)}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(BANK_FLOW.termsUrl)}>
                <Text style={s.link}>View terms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: BTN }, busy && s.btnDisabled]}
                onPress={agreeAndPay}
                disabled={busy}
              >
                {busy ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>{MANDATE_ACCEPT_LABEL}</Text>}
              </TouchableOpacity>
              {!busy && (
                <TouchableOpacity style={s.secondaryBtn} onPress={abandon}>
                  <Text style={s.secondaryBtnText}>Cancel</Text>
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

              <Text style={[s.label, { marginTop: 18 }]}>Account holder name</Text>
              <TextInput
                style={[s.input, hasSession && s.inputLocked]}
                placeholder="Name on the bank account"
                placeholderTextColor="#9CA3AF"
                value={holder}
                onChangeText={setHolder}
                editable={!hasSession && !busy}
                autoCapitalize="words"
                maxLength={100}
              />
              <Text style={s.note}>
                You will link and verify your bank in Stripe's secure screens. Your bank details are never stored by this app.
                A bank transfer can take up to 4 business days to arrive.
              </Text>

              {showRetryNotice({ hasSession, busy }) && (
                <Text style={[s.note, { color: '#B45309', marginTop: 14 }]}>
                  Your bank account was not linked. Try again, or cancel this top-up.
                </Text>
              )}

              <TouchableOpacity
                style={[s.btn, { backgroundColor: BTN }, !canStart && s.btnDisabled]}
                onPress={start}
                disabled={!canStart}
              >
                {busy
                  ? <Spinner size="sm" color="#fff" />
                  : <Text style={s.btnText}>{hasSession ? 'Try again' : 'Link bank account'}</Text>}
              </TouchableOpacity>

              {hasSession && !busy && (
                <TouchableOpacity style={s.secondaryBtn} onPress={abandon}>
                  <Text style={s.secondaryBtnText}>Cancel this top-up</Text>
                </TouchableOpacity>
              )}
            </>
          )}
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
  note:       { fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 18 },
  input:      { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  inputLocked:{ backgroundColor: '#F3F4F6', color: '#6B7280' },
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
  bankRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, marginVertical: 12 },
  bankName:   { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  mandate:    { fontSize: 13, color: '#374151', lineHeight: 20 },
  link:       { fontSize: 14, fontWeight: '600', color: BTN, marginTop: 12 },
})
