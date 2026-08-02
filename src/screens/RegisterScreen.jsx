import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ArrowLeft, ArrowRight, Globe, Search } from 'lucide-react-native'
import api from '../api/client'
import useCountries from '../hooks/useCountries'
import Spinner from '../components/Spinner'

// ISO codes curated per role — the country *data* (name/flag/dial/currency)
// now comes from useCountries(); these lists just define which of those
// countries are offered to senders (North America/Europe) vs receivers (Africa).
const SENDER_CODES = ['US', 'CA', 'FR', 'GB', 'DE', 'ES', 'IT', 'PT', 'CH', 'BE']
const RECEIVER_CODES = [
  'SN', 'CI', 'ML', 'GN', 'BF', 'NE', 'TG', 'BJ', 'CM', 'MR',
  'GM', 'GW', 'NG', 'GH', 'MA', 'KE', 'ZA', 'EG', 'ET', 'CD',
]

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', CHF: 'Fr',
  XOF: 'XOF', XAF: 'XAF', NGN: '₦', GHS: '₵', KES: 'KSh',
  MAD: 'MAD', ZAR: 'R', EGP: '£E', SEK: 'kr', NOK: 'kr',
}

const REGION_CURRENCY = {
  US: 'USD', CA: 'CAD', GB: 'GBP', CH: 'CHF',
  FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR',
  BE: 'EUR', NL: 'EUR', AT: 'EUR', FI: 'EUR', IE: 'EUR',
  LU: 'EUR', SE: 'SEK', NO: 'NOK',
}

function getDeviceCountry(countryList) {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const parts = locale.split('-')
    const region = parts.reverse().find(p => /^[A-Z]{2}$/.test(p))
    if (!region) return null
    const currency = REGION_CURRENCY[region]
    if (!currency) return null
    return countryList.find(c => c.currency === currency) || null
  } catch {
    return null
  }
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function StepDots({ current }) {
  return (
    <View style={s.stepDots}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[s.dot, i === current && s.dotActive]} />
      ))}
    </View>
  )
}

function StepText({ current, total = 3 }) {
  return <Text style={s.stepText}>Step {current + 1} of {total}</Text>
}

