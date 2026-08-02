import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal, Alert, Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { CardField, useStripe } from '@stripe/stripe-react-native'
import Toast from 'react-native-toast-message'
import { ChevronDown, UserPlus, CheckCircle, ArrowRight, Zap, Shield, Clock, Mail, Trash2, Plus, Home, ArrowLeftRight, TrendingUp, Bell, User, Wallet, Smartphone, Building2 } from 'lucide-react-native'
import { Haptics } from '../utils/haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { CURRENCY_SYMBOLS, fmt, getCurrencyByCountryName } from '../data/currencies'
import { getWalletProvidersForCountry, getProviderById } from '../data/walletProviders'
import useDeviceCurrency from '../hooks/useDeviceCurrency'
import usePaymentMethods from '../hooks/usePaymentMethods'
import useRecipients from '../hooks/useRecipients'
import useWalletBalance from '../hooks/useWalletBalance'
import useTransferQuote from '../hooks/useTransferQuote'

const TEAL = '#0E9E98'
const LIGHT_TEAL = '#D4EFEE'
const TEAL_TEXT = '#0A7A76'
const BEIGE = '#F5F0E8'

// CardField's `cardStyle` prop is native-only config, not RN's `style` — it
// must be a plain object; StyleSheet.create() refs resolve only for `style`.
const CARD_FIELD_STYLE = {
  backgroundColor: '#F9FAFB',
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
  borderRadius: 14,
  fontSize: 16,
  textColor: '#111111',
  placeholderColor: '#9CA3AF',
}

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

// 'wallet' only works when the recipient has a registered Kalipeh account —
// gated at selection time using the /transfer/quote `recipient_found` flag.
const DELIVERY_OPTIONS = [
  { id: 'wallet',        label: 'Kalipeh Wallet', icon: Wallet,     needsAccount: true  },
  { id: 'wave',          label: 'Wave',           icon: Smartphone, needsAccount: false },
  { id: 'mobile_wallet', label: 'Mobile Money',   icon: Smartphone, needsAccount: false },
  { id: 'cash',          label: 'Cash Pickup',    icon: Building2,  needsAccount: false },
]

// Hard-coded fee rate remains until Phase 3 (backend-driven quote)

const FEE_RATE = 0.015

const BRAND_LOGO = {
  visa:       { text: 'VISA', bg: '#1D4ED8', fg: '#fff' },
  mastercard: { text: 'MC',   bg: '#DC2626', fg: '#fff' },
  amex:       { text: 'AMEX', bg: '#2563EB', fg: '#fff' },
  discover:   { text: 'DISC', bg: '#EA580C', fg: '#fff' },
  unknown:    { text: '💳',   bg: '#E5E7EB', fg: '#374151' },
}

