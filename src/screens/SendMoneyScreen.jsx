import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ChevronDown, UserPlus, CheckCircle, ArrowRight, Zap, Shield, Clock, Mail } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const TEAL = '#0E9E98'
const LIGHT_TEAL = '#D4EFEE'
const TEAL_TEXT = '#0A7A76'
const BEIGE = '#F5F0E8'

const DEST_COUNTRIES = [
  { name: 'Senegal',       flag: '🇸🇳', currency: 'XOF', dial: '+221' },
  { name: "Côte d'Ivoire", flag: '🇨🇮', currency: 'XOF', dial: '+225' },
  { name: 'Mali',          flag: '🇲🇱', currency: 'XOF', dial: '+223' },
  { name: 'Burkina Faso',  flag: '🇧🇫', currency: 'XOF', dial: '+226' },
  { name: 'Niger',         flag: '🇳🇪', currency: 'XOF', dial: '+227' },
  { name: 'Togo',          flag: '🇹🇬', currency: 'XOF', dial: '+228' },
  { name: 'Benin',         flag: '🇧🇯', currency: 'XOF', dial: '+229' },
  { name: 'Guinea',        flag: '🇬🇳', currency: 'GNF', dial: '+224' },
  { name: 'Cameroon',      flag: '🇨🇲', currency: 'XAF', dial: '+237' },
  { name: 'Nigeria',       flag: '🇳🇬', currency: 'NGN', dial: '+234' },
  { name: 'Ghana',         flag: '🇬🇭', currency: 'GHS', dial: '+233' },
  { name: 'Kenya',         flag: '🇰🇪', currency: 'KES', dial: '+254' },
  { name: 'Morocco',       flag: '🇲🇦', currency: 'MAD', dial: '+212' },
  { name: 'South Africa',  flag: '🇿🇦', currency: 'ZAR', dial: '+27'  },
  { name: 'Egypt',         flag: '🇪🇬', currency: 'EGP', dial: '+20'  },
  { name: 'Ethiopia',      flag: '🇪🇹', currency: 'ETB', dial: '+251' },
  { name: 'Gambia',        flag: '🇬🇲', currency: 'GMD', dial: '+220' },
]

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', CHF: 'Fr',
  XOF: 'XOF', XAF: 'XAF', NGN: '₦', GHS: '₵', KES: 'KSh',
  MAD: 'MAD', ZAR: 'R', EGP: '£E', GNF: 'GNF', ETB: 'Br', GMD: 'D',
}

const FEE_RATE = 0.015

const BRAND_LOGO = {
  visa:       { text: 'VISA', bg: '#1D4ED8', fg: '#fff' },
  mastercard: { text: 'MC',   bg: '#DC2626', fg: '#fff' },
  amex:       { text: 'AMEX', bg: '#2563EB', fg: '#fff' },
  discover:   { text: 'DISC', bg: '#EA580C', fg: '#fff' },
  unknown:    { text: '💳',   bg: '#E5E7EB', fg: '#374151' },
}

const TYPE_BADGE = {
  ach:          { text: '🏛', bg: '#F3F4F6', fg: '#374151' },
  bank_transfer:{ text: '🏛', bg: '#F3F4F6', fg: '#374151' },
  paypal:       { text: 'PP', bg: '#003087', fg: '#fff' },
  apple_pay:    { text: '⌘',  bg: '#000',    fg: '#fff' },
  google_pay:   { text: 'G',  bg: '#4285F4', fg: '#fff' },
}

async function notifySender(transferData) {
  // /notifications only supports GET — skip the in-app notification POST
  // Only call transfer-email if that endpoint exists on your backend
  try {
    await api.post('/notifications/transfer-email', {
      recipient_type:  'sender',
      transfer_type:   transferData.pickup_code ? 'cash_pickup' : transferData.wave_ref ? 'wave' : 'wallet',
      transaction_ref: transferData.transaction_ref,
      send_amount:     transferData.send_amount,
      send_currency:   transferData.send_currency,
      fee:             transferData.fee,
      received_amount: transferData.received_amount,
      recv_currency:   transferData.recv_currency,
      recipient_name:  transferData.recipient_name,
      exchange_rate:   transferData.exchange_rate,
      pickup_code:     transferData.pickup_code || null,
    })
  } catch { /* silent */ }
}

async function notifyRecipient(transferData, toPhone) {
  try {
    await api.post('/notifications/recipient-notify', {
      to_phone:        toPhone,
      transfer_type:   transferData.pickup_code ? 'cash_pickup' : transferData.wave_ref ? 'wave' : 'wallet',
      transaction_ref: transferData.transaction_ref,
      received_amount: transferData.received_amount,
      recv_currency:   transferData.recv_currency,
      sender_name:     transferData.sender_name || null,
      pickup_code:     transferData.pickup_code || null,
      wave_ref:        transferData.wave_ref    || null,
    })
  } catch { /* silent — 403 means backend route needs permission fix, see backend instructions */ }
}

