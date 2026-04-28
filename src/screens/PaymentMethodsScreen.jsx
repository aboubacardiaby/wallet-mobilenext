import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, ActivityIndicator, Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ArrowLeft, CreditCard, Building2, Star, Trash2, Plus, X, Smartphone } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'

const BRAND_LOGO = {
  visa:       { text: 'VISA', bg: '#1D4ED8', fg: '#fff' },
  mastercard: { text: 'MC',   bg: '#DC2626', fg: '#fff' },
  amex:       { text: 'AMEX', bg: '#2563EB', fg: '#fff' },
  discover:   { text: 'DISC', bg: '#EA580C', fg: '#fff' },
  unknown:    { text: '💳',   bg: '#E5E7EB', fg: '#374151' },
}

const BASE_FORM_TABS = [
  { id: 'card',       label: 'Card',       icon: '💳' },
  { id: 'ach',        label: 'Bank (ACH)', icon: '🏛️' },
  { id: 'paypal',     label: 'PayPal',     icon: '🅿️' },
  { id: 'apple_pay',  label: 'Apple Pay',  icon: '🍎' },
  { id: 'google_pay', label: 'Google Pay', icon: '🇬' },
]

function detectBrand(n) {
  const d = n.replace(/\s/g, '')
  if (d.startsWith('4')) return 'visa'
  if (/^3[47]/.test(d)) return 'amex'
  if (/^6(011|5)/.test(d)) return 'discover'
  const p = parseInt(d.slice(0, 2), 10)
  if (p >= 51 && p <= 55) return 'mastercard'
  const p4 = parseInt(d.slice(0, 4), 10)
  if (p4 >= 2221 && p4 <= 2720) return 'mastercard'
  return 'unknown'
}