export default function RegisterScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(0)
  const [userType, setUserType] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [countryQuery, setCountryQuery] = useState('')
  const [errors, setErrors] = useState({ fullName: '', phoneNumber: '' })
  const [loading, setLoading] = useState(false)
  const { countries: allCountries } = useCountries()

  const senderCountries = SENDER_CODES.map(code => allCountries.find(c => c.code === code)).filter(Boolean)
  const receiverCountries = RECEIVER_CODES.map(code => allCountries.find(c => c.code === code)).filter(Boolean)
  const countries = userType === 'sender' ? senderCountries : receiverCountries

  const filteredCountries = countryQuery.trim()
    ? countries.filter(c =>
        c.name.toLowerCase().includes(countryQuery.toLowerCase()) ||
        c.dial.includes(countryQuery)
      )
    : countries

  const clearError = (field) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const submit = async () => {
    const nextErrors = { fullName: '', phoneNumber: '' }
    if (!fullName.trim()) nextErrors.fullName = 'Enter your full name'

    const rawPhone = phoneNumber.replace(/\D/g, '')
    if (!rawPhone) nextErrors.phoneNumber = 'Enter your phone number'
    else if (rawPhone.length < 7) nextErrors.phoneNumber = 'Phone number is too short'

    setErrors(nextErrors)
    if (nextErrors.fullName || nextErrors.phoneNumber) return

    setLoading(true)
    try {
      const phone = (selectedCountry.dial + phoneNumber).replace(/\s/g, '')
      await api.post('auth/register', {
        phone_number: phone,
        country_code: selectedCountry.dial,
        full_name: fullName,
      })
      Toast.show({ type: 'success', text1: 'OTP sent!' })
      navigation.navigate('VerifyOTP', {
        phone_number: phone,
        country_code: selectedCountry.dial,
        full_name: fullName,
        user_type: userType,
        home_currency: selectedCountry.currency,
        home_country: selectedCountry.name,
      })
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Registration failed' })
    } finally {
      setLoading(false)
    }
  }

  // ── Step 0: Role selection ─────────────────────────────────────────────────
  if (step === 0) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        contentContainerStyle={[s.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.logoWrap}>
          <View style={[s.iconBox, { backgroundColor: '#4F46E5' }]}>
            <Globe size={32} color="#fff" />
          </View>
          <Text style={s.title}>Create Account</Text>
          <Text style={s.sub}>How will you use Kalipeh?</Text>
          <StepDots current={0} />
          <StepText current={0} />
        </View>

        <TouchableOpacity
          style={s.roleCard}
          onPress={() => {
            setUserType('sender')
            const detected = getDeviceCountry(senderCountries)
            if (detected) setSelectedCountry(detected)
            setCountryQuery('')
            setStep(1)
          }}
          activeOpacity={0.85}
        >
          <View style={[s.roleIconWrap, { backgroundColor: '#EEF2FF' }]}>
            <Text style={[s.roleInitial, { color: '#4338CA' }]}>S</Text>
          </View>
          <View style={s.roleInfo}>
            <Text style={s.roleTitle}>I'm sending money</Text>
            <Text style={s.roleSub}>I live abroad and send money to Africa</Text>
          </View>
          <View style={[s.badge, { backgroundColor: '#EEF2FF' }]}>
            <Text style={[s.badgeText, { color: '#4338CA' }]}>Sender</Text>
          </View>
          <ArrowRight size={16} color="#C7D2FE" />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.roleCard}
          onPress={() => { setUserType('receiver'); setCountryQuery(''); setStep(1) }}
          activeOpacity={0.85}
        >
          <View style={[s.roleIconWrap, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[s.roleInitial, { color: '#166534' }]}>R</Text>
          </View>
          <View style={s.roleInfo}>
            <Text style={s.roleTitle}>I'm receiving money</Text>
            <Text style={s.roleSub}>I live in Africa and receive money</Text>
          </View>
          <View style={[s.badge, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[s.badgeText, { color: '#166534' }]}>Receiver</Text>
          </View>
          <ArrowRight size={16} color="#BBF7D0" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.linkWrap}>
          <Text style={s.linkText}>Already have an account? <Text style={s.link}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ── Step 1: Country selection ──────────────────────────────────────────────
  if (step === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setStep(0)} style={s.backBtn}>
            <ArrowLeft size={18} color="#374151" />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={s.stepTitle}>
              Where are you based?
            </Text>
            <Text style={s.stepSub}>Select your country</Text>
            <StepDots current={1} />
          </View>
        </View>

        <View style={s.searchWrap}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={s.searchInput}
            placeholder="Search country or dial code"
            placeholderTextColor="#9CA3AF"
            value={countryQuery}
            onChangeText={setCountryQuery}
            autoCorrect={false}
          />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {filteredCountries.length === 0 && (
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>No countries found</Text>
            </View>
          )}
          {filteredCountries.map(c => (
            <TouchableOpacity
              key={c.name}
              style={s.countryRow}
              onPress={() => { setSelectedCountry(c); setPhoneNumber(''); setStep(2) }}
              activeOpacity={0.85}
            >
              <Text style={s.flag}>{c.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.countryName}>{c.name}</Text>
                <Text style={s.dial}>{c.dial}</Text>
              </View>
              <View style={s.currencyBadge}>
                <Text style={s.currencyText}>{CURRENCY_SYMBOLS[c.currency] || c.currency} {c.currency}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  }

  // ── Step 2: Name + Phone ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
          <ArrowLeft size={18} color="#374151" />
        </TouchableOpacity>

        <StepDots current={2} />
        <StepText current={2} />

        <View style={s.countryHeader}>
          <Text style={{ fontSize: 40 }}>{selectedCountry?.flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Create Account</Text>
            <Text style={s.sub}>{selectedCountry?.name} · {selectedCountry?.currency}</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Full Name</Text>
          <TextInput
            style={[s.input, errors.fullName && s.inputError]}
            placeholder="Your full name"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={v => { setFullName(v); clearError('fullName') }}
            autoCapitalize="words"
          />
          {!!errors.fullName && <Text style={s.errorText}>{errors.fullName}</Text>}

          <Text style={[s.label, { marginTop: 22 }]}>Phone Number</Text>
          <View style={s.phoneRow}>
            <View style={s.dialBox}>
              <Text style={s.dialText}>{selectedCountry?.dial}</Text>
            </View>
            <TextInput
              style={[s.input, s.phoneInput, errors.phoneNumber && s.inputError]}
              placeholder="770 000 000"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={v => { setPhoneNumber(formatPhone(v)); clearError('phoneNumber') }}
            />
          </View>
          {!!errors.phoneNumber && <Text style={s.errorText}>{errors.phoneNumber}</Text>}
          <Text style={s.hint}>Full: {selectedCountry?.dial} {phoneNumber}</Text>

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading
              ? <Spinner size="sm" color="#fff" />
              : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.btnText}>Send OTP</Text>
                  <ArrowRight size={16} color="#fff" />
                </View>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.linkWrap}>
          <Text style={s.linkText}>Already have an account? <Text style={s.link}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, paddingHorizontal: 20 },
  logoWrap:     { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  iconBox:      { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  title:        { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  sub:          { fontSize: 14, color: '#6B7280', marginTop: 4 },
  stepDots:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  dotActive:    { width: 24, backgroundColor: '#4F46E5' },
  stepText:     { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginTop: 8 },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stepTitle:    { fontSize: 18, fontWeight: '700', color: '#111827' },
  stepSub:      { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  roleCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  roleIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleInitial:  { fontSize: 18, fontWeight: '800' },
  roleInfo:     { flex: 1 },
  roleTitle:    { fontSize: 15, fontWeight: '700', color: '#111827' },
  roleSub:      { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  badge:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText:    { fontSize: 11, fontWeight: '700' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  searchInput:  { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15, color: '#111827' },
  emptyWrap:    { paddingVertical: 32, alignItems: 'center' },
  emptyText:    { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  countryRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  flag:         { fontSize: 26, width: 34, textAlign: 'center' },
  countryName:  { fontSize: 14, fontWeight: '600', color: '#111827' },
  dial:         { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  currencyBadge:{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  currencyText: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },
  countryHeader:{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, marginTop: 16 },
  card:         { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 20 },
  label:        { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input:        { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' },
  inputError:   { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorText:    { fontSize: 12, color: '#EF4444', fontWeight: '500', marginTop: 6 },
  phoneRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInput:   { flex: 1 },
  dialBox:      { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minWidth: 76 },
  dialText:     { fontSize: 14, fontWeight: '600', color: '#374151' },
  hint:         { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  btn:          { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnDisabled:  { opacity: 0.7 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkWrap:     { alignItems: 'center' },
  linkText:     { fontSize: 14, color: '#6B7280' },
  link:         { color: '#4F46E5', fontWeight: '700' },
})