function buildReceiptHtml(transferData, senderName) {
  const date = new Date(transferData.sent_at || Date.now()).toLocaleString('en', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const ref = (transferData.transaction_ref || '').slice(0, 20)

  const row = (label, value) => value != null && value !== ''
    ? `<tr>
        <td style="padding:10px 0;color:#6B7280;font-size:14px;border-bottom:1px solid #F3F4F6">${label}</td>
        <td style="padding:10px 0;text-align:right;font-weight:600;color:#111;font-size:14px;border-bottom:1px solid #F3F4F6">${value}</td>
       </tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto">
    <tr>
      <td style="background:#0A1628;border-radius:16px 16px 0 0;padding:32px;text-align:center">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.45)">KALIPEH WALLET</p>
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff">Transfer Receipt</h1>
        <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.5)">${date}</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fff;padding:32px">

        <div style="text-align:center;margin-bottom:28px">
          <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:#D4EFEE;line-height:64px;font-size:30px;margin-bottom:12px">✓</div>
          <p style="margin:0;font-size:15px;color:#6B7280">
            <strong style="color:#111">${senderName || 'You'}</strong> sent
          </p>
          <p style="margin:4px 0 0;font-size:36px;font-weight:800;color:#111">
            ${transferData.send_amount} <span style="font-size:20px;color:#374151">${transferData.send_currency}</span>
          </p>
          ${transferData.received_amount && transferData.recv_currency !== transferData.send_currency
            ? `<p style="margin:6px 0 0;font-size:14px;color:#6B7280">
                Recipient receives <strong>${transferData.received_amount} ${transferData.recv_currency}</strong>
               </p>`
            : ''}
        </div>

        <table width="100%" cellpadding="0" cellspacing="0">
          ${row('Recipient',     transferData.recipient_name || '—')}
          ${row('Transfer amount', `${transferData.send_amount} ${transferData.send_currency}`)}
          ${row('Fee (1.5%)',    transferData.fee != null ? `${transferData.fee} ${transferData.send_currency}` : null)}
          ${row('Exchange rate', transferData.exchange_rate && transferData.recv_currency !== transferData.send_currency
            ? `1 ${transferData.send_currency} = ${transferData.exchange_rate} ${transferData.recv_currency}` : null)}
          ${row('Total debited', `${transferData.send_amount} ${transferData.send_currency}`)}
          ${row('Reference',     ref ? ref + '…' : null)}
          ${row('Status',        '<span style="color:#16A34A;font-weight:700">Completed ✓</span>')}
        </table>

        ${transferData.pickup_code
          ? `<div style="margin-top:20px;background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:8px;padding:14px">
              <p style="margin:0;font-size:13px;color:#92400E">
                <strong>Cash pickup code:</strong> ${transferData.pickup_code}
              </p>
             </div>`
          : ''}

      </td>
    </tr>
    <tr>
      <td style="background:#F9FAFB;border-radius:0 0 16px 16px;padding:20px;text-align:center">
        <p style="margin:0;font-size:12px;color:#9CA3AF">
          This is an automated receipt from KalipehWallet.<br>
          Please keep this for your records.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendReceipt(transferData, senderEmail, senderName) {
  if (!senderEmail) return

  // Load SMTP config saved by SmtpSettingsScreen → AsyncStorage
  let smtpConfig = null
  try {
    const raw = await AsyncStorage.getItem('smtp_config')
    if (raw) smtpConfig = JSON.parse(raw)
  } catch { /* ignore */ }

  if (!smtpConfig?.host || !smtpConfig?.username) {
    Toast.show({
      type: 'error',
      text1: 'Receipt not sent — SMTP not configured',
      text2: 'Go to Profile → Settings → Email (SMTP)',
    })
    return
  }

  const subject = `Transfer Receipt — ${transferData.send_amount} ${transferData.send_currency} sent`
  const html    = buildReceiptHtml(transferData, senderName)
  const text    = `Transfer Receipt\n\nYou sent ${transferData.send_amount} ${transferData.send_currency} to ${transferData.recipient_name || '—'}.\nFee: ${transferData.fee} ${transferData.send_currency}\nReference: ${transferData.transaction_ref || ''}\n\nKalipehWallet`

  try {
    // POST the full email content + SMTP credentials.
    // Backend only needs to open an SMTP connection and send — no templates needed.
    await api.post('/email/send', {
      smtp_config: smtpConfig,
      to:          senderEmail,
      subject,
      html,
      text,
    })
  } catch (err) {
    const detail = err.response?.data?.detail || err.message || 'Unknown error'
    Toast.show({ type: 'error', text1: 'Receipt email failed', text2: String(detail) })
  }
}

function fmt(n, ccy) {
  if (n == null || isNaN(n)) return '—'
  const sym = CURRENCY_SYMBOLS[ccy] || ccy
  return `${sym} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export default function SendMoneyScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [wallet, setWallet]                 = useState(null)
  const [toPhone, setToPhone]               = useState(route.params?.to_phone || '')
  const [delivery, setDelivery]             = useState(route.params?.delivery || 'wallet')
  const [description, setDescription]       = useState('')
  const [amount, setAmount]                 = useState('')
  const [destCountry, setDestCountry]       = useState(DEST_COUNTRIES[16])
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [liveRate, setLiveRate]             = useState(null)
  const [rateLoading, setRateLoading]       = useState(false)
  const [quote, setQuote]                   = useState(null)
  const [quoteLoading, setQuoteLoading]     = useState(false)
  const [loading, setLoading]               = useState(false)
  const [confirming, setConfirming]         = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [result, setResult]                 = useState(null)
  const [transactions, setTransactions]     = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedPayMethod, setSelectedPayMethod] = useState(null) // null = wallet
  const [showPayPicker, setShowPayPicker]   = useState(false)

  const senderCcy    = wallet?.currency || 'USD'
  const destCcy      = destCountry.currency
  const sendAmt      = parseFloat(amount) || 0
  const fee          = parseFloat((sendAmt * FEE_RATE).toFixed(2))
  const netAmt       = parseFloat((sendAmt - fee).toFixed(2))
  const effectiveRate = (quote?.recipient_found ? quote.exchange_rate : liveRate) ?? liveRate
  const receivedAmt  = effectiveRate && netAmt > 0
    ? parseFloat((netAmt * effectiveRate).toFixed(2))
    : null
  const isValid = toPhone.trim().length > 5 && sendAmt > 0

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase()

  const autoConfirmTriggered = useRef(false)

  // Sync params whenever the screen is (re-)focused with new recipient data
  useEffect(() => {
    if (route.params?.to_phone) setToPhone(route.params.to_phone)
    if (route.params?.delivery) setDelivery(route.params.delivery)
    if (route.params?.amount)   setAmount(route.params.amount)
    if (route.params?.country_name) {
      const match = DEST_COUNTRIES.find(c => c.name === route.params.country_name)
      if (match) setDestCountry(match)
    }
    // Reset trigger when a new autoConfirm signal arrives
    if (route.params?.autoConfirm) autoConfirmTriggered.current = false
  }, [route.params?.to_phone, route.params?.country_name, route.params?.delivery, route.params?.amount, route.params?.autoConfirm])

  // Auto-open confirm sheet when navigated here from "Repeat Transfer"
  useEffect(() => {
    if (!route.params?.autoConfirm) return
    if (autoConfirmTriggered.current) return
    if (!wallet || !toPhone || parseFloat(amount) <= 0) return
    autoConfirmTriggered.current = true
    handleContinue()
  }, [route.params?.autoConfirm, wallet, toPhone, amount])

  useEffect(() => {
    if (!senderCcy || !destCcy) return
    if (senderCcy === destCcy) { setLiveRate(1.0); return }
    setRateLoading(true)
    api.get(`/exchange/convert?from=${senderCcy}&to=${destCcy}&amount=1`)
      .then(({ data }) => setLiveRate(data.rate))
      .catch(() => setLiveRate(null))
      .finally(() => setRateLoading(false))
  }, [senderCcy, destCcy])

  useEffect(() => {
    api.get('/wallet/balance').then(({ data }) => setWallet(data)).catch(() => {})
    api.get('/transactions?limit=5').then(({ data }) => setTransactions(data.transactions || [])).catch(() => {})
    api.get('/payment-methods').then(({ data }) => setPaymentMethods(data.payment_methods || [])).catch(() => {})
  }, [])

  const fetchQuote = useCallback(async (phone, amt, recvCcy) => {
    if (!phone || !amt || parseFloat(amt) <= 0) { setQuote(null); return }
    setQuoteLoading(true)
    try {
      const { data } = await api.get(
        `/transfer/quote?to_phone=${encodeURIComponent(phone)}&amount=${amt}&recv_currency=${recvCcy}`
      )
      setQuote(data)
      if (data.recipient_found && data.exchange_rate) setLiveRate(data.exchange_rate)
    } catch { setQuote(null) }
    finally { setQuoteLoading(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchQuote(toPhone, amount, destCcy), 600)
    return () => clearTimeout(t)
  }, [toPhone, amount, destCcy, fetchQuote])

  // Phase 1: confirm funds exist before sending
  const verifyPayment = async () => {
    const { data: freshWallet } = await api.get('/wallet/balance')
    setWallet(freshWallet)
    if (parseFloat(freshWallet.balance) < sendAmt) {
      throw new Error(
        `Insufficient balance. Available: ${fmt(parseFloat(freshWallet.balance), senderCcy)}`
      )
    }
  }

  // "Continue to send" — verify funds then show confirmation sheet
  const handleContinue = async () => {
    if (!toPhone.trim()) return Toast.show({ type: 'error', text1: 'Enter recipient phone' })
    if (!amount || sendAmt <= 0) return Toast.show({ type: 'error', text1: 'Enter an amount' })
    setLoading(true)
    try {
      await verifyPayment()
      setShowConfirm(true)
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || err.message || 'Transfer failed' })
    } finally {
      setLoading(false)
    }
  }

  // "Confirm transfer" — routes to the correct backend endpoint per delivery method
  const confirmTransfer = async () => {
    setConfirming(true)
    try {
      let responseData

      const payMethodId = selectedPayMethod?.id || null

      if (delivery === 'wave') {
        const { data } = await api.post('/transfer/wave', {
          to_phone:           toPhone,
          amount:             sendAmt,
          recv_currency:      destCcy,
          description,
          ...(payMethodId && { payment_method_id: payMethodId }),
        })
        responseData = data

      } else if (delivery === 'cash') {
        const agentsRes = await api.get(
          `/transfer/agents?country=${encodeURIComponent(destCountry.name)}`
        )
        const agents = agentsRes.data?.agents || []
        if (!agents.length) {
          throw new Error(`No cash pickup agents available in ${destCountry.name}`)
        }
        const { data } = await api.post('/transfer/cash-pickup', {
          to_phone:           toPhone,
          recipient_name:     quote?.recipient_name || toPhone,
          amount:             sendAmt,
          recv_currency:      destCcy,
          agent_id:           agents[0].id,
          description,
          ...(payMethodId && { payment_method_id: payMethodId }),
        })
        responseData = data

      } else {
        const { data } = await api.post('/transfer/send', {
          to_phone:           toPhone,
          amount:             sendAmt,
          recv_currency:      destCcy,
          description,
          ...(payMethodId && { payment_method_id: payMethodId }),
        })
        responseData = data
      }

      // Inject recipient_name (backends don't return it for wave/wallet)
      const enriched = {
        ...responseData,
        recipient_name: responseData.recipient_name || quote?.recipient_name || toPhone,
      }

      const sentAt = new Date().toISOString()
      setShowConfirm(false)
      notifySender(enriched)
      notifyRecipient(enriched, toPhone)
      sendReceipt(enriched, user?.email, user?.full_name)
      setResult({ ...enriched, sent_at: sentAt })
      Toast.show({ type: 'success', text1: 'Transfer sent!' })
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        err.message ||
        'Transfer failed'
      Toast.show({ type: 'error', text1: String(msg) })
    } finally {
      setConfirming(false)
    }
  }

  // ── Success / Receipt screen ──────────────────────────────────────────────────
  if (result) {
    const sentDate = result.sent_at
      ? new Date(result.sent_at).toLocaleString('en', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : ''

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F4F6F9' }}
        contentContainerStyle={[s.successWrap, { paddingTop: insets.top + 20, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon + title */}
        <View style={s.successIconWrap}>
          <CheckCircle size={48} color={TEAL} />
        </View>
        <Text style={s.successTitle}>Transfer Sent!</Text>
        {sentDate ? <Text style={s.successDate}>{sentDate}</Text> : null}

        {/* Recipient + received amount hero */}
        <View style={s.successHero}>
          <Text style={s.successHeroLabel}>
            {result.recipient_name || toPhone} will receive
          </Text>
          <Text style={s.successHeroAmount}>
            {result.received_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <Text style={s.successHeroCcy}> {result.recv_currency}</Text>
          </Text>
        </View>

        {/* Receipt card */}
        <View style={s.successCard}>
          <Text style={s.receiptCardTitle}>Receipt</Text>
          <SuccessRow label="Recipient"    value={result.recipient_name || toPhone} />
          <SuccessRow label="Phone"        value={toPhone} />
          <SuccessRow label="You sent"     value={fmt(result.send_amount, result.send_currency)} bold />
          <SuccessRow label="Fee (1.5%)"   value={fmt(result.fee, result.send_currency)} />
          {result.recv_currency !== result.send_currency && (
            <SuccessRow
              label="Exchange rate"
              value={`1 ${result.send_currency} = ${result.exchange_rate?.toFixed(4)} ${result.recv_currency}`}
            />
          )}
          <SuccessRow label="Total debited" value={fmt(result.send_amount, result.send_currency)} bold />
          <SuccessRow
            label="Reference"
            value={result.transaction_ref
              ? result.transaction_ref.slice(0, 18) + (result.transaction_ref.length > 18 ? '…' : '')
              : '—'}
          />
        </View>

        {/* Receipt email badge */}
        {user?.email && (
          <View style={s.receiptEmailBadge}>
            <Mail size={14} color={TEAL} />
            <Text style={s.receiptEmailText}>
              Receipt sent to <Text style={{ fontWeight: '700' }}>{user.email}</Text>
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <TouchableOpacity style={s.successBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={s.successBtnText}>Back to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.successBtnSecondary}
          onPress={() => navigation.navigate('Transactions')}
        >
          <Text style={s.successBtnSecondaryText}>View History</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ── Main screen ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F4F6F9' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Dark header band ── */}
        <View style={[s.headerBand, { paddingTop: insets.top + 16 }]}>

          {/* Top row: avatar + invite */}
          <View style={s.topRow}>
            <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate('Profile')} activeOpacity={0.85}>
              <Text style={s.avatarText}>{initials}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.inviteBtn} activeOpacity={0.8}>
              <Zap size={13} color="#0A1628" style={{ marginRight: 4 }} />
              <Text style={s.inviteBtnText}>Invite friends</Text>
            </TouchableOpacity>
          </View>

          {/* Title + country */}
          <View style={s.titleRow}>
            <View>
              <Text style={s.titleSub}>Transfer</Text>
              <Text style={s.title}>Send money to</Text>
            </View>
            <TouchableOpacity
              style={s.countryPill}
              onPress={() => setShowCountryPicker(v => !v)}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 18 }}>{destCountry.flag}</Text>
              <Text style={s.countryPillText}>{destCountry.name}</Text>
              <ChevronDown size={13} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Country dropdown ── */}
        {showCountryPicker && (
          <View style={s.countryDropdown}>
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {DEST_COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.name}
                  style={[s.countryOption, c.name === destCountry.name && s.countryOptionActive]}
                  onPress={() => { setDestCountry(c); setShowCountryPicker(false) }}
                >
                  <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                  <Text style={s.countryOptionName}>{c.name}</Text>
                  <Text style={s.countryOptionCcy}>{c.currency}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Main card (floats over header) ── */}
        <View style={s.mainCard}>

          {/* Recipient row */}
          <View style={s.recipientSection}>
            <View style={s.recipientIconWrap}>
              <Text style={s.recipientIcon}>👤</Text>
            </View>
            <TextInput
              style={s.recipientInput}
              placeholder="Recipient phone number"
              placeholderTextColor="#A0AEC0"
              value={toPhone}
              onChangeText={setToPhone}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={s.addRecipientBtn}
              onPress={() => navigation.navigate('Recipients', { country_name: destCountry.name, to_phone: toPhone })}
              activeOpacity={0.7}
            >
              <UserPlus size={18} color={TEAL} />
            </TouchableOpacity>
          </View>

          {/* Verified badge */}
          {quoteLoading && (
            <View style={s.statusRow}>
              <Spinner size="sm" color={TEAL} />
              <Text style={s.statusText}>Verifying recipient…</Text>
            </View>
          )}
          {!quoteLoading && quote?.recipient_found && (
            <View style={s.statusRow}>
              <CheckCircle size={14} color="#10B981" />
              <Text style={[s.statusText, { color: '#10B981' }]}>{quote.recipient_name} · Verified</Text>
            </View>
          )}

          <View style={s.cardDivider} />

          {/* Amount inputs */}
          <View style={s.amountSection}>
            {/* You send */}
            <View style={s.amountCol}>
              <Text style={s.amountLabel}>YOU SEND</Text>
              <View style={s.amountInputRow}>
                <Text style={s.currencySymbol}>{CURRENCY_SYMBOLS[senderCcy] || senderCcy}</Text>
                <TextInput
                  style={s.amountInput}
                  placeholder="0"
                  placeholderTextColor="#CBD5E0"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <Text style={s.amountCcy}>{senderCcy}</Text>
            </View>

            {/* Divider with arrow */}
            <View style={s.arrowCol}>
              <View style={s.arrowCircle}>
                <ArrowRight size={16} color="#fff" />
              </View>
            </View>

            {/* They receive */}
            <View style={[s.amountCol, { alignItems: 'flex-end' }]}>
              <Text style={s.amountLabel}>THEY GET</Text>
              <Text style={s.receivedValue}>
                {rateLoading ? '…' : receivedAmt != null
                  ? receivedAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : '0'}
              </Text>
              <TouchableOpacity
                style={s.currencySelectorPill}
                onPress={() => setShowCountryPicker(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={s.currencySelectorText}>{destCcy}</Text>
                <ChevronDown size={10} color={TEAL} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Rate chip */}
          <View style={s.rateChip}>
            <Text style={s.rateChipText}>
              1 {senderCcy} = {effectiveRate ? effectiveRate.toFixed(4) : '—'} {destCcy}
            </Text>
            <View style={s.rateChipDot} />
            <Text style={s.rateChipText}>
              Fee {sendAmt > 0 ? fmt(fee, senderCcy) : '0.00'}
            </Text>
          </View>

        </View>

        {/* ── CTA button ── */}
        <View style={s.ctaWrap}>
          <TouchableOpacity
            style={[s.ctaBtn, (!isValid || loading) && s.ctaBtnOff]}
            onPress={handleContinue}
            disabled={!isValid || loading}
            activeOpacity={0.88}
          >
            {loading
              ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Spinner size="sm" color={isValid ? '#fff' : '#AAA'} />
                  <Text style={[s.ctaBtnText, !isValid && s.ctaBtnTextOff]}>Verifying…</Text>
                </View>
              : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={[s.ctaBtnText, !isValid && s.ctaBtnTextOff]}>Continue to send</Text>
                  {isValid && <ArrowRight size={18} color="#fff" />}
                </View>
            }
          </TouchableOpacity>

          {/* Trust chips */}
          <View style={s.trustRow}>
            <View style={s.trustChip}>
              <Shield size={12} color="#10B981" />
              <Text style={s.trustText}>Secure</Text>
            </View>
            <View style={s.trustChip}>
              <Clock size={12} color="#F59E0B" />
              <Text style={s.trustText}>Under a minute</Text>
            </View>
            <View style={s.trustChip}>
              <Zap size={12} color={TEAL} />
              <Text style={s.trustText}>1.5% fee</Text>
            </View>
          </View>
        </View>

        {/* ── Wave promo ── */}
        <View style={s.promoCard}>
          <View style={s.promoLeft}>
            <Text style={s.promoTitle}>Rapid, secure{'\n'}transfer</Text>
            <Text style={s.promoSub}>Via Wave mobile wallets & agents</Text>
          </View>
          <View style={s.promoRight}>
            <View style={s.waveIconBox}>
              <Text style={{ fontSize: 28 }}>🐧</Text>
            </View>
            <Text style={s.waveWord}>wave</Text>
          </View>
        </View>

        {/* ── Recent transactions ── */}
        <View style={s.txSection}>
          <View style={s.txHeader}>
            <Text style={s.txTitle}>Recent</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')} activeOpacity={0.7}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={s.txCard}>
            {transactions.length === 0
              ? <Text style={s.txEmpty}>No transactions yet</Text>
              : transactions.map((tx, i) => <TxRow key={tx.id} tx={tx} last={i === transactions.length - 1} />)
            }
          </View>
        </View>

      </ScrollView>

      {/* ── Confirmation bottom sheet ── */}
      <Modal
        visible={showConfirm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={cs.overlay}>
          <View style={[cs.sheet, { paddingBottom: insets.bottom + 20 }]}>

            {/* Close */}
            <TouchableOpacity style={cs.closeBtn} onPress={() => setShowConfirm(false)} activeOpacity={0.7}>
              <Text style={cs.closeX}>✕</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Recipient */}
              <ConfirmRow label="Recipient" noDivider={false}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flex: 1 }}>
                  <View>
                    <Text style={cs.valueMain}>{quote?.recipient_name || toPhone}</Text>
                    <Text style={cs.valueSub}>{toPhone}</Text>
                  </View>
                  <Text style={{ fontSize: 24 }}>{destCountry.flag}</Text>
                </View>
              </ConfirmRow>

              {/* Transfer Amount */}
              <ConfirmRow label="Transfer Amount">
                <Text style={cs.valueMain}>{sendAmt.toFixed(2)} {senderCcy}</Text>
              </ConfirmRow>

              {/* Transfer Fees */}
              <ConfirmRow label="Transfer Fees">
                <Text style={cs.valueMain}>{fee.toFixed(2)} {senderCcy}</Text>
              </ConfirmRow>

              {/* Exchange Rate */}
              <ConfirmRow label="Exchange Rate">
                <Text style={cs.valueMain}>
                  1 {senderCcy} = {effectiveRate ? effectiveRate.toFixed(2) : '—'} {destCcy}
                </Text>
              </ConfirmRow>

              {/* Total to Recipient */}
              <ConfirmRow label={`Total to\nRecipient`}>
                <View>
                  <Text style={cs.valueMain}>
                    {receivedAmt != null ? receivedAmt.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'} {destCcy}
                  </Text>
                  <Text style={cs.valueNote}>
                    Your recipient may receive less due to fees charged by the mobile wallet provider, by a bank, and/or foreign taxes.
                  </Text>
                </View>
              </ConfirmRow>

              {/* Estimated Delivery */}
              <ConfirmRow label={`Estimated\nDelivery By`}>
                <Text style={cs.valueMain}>Under a minute</Text>
              </ConfirmRow>

              {/* Pay with */}
              <ConfirmRow label="Pay with">
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'space-between' }}
                  onPress={() => setShowPayPicker(true)}
                  activeOpacity={0.7}
                >
                  {selectedPayMethod ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <PayMethodBadge method={selectedPayMethod} />
                      <View>
                        <Text style={cs.valueMain}>{selectedPayMethod.label}</Text>
                        <Text style={cs.valueSub}>{selectedPayMethod.type === 'card' && selectedPayMethod.expiry_month ? `Expires ${String(selectedPayMethod.expiry_month).padStart(2,'0')}/${selectedPayMethod.expiry_year}` : selectedPayMethod.type.replace('_', ' ')}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={cs.walletBadge}><Text style={cs.walletBadgeText}>W</Text></View>
                      <View>
                        <Text style={cs.valueMain}>Wallet</Text>
                        <Text style={cs.valueSub}>{wallet ? `${Number(wallet.balance).toLocaleString()} ${senderCcy}` : 'Balance'}</Text>
                      </View>
                    </View>
                  )}
                  <Text style={{ color: '#BBBBBB', fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              </ConfirmRow>

              {/* Total Amount */}
              <ConfirmRow label="Total Amount">
                <Text style={[cs.valueMain, { fontWeight: '800', fontSize: 20 }]}>{sendAmt.toFixed(2)} {senderCcy}</Text>
              </ConfirmRow>

              {/* Fraud warning */}
              <View style={cs.fraudBox}>
                <Text style={cs.fraudText}>
                  Please be sure you know your recipient. Fraudulent transactions may result in the loss of your money with no recourse. To report fraud or suspected fraud, call 701-515-4355.
                </Text>
              </View>

            </ScrollView>

            {/* Confirm button */}
            <TouchableOpacity
              style={[cs.confirmBtn, confirming && { opacity: 0.7 }]}
              onPress={confirmTransfer}
              disabled={confirming}
              activeOpacity={0.85}
            >
              {confirming
                ? <Spinner size="sm" color="#7A6000" />
                : <Text style={cs.confirmBtnText}>Confirm transfer</Text>
              }
            </TouchableOpacity>

            {/* ── Payment picker overlay (inside modal to avoid stacking two Modals) ── */}
            {showPayPicker && (
              <View style={cs.pickerOverlay}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPayPicker(false)} />
                <View style={[cs.pickerSheet, { paddingBottom: insets.bottom + 20 }]}>
                  <View style={cs.pickerHeader}>
                    <Text style={cs.pickerTitle}>Pay with</Text>
                    <TouchableOpacity onPress={() => setShowPayPicker(false)} style={cs.closeBtn} activeOpacity={0.7}>
                      <Text style={cs.closeX}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Wallet option */}
                  <TouchableOpacity
                    style={[cs.pickerRow, !selectedPayMethod && cs.pickerRowSelected]}
                    onPress={() => { setSelectedPayMethod(null); setShowPayPicker(false) }}
                    activeOpacity={0.75}
                  >
                    <View style={cs.walletBadge}><Text style={cs.walletBadgeText}>W</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={cs.pickerLabel}>Wallet</Text>
                      <Text style={cs.pickerSub}>{wallet ? `${Number(wallet.balance).toLocaleString()} ${senderCcy}` : 'Balance'}</Text>
                    </View>
                    {!selectedPayMethod && <View style={cs.selectedDot} />}
                  </TouchableOpacity>

                  {/* Saved payment methods */}
                  {paymentMethods.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[cs.pickerRow, selectedPayMethod?.id === m.id && cs.pickerRowSelected]}
                      onPress={() => { setSelectedPayMethod(m); setShowPayPicker(false) }}
                      activeOpacity={0.75}
                    >
                      <PayMethodBadge method={m} />
                      <View style={{ flex: 1 }}>
                        <Text style={cs.pickerLabel}>{m.label}</Text>
                        <Text style={cs.pickerSub}>
                          {m.type === 'card' && m.expiry_month
                            ? `Expires ${String(m.expiry_month).padStart(2, '0')}/${m.expiry_year}`
                            : m.type.replace('_', ' ')}
                        </Text>
                      </View>
                      {selectedPayMethod?.id === m.id && <View style={cs.selectedDot} />}
                    </TouchableOpacity>
                  ))}

                  {paymentMethods.length === 0 && (
                    <Text style={cs.pickerEmpty}>No saved payment methods. Add one in Settings.</Text>
                  )}
                </View>
              </View>
            )}

          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  )
}