function mapStripeBrand(brand) {
  const k = (brand || '').toLowerCase()
  if (k.includes('visa')) return 'visa'
  if (k.includes('master')) return 'mastercard'
  if (k.includes('american') || k === 'amex') return 'amex'
  if (k.includes('discover')) return 'discover'
  return 'unknown'
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
    await api.post('notifications/transfer-email', {
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

function SendStepTracker({ step }) {
  const STEPS = ['Recipient', 'Amount', 'Delivery', 'Payment']
  return (
    <View style={st.wrap}>
      {STEPS.map((label, i) => (
        <View key={label} style={st.item}>
          <View style={[st.dot, i <= step && st.dotActive]}>
            <Text style={[st.dotText, i <= step && st.dotTextActive]}>{i + 1}</Text>
          </View>
          <Text style={[st.label, i <= step && st.labelActive]}>{label}</Text>
          {i < STEPS.length - 1 && <View style={[st.line, i < step && st.lineActive]} />}
        </View>
      ))}
    </View>
  )
}

async function notifyRecipient(transferData, toPhone) {
  try {
    await api.post('notifications/recipient-notify', {
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

  const subject = `Transfer Receipt — ${transferData.send_amount} ${transferData.send_currency} sent`
  const html    = buildReceiptHtml(transferData, senderName)
  const text    = `Transfer Receipt\n\nYou sent ${transferData.send_amount} ${transferData.send_currency} to ${transferData.recipient_name || '—'}.\nFee: ${transferData.fee} ${transferData.send_currency}\nReference: ${transferData.transaction_ref || ''}\n\nKalipehWallet`

  try {
    // Backend handles SMTP configuration
    await api.post('email/send', {
      to:      senderEmail,
      subject,
      html,
      text,
    })
  } catch (err) {
    const detail = err.response?.data?.detail || err.message || 'Unknown error'
    Toast.show({ type: 'error', text1: 'Receipt email failed', text2: String(detail) })
  }
}

export default function SendMoneyScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { createPaymentMethod } = useStripe()

  const [toPhone, setToPhone]               = useState(route.params?.to_phone || '')
  const [delivery, setDelivery]             = useState(route.params?.delivery || 'wallet')
  const [mobileWalletProvider, setMobileWalletProvider] = useState('')
  const [description, setDescription]       = useState('')
  const [amount, setAmount]                 = useState('')
  const [recipientName, setRecipientName]   = useState('')
  const [touchedPhone, setTouchedPhone]     = useState(false)
  const [touchedAmount, setTouchedAmount]   = useState(false)
  const [destCountry, setDestCountry]       = useState(DEST_COUNTRIES[16])
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [liveRate, setLiveRate]             = useState(null)
  const [rateLoading, setRateLoading]       = useState(false)
  const [loading, setLoading]               = useState(false)
  const [confirming, setConfirming]         = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [showDetails, setShowDetails]       = useState(false)
  const [result, setResult]                 = useState(null)
  const [selectedPayMethod, setSelectedPayMethod] = useState(null) // null = wallet
  const [paymentChosen, setPaymentChosen]         = useState(false)
  const [showPayPicker, setShowPayPicker]         = useState(false)
  const [showInsufficientModal, setShowInsufficientModal] = useState(false)
  const [showCardEntry, setShowCardEntry]         = useState(false)
  const [cardDetails, setCardDetails]             = useState(null)
  const [cardHolderName, setCardHolderName]       = useState('')
  const [saveCard, setSaveCard]                   = useState(true)

  const deviceCcy = useDeviceCurrency()
  const { wallet, setWallet, transactions, setTransactions, refresh: refreshWallet } = useWalletBalance()
  const { paymentMethods, setPaymentMethods, refresh: refreshPaymentMethods } = usePaymentMethods()
  const { recipients: savedRecipients, setRecipients: setSavedRecipients, refresh: refreshRecipients } = useRecipients()
  const countryCcy   = getCurrencyByCountryName(user?.country || user?.home_country)
  const senderCcy    = countryCcy || user?.home_currency || deviceCcy || wallet?.currency || 'USD'
  const { quote, loading: quoteLoading, refresh: fetchQuote } = useTransferQuote(toPhone, amount, senderCcy, destCcy)
  const destCcy      = destCountry.currency
  const sendAmt      = parseFloat(amount) || 0
  const fee          = parseFloat((sendAmt * FEE_RATE).toFixed(2))
  const netAmt       = parseFloat((sendAmt - fee).toFixed(2))
  const effectiveRate = (quote?.recipient_found ? quote.exchange_rate : liveRate) ?? liveRate
  const receivedAmt  = effectiveRate && netAmt > 0
    ? parseFloat((netAmt * effectiveRate).toFixed(2))
    : null
  const isValid    = toPhone.trim().length > 5 && sendAmt > 0
  const savedCards = paymentMethods.filter(m => m.type === 'card')
  const savedACH   = paymentMethods.filter(m => m.type === 'ach' || m.type === 'bank_transfer')
  const savedMobileWallets = paymentMethods.filter(m => getProviderById(m.type))

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
    api.get(`exchange/convert?from=${senderCcy}&to=${destCcy}&amount=1`)
      .then(({ data }) => setLiveRate(data.rate))
      .catch(() => setLiveRate(null))
      .finally(() => setRateLoading(false))
  }, [senderCcy, destCcy])

  // Keep the selected mobile wallet provider in sync with the destination country
  useEffect(() => {
    if (delivery !== 'mobile_wallet') return
    const providers = getWalletProvidersForCountry(destCountry.name)
    const selected = providers.find(p => p.id === mobileWalletProvider)
    if (!selected && providers.length) setMobileWalletProvider(providers[0].id)
  }, [destCountry, delivery, mobileWalletProvider])

  // Quote may also carry a known exchange rate
  useEffect(() => {
    if (quote?.recipient_found && quote?.exchange_rate) setLiveRate(quote.exchange_rate)
  }, [quote])

  // Refresh payment methods and recipients when the screen is focused
  useFocusEffect(useCallback(() => {
    refreshPaymentMethods()
    refreshRecipients()
  }, [refreshPaymentMethods, refreshRecipients]))

  // Pull the name from a saved recipient when the phone matches one; otherwise
  // clear it so unknown numbers still require manual entry.
  useEffect(() => {
    const normalized = toPhone.replace(/[\s\-()]/g, '')
    const saved = normalized
      ? savedRecipients.find(r => r.phone_number.replace(/[\s\-()]/g, '') === normalized)
      : null
    setRecipientName(saved ? (saved.nickname || saved.full_name || '') : '')
  }, [toPhone, savedRecipients])

  // Mobile Wallet delivery only works if the recipient has a Kalipeh account.
  // Once the quote confirms they don't, bail out of 'wallet' automatically —
  // otherwise the user reaches payment before discovering the transfer can't
  // go through. Guarded per phone number so it fires once, not on every quote refresh.
  const autoSwitchedForPhone = useRef(null)
  useEffect(() => {
    if (quoteLoading || !quote) return
    if (delivery !== 'wallet' || quote.recipient_found) return
    if (autoSwitchedForPhone.current === toPhone) return
    autoSwitchedForPhone.current = toPhone
    Alert.alert(
      'Switch delivery method?',
      `${toPhone} doesn't have a Kalipeh wallet yet. Cash pickup is available now, or keep Wallet if you want to invite them later.`,
      [
        { text: 'Keep Wallet', style: 'cancel' },
        { text: 'Switch to Cash', onPress: () => setDelivery('cash') },
      ]
    )
  }, [quote, quoteLoading, delivery, toPhone])

  const selectDelivery = (id) => {
    if (id === 'wallet' && quote && !quote.recipient_found) {
      Toast.show({ type: 'error', text1: 'Recipient needs a Kalipeh wallet for this option' })
      return
    }
    if (id === 'mobile_wallet') {
      const providers = getWalletProvidersForCountry(destCountry.name)
      if (!mobileWalletProvider && providers.length) setMobileWalletProvider(providers[0].id)
    } else {
      setMobileWalletProvider('')
    }
    setDelivery(id)
  }

  const walletBalance = parseFloat(wallet?.balance || 0)
  const shortfall     = Math.max(0, parseFloat((sendAmt - walletBalance).toFixed(2)))

  // Phase 1: verify wallet has enough — throws typed error on shortfall
  // Insufficient-balance modal chose a card — select it and stay on confirm sheet
  const selectMethodAndConfirm = (method) => {
    setSelectedPayMethod(method)
    setPaymentChosen(true)
    setShowInsufficientModal(false)
  }

  const goAddPaymentMethod = () => {
    setShowPayPicker(false)
    setShowConfirm(false)
    navigation.navigate('PaymentMethods')
  }

  // Show card entry modal for adding a new card during payment
  const showAddCardDuringPayment = () => {
    setShowPayPicker(false)
    setShowCardEntry(true)
  }

  // Delete a saved payment method
  const deletePaymentMethod = (method) => {
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete ${method.label || 'this payment method'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/payment-methods/${method.id}`)
              // Refresh payment methods list
              const { data } = await api.get('payment-methods')
              setPaymentMethods(data.payment_methods || [])
              // Clear selection if deleted method was selected
              if (selectedPayMethod?.id === method.id) {
                setSelectedPayMethod(null)
                setPaymentChosen(false)
              }
              Toast.show({ type: 'success', text1: 'Payment method deleted' })
            } catch (err) {
              const msg = err.response?.data?.detail || err.message || 'Failed to delete'
              Toast.show({ type: 'error', text1: 'Delete failed', text2: msg })
            }
          },
        },
      ]
    )
  }

  // "Continue to send" — validate fields then open confirmation sheet
  const handleContinue = () => {
    // Check KYC status before allowing transfer
    if (user?.kyc_status !== 'verified') {
      Alert.alert(
        'KYC Required',
        'You need to complete identity verification before sending money.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Verify Now',
            onPress: () => navigation.navigate('KYC'),
          },
        ]
      )
      return
    }

    if (!toPhone.trim()) {
      Haptics.error()
      return Toast.show({ type: 'error', text1: 'Enter recipient phone' })
    }
    if (!amount || sendAmt <= 0) {
      Haptics.error()
      return Toast.show({ type: 'error', text1: 'Enter an amount' })
    }
    if (delivery === 'wallet' && quote && !quote.recipient_found) {
      Haptics.error()
      return Toast.show({ type: 'error', text1: 'Recipient needs a Kalipeh wallet for this option' })
    }
    if (delivery === 'mobile_wallet' && !mobileWalletProvider) {
      Haptics.error()
      return Toast.show({ type: 'error', text1: 'Select a mobile wallet provider' })
    }
    // Reset payment selection so user must choose on confirm sheet
    Haptics.light()
    setSelectedPayMethod(null)
    setPaymentChosen(false)
    setShowConfirm(true)
  }

  // "Confirm transfer" — routes to the correct backend endpoint per delivery method
  const confirmTransfer = async () => {
    console.log('[CONFIRM] selectedPayMethod:', JSON.stringify(selectedPayMethod))
    console.log('[CONFIRM] paymentChosen:', paymentChosen)

    // If card payment method is selected but no ID (new card), show card entry modal
    if (selectedPayMethod?.type === 'card' && !selectedPayMethod?.id) {
      setShowCardEntry(true)
      return
    }

    // If saved card is selected, process payment via card/pay endpoint first
    if (selectedPayMethod?.type === 'card' && selectedPayMethod?.id) {
      setConfirming(true)
      try {
        const payload = {
          payment_method_id: selectedPayMethod.stripe_payment_method_id || selectedPayMethod.id,
          payment_type: 'debit_card',
          amount: sendAmt,
          currency: senderCcy.toLowerCase(),
          description: `Transfer to ${toPhone}`,
        }
        console.log('[STRIPE PAY] Payload:', JSON.stringify(payload))
        console.log('[STRIPE PAY] Selected method:', JSON.stringify(selectedPayMethod))
        const stripeResponse = await api.post('stripe/pay', payload)
        console.log('[STRIPE PAY] Success:', JSON.stringify(stripeResponse.data))
        // Card payment successful, now execute transfer
        console.log('[STRIPE PAY] Now calling executeTransfer...')
        await executeTransfer(true) // skip balance check, payment already processed
        console.log('[STRIPE PAY] executeTransfer completed')
      } catch (err) {
        console.log('[STRIPE PAY] Error response:', JSON.stringify(err.response?.data))
        console.log('[STRIPE PAY] Error status:', err.response?.status)
        const detail = err.response?.data?.detail
        let msg
        if (Array.isArray(detail)) {
          msg = detail.map(d => `${d.loc?.join('.')}: ${d.msg}` || JSON.stringify(d)).join('\n')
        } else if (typeof detail === 'string') {
          msg = detail
        } else {
          msg = err.response?.data?.message || err.message || 'Card payment failed. Please try again.'
        }
        Alert.alert('Card Payment Failed', msg)
        setConfirming(false)
      }
      return
    }

    // For wallet or other payment methods, execute transfer directly
    await executeTransfer()
  }

  // Tokenize the card client-side (raw PAN/CVC never reach our backend),
  // then process the payment and execute the transfer.
  const processCardAndTransfer = async () => {
    if (!cardDetails?.complete) {
      Toast.show({ type: 'error', text1: 'Please fill in all card details' })
      return
    }

    setConfirming(true)
    try {
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: 'Card',
        paymentMethodData: cardHolderName ? { billingDetails: { name: cardHolderName } } : undefined,
      })
      if (error) throw new Error(error.message)

      await api.post('stripe/pay', {
        payment_method_id: paymentMethod.id,
        payment_type: 'debit_card',
        amount: sendAmt,
        currency: senderCcy.toLowerCase(),
        description: `Transfer to ${toPhone}`,
      })

      // Persist the card for future use — best-effort, doesn't block the transfer
      if (saveCard) {
        try {
          await api.post('payment-methods/card', {
            payment_method_id: paymentMethod.id,
            card_brand: mapStripeBrand(paymentMethod.Card?.brand),
            last4: paymentMethod.Card?.last4,
            expiry_month: paymentMethod.Card?.expiryMonth,
            expiry_year: paymentMethod.Card?.expiryYear,
            holder_name: cardHolderName || undefined,
          })
        } catch { /* non-critical — the transfer already succeeded */ }
      }

      // Close card entry modal
      setShowCardEntry(false)
      setCardDetails(null)
      setCardHolderName('')

      // Now execute the transfer (wallet will have the funds)
      await executeTransfer(true) // true = skip balance check, we just funded it
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Card payment failed. Please try again.'
      Alert.alert('Card Payment Failed', String(msg))
      setConfirming(false)
    }
  }

  // Execute the actual transfer
  const executeTransfer = async (skipBalanceCheck = false) => {
    setConfirming(true)
    try {
      // Wallet selected — pre-check balance (skip if using saved payment method or explicit skip)
      const usingSavedPaymentMethod = selectedPayMethod?.id != null
      if (!skipBalanceCheck && !usingSavedPaymentMethod && selectedPayMethod === null) {
        try {
          const { data: freshWallet } = await api.get('wallet/balance')
          setWallet(freshWallet)
          if (parseFloat(freshWallet.balance) < sendAmt) {
            setShowInsufficientModal(true)
            return
          }
        } catch (balanceErr) {
          // If balance check itself fails due to network, proceed — backend will reject if needed
          console.warn('Balance pre-check failed, proceeding to API:', balanceErr.message)
        }
      }

      let responseData
      const resolvedRecipientName = quote?.recipient_name || recipientName.trim() || null

      // Include payment_method_id if a saved payment method is selected
      const paymentMethodId = selectedPayMethod?.id || null

      if (delivery === 'wave') {
        const { data } = await api.post('transfer/wave', {
          to_phone:          toPhone,
          amount:            sendAmt,
          send_currency:     senderCcy,
          recv_currency:     destCcy,
          description,
          recipient_name:    resolvedRecipientName,
          payment_method_id: paymentMethodId,
        })
        responseData = data

      } else if (delivery === 'mobile_wallet') {
        const provider = getProviderById(mobileWalletProvider)
        if (!provider) throw new Error('Select a mobile wallet provider')
        const { data } = await api.post(provider.transferEndpoint, {
          to_phone:          toPhone,
          amount:            sendAmt,
          send_currency:     senderCcy,
          recv_currency:     destCcy,
          description,
          recipient_name:    resolvedRecipientName,
          payment_method_id: paymentMethodId,
          provider:          provider.id,
        })
        responseData = data

      } else if (delivery === 'cash') {
        const agentsRes = await api.get(`transfer/agents?country=${encodeURIComponent(destCountry.name)}`)
        const agents = agentsRes.data?.agents || []
        if (!agents.length) throw new Error(`No cash pickup agents available in ${destCountry.name}`)
        const { data } = await api.post('transfer/cash-pickup', {
          to_phone:          toPhone,
          recipient_name:    resolvedRecipientName || toPhone,
          amount:            sendAmt,
          send_currency:     senderCcy,
          recv_currency:     destCcy,
          agent_id:          agents[0].id,
          description,
          payment_method_id: paymentMethodId,
        })
        responseData = data

      } else {
        const { data } = await api.post('transfer/send', {
          to_phone:          toPhone,
          amount:            sendAmt,
          send_currency:     senderCcy,
          recv_currency:     destCcy,
          description,
          payment_method_id: paymentMethodId,
        })
        responseData = data
      }

      if (!responseData) return

      const resolvedName =
        quote?.recipient_name ||
        recipientName.trim() ||
        responseData?.recipient_name ||
        null
      const enriched = {
        ...(responseData || {}),
        recipient_name: resolvedName,
      }

      setShowConfirm(false)
      Haptics.success()
      notifySender(enriched)
      notifyRecipient(enriched, toPhone)
      sendReceipt(enriched, user?.email, user?.full_name)
      setResult({ ...enriched, sent_at: new Date().toISOString() })

    } catch (err) {
      Haptics.error()
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        err.message ||
        'Transfer failed. Please try again.'
      // Alert renders above the modal so the user always sees the error
      Alert.alert('Transfer Failed', String(msg))
    } finally {
      setConfirming(false)
    }
  }

  // ── Success / Receipt screen ──────────────────────────────────────────────────
  if (result) {
    const sentDate = result.sent_at
      ? new Date(result.sent_at).toLocaleString('en', {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : ''
    const refNumber = result.transaction_ref || `TXN${Date.now()}`
    const recipientDisplayName = result.recipient_name && result.recipient_name !== toPhone
      ? result.recipient_name : 'Recipient'
    const senderCountry = user?.country || 'United States'

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0A1628' }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark header */}
        <View style={rc.header}>
          <View style={rc.headerTop}>
            <Text style={rc.logoText}>KALIPAY</Text>
            <View style={rc.statusBadge}>
              <CheckCircle size={14} color="#10B981" />
              <Text style={rc.statusText}>Successful</Text>
            </View>
          </View>
          <Text style={rc.headerTitle}>Transfer Receipt</Text>
          <Text style={rc.headerDate}>{sentDate}</Text>
          <Text style={rc.headerRef}>Ref: {refNumber.slice(0, 20)}</Text>
        </View>

        {/* Main receipt card */}
        <View style={rc.card}>
          {/* Amount hero */}
          <View style={rc.amountSection}>
            <Text style={rc.amountLabel}>Amount Sent</Text>
            <Text style={rc.amountValue}>
              {fmt(result.send_amount, result.send_currency)}
            </Text>
            {result.recv_currency !== result.send_currency && (
              <View style={rc.convertedRow}>
                <ArrowRight size={14} color={TEAL} />
                <Text style={rc.convertedText}>
                  {result.received_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {result.recv_currency}
                </Text>
              </View>
            )}
          </View>

          <View style={rc.divider} />

          {/* Sender section */}
          <View style={rc.partySection}>
            <View style={rc.partyHeader}>
              <View style={rc.partyIconWrap}>
                <Text style={rc.partyIcon}>↑</Text>
              </View>
              <Text style={rc.partyLabel}>FROM (Sender)</Text>
            </View>
            <View style={rc.partyDetails}>
              <Text style={rc.partyName}>{user?.full_name || 'You'}</Text>
              <View style={rc.partyInfoRow}>
                <Text style={rc.partyInfoIcon}>📍</Text>
                <Text style={rc.partyInfoText}>{senderCountry}</Text>
              </View>
              {user?.phone && (
                <View style={rc.partyInfoRow}>
                  <Text style={rc.partyInfoIcon}>📱</Text>
                  <Text style={rc.partyInfoText}>{user.phone}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={rc.connectionLine}>
            <View style={rc.lineDot} />
            <View style={rc.lineBar} />
            <View style={rc.lineDot} />
          </View>

          {/* Recipient section */}
          <View style={rc.partySection}>
            <View style={rc.partyHeader}>
              <View style={[rc.partyIconWrap, { backgroundColor: '#D1FAE5' }]}>
                <Text style={[rc.partyIcon, { color: '#059669' }]}>↓</Text>
              </View>
              <Text style={rc.partyLabel}>TO (Recipient)</Text>
            </View>
            <View style={rc.partyDetails}>
              <Text style={rc.partyName}>{recipientDisplayName}</Text>
              <View style={rc.partyInfoRow}>
                <Text style={rc.partyInfoIcon}>{destCountry.flag}</Text>
                <Text style={rc.partyInfoText}>{destCountry.name}</Text>
              </View>
              <View style={rc.partyInfoRow}>
                <Text style={rc.partyInfoIcon}>📱</Text>
                <Text style={rc.partyInfoText}>{toPhone}</Text>
              </View>
            </View>
          </View>

          <View style={rc.divider} />

          {/* Transaction details */}
          <View style={rc.detailsSection}>
            <Text style={rc.detailsSectionTitle}>Transaction Details</Text>
            <View style={rc.detailRow}>
              <Text style={rc.detailLabel}>Transfer Amount</Text>
              <Text style={rc.detailValue}>{fmt(result.send_amount, result.send_currency)}</Text>
            </View>
            <View style={rc.detailRow}>
              <Text style={rc.detailLabel}>Transfer Fee (1.5%)</Text>
              <Text style={rc.detailValue}>{fmt(result.fee, result.send_currency)}</Text>
            </View>
            {result.recv_currency !== result.send_currency && (
              <View style={rc.detailRow}>
                <Text style={rc.detailLabel}>Exchange Rate</Text>
                <Text style={rc.detailValue}>1 {result.send_currency} = {result.exchange_rate?.toFixed(4)} {result.recv_currency}</Text>
              </View>
            )}
            <View style={rc.detailRow}>
              <Text style={rc.detailLabel}>Recipient Gets</Text>
              <Text style={[rc.detailValue, { color: TEAL, fontWeight: '700' }]}>
                {result.received_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {result.recv_currency}
              </Text>
            </View>
            <View style={[rc.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={rc.detailLabel}>Delivery Method</Text>
              <Text style={rc.detailValue}>
                {delivery === 'wave' ? 'Wave Mobile Money' : delivery === 'cash' ? 'Cash Pickup' : delivery === 'mobile_wallet' ? 'Mobile Money' : 'Kalipeh Wallet'}
              </Text>
            </View>
          </View>

          {/* Total */}
          <View style={rc.totalSection}>
            <Text style={rc.totalLabel}>Total Charged</Text>
            <Text style={rc.totalValue}>{fmt(result.send_amount, result.send_currency)}</Text>
          </View>
        </View>

        {/* Email receipt badge */}
        {user?.email && (
          <View style={rc.emailBadge}>
            <Mail size={16} color={TEAL} />
            <Text style={rc.emailText}>
              Receipt emailed to <Text style={{ fontWeight: '700' }}>{user.email}</Text>
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={rc.actions}>
          <TouchableOpacity style={rc.primaryBtn} onPress={() => {
            setResult(null)
            setAmount('')
            setToPhone('')
            setSelectedPayMethod(null)
            setPaymentChosen(false)
          }}>
            <Text style={rc.primaryBtnText}>Send Another</Text>
          </TouchableOpacity>
          <TouchableOpacity style={rc.secondaryBtn} onPress={() => navigation.navigate('Main', { screen: 'Transactions' })}>
            <Text style={rc.secondaryBtnText}>View All Transactions</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={rc.footer}>
          Thank you for using KalipehWallet{'\n'}
          Questions? Contact support@kalipay.com
        </Text>
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
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Dark header band ── */}
        <View style={[s.headerBand, { paddingTop: insets.top + 16 }]}>

          {/* Top row: avatar + invite */}
          <View style={s.topRow}>
            <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate('Main', { screen: 'Profile' })} activeOpacity={0.85}>
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

        {/* ── Step tracker ── */}
        <SendStepTracker step={
          !toPhone.trim() ? 0
          : !amount ? 1
          : !paymentChosen ? 2
          : 3
        } />

        {/* ── Main card (floats over header) ── */}
        <View style={s.mainCard}>

          {/* Recipient row */}
          <View style={s.recipientSection}>
            <View style={s.recipientIconWrap}>
              <Text style={s.recipientIcon}>👤</Text>
            </View>
            <TextInput
              style={[s.recipientInput, touchedPhone && !toPhone.trim() && s.inputError]}
              placeholder="Recipient phone number *"
              placeholderTextColor="#A0AEC0"
              value={toPhone}
              onChangeText={setToPhone}
              onBlur={() => setTouchedPhone(true)}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={s.addRecipientBtn}
              onPress={() => navigation.navigate('Recipients')}
              activeOpacity={0.7}
            >
              <UserPlus size={18} color={TEAL} />
            </TouchableOpacity>
          </View>

          {/* Saved recipient quick-select */}
          {savedRecipients.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.recipientChips}
              keyboardShouldPersistTaps="handled"
            >
              {savedRecipients.map(r => (
                <TouchableOpacity
                  key={r.id || r.phone_number}
                  style={[s.recipientChip, toPhone === r.phone_number && s.recipientChipActive]}
                  onPress={() => { setToPhone(r.phone_number); setRecipientName(r.nickname || r.full_name || '') }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.recipientChipText, toPhone === r.phone_number && s.recipientChipTextActive]}>
                    {r.nickname || r.full_name || r.phone_number}
                  </Text>
                  <Text style={[s.recipientChipPhone, toPhone === r.phone_number && s.recipientChipPhoneActive]}>
                    {r.phone_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

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
          {!quoteLoading && toPhone.length > 5 && quote && !quote.recipient_found && (
            <View style={s.nameInputWrap}>
              <TextInput
                style={s.nameInput}
                placeholder="Recipient full name (required)"
                placeholderTextColor="#A0AEC0"
                value={recipientName}
                onChangeText={setRecipientName}
                autoCorrect={false}
              />
            </View>
          )}

          {/* Delivery method */}
          {toPhone.length > 5 && (
            <View style={s.deliveryRow}>
              {DELIVERY_OPTIONS.map(opt => {
                const Icon = opt.icon
                const disabled = opt.needsAccount && quote && !quote.recipient_found
                const active = delivery === opt.id
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.deliveryPill, active && s.deliveryPillActive, disabled && s.deliveryPillDisabled]}
                    onPress={() => selectDelivery(opt.id)}
                    activeOpacity={0.8}
                  >
                    <Icon size={14} color={disabled ? '#C4C9D4' : active ? '#fff' : TEAL} />
                    <Text style={[s.deliveryPillText, active && s.deliveryPillTextActive, disabled && s.deliveryPillTextDisabled]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* Mobile wallet provider picker */}
          {delivery === 'mobile_wallet' && (
            <View style={s.providerPicker}>
              <Text style={s.providerLabel}>Mobile wallet provider</Text>
              <View style={s.providerRow}>
                {getWalletProvidersForCountry(destCountry.name).map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.providerPill, mobileWalletProvider === p.id && s.providerPillActive]}
                    onPress={() => setMobileWalletProvider(p.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 16 }}>{p.icon}</Text>
                    <Text style={[s.providerPillText, mobileWalletProvider === p.id && s.providerPillTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!getWalletProvidersForCountry(destCountry.name).length && (
                  <Text style={s.noProviderText}>No mobile money providers available in {destCountry.name}</Text>
                )}
              </View>
            </View>
          )}

          <View style={s.cardDivider} />

          {/* Amount inputs */}
          <View style={s.amountSection}>
            {/* You send */}
            <View style={s.amountCol}>
              <Text style={s.amountLabel}>YOU SEND *</Text>
              <View style={s.amountInputRow}>
                <Text style={s.currencySymbol}>{CURRENCY_SYMBOLS[senderCcy] || senderCcy}</Text>
                <TextInput
                  style={[s.amountInput, touchedAmount && (!amount || parseFloat(amount) <= 0) && s.inputError]}
                  placeholder="0"
                  placeholderTextColor="#CBD5E0"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  onBlur={() => setTouchedAmount(true)}
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

          {/* Cost breakdown */}
          {sendAmt > 0 && (
            <View style={s.costSummary}>
              <View style={s.costRow}>
                <Text style={s.costLabel}>You send</Text>
                <Text style={s.costValue}>{fmt(sendAmt, senderCcy)}</Text>
              </View>
              <View style={s.costRow}>
                <Text style={s.costLabel}>Fee (1.5%)</Text>
                <Text style={s.costValue}>{fmt(fee, senderCcy)}</Text>
              </View>
              <View style={[s.costRow, s.costRowLast]}>
                <Text style={s.costLabel}>Recipient gets</Text>
                <Text style={[s.costValue, { color: TEAL }]}>
                  {receivedAmt != null ? fmt(receivedAmt, destCcy) : '—'}
                </Text>
              </View>
            </View>
          )}

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
            <Text style={s.txTitle}>Transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Transactions' })} activeOpacity={0.7}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {transactions.length === 0
            ? <Text style={s.txEmpty}>No transactions yet</Text>
            : transactions.map(tx => <TxRow key={tx.id} tx={tx} />)
          }
        </View>

      </ScrollView>

      {/* ── Confirmation bottom sheet ──
          Hidden (not unmounted) while the card-entry overlay shows: it's a
          plain in-tree View, not a Modal, so it can't paint above this
          Modal's separate native window — hiding this one avoids the clash,
          and showConfirm itself stays true so it reappears once card entry closes. */}
      <Modal
        visible={showConfirm && !showCardEntry}
        animationType="slide"
        transparent
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={cs.overlay}>
          <View style={[cs.sheet, { paddingBottom: insets.bottom + 16 }]}>

            {/* Drag handle */}
            <View style={cs.handle} />

            {/* Sheet header */}
            <View style={cs.sheetHeader}>
              <Text style={cs.sheetTitle}>Review Transfer</Text>
              <TouchableOpacity style={cs.closeCircle} onPress={() => setShowConfirm(false)} activeOpacity={0.7}>
                <Text style={cs.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

              {/* ── Hero card ── */}
              <View style={cs.heroCard}>
                <Text style={cs.heroLabel}>You're sending</Text>
                <Text style={cs.heroAmount}>
                  {sendAmt.toFixed(2)}{' '}
                  <Text style={cs.heroCcy}>{senderCcy}</Text>
                </Text>
                {receivedAmt != null && (
                  <View style={cs.heroConvertRow}>
                    <Text style={cs.heroArrow}>→</Text>
                    <Text style={cs.heroConverted}>
                      {receivedAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} {destCcy}
                    </Text>
                  </View>
                )}
                <View style={cs.heroDivider} />
                <View style={cs.heroRecipientRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.heroName}>{quote?.recipient_name || recipientName.trim() || toPhone}</Text>
                    <Text style={cs.heroSub}>
                      {toPhone}{'  ·  '}
                      {delivery === 'wave' ? 'Wave Mobile Money' : delivery === 'cash' ? 'Cash Pickup' : delivery === 'mobile_wallet' ? 'Mobile Money' : 'Kalipeh Wallet'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 30 }}>{destCountry.flag}</Text>
                </View>
              </View>

              {/* ── Pay with ── */}
              <TouchableOpacity
                style={[cs.payBlock, !paymentChosen && cs.payBlockUnchosen]}
                onPress={() => setShowPayPicker(true)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={cs.payBlockLabel}>PAY WITH</Text>
                  {paymentChosen ? (
                    selectedPayMethod ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <PayMethodBadge method={selectedPayMethod} />
                        <View>
                          <Text style={cs.payBlockValue} numberOfLines={1}>{selectedPayMethod.label}</Text>
                          {selectedPayMethod.last_four
                            ? <Text style={cs.payBlockSub}>•••{selectedPayMethod.last_four}</Text>
                            : null}
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <View style={cs.walletBadge}><Text style={cs.walletBadgeText}>W</Text></View>
                        <View>
                          <Text style={cs.payBlockValue}>Wallet</Text>
                          <Text style={cs.payBlockSub}>{wallet ? `${Number(wallet.balance).toLocaleString()} ${senderCcy}` : ''}</Text>
                        </View>
                      </View>
                    )
                  ) : (
                    <Text style={cs.payBlockPlaceholder}>Tap to select a payment method</Text>
                  )}
                </View>
                <Text style={cs.payBlockChevron}>›</Text>
              </TouchableOpacity>

              {/* ── Total charged ── */}
              <View style={cs.totalBlock}>
                <Text style={cs.totalLabel}>Total charged</Text>
                <Text style={cs.totalValue}>{sendAmt.toFixed(2)} {senderCcy}</Text>
              </View>

              {/* ── Expand details ── */}
              <TouchableOpacity
                style={cs.detailsToggle}
                onPress={() => setShowDetails(v => !v)}
                activeOpacity={0.75}
              >
                <Text style={cs.detailsToggleText}>{showDetails ? 'Hide details' : 'Show details'}</Text>
                <Text style={cs.detailsToggleChevron}>{showDetails ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showDetails && (
                <>
                  <View style={cs.breakCard}>
                    <BreakRow label="Transfer fees"   value={`${fee.toFixed(2)} ${senderCcy}`} />
                    <BreakRow label="Exchange rate"   value={effectiveRate ? `1 ${senderCcy} = ${effectiveRate.toFixed(2)} ${destCcy}` : '—'} />
                    <BreakRow label="Recipient gets"  value={receivedAmt != null ? `${receivedAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${destCcy}` : '—'} />
                    <BreakRow label="Delivery"        value="Under a minute" last />
                  </View>
                  <Text style={cs.receiveNote}>* Recipient may receive less due to provider fees or foreign taxes.</Text>

                  {/* ── Disclaimer ── */}
                  <Text style={cs.disclaimerText}>
                    Please be sure you know your recipient. Fraudulent transactions may result in the loss of your money with no recourse. To report fraud call 701-515-4355.
                  </Text>
                </>
              )}

            </ScrollView>

            {/* ── Confirm button ── */}
            <TouchableOpacity
              style={[cs.confirmBtn, (!paymentChosen || confirming) && cs.confirmBtnDisabled]}
              onPress={confirmTransfer}
              disabled={!paymentChosen || confirming}
              activeOpacity={0.85}
            >
              {confirming
                ? <Spinner size="sm" color="#7A6000" />
                : <Text style={[cs.confirmBtnText, !paymentChosen && cs.confirmBtnTextDisabled]}>
                    {paymentChosen ? 'Confirm transfer' : 'Select a payment method'}
                  </Text>
              }
            </TouchableOpacity>

            {/* ── Payment picker overlay ── */}
            {showPayPicker && (
              <View style={cs.pickerOverlay}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPayPicker(false)} />
                <View style={[cs.pickerSheet, { paddingBottom: insets.bottom + 20 }]}>
                  <View style={cs.pickerHeader}>
                    <Text style={cs.pickerTitle}>Pay with</Text>
                    <TouchableOpacity onPress={() => setShowPayPicker(false)} style={cs.pickerCloseBtn} activeOpacity={0.7}>
                      <Text style={cs.closeX}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>

                    {/* ── Wallet ── */}
                    <Text style={cs.pickerSection}>Wallet</Text>
                    <TouchableOpacity
                      style={[cs.pickerRow, paymentChosen && !selectedPayMethod && cs.pickerRowSelected]}
                      onPress={() => { setSelectedPayMethod(null); setPaymentChosen(true); setShowPayPicker(false) }}
                      activeOpacity={0.75}
                    >
                      <View style={cs.walletBadge}><Text style={cs.walletBadgeText}>W</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={cs.pickerLabel}>Wallet</Text>
                        <Text style={cs.pickerSub}>{wallet ? `${Number(wallet.balance).toLocaleString()} ${senderCcy}` : 'Balance'}</Text>
                      </View>
                      {paymentChosen && !selectedPayMethod && <View style={cs.selectedDot} />}
                    </TouchableOpacity>

                    {/* ── Credit / Debit Card ── */}
                    <Text style={cs.pickerSection}>Credit / Debit Card</Text>
                    {savedCards.map(m => (
                      <View key={m.id} style={[cs.pickerRow, selectedPayMethod?.id === m.id && cs.pickerRowSelected]}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 }}
                          onPress={() => { setSelectedPayMethod(m); setPaymentChosen(true); setShowPayPicker(false) }}
                          activeOpacity={0.75}
                        >
                          <PayMethodBadge method={m} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={cs.pickerLabel}>{m.label}</Text>
                              {m.is_default && (
                                <View style={cs.defaultBadge}>
                                  <Text style={cs.defaultBadgeText}>Default</Text>
                                </View>
                              )}
                            </View>
                            <Text style={cs.pickerSub}>
                              {m.last_four ? `•••${m.last_four}` : m.expiry_month ? `Expires ${String(m.expiry_month).padStart(2,'0')}/${m.expiry_year}` : 'Card'}
                            </Text>
                          </View>
                          {selectedPayMethod?.id === m.id && <View style={cs.selectedDot} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={cs.deleteBtn}
                          onPress={() => deletePaymentMethod(m)}
                          activeOpacity={0.6}
                        >
                          <Trash2 size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {/* Always show Add new card option */}
                    <TouchableOpacity style={cs.pickerAddRow} onPress={showAddCardDuringPayment} activeOpacity={0.75}>
                      <View style={[cs.walletBadge, { backgroundColor: LIGHT_TEAL, width: 44 }]}>
                        <Plus size={20} color={TEAL} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={cs.pickerLabel}>Add New Card</Text>
                        <Text style={cs.pickerSub}>Credit or debit card</Text>
                      </View>
                      <Text style={cs.pickerAddChevron}>›</Text>
                    </TouchableOpacity>

                    {/* ── ACH Bank Transfer ── */}
                    <Text style={cs.pickerSection}>ACH Bank Transfer</Text>
                    {savedACH.map(m => (
                      <View key={m.id} style={[cs.pickerRow, selectedPayMethod?.id === m.id && cs.pickerRowSelected]}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 }}
                          onPress={() => { setSelectedPayMethod(m); setPaymentChosen(true); setShowPayPicker(false) }}
                          activeOpacity={0.75}
                        >
                          <PayMethodBadge method={m} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={cs.pickerLabel}>{m.label}</Text>
                              {m.is_default && (
                                <View style={cs.defaultBadge}>
                                  <Text style={cs.defaultBadgeText}>Default</Text>
                                </View>
                              )}
                            </View>
                            <Text style={cs.pickerSub}>Bank account</Text>
                          </View>
                          {selectedPayMethod?.id === m.id && <View style={cs.selectedDot} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={cs.deleteBtn}
                          onPress={() => deletePaymentMethod(m)}
                          activeOpacity={0.6}
                        >
                          <Trash2 size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {/* Always show Add bank account option */}
                    <TouchableOpacity style={cs.pickerAddRow} onPress={goAddPaymentMethod} activeOpacity={0.75}>
                      <View style={[cs.walletBadge, { backgroundColor: LIGHT_TEAL, width: 44 }]}>
                        <Plus size={20} color={TEAL} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={cs.pickerLabel}>Add Bank Account</Text>
                        <Text style={cs.pickerSub}>ACH bank transfer</Text>
                      </View>
                      <Text style={cs.pickerAddChevron}>›</Text>
                    </TouchableOpacity>

                    {/* ── Mobile Money ── */}
                    {savedMobileWallets.length > 0 && (
                      <>
                        <Text style={cs.pickerSection}>Mobile Money</Text>
                        {savedMobileWallets.map(m => (
                          <View key={m.id} style={[cs.pickerRow, selectedPayMethod?.id === m.id && cs.pickerRowSelected]}>
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 }}
                              onPress={() => { setSelectedPayMethod(m); setPaymentChosen(true); setShowPayPicker(false) }}
                              activeOpacity={0.75}
                            >
                              <PayMethodBadge method={m} />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={cs.pickerLabel}>{m.label}</Text>
                                  {m.is_default && (
                                    <View style={cs.defaultBadge}>
                                      <Text style={cs.defaultBadgeText}>Default</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={cs.pickerSub}>Mobile wallet</Text>
                              </View>
                              {selectedPayMethod?.id === m.id && <View style={cs.selectedDot} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={cs.deleteBtn}
                              onPress={() => deletePaymentMethod(m)}
                              activeOpacity={0.6}
                            >
                              <Trash2 size={18} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </>
                    )}

                  </ScrollView>
                </View>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* ── Insufficient balance modal ── */}
      <Modal
        visible={showInsufficientModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInsufficientModal(false)}
      >
        <View style={cs.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowInsufficientModal(false)} />
          <View style={[ib.sheet, { paddingBottom: insets.bottom + 24 }]}>

            {/* Header */}
            <View style={ib.header}>
              <View style={ib.warningIcon}>
                <Text style={{ fontSize: 24 }}>⚠️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ib.title}>Insufficient Balance</Text>
                <Text style={ib.sub}>Your wallet doesn't have enough funds</Text>
              </View>
              <TouchableOpacity onPress={() => setShowInsufficientModal(false)} style={cs.closeCircle} activeOpacity={0.7}>
                <Text style={cs.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Balance breakdown */}
            <View style={ib.breakdownCard}>
              <View style={ib.breakdownRow}>
                <Text style={ib.breakdownLabel}>Your balance</Text>
                <Text style={ib.breakdownValue}>{fmt(walletBalance, senderCcy)}</Text>
              </View>
              <View style={ib.breakdownRow}>
                <Text style={ib.breakdownLabel}>Transfer amount</Text>
                <Text style={ib.breakdownValue}>{fmt(sendAmt, senderCcy)}</Text>
              </View>
              <View style={[ib.breakdownRow, { borderBottomWidth: 0 }]}>
                <Text style={[ib.breakdownLabel, { color: '#EF4444', fontWeight: '700' }]}>Shortfall</Text>
                <Text style={[ib.breakdownValue, { color: '#EF4444', fontWeight: '800' }]}>
                  {fmt(shortfall, senderCcy)}
                </Text>
              </View>
            </View>

            {/* Option 1 — Pay with a saved card */}
            {paymentMethods.length > 0 && (
              <View style={ib.section}>
                <Text style={ib.sectionTitle}>Pay with a saved method</Text>
                {paymentMethods.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={ib.methodRow}
                    onPress={() => selectMethodAndConfirm(m)}
                    activeOpacity={0.75}
                  >
                    <PayMethodBadge method={m} />
                    <View style={{ flex: 1 }}>
                      <Text style={ib.methodLabel}>{m.label}</Text>
                      <Text style={ib.methodSub}>
                        {m.type === 'card' && m.expiry_month
                          ? `Expires ${String(m.expiry_month).padStart(2,'0')}/${m.expiry_year}`
                          : m.type.replace('_', ' ')}
                      </Text>
                    </View>
                    <Text style={{ color: '#D1D5DB', fontSize: 18 }}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Option 2 — Add funds to wallet */}
            <TouchableOpacity
              style={ib.addFundsBtn}
              onPress={() => { setShowInsufficientModal(false); navigation.navigate('CashIn') }}
              activeOpacity={0.85}
            >
              <Text style={ib.addFundsBtnText}>+ Add Funds to Wallet</Text>
              <Text style={ib.addFundsBtnSub}>Top up {fmt(shortfall, senderCcy)} or more</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={ib.cancelBtn}
              onPress={() => setShowInsufficientModal(false)}
              activeOpacity={0.75}
            >
              <Text style={ib.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* ── Card entry overlay ──
          Deliberately a plain View, not RN's <Modal>: Stripe's CardField uses
          Jetpack Compose internally, and Modal hosts its content in a separate
          Android Dialog window with no ViewTreeLifecycleOwner, which crashes
          Compose on mount ("ViewTreeLifecycleOwner not found"). Rendering this
          in-tree instead keeps it under the Activity's own lifecycle owner. */}
      {showCardEntry && (
        <View style={cs.cardEntryOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCardEntry(false)} />
          <View style={[ce.sheet, { paddingBottom: insets.bottom + 24 }]}>

            {/* Header */}
            <View style={ce.header}>
              <View style={ce.cardIcon}>
                <Text style={{ fontSize: 24 }}>💳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ce.title}>Enter Card Details</Text>
                <Text style={ce.sub}>Amount: {fmt(sendAmt, senderCcy)}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCardEntry(false)} style={cs.closeCircle} activeOpacity={0.7}>
                <Text style={cs.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Card details — entered directly into Stripe's field; the raw
                number/CVC are sent straight to Stripe and never touch our backend */}
            <Text style={ce.label}>Card Details</Text>
            <CardField
              postalCodeEnabled={false}
              placeholders={{ number: '1234 5678 9012 3456' }}
              style={ce.cardField}
              cardStyle={CARD_FIELD_STYLE}
              onCardChange={setCardDetails}
            />

            {/* Cardholder name */}
            <Text style={ce.label}>Cardholder Name (optional)</Text>
            <TextInput
              style={ce.input}
              placeholder="John Doe"
              placeholderTextColor="#9CA3AF"
              value={cardHolderName}
              onChangeText={setCardHolderName}
            />

            {/* Save for future use */}
            <View style={ce.switchRow}>
              <Text style={ce.switchLabel}>Save card for future payments</Text>
              <Switch value={saveCard} onValueChange={setSaveCard} trackColor={{ true: TEAL }} />
            </View>

            {/* Pay button */}
            <TouchableOpacity
              style={[ce.payBtn, (confirming || !cardDetails?.complete) && ce.payBtnDisabled]}
              onPress={processCardAndTransfer}
              disabled={confirming || !cardDetails?.complete}
              activeOpacity={0.85}
            >
              {confirming
                ? <Spinner size="sm" color="#fff" />
                : <Text style={ce.payBtnText}>Pay {fmt(sendAmt, senderCcy)} & Send</Text>
              }
            </TouchableOpacity>

            {/* Security note */}
            <View style={ce.securityNote}>
              <Shield size={14} color="#9CA3AF" />
              <Text style={ce.securityText}>Your card details are encrypted and securely processed</Text>
            </View>

          </View>
        </View>
      )}

      {/* ── Bottom Navigation Bar ── */}
      <View style={[nav.container, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={nav.tab} onPress={() => navigation.navigate('SendMoney')} activeOpacity={0.7}>
          <Home size={22} color="#4F46E5" />
          <Text style={[nav.label, nav.labelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={nav.tab} onPress={() => navigation.navigate('Main', { screen: 'Transactions' })} activeOpacity={0.7}>
          <ArrowLeftRight size={22} color="#9CA3AF" />
          <Text style={nav.label}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={nav.tab} onPress={() => navigation.navigate('Main', { screen: 'Exchange' })} activeOpacity={0.7}>
          <TrendingUp size={22} color="#9CA3AF" />
          <Text style={nav.label}>Exchange</Text>
        </TouchableOpacity>
        <TouchableOpacity style={nav.tab} onPress={() => navigation.navigate('Main', { screen: 'Notifications' })} activeOpacity={0.7}>
          <Bell size={22} color="#9CA3AF" />
          <Text style={nav.label}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={nav.tab} onPress={() => navigation.navigate('Main', { screen: 'Profile' })} activeOpacity={0.7}>
          <User size={22} color="#9CA3AF" />
          <Text style={nav.label}>Profile</Text>
        </TouchableOpacity>
      </View>

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
  const provider = getProviderById(method.type)
  if (provider) {
    return (
      <View style={[cs.walletBadge, { backgroundColor: '#F3F4F6', width: 44 }]}>
        <Text style={[cs.walletBadgeText, { fontSize: 16 }]}>{provider.icon}</Text>
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
  const d = tx.extra_data || {}
  const recipientName  = tx.recipient_name  ?? d.recipient_name  ?? tx.to_phone ?? 'Unknown'
  const sendAmount     = tx.send_amount     ?? d.send_amount     ?? tx.amount
  const sendCurrency   = tx.send_currency   ?? d.send_currency   ?? tx.currency
  const receivedAmount = tx.received_amount ?? d.received_amount ?? d.net_send_amount
  const recvCurrency   = tx.recv_currency   ?? d.recv_currency

  const isDelivered = tx.status === 'completed'
  const date = tx.created_at
    ? new Date(tx.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
    : ''
  const fmt2 = n => n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
  return (
    <View style={t.row}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={t.name} numberOfLines={1}>{recipientName}</Text>
        <View style={t.meta}>
          <Text style={t.date}>{date}</Text>
          {isDelivered
            ? <View style={t.badge}><Text style={t.badgeText}>DELIVERED</Text></View>
            : tx.status
              ? <View style={t.badgePending}><Text style={t.badgePendingText}>{tx.status.toUpperCase()}</Text></View>
              : null
          }
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={t.amount}>{fmt2(sendAmount)} {sendCurrency}</Text>
        <Text style={t.subAmount}>{fmt2(receivedAmount)} {recvCurrency}</Text>
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

// ── Bottom Navigation Styles ──────────────────────────────────────────────────
const nav = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 4,
  },
  labelActive: {
    color: '#4F46E5',
  },
})

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

  // Saved recipient chips
  recipientChips: { flexDirection: 'row', gap: 8, paddingLeft: 52, marginBottom: 10 },
  recipientChip: {
    backgroundColor: '#F0FAF9', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  recipientChipActive: { backgroundColor: TEAL, borderColor: TEAL },
  recipientChipText: { fontSize: 12, fontWeight: '700', color: TEAL },
  recipientChipTextActive: { color: '#fff' },
  recipientChipPhone: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  recipientChipPhoneActive: { color: 'rgba(255,255,255,0.8)' },

  // Status row (verified/loading)
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 52 },
  statusText: { fontSize: 13, color: '#9CA3AF' },

  cardDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
  nameInputWrap: {
    marginBottom: 6, paddingLeft: 52,
  },
  nameInput: {
    fontSize: 14, color: '#111',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingVertical: 6,
  },

  // Delivery method pills
  deliveryRow: {
    flexDirection: 'row', gap: 8, paddingLeft: 52, marginBottom: 10, flexWrap: 'wrap',
  },
  deliveryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0FAF9', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  deliveryPillActive:   { backgroundColor: TEAL },
  deliveryPillDisabled: { backgroundColor: '#F4F5F7' },
  deliveryPillText:     { fontSize: 12, fontWeight: '600', color: TEAL },
  deliveryPillTextActive:  { color: '#fff' },
  deliveryPillTextDisabled:{ color: '#C4C9D4' },

  // Mobile wallet provider picker
  providerPicker: { marginTop: 4, paddingLeft: 52, marginBottom: 6 },
  providerLabel:  { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  providerRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  providerPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F9FAFB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: '#E5E7EB' },
  providerPillActive:   { backgroundColor: TEAL, borderColor: TEAL },
  providerPillText:     { fontSize: 12, fontWeight: '600', color: '#111' },
  providerPillTextActive: { color: '#fff' },
  noProviderText: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

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
  inputError:   { borderBottomWidth: 2, borderBottomColor: '#EF4444' },

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

  // Cost breakdown
  costSummary: {
    marginTop: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
  },
  costRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  costRowLast: { borderBottomWidth: 0 },
  costLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  costValue: { fontSize: 14, fontWeight: '700', color: '#111' },

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
  txSection: { marginHorizontal: 20, marginBottom: 32 },
  txHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  txTitle:   { fontSize: 26, fontWeight: '800', color: '#111827' },
  seeAll:    { fontSize: 15, fontWeight: '600', color: TEAL, textDecorationLine: 'underline' },
  txEmpty:   { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 32 },

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
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  name:          { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 6 },
  meta:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date:          { fontSize: 13, color: '#9CA3AF' },
  badge:         { backgroundColor: LIGHT_TEAL, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText:     { fontSize: 11, fontWeight: '700', color: TEAL_TEXT, letterSpacing: 0.6 },
  badgePending:  { backgroundColor: '#FEF9C3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgePendingText: { fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 0.6 },
  amount:        { fontSize: 16, fontWeight: '800', color: '#111827', textAlign: 'right' },
  subAmount:     { fontSize: 13, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
})

// ── Confirmation sheet helper ─────────────────────────────────────────────────
function BreakRow({ label, value, last, valueStyle }) {
  return (
    <View style={[cs.breakRow, !last && cs.breakRowBorder]}>
      <Text style={cs.breakLabel}>{label}</Text>
      <Text style={[cs.breakValue, valueStyle]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const cs = StyleSheet.create({
  // ── Overlay & sheet ───────────────────────────────────────────────────────────
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  cardEntryOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 1000,
    elevation: 20,
  },
  sheet:      { backgroundColor: '#F4F6F9', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '95%' },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10 },

  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  sheetTitle:  { fontSize: 17, fontWeight: '700', color: '#111827' },
  closeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  closeX:      { fontSize: 15, color: '#374151', fontWeight: '700', lineHeight: 18 },

  // ── Hero card ─────────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: '#0A1628',
    marginHorizontal: 16, borderRadius: 20,
    padding: 22, marginBottom: 10,
    shadowColor: '#0A1628', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  heroLabel:        { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  heroAmount:       { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroCcy:          { fontSize: 22, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  heroConvertRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  heroArrow:        { fontSize: 15, color: '#F5C842', fontWeight: '700' },
  heroConverted:    { fontSize: 16, fontWeight: '700', color: '#F5C842' },
  heroDivider:      { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  heroRecipientRow: { flexDirection: 'row', alignItems: 'center' },
  heroName:         { fontSize: 16, fontWeight: '700', color: '#fff' },
  heroSub:          { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 },

  // ── Breakdown card ────────────────────────────────────────────────────────────
  breakCard:      { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, marginBottom: 4, overflow: 'hidden' },
  breakRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  breakRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  breakLabel:     { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  breakValue:     { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right', marginLeft: 12 },
  receiveNote:    { fontSize: 11, color: '#9CA3AF', marginHorizontal: 20, marginTop: 6, marginBottom: 10, lineHeight: 16 },

  // ── Pay with block ────────────────────────────────────────────────────────────
  payBlock: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16,
    padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  payBlockUnchosen: { borderColor: '#F5C842', borderStyle: 'dashed' },
  payBlockLabel:    { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' },
  payBlockValue:    { fontSize: 15, fontWeight: '700', color: '#111827' },
  payBlockSub:      { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  payBlockPlaceholder: { fontSize: 14, color: '#9CA3AF', marginTop: 5 },
  payBlockChevron:  { fontSize: 26, color: '#9CA3AF', marginLeft: 8 },

  // ── Total block ───────────────────────────────────────────────────────────────
  totalBlock: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#111827' },

  // ── Details toggle ─────────────────────────────────────────────────────────────
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 20, marginBottom: 10 },
  detailsToggleText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  detailsToggleChevron: { fontSize: 13, color: '#4F46E5' },

  // ── Disclaimer ────────────────────────────────────────────────────────────────
  disclaimerText: { fontSize: 11, color: '#6B7280', lineHeight: 17, textAlign: 'center', marginHorizontal: 20, marginBottom: 14 },

  // ── Wallet badge ──────────────────────────────────────────────────────────────
  walletBadge:     { width: 38, height: 26, backgroundColor: '#1A1F71', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  walletBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // ── Confirm button ────────────────────────────────────────────────────────────
  confirmBtn:             { backgroundColor: '#F5C842', borderRadius: 32, paddingVertical: 18, alignItems: 'center', marginHorizontal: 16, marginTop: 4, marginBottom: 4 },
  confirmBtnDisabled:     { backgroundColor: '#E5E7EB' },
  confirmBtnText:         { fontSize: 17, fontWeight: '700', color: '#5A4500' },
  confirmBtnTextDisabled: { color: '#9CA3AF', fontWeight: '600' },

  // ── Payment picker overlay ────────────────────────────────────────────────────
  pickerOverlay:  {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  pickerSheet:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20 },
  pickerHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerTitle:    { fontSize: 18, fontWeight: '700', color: '#111' },
  pickerCloseBtn: { padding: 4 },
  pickerSection:  { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 6, marginLeft: 2 },
  pickerRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, marginBottom: 8, backgroundColor: '#F9FAFB' },
  pickerRowSelected: { backgroundColor: '#FFF9E6', borderWidth: 1.5, borderColor: '#F5C842' },
  pickerAddRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, marginBottom: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  pickerAddChevron: { fontSize: 20, color: '#9CA3AF' },
  pickerLabel:    { fontSize: 15, fontWeight: '600', color: '#111' },
  pickerSub:      { fontSize: 13, color: '#888', marginTop: 2 },
  defaultBadge:   { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  defaultBadgeText:{ fontSize: 10, fontWeight: '700', color: '#4F46E5' },
  selectedDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F5C842' },
  deleteBtn:      { padding: 10, marginLeft: 4 },
})

// ── Step tracker styles ─────────────────────────────────────────────────────────
const st = StyleSheet.create({
  wrap:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F4F6F9' },
  item:    { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dot:     { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  dotActive:{ backgroundColor: '#0E9E98' },
  dotText: { fontSize: 11, fontWeight: '800', color: '#9CA3AF' },
  dotTextActive:{ color: '#fff' },
  label:   { fontSize: 11, color: '#9CA3AF', marginLeft: 6, fontWeight: '600' },
  labelActive:{ color: '#0E9E98' },
  line:    { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 6 },
  lineActive:{ backgroundColor: '#0E9E98' },
})

// ── Professional Receipt styles ────────────────────────────────────────────────
const rc = StyleSheet.create({
  header: {
    backgroundColor: '#0A1628',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F5C842',
    letterSpacing: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  headerDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  headerRef: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 24,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },

  amountSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
  },
  convertedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F0FAF9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  convertedText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEAL,
  },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 24,
    marginVertical: 16,
  },

  partySection: {
    paddingHorizontal: 24,
  },
  partyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  partyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  partyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  partyDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  partyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  partyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  partyInfoIcon: {
    fontSize: 14,
  },
  partyInfoText: {
    fontSize: 14,
    color: '#6B7280',
  },

  connectionLine: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  lineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  lineBar: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
  },

  detailsSection: {
    paddingHorizontal: 24,
  },
  detailsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },

  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: '#0A1628',
    borderRadius: 16,
    padding: 18,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },

  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#F0FAF9',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  emailText: {
    fontSize: 13,
    color: '#0A7A76',
  },

  actions: {
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 32,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryBtn: {
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 30,
    lineHeight: 20,
  },
})

// ── Insufficient balance modal styles ─────────────────────────────────────────
const ib = StyleSheet.create({
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20,
  },
  warningIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  title:  { fontSize: 18, fontWeight: '800', color: '#111' },
  sub:    { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  breakdownCard: {
    backgroundColor: '#FEF2F2', borderRadius: 16,
    paddingHorizontal: 16, marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.1)',
  },
  breakdownLabel: { fontSize: 14, color: '#6B7280' },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: '#111' },

  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#F9FAFB', borderRadius: 14, marginBottom: 8,
  },
  methodLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  methodSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  addFundsBtn: {
    backgroundColor: TEAL,
    borderRadius: 28, paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', marginBottom: 10,
  },
  addFundsBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  addFundsBtnSub:  { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  cancelBtn:     { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
})

// ── Card entry modal styles ────────────────────────────────────────────────────
const ce = StyleSheet.create({
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 20,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111' },
  sub:   { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  label: {
    fontSize: 12, fontWeight: '600', color: '#6B7280',
    marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#111',
  },
  cardField: { height: 50 },
  row: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },

  payBtn: {
    backgroundColor: TEAL,
    borderRadius: 28, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  securityNote: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16,
  },
  securityText: { fontSize: 12, color: '#9CA3AF' },
})