function formatCardNumber(raw) {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export default function PaymentMethodsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const FORM_TABS = BASE_FORM_TABS
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [activeTab, setActiveTab] = useState('card')

  const load = async () => {
    try {
      const { data } = await api.get('/payment-methods')
      setMethods(data.payment_methods || [])
    } catch { Toast.show({ type: 'error', text1: 'Failed to load payment methods' }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const remove = (id, label) => {
    Alert.alert('Remove Method', `Remove "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/payment-methods/${id}`)
          Toast.show({ type: 'success', text1: 'Removed' })
          setMethods(m => m.filter(x => x.id !== id))
        } catch { Toast.show({ type: 'error', text1: 'Failed to remove' }) }
      }},
    ])
  }

  const setDefault = async (id) => {
    try {
      await api.put(`/payment-methods/${id}/default`)
      Toast.show({ type: 'success', text1: 'Default updated' })
      load()
    } catch { Toast.show({ type: 'error', text1: 'Failed to update' }) }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={s.title}>Payment Methods</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={methods}
        keyExtractor={m => String(m.id)}
        contentContainerStyle={s.list}
        ListHeaderComponent={() => (
          <View>
            {!showAdd ? (
              <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
                <Plus size={16} color="#4F46E5" />
                <Text style={s.addBtnText}>Add Payment Method</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.formCard}>
                <View style={s.formHeader}>
                  <Text style={s.formTitle}>Add Method</Text>
                  <TouchableOpacity onPress={() => setShowAdd(false)}><X size={18} color="#9CA3AF" /></TouchableOpacity>
                </View>
                <View style={s.tabRow}>
                  {FORM_TABS.map(t => (
                    <TouchableOpacity key={t.id} style={[s.tab, activeTab === t.id && s.tabActive]} onPress={() => setActiveTab(t.id)}>
                      <Text style={s.tabIcon}>{t.icon}</Text>
                      <Text style={[s.tabLabel, activeTab === t.id && s.tabLabelActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {activeTab === 'card' && <AddCardForm onDone={() => { setShowAdd(false); load() }} />}
                {activeTab === 'ach'  && <AddACHForm onDone={() => { setShowAdd(false); load() }} />}
                {activeTab === 'paypal' && <AddPayPalForm onDone={() => { setShowAdd(false); load() }} />}
                {(activeTab === 'apple_pay' || activeTab === 'google_pay') && <AddDigitalWalletForm type={activeTab} onDone={() => { setShowAdd(false); load() }} />}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={() => !loading ? (
          <View style={s.empty}>
            <CreditCard size={40} color="#E5E7EB" />
            <Text style={s.emptyText}>No payment methods saved yet</Text>
            <Text style={s.emptySub}>Add a card or bank account to fund your transfers</Text>
          </View>
        ) : null}
        renderItem={({ item: m }) => {
          const brand = BRAND_LOGO[m.card_brand] || BRAND_LOGO.unknown
          return (
            <View style={[s.methodCard, m.is_default && s.methodCardDefault]}>
              {m.type === 'card' ? (
                <View style={[s.brandBadge, { backgroundColor: brand.bg }]}>
                  <Text style={[s.brandText, { color: brand.fg }]}>{brand.text}</Text>
                </View>
              ) : (
                <View style={s.iconBadge}>
                  {m.type === 'ach' || m.type === 'bank_transfer'
                    ? <Building2 size={16} color="#374151" />
                    : <Smartphone size={16} color="#374151" />}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.methodLabel}>{m.label}</Text>
                {m.type === 'card' && m.expiry_month && (
                  <Text style={s.methodExpiry}>Expires {String(m.expiry_month).padStart(2, '0')}/{m.expiry_year}</Text>
                )}
                {m.is_default && <Text style={s.defaultBadge}>Default</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {!m.is_default && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => setDefault(m.id)}>
                    <Star size={14} color="#CA8A04" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => remove(m.id, m.label)}>
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
      {loading && <View style={s.loadingOverlay}><ActivityIndicator size="large" color="#4F46E5" /></View>}
    </View>
  )
}

function AddCardForm({ onDone }) {
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const brand = BRAND_LOGO[detectBrand(number)] || BRAND_LOGO.unknown

  const submit = async () => {
    const [mm, yy] = expiry.split('/')
    if (!mm || !yy) return Toast.show({ type: 'error', text1: 'Invalid expiry date' })
    setSaving(true)
    try {
      await api.post('/payment-methods/card', {
        card_number: number.replace(/\s/g, ''),
        expiry_month: parseInt(mm, 10),
        expiry_year: parseInt('20' + yy, 10),
        holder_name: name,
        set_default: isDefault,
      })
      Toast.show({ type: 'success', text1: 'Card added!' })
      onDone()
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join('\n')
        : typeof detail === 'string' ? detail : err.message || 'Failed to add card.'
      Alert.alert('Could Not Save Card', msg)
    } finally { setSaving(false) }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ position: 'relative' }}>
        <TextInput style={sF.input} placeholder="1234 5678 9012 3456" placeholderTextColor="#9CA3AF" keyboardType="number-pad" maxLength={19} value={number} onChangeText={v => setNumber(formatCardNumber(v))} />
        <View style={[sF.brandTag, { backgroundColor: brand.bg }]}><Text style={[sF.brandTagText, { color: brand.fg }]}>{brand.text}</Text></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput style={[sF.input, { flex: 1 }]} placeholder="MM/YY" placeholderTextColor="#9CA3AF" keyboardType="number-pad" maxLength={5} value={expiry} onChangeText={v => setExpiry(formatExpiry(v))} />
        <TextInput style={[sF.input, { flex: 1 }]} placeholder="CVV" placeholderTextColor="#9CA3AF" keyboardType="number-pad" maxLength={4} secureTextEntry value={cvv} onChangeText={v => setCvv(v.replace(/\D/g, '').slice(0, 4))} />
      </View>
      <TextInput style={sF.input} placeholder="Cardholder name" placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />
      <View style={sF.switchRow}>
        <Text style={sF.switchLabel}>Set as default</Text>
        <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: '#4F46E5' }} />
      </View>
      <TouchableOpacity style={[sF.btn, saving && sF.btnDisabled]} onPress={submit} disabled={saving}>
        {saving ? <Spinner size="sm" color="#fff" /> : <Text style={sF.btnText}>Add Card</Text>}
      </TouchableOpacity>
    </View>
  )
}


function AddACHForm({ onDone }) {
  const [bankName, setBankName]           = useState('')
  const [holderName, setHolderName]       = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType]     = useState('checking')
  const [isDefault, setIsDefault]         = useState(false)
  const [saving, setSaving]               = useState(false)

  const submit = async () => {
    if (!bankName.trim())          return Alert.alert('Missing Field', 'Please enter the bank name.')
    if (!holderName.trim())        return Alert.alert('Missing Field', 'Please enter the account holder name.')
    if (routingNumber.length !== 9) return Alert.alert('Invalid Routing Number', 'Routing number must be exactly 9 digits.')
    if (accountNumber.length < 4)  return Alert.alert('Invalid Account Number', 'Please enter a valid account number (min 4 digits).')
    setSaving(true)
    try {
      await api.post('/payment-methods/bank', {
        bank_name:      bankName.trim(),
        holder_name:    holderName.trim(),
        routing_number: routingNumber,
        account_number: accountNumber,
        account_type:   accountType,
        set_default:    isDefault,
      })
      Toast.show({ type: 'success', text1: 'Bank account added!' })
      onDone()
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join('\n')
        : typeof detail === 'string'
          ? detail
          : err.response?.data?.message || err.message || 'Failed to save bank account.'
      Alert.alert('Could Not Save Account', msg)
    } finally { setSaving(false) }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={sF.infoBanner}>
        <Text style={{ fontSize: 20 }}>🏛️</Text>
        <Text style={sF.infoText}>Link your bank account for direct ACH transfers.</Text>
      </View>
      <TextInput
        style={sF.input}
        placeholder="Bank name (e.g. Bank of America)"
        placeholderTextColor="#9CA3AF"
        value={bankName}
        onChangeText={setBankName}
      />
      <TextInput
        style={sF.input}
        placeholder="Account holder name"
        placeholderTextColor="#9CA3AF"
        value={holderName}
        onChangeText={setHolderName}
      />
      <TextInput
        style={sF.input}
        placeholder="Routing number (9 digits)"
        placeholderTextColor="#9CA3AF"
        keyboardType="number-pad"
        maxLength={9}
        value={routingNumber}
        onChangeText={v => setRoutingNumber(v.replace(/\D/g, '').slice(0, 9))}
      />
      <TextInput
        style={sF.input}
        placeholder="Account number"
        placeholderTextColor="#9CA3AF"
        keyboardType="number-pad"
        value={accountNumber}
        onChangeText={v => setAccountNumber(v.replace(/\D/g, ''))}
      />
      <View style={sF.segmentRow}>
        <TouchableOpacity
          style={[sF.segment, accountType === 'checking' && sF.segmentActive]}
          onPress={() => setAccountType('checking')}
        >
          <Text style={[sF.segmentText, accountType === 'checking' && sF.segmentTextActive]}>Checking</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[sF.segment, accountType === 'savings' && sF.segmentActive]}
          onPress={() => setAccountType('savings')}
        >
          <Text style={[sF.segmentText, accountType === 'savings' && sF.segmentTextActive]}>Savings</Text>
        </TouchableOpacity>
      </View>
      <View style={sF.switchRow}>
        <Text style={sF.switchLabel}>Set as default</Text>
        <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: '#4F46E5' }} />
      </View>
      <TouchableOpacity style={[sF.btn, saving && sF.btnDisabled]} onPress={submit} disabled={saving}>
        {saving ? <Spinner size="sm" color="#fff" /> : <Text style={sF.btnText}>Add Bank Account</Text>}
      </TouchableOpacity>
    </View>
  )
}

function AddPayPalForm({ onDone }) {
  const [email, setEmail] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await api.post('/payment-methods/paypal', { email, set_default: isDefault })
      Toast.show({ type: 'success', text1: 'PayPal added!' })
      onDone()
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed' })
    } finally { setSaving(false) }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={sF.infoBanner}><Text style={{ fontSize: 20 }}>🅿️</Text><Text style={sF.infoText}>Link your PayPal account to send money instantly.</Text></View>
      <TextInput style={sF.input} placeholder="PayPal email address" placeholderTextColor="#9CA3AF" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <View style={sF.switchRow}><Text style={sF.switchLabel}>Set as default</Text><Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: '#4F46E5' }} /></View>
      <TouchableOpacity style={[sF.btn, saving && sF.btnDisabled]} onPress={submit} disabled={saving}>
        {saving ? <Spinner size="sm" color="#fff" /> : <Text style={sF.btnText}>Link PayPal</Text>}
      </TouchableOpacity>
    </View>
  )
}