function PayMethodBadge({ method }) {
  if (method.type === 'card') {
    const brand = BRAND_LOGO[method.card_brand] || BRAND_LOGO.unknown
    return (
      <View style={[cs.walletBadge, { backgroundColor: brand.bg, width: 44 }]}>
        <Text style={[cs.walletBadgeText, { color: brand.fg, fontSize: 10 }]}>{brand.text}</Text>
      </View>
    )
  }
  const badge = TYPE_BADGE[method.type] || { text: '💳', bg: '#E5E7EB', fg: '#374151' }
  return (
    <View style={[cs.walletBadge, { backgroundColor: badge.bg, width: 44 }]}>
      <Text style={[cs.walletBadgeText, { color: badge.fg, fontSize: 13 }]}>{badge.text}</Text>
    </View>
  )
}

function TxRow({ tx }) {
  const isDelivered = tx.status === 'completed'
  const date = tx.created_at
    ? new Date(tx.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
    : ''
  return (
    <View style={t.row}>
      <View style={{ flex: 1 }}>
        <Text style={t.name}>{tx.recipient_name || tx.to_phone || 'Unknown'}</Text>
        <View style={t.meta}>
          <Text style={t.date}>{date}</Text>
          {isDelivered && (
            <View style={t.badge}>
              <Text style={t.badgeText}>DELIVERED</Text>
            </View>
          )}
          {!isDelivered && tx.status && (
            <View style={[t.badge, { backgroundColor: '#FEF9C3' }]}>
              <Text style={[t.badgeText, { color: '#92400E' }]}>{tx.status.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={t.amount}>
          {tx.send_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.send_currency}
        </Text>
        <Text style={t.subAmount}>
          {tx.received_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.recv_currency}
        </Text>
      </View>
    </View>
  )
}

function SuccessRow({ label, value, bold }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '500', flexShrink: 0, marginRight: 12 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '700' : '500', color: '#111', textAlign: 'right', flex: 1 }} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  // ── Header band ──────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: '#0A1628',
    paddingHorizontal: 20,
    paddingBottom: 52,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5C842',
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9,
  },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#0A1628' },

  titleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  titleSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 4, textTransform: 'uppercase' },
  title:    { fontSize: 26, fontWeight: '800', color: '#fff' },
  countryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  countryPillText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // ── Country dropdown ─────────────────────────────────────────────────────────
  countryDropdown: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    marginHorizontal: 16, marginTop: -8, marginBottom: 8, overflow: 'hidden', zIndex: 99,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 8,
  },
  countryOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  countryOptionActive:{ backgroundColor: '#F0FAF9' },
  countryOptionName:  { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },
  countryOptionCcy:   { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  // ── Main card ────────────────────────────────────────────────────────────────
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: -36,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },

  // Recipient row
  recipientSection: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
  },
  recipientIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0FAF9',
    alignItems: 'center', justifyContent: 'center',
  },
  recipientIcon:  { fontSize: 20 },
  recipientInput: { flex: 1, fontSize: 16, color: '#111', paddingVertical: 0 },
  addRecipientBtn:{ padding: 8 },

  // Status row (verified/loading)
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 52 },
  statusText: { fontSize: 13, color: '#9CA3AF' },

  cardDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },

  // Amount columns
  amountSection: {
    flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 14,
  },
  amountCol:    { flex: 1 },
  amountLabel:  { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 8 },
  amountInputRow:{ flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  currencySymbol:{ fontSize: 18, fontWeight: '700', color: '#111' },
  amountInput:  { fontSize: 26, fontWeight: '800', color: '#111', minWidth: 60, paddingVertical: 0 },
  amountCcy:    { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontWeight: '500' },

  // Arrow column
  arrowCol: { width: 48, alignItems: 'center', justifyContent: 'center', paddingTop: 14 },
  arrowCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
  },

  // They get
  receivedValue: { fontSize: 26, fontWeight: '800', color: '#111' },
  currencySelectorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-end',
    backgroundColor: '#F0FAF9',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
    marginTop: 4,
    borderWidth: 1, borderColor: '#C9EDE9',
  },
  currencySelectorText: { fontSize: 12, fontWeight: '700', color: TEAL },

  // Rate chip
  rateChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  rateChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  rateChipDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },

  // ── CTA ──────────────────────────────────────────────────────────────────────
  ctaWrap: { paddingHorizontal: 16, marginTop: 18, marginBottom: 18 },
  ctaBtn:  {
    backgroundColor: TEAL,
    borderRadius: 32, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 10,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  ctaBtnOff:     { backgroundColor: '#E5E5E5', shadowOpacity: 0 },
  ctaBtnText:    { fontSize: 17, fontWeight: '700', color: '#fff' },
  ctaBtnTextOff: { color: '#AAAAAA' },

  // Trust chips
  trustRow:  { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // ── Wave promo card ───────────────────────────────────────────────────────────
  promoCard: {
    marginHorizontal: 16, marginBottom: 18,
    backgroundColor: '#0A1628',
    borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  promoLeft:  { flex: 1 },
  promoRight: { alignItems: 'center', gap: 6 },
  promoTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4, lineHeight: 24 },
  promoSub:   { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
  waveIconBox:{
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#1BAEC2',
    alignItems: 'center', justifyContent: 'center',
  },
  waveWord: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  // ── Transactions ──────────────────────────────────────────────────────────────
  txSection: { marginHorizontal: 16, marginBottom: 24 },
  txHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  txTitle:   { fontSize: 18, fontWeight: '800', color: '#111' },
  seeAll:    { fontSize: 14, fontWeight: '600', color: TEAL },
  txCard:    {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    overflow: 'hidden',
  },
  txEmpty: { fontSize: 13, color: '#BBBBBB', textAlign: 'center', paddingVertical: 24 },

  // ── Success / Receipt screen ──────────────────────────────────────────────────
  successWrap:          { paddingHorizontal: 24, alignItems: 'center' },
  successIconWrap:      { width: 90, height: 90, borderRadius: 45, backgroundColor: LIGHT_TEAL, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle:         { fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 4 },
  successDate:          { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  successHero:          { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  successHeroLabel:     { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  successHeroAmount:    { fontSize: 36, fontWeight: '800', color: '#111' },
  successHeroCcy:       { fontSize: 20, fontWeight: '600', color: '#374151' },
  successCard:          { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  receiptCardTitle:     { fontSize: 13, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  receiptEmailBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: LIGHT_TEAL, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 24, alignSelf: 'stretch' },
  receiptEmailText:     { fontSize: 13, color: TEAL_TEXT, flex: 1 },
  successBtn:           { backgroundColor: TEAL, borderRadius: 32, paddingVertical: 16, alignItems: 'center', alignSelf: 'stretch', marginBottom: 12 },
  successBtnText:       { fontSize: 16, fontWeight: '700', color: '#fff' },
  successBtnSecondary:  { borderRadius: 32, paddingVertical: 16, alignItems: 'center', alignSelf: 'stretch', borderWidth: 1.5, borderColor: TEAL },
  successBtnSecondaryText: { fontSize: 16, fontWeight: '600', color: TEAL },
})

const t = StyleSheet.create({
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  name:     { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date:     { fontSize: 13, color: '#999' },
  badge:    { backgroundColor: LIGHT_TEAL, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText:{ fontSize: 11, fontWeight: '700', color: TEAL_TEXT, letterSpacing: 0.5 },
  amount:   { fontSize: 15, fontWeight: '700', color: '#111', textAlign: 'right' },
  subAmount:{ fontSize: 13, color: '#999', textAlign: 'right', marginTop: 3 },
})

// ── Confirmation sheet helper ─────────────────────────────────────────────────
function ConfirmRow({ label, children }) {
  return (
    <View style={cs.row}>
      <Text style={cs.label}>{label}</Text>
      <View style={cs.valueWrap}>{children}</View>
    </View>
  )
}

const cs = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 20,
    maxHeight: '92%',
  },

  closeBtn:  { alignSelf: 'flex-end', padding: 6, marginBottom: 12 },
  closeX:    { fontSize: 20, color: '#333', fontWeight: '600' },

  row:       {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#ECECEC',
  },
  label:     { width: 110, fontSize: 14, color: '#888', lineHeight: 20 },
  valueWrap: { flex: 1 },
  valueMain: { fontSize: 18, fontWeight: '600', color: '#111' },
  valueSub:  { fontSize: 13, color: '#888', marginTop: 2 },
  valueNote: { fontSize: 12, color: '#999', marginTop: 6, lineHeight: 17 },

  walletBadge:     { width: 36, height: 24, backgroundColor: '#1A1F71', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  walletBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  fraudBox:  { backgroundColor: '#F2F0EC', borderRadius: 10, padding: 16, marginTop: 20, marginBottom: 16 },
  fraudText: { fontSize: 13, color: '#555', lineHeight: 20 },

  confirmBtn:     { backgroundColor: '#F5C842', borderRadius: 32, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { fontSize: 18, fontWeight: '700', color: '#5A4500' },

  pickerOverlay:  {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  pickerSheet:    {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 20,
  },
  pickerHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerTitle:    { fontSize: 18, fontWeight: '700', color: '#111' },
  pickerRow:      {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  pickerRowSelected: { backgroundColor: '#FFF9E6', borderWidth: 1.5, borderColor: '#F5C842' },
  pickerLabel:    { fontSize: 15, fontWeight: '600', color: '#111' },
  pickerSub:      { fontSize: 13, color: '#888', marginTop: 2 },
  pickerEmpty:    { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
  selectedDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F5C842' },
})
