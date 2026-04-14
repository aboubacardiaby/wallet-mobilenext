import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, FlatList, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import {
  ArrowLeft, Send, Users, ChevronDown,
  CheckCircle, MapPin, Zap, RefreshCw, CreditCard, Wallet,
} from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

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

const CURRENCY_FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CAD: '🇨🇦', CHF: '🇨🇭',
  XOF: '🌍', XAF: '🌍', NGN: '🇳🇬', GHS: '🇬🇭', KES: '🇰🇪',
  MAD: '🇲🇦', ZAR: '🇿🇦', EGP: '🇪🇬', GNF: '🇬🇳', ETB: '🇪🇹', GMD: '🇬🇲',
}
const FEE_RATE = 0.015

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
  const isSender = user?.user_type === 'sender'

  const [wallet, setWallet] = useState(null)
  const [toPhone, setToPhone] = useState(route.params?.to_phone || '')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [destCountry, setDestCountry] = useState(DEST_COUNTRIES[0])
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [recipients, setRecipients] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedPmId, setSelectedPmId] = useState('wallet')
  const [liveRate, setLiveRate] = useState(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [waveCheck, setWaveCheck] = useState(null)
  const [waveCheckLoading, setWaveCheckLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const senderCcy = wallet?.currency || (isSender ? 'USD' : 'XOF')
  const destCcy = destCountry.currency
  const sendAmt = parseFloat(amount) || 0
  const fee = parseFloat((sendAmt * FEE_RATE).toFixed(2))
  const netAmt = parseFloat((sendAmt - fee).toFixed(2))
  const effectiveRate = (quote?.recipient_found ? quote.exchange_rate : liveRate) ?? liveRate
  const receivedAmt = effectiveRate && netAmt > 0 ? parseFloat((netAmt * effectiveRate).toFixed(2)) : null

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
    api.get('/user/recipients').then(({ data }) => setRecipients(data.recipients || [])).catch(() => {})
    if (isSender) {
      api.get('/payment-methods').then(({ data }) => {
        setPaymentMethods(data.payment_methods || [])
        const def = (data.payment_methods || []).find(m => m.is_default)
        if (def) setSelectedPmId(def.id)
      }).catch(() => {})
    }
  }, [])

  const fetchQuote = useCallback(async (phone, amt, recvCcy) => {
    if (!phone || !amt || parseFloat(amt) <= 0) { setQuote(null); return }
    setQuoteLoading(true)
    try {
      const { data } = await api.get(`/transfer/quote?to_phone=${encodeURIComponent(phone)}&amount=${amt}&recv_currency=${recvCcy}`)
      setQuote(data)
      // If recipient has a different wallet currency, update live rate accordingly
      if (data.recipient_found && data.recv_currency !== destCcy) {
        setLiveRate(data.exchange_rate)
      }
    } catch { setQuote(null) }
    finally { setQuoteLoading(false) }
  }, [destCcy])

  useEffect(() => {
    const t = setTimeout(() => fetchQuote(toPhone, amount, destCcy), 600)
    return () => clearTimeout(t)
  }, [toPhone, amount, destCcy, fetchQuote])

  // Wave check — runs when quote confirms no account found
  useEffect(() => {
    if (!quote || quote.recipient_found || toPhone.length <= 5) {
      setWaveCheck(null)
      return
    }
    setWaveCheckLoading(true)
    api.get(`/transfer/wave/check?phone=${encodeURIComponent(toPhone)}&country=${encodeURIComponent(destCountry.name)}`)
      .then(({ data }) => setWaveCheck(data))
      .catch(() => setWaveCheck({ has_wave: false }))
      .finally(() => setWaveCheckLoading(false))
  }, [quote, toPhone, destCountry.name])

  const submit = async () => {
    if (!toPhone) return Toast.show({ type: 'error', text1: 'Enter recipient phone' })
    if (!amount || sendAmt <= 0) return Toast.show({ type: 'error', text1: 'Enter an amount' })
    setLoading(true)
    try {
      if (isSender && selectedPmId !== 'wallet') {
        await api.post(`/payment-methods/${selectedPmId}/top-up`, { amount: sendAmt })
        Toast.show({ type: 'success', text1: 'Wallet funded!' })
      }
      const { data } = await api.post('/transfer/send', {
        to_phone: toPhone, amount: sendAmt, description,
      })
      setResult(data)
      Toast.show({ type: 'success', text1: 'Transfer sent!' })
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Transfer failed' })
    } finally { setLoading(false) }
  }

  if (result) {
    const isPickup = !!result.pickup_code
    const isWave   = !!result.wave_ref
    return (
      <View style={[s.successContainer, { paddingTop: insets.top + 16 }]}>
        <View style={[s.successIcon, { backgroundColor: isPickup ? '#FEF3C7' : isWave ? '#DBEAFE' : '#DCFCE7' }]}>
          {isPickup ? <MapPin size={36} color="#D97706" /> : isWave ? <Zap size={36} color="#2563EB" /> : <CheckCircle size={36} color="#16A34A" />}
        </View>
        <Text style={s.successTitle}>{isPickup ? 'Cash Pickup Ready!' : isWave ? 'Wave Transfer Sent!' : 'Transfer Successful!'}</Text>
        <Text style={s.successSub}>{isPickup ? 'Share the pickup code with the recipient' : isWave ? "Funds sent to recipient's Wave account" : 'Your money is on its way'}</Text>

        {isPickup && (
          <View style={s.pickupBox}>
            <Text style={s.pickupLabel}>PICKUP CODE</Text>
            <Text style={s.pickupCode}>{result.pickup_code}</Text>
          </View>
        )}
        {isWave && (
          <View style={[s.pickupBox, { backgroundColor: '#2563EB' }]}>
            <Text style={s.pickupLabel}>WAVE REFERENCE</Text>
            <Text style={s.pickupCode}>{result.wave_ref}</Text>
          </View>
        )}

        <View style={[s.resultAmountBox, { backgroundColor: isWave ? '#2563EB' : '#4F46E5' }]}>
          <Text style={s.resultAmountLabel}>{isPickup ? 'Amount to collect' : 'Recipient receives'}</Text>
          <Text style={s.resultAmount}>{result.received_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })} <Text style={{ fontSize: 18 }}>{result.recv_currency}</Text></Text>
        </View>

        {/* Agent location for cash pickup */}
        {result.agent && (
          <View style={[s.summaryCard, { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }]}>
            <View style={{ width: 36, height: 36, backgroundColor: '#FEF3C7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={16} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{result.agent.name}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>{result.agent.address}</Text>
              <Text style={{ fontSize: 12, color: '#4F46E5', fontWeight: '500', marginTop: 2 }}>{result.agent.phone}</Text>
            </View>
          </View>
        )}

        <View style={s.summaryCard}>
          <SummaryRow label="To"          value={result.recipient_name || toPhone} />
          <SummaryRow label="You sent"    value={fmt(result.send_amount, result.send_currency)} bold />
          <SummaryRow label="Fee (1.5%)"  value={fmt(result.fee, result.send_currency)} />
          {result.recv_currency !== result.send_currency && (
            <SummaryRow label="Rate" value={`1 ${result.send_currency} = ${result.exchange_rate?.toFixed(4)} ${result.recv_currency}`} />
          )}
          <SummaryRow label="Ref" value={(result.transaction_ref || '').slice(0, 16) + '…'} />
        </View>

        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Main')}>
          <Text style={s.btnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Send Money</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.content}>
          {/* Balance */}
          {wallet && (
            <View style={s.balanceChip}>
              <Text style={s.balanceLabel}>Your balance</Text>
              <Text style={s.balanceValue}>{Number(wallet.balance).toLocaleString()} {senderCcy}</Text>
            </View>
          )}

          {/* Recent recipients */}
          {recipients.length > 0 && (
            <View>
              <View style={s.sectionRow}>
                <Text style={s.sectionLabel}>Recent</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Recipients')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Users size={12} color="#4F46E5" />
                    <Text style={s.manageLink}>Manage</Text>
                  </View>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {recipients.map(r => {
                  const initials = (r.full_name || r.phone_number).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <TouchableOpacity key={r.id} style={[s.recipientChip, toPhone === r.phone_number && s.recipientChipActive]} onPress={() => {
                      setToPhone(r.phone_number)
                      // Auto-select destination country from recipient's saved country
                      const match = DEST_COUNTRIES.find(c => c.name === r.country_name)
                      if (match) setDestCountry(match)
                    }}>
                      <View style={[s.recipientAvatar, { backgroundColor: r.avatar_color || '#4F46E5' }]}>
                        <Text style={s.recipientInitials}>{initials}</Text>
                      </View>
                      <Text style={s.recipientName} numberOfLines={1}>{r.full_name || r.phone_number}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          )}

          {/* To phone */}
          <Text style={s.inputLabel}>To Phone Number</Text>
          <TextInput style={s.input} placeholder="+221 77 000 00 00" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={toPhone} onChangeText={setToPhone} />

          {/* Quote info */}
          {quoteLoading && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}><Spinner size="sm" /><Text style={{ fontSize: 12, color: '#9CA3AF' }}>Verifying recipient…</Text></View>}
          {quote?.recipient_found && (
            <View style={s.verifiedBadge}>
              <CheckCircle size={14} color="#16A34A" />
              <Text style={s.verifiedText}>{quote.recipient_name} — wallet found</Text>
            </View>
          )}
          {/* Wave check — shown when no Kalipeh account found */}
          {waveCheckLoading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Spinner size="sm" />
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Checking Wave account…</Text>
            </View>
          )}
          {waveCheck && !waveCheckLoading && (
            <View style={[s.verifiedBadge, { backgroundColor: waveCheck.has_wave ? '#DBEAFE' : '#FEF3C7', padding: 8, borderRadius: 10, marginTop: 6 }]}>
              {waveCheck.has_wave
                ? <><Zap size={14} color="#2563EB" /><Text style={[s.verifiedText, { color: '#2563EB' }]}>Wave account found — will send via Wave</Text></>
                : <><Text style={[s.verifiedText, { color: '#D97706' }]}>No Kalipeh or Wave account found</Text></>
              }
            </View>
          )}

          {/* Destination country */}
          <Text style={[s.inputLabel, { marginTop: 16 }]}>Destination Country</Text>
          <TouchableOpacity style={s.countryPicker} onPress={() => setShowCountryPicker(!showCountryPicker)}>
            <Text style={{ fontSize: 20 }}>{destCountry.flag}</Text>
            <Text style={s.countryName}>{destCountry.name}</Text>
            <Text style={s.currencyCode}>{destCcy}</Text>
            <ChevronDown size={16} color="#9CA3AF" />
          </TouchableOpacity>
          {showCountryPicker && (
            <View style={s.pickerDropdown}>
              <FlatList
                data={DEST_COUNTRIES}
                keyExtractor={c => c.name}
                style={{ maxHeight: 200 }}
                renderItem={({ item: c }) => (
                  <TouchableOpacity style={s.pickerOption} onPress={() => { setDestCountry(c); setShowCountryPicker(false) }}>
                    <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                    <Text style={{ fontSize: 14, flex: 1, color: '#111827', fontWeight: '500' }}>{c.name}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{c.currency}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Amount */}
          <Text style={[s.inputLabel, { marginTop: 16 }]}>Amount ({senderCcy})</Text>
          <TextInput style={s.input} placeholder="0.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

          {/* Fee summary */}
          {sendAmt > 0 && (
            <View style={s.feeCard}>
              <FeeRow label="Fee (1.5%)" value={fmt(fee, senderCcy)} />
              <FeeRow label="Net sent" value={fmt(netAmt, senderCcy)} />
              <View style={s.feeDivider} />
              <FeeRow
                label={`Recipient gets (${destCcy})`}
                value={rateLoading ? '…' : receivedAmt != null ? fmt(receivedAmt, destCcy) : '—'}
                highlight
              />
              {effectiveRate && senderCcy !== destCcy && (
                <Text style={s.rateHint}>Rate: 1 {senderCcy} = {effectiveRate.toFixed(4)} {destCcy}</Text>
              )}
            </View>
          )}

          {/* Alternate delivery — shown when no Kalipeh account found */}
          {quote && !quote.recipient_found && toPhone.length > 5 && sendAmt > 0 && (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Text style={[s.inputLabel, { textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11, color: '#9CA3AF' }]}>No account — choose delivery</Text>
              {waveCheck?.has_wave ? (
                <>
                  <WaveSection toPhone={toPhone} amount={sendAmt} destCountry={destCountry} receivedAmt={receivedAmt} defaultOpen onSuccess={r => setResult(r)} />
                  <CashPickupSection toPhone={toPhone} amount={sendAmt} sendCcy={senderCcy} destCountry={destCountry} receivedAmt={receivedAmt} fee={fee} onSuccess={r => setResult(r)} />
                </>
              ) : (
                <>
                  <CashPickupSection toPhone={toPhone} amount={sendAmt} sendCcy={senderCcy} destCountry={destCountry} receivedAmt={receivedAmt} fee={fee} onSuccess={r => setResult(r)} />
                  <WaveSection toPhone={toPhone} amount={sendAmt} destCountry={destCountry} receivedAmt={receivedAmt} onSuccess={r => setResult(r)} />
                </>
              )}
            </View>
          )}

          {/* Description */}
          <Text style={[s.inputLabel, { marginTop: 16 }]}>Reason (optional)</Text>
          <TextInput style={s.input} placeholder="Rent, groceries…" placeholderTextColor="#9CA3AF" value={description} onChangeText={setDescription} />

          {/* Payment method selector (senders only) */}
          {isSender && paymentMethods.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.inputLabel}>Fund from</Text>
              <TouchableOpacity style={s.countryPicker} onPress={() => setSelectedPmId('wallet')}>
                <Wallet size={16} color={selectedPmId === 'wallet' ? '#4F46E5' : '#9CA3AF'} />
                <Text style={[s.countryName, { color: selectedPmId === 'wallet' ? '#4F46E5' : '#111827' }]}>Wallet balance</Text>
                {selectedPmId === 'wallet' && <CheckCircle size={16} color="#4F46E5" />}
              </TouchableOpacity>
              {paymentMethods.map(pm => (
                <TouchableOpacity key={pm.id} style={[s.countryPicker, { marginTop: 6 }]} onPress={() => setSelectedPmId(pm.id)}>
                  <CreditCard size={16} color={selectedPmId === pm.id ? '#4F46E5' : '#9CA3AF'} />
                  <Text style={[s.countryName, { color: selectedPmId === pm.id ? '#4F46E5' : '#111827' }]}>{pm.label}</Text>
                  {selectedPmId === pm.id && <CheckCircle size={16} color="#4F46E5" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading
              ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Spinner size="sm" color="#fff" /><Text style={s.btnText}>Sending…</Text></View>
              : <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Send size={16} color="#fff" /><Text style={s.btnText}>Send Money</Text></View>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function FeeRow({ label, value, highlight }) {
  return (
    <View style={s.feeRow}>
      <Text style={[s.feeLabel, highlight && { fontWeight: '700', color: '#111827' }]}>{label}</Text>
      <Text style={[s.feeValue, highlight && { fontWeight: '700', color: '#4F46E5', fontSize: 15 }]}>{value}</Text>
    </View>
  )
}

function SummaryRow({ label, value, bold }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: 14, color: '#6B7280' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '700' : '500', color: '#111827' }}>{value}</Text>
    </View>
  )
}

function CashPickupSection({ toPhone, amount, sendCcy, destCountry, receivedAmt, fee, onSuccess }) {
  const [open, setOpen] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    api.get(`/transfer/agents?country=${encodeURIComponent(destCountry.name)}`)
      .then(({ data }) => {
        setAgents(data.agents || [])
        if (data.agents?.length > 0) setSelectedAgent(data.agents[0])
      })
      .catch(() => {})
  }, [open, destCountry.name])

  const submit = async () => {
    if (!recipientName.trim()) return Toast.show({ type: 'error', text1: 'Enter recipient name' })
    if (!selectedAgent) return Toast.show({ type: 'error', text1: 'Select a pickup location' })
    setSaving(true)
    try {
      const { data } = await api.post('/transfer/cash-pickup', {
        to_phone: toPhone, recipient_name: recipientName,
        amount, recv_currency: destCountry.currency, agent_id: selectedAgent.id,
      })
      Toast.show({ type: 'success', text1: 'Cash pickup created!' })
      onSuccess(data)
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed to create cash pickup' })
    } finally { setSaving(false) }
  }

  if (!open) {
    return (
      <TouchableOpacity style={cp.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <View style={cp.triggerIcon}><MapPin size={20} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={cp.triggerTitle}>Send as Cash Pickup</Text>
          <Text style={cp.triggerSub}>Recipient collects cash at a local agent with a PIN code</Text>
        </View>
        <ChevronDown size={16} color="#D97706" />
      </TouchableOpacity>
    )
  }

  return (
    <View style={cp.expanded}>
      <View style={cp.header}>
        <MapPin size={16} color="#fff" />
        <Text style={cp.headerTitle}>Cash Pickup</Text>
        <TouchableOpacity onPress={() => setOpen(false)}><ChevronDown size={16} color="rgba(255,255,255,0.7)" style={{ transform: [{ rotate: '180deg' }] }} /></TouchableOpacity>
      </View>
      <View style={{ padding: 12, gap: 10 }}>
        <View style={cp.amountRow}>
          <Text style={{ fontSize: 12, color: '#78716C' }}>They collect</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>
            {destCountry.flag} {receivedAmt?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'} {destCountry.currency}
          </Text>
        </View>
        <TextInput style={cp.input} placeholder="Recipient full name" placeholderTextColor="#9CA3AF" value={recipientName} onChangeText={setRecipientName} />
        <Text style={{ fontSize: 12, fontWeight: '500', color: '#92400E' }}>Pickup location · {destCountry.name}</Text>
        {agents.length === 0
          ? <Text style={{ fontSize: 12, color: '#D97706' }}>No agents available for this country yet</Text>
          : agents.map(a => (
            <TouchableOpacity key={a.id} style={[cp.agentRow, selectedAgent?.id === a.id && cp.agentRowActive]} onPress={() => setSelectedAgent(a)}>
              <MapPin size={12} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#111827' }}>{a.name}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>{a.address}</Text>
                <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '500' }}>{a.phone}</Text>
              </View>
              <View style={[cp.radio, selectedAgent?.id === a.id && cp.radioActive]} />
            </TouchableOpacity>
          ))
        }
        <TouchableOpacity style={[cp.submitBtn, (saving || !recipientName.trim() || !selectedAgent) && { opacity: 0.5 }]} onPress={submit} disabled={saving || !recipientName.trim() || !selectedAgent}>
          {saving ? <Spinner size="sm" color="#fff" /> : <><MapPin size={14} color="#fff" /><Text style={cp.submitBtnText}>Confirm Cash Pickup</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function WaveSection({ toPhone, amount, destCountry, receivedAmt, defaultOpen = false, onSuccess }) {
  const [open, setOpen] = useState(defaultOpen)
  const [wavePhone, setWavePhone] = useState(toPhone)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!wavePhone.trim()) return Toast.show({ type: 'error', text1: 'Enter Wave phone number' })
    setSaving(true)
    try {
      const { data } = await api.post('/transfer/wave', {
        to_phone: wavePhone, amount, recv_currency: destCountry.currency,
      })
      Toast.show({ type: 'success', text1: 'Wave transfer sent!' })
      onSuccess(data)
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Wave transfer failed' })
    } finally { setSaving(false) }
  }

  if (!open) {
    return (
      <TouchableOpacity style={wp.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <View style={wp.triggerIcon}><Zap size={20} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={wp.triggerTitle}>Send via Wave</Text>
          <Text style={wp.triggerSub}>Deliver directly to recipient's Wave mobile money account</Text>
        </View>
        <ChevronDown size={16} color="#2563EB" />
      </TouchableOpacity>
    )
  }

  return (
    <View style={wp.expanded}>
      <View style={wp.header}>
        <Zap size={16} color="#fff" />
        <Text style={wp.headerTitle}>Wave Mobile Money</Text>
        <TouchableOpacity onPress={() => setOpen(false)}><ChevronDown size={16} color="rgba(255,255,255,0.7)" style={{ transform: [{ rotate: '180deg' }] }} /></TouchableOpacity>
      </View>
      <View style={{ padding: 12, gap: 10 }}>
        <View style={wp.amountRow}>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>They receive via Wave</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1D4ED8' }}>
            {destCountry.flag} {receivedAmt?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'} {destCountry.currency}
          </Text>
        </View>
        <TextInput style={wp.input} placeholder="+221 77 000 00 00" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={wavePhone} onChangeText={setWavePhone} />
        <Text style={{ fontSize: 11, color: '#60A5FA' }}>Must be registered with Wave in {destCountry.name}</Text>
        <TouchableOpacity style={[wp.submitBtn, (saving || !wavePhone.trim()) && { opacity: 0.5 }]} onPress={submit} disabled={saving || !wavePhone.trim()}>
          {saving ? <Spinner size="sm" color="#fff" /> : <><Zap size={14} color="#fff" /><Text style={wp.submitBtnText}>Send via Wave</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const cp = StyleSheet.create({
  trigger:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: '#FCD34D', borderStyle: 'dashed', backgroundColor: '#FFFBEB' },
  triggerIcon:  { width: 40, height: 40, backgroundColor: '#F59E0B', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  triggerTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  triggerSub:   { fontSize: 12, color: '#D97706', marginTop: 2 },
  expanded:     { borderRadius: 16, borderWidth: 2, borderColor: '#FCD34D', overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 10 },
  headerTitle:  { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },
  amountRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  input:        { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827' },
  agentRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: 'rgba(255,255,255,0.6)' },
  agentRowActive:{ borderColor: '#F59E0B', backgroundColor: '#fff' },
  radio:        { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#D1D5DB', marginTop: 2 },
  radioActive:  { borderColor: '#F59E0B', backgroundColor: '#F59E0B' },
  submitBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F59E0B', borderRadius: 12, paddingVertical: 12 },
  submitBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
})

const wp = StyleSheet.create({
  trigger:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: '#93C5FD', borderStyle: 'dashed', backgroundColor: '#EFF6FF' },
  triggerIcon:  { width: 40, height: 40, backgroundColor: '#3B82F6', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  triggerTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  triggerSub:   { fontSize: 12, color: '#3B82F6', marginTop: 2 },
  expanded:     { borderRadius: 16, borderWidth: 2, borderColor: '#93C5FD', overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 10 },
  headerTitle:  { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },
  amountRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  input:        { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827' },
  submitBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 12 },
  submitBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
})

const s = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn:       { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: '#111827' },
  content:       { paddingHorizontal: 20, paddingBottom: 40 },
  balanceChip:   { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  balanceLabel:  { fontSize: 13, color: '#6366F1', fontWeight: '500' },
  balanceValue:  { fontSize: 14, fontWeight: '700', color: '#4338CA' },
  sectionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  manageLink:    { fontSize: 12, color: '#4F46E5', fontWeight: '600' },
  recipientChip: { alignItems: 'center', marginRight: 12, width: 72 },
  recipientChipActive: { opacity: 1 },
  recipientAvatar:{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  recipientInitials:{ fontSize: 14, fontWeight: '700', color: '#fff' },
  recipientName: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
  inputLabel:    { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:         { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827', marginBottom: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 4 },
  verifiedText:  { fontSize: 13, color: '#16A34A', fontWeight: '500' },
  countryPicker: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 },
  countryName:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  currencyCode:  { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  pickerDropdown:{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4, overflow: 'hidden' },
  pickerOption:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  feeCard:       { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginTop: 12 },
  feeRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  feeLabel:      { fontSize: 13, color: '#6B7280' },
  feeValue:      { fontSize: 13, fontWeight: '600', color: '#374151' },
  feeDivider:    { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  rateHint:      { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  btn:           { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnDisabled:   { opacity: 0.7 },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Success screen
  successContainer: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 24, alignItems: 'center', paddingBottom: 40 },
  successIcon:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle:  { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  successSub:    { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  pickupBox:     { backgroundColor: '#D97706', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', marginBottom: 12, width: '100%' },
  pickupLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', letterSpacing: 2, marginBottom: 8 },
  pickupCode:    { fontSize: 36, fontWeight: '700', color: '#fff', letterSpacing: 10, fontFamily: 'monospace' },
  resultAmountBox:{ borderRadius: 20, paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', marginBottom: 16, width: '100%' },
  resultAmountLabel:{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  resultAmount:  { fontSize: 36, fontWeight: '700', color: '#fff' },
  summaryCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 16, width: '100%', marginBottom: 16 },
})