function AddDigitalWalletForm({ type, onDone }) {
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const label = type === 'apple_pay' ? 'Apple Pay' : 'Google Pay'
  const icon = type === 'apple_pay' ? '🍎' : '🇬'

  const submit = async () => {
    setSaving(true)
    try {
      await api.post('/payment-methods/digital-wallet', { type, set_default: isDefault })
      Toast.show({ type: 'success', text1: `${label} added!` })
      onDone()
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed' })
    } finally { setSaving(false) }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={sF.walletBanner}>
        <Text style={{ fontSize: 40 }}>{icon}</Text>
        <Text style={sF.walletTitle}>{label}</Text>
        <Text style={sF.walletSub}>{type === 'apple_pay' ? 'Use Face ID / Touch ID for fast, secure payments.' : 'Pay with your Google account securely.'}</Text>
      </View>
      <View style={sF.switchRow}><Text style={sF.switchLabel}>Set as default</Text><Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: '#4F46E5' }} /></View>
      <TouchableOpacity style={[sF.btn, saving && sF.btnDisabled]} onPress={submit} disabled={saving}>
        {saving ? <Spinner size="sm" color="#fff" /> : <Text style={sF.btnText}>Add {label}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F9FAFB' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '700', color: '#111827' },
  list:         { padding: 20, gap: 10 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed' },
  addBtnText:   { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  formCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 4 },
  formHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formTitle:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  tabRow:       { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 14, gap: 2 },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  tabActive:    { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  tabIcon:      { fontSize: 14 },
  tabLabel:     { fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  tabLabelActive:{ color: '#4F46E5' },
  methodCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  methodCardDefault:{ borderWidth: 2, borderColor: '#C7D2FE' },
  brandBadge:   { width: 44, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandText:    { fontSize: 11, fontWeight: '900' },
  iconBadge:    { width: 44, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  methodLabel:  { fontSize: 14, fontWeight: '700', color: '#111827' },
  methodExpiry: { fontSize: 12, color: '#9CA3AF' },
  defaultBadge: { fontSize: 10, fontWeight: '700', color: '#4F46E5', backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start', marginTop: 3 },
  actionBtn:    { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF9C3', alignItems: 'center', justifyContent: 'center' },
  empty:        { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: 14, color: '#9CA3AF' },
  emptySub:     { fontSize: 12, color: '#D1D5DB', textAlign: 'center' },
  loadingOverlay:{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' },
})

const sF = StyleSheet.create({
  input:       { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827' },
  brandTag:    { position: 'absolute', right: 12, top: '50%', marginTop: -10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  brandTagText:{ fontSize: 10, fontWeight: '900' },
  switchRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 14, color: '#374151' },
  btn:         { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 },
  infoText:    { fontSize: 12, color: '#1D4ED8', flex: 1 },
  walletBanner:{ alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16 },
  walletTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  walletSub:   { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  segmentRow:  { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 3, gap: 3 },
  segment:     { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive:{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  segmentTextActive: { color: '#4F46E5' },
})
