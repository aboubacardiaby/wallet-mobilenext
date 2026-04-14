import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ArrowLeft, ArrowRight, Globe } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

const SENDER_COUNTRIES = [
  { name: 'United States',  flag: '🇺🇸', currency: 'USD', dial: '+1'   },
  { name: 'Canada',         flag: '🇨🇦', currency: 'CAD', dial: '+1'   },
  { name: 'France',         flag: '🇫🇷', currency: 'EUR', dial: '+33'  },
  { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', dial: '+44'  },
  { name: 'Germany',        flag: '🇩🇪', currency: 'EUR', dial: '+49'  },
  { name: 'Spain',          flag: '🇪🇸', currency: 'EUR', dial: '+34'  },
  { name: 'Italy',          flag: '🇮🇹', currency: 'EUR', dial: '+39'  },
  { name: 'Portugal',       flag: '🇵🇹', currency: 'EUR', dial: '+351' },
  { name: 'Switzerland',    flag: '🇨🇭', currency: 'CHF', dial: '+41'  },
  { name: 'Belgium',        flag: '🇧🇪', currency: 'EUR', dial: '+32'  },
  { name: 'Netherlands',    flag: '🇳🇱', currency: 'EUR', dial: '+31'  },
  { name: 'Sweden',         flag: '🇸🇪', currency: 'SEK', dial: '+46'  },
  { name: 'Norway',         flag: '🇳🇴', currency: 'NOK', dial: '+47'  },
]

const RECEIVER_COUNTRIES = [
  { name: 'Senegal',       flag: '🇸🇳', currency: 'XOF', dial: '+221' },
  { name: "Côte d'Ivoire", flag: '🇨🇮', currency: 'XOF', dial: '+225' },
  { name: 'Mali',          flag: '🇲🇱', currency: 'XOF', dial: '+223' },
  { name: 'Guinea',        flag: '🇬🇳', currency: 'GNF', dial: '+224' },
  { name: 'Burkina Faso',  flag: '🇧🇫', currency: 'XOF', dial: '+226' },
  { name: 'Niger',         flag: '🇳🇪', currency: 'XOF', dial: '+227' },
  { name: 'Togo',          flag: '🇹🇬', currency: 'XOF', dial: '+228' },
  { name: 'Benin',         flag: '🇧🇯', currency: 'XOF', dial: '+229' },
  { name: 'Cameroon',      flag: '🇨🇲', currency: 'XAF', dial: '+237' },
  { name: 'Mauritania',    flag: '🇲🇷', currency: 'MRU', dial: '+222' },
  { name: 'Gambia',        flag: '🇬🇲', currency: 'GMD', dial: '+220' },
  { name: 'Guinea-Bissau', flag: '🇬🇼', currency: 'XOF', dial: '+245' },
  { name: 'Nigeria',       flag: '🇳🇬', currency: 'NGN', dial: '+234' },
  { name: 'Ghana',         flag: '🇬🇭', currency: 'GHS', dial: '+233' },
  { name: 'Morocco',       flag: '🇲🇦', currency: 'MAD', dial: '+212' },
  { name: 'Kenya',         flag: '🇰🇪', currency: 'KES', dial: '+254' },
  { name: 'South Africa',  flag: '🇿🇦', currency: 'ZAR', dial: '+27'  },
  { name: 'Egypt',         flag: '🇪🇬', currency: 'EGP', dial: '+20'  },
  { name: 'Ethiopia',      flag: '🇪🇹', currency: 'ETB', dial: '+251' },
  { name: 'Congo (DRC)',   flag: '🇨🇩', currency: 'CDF', dial: '+243' },
]

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', CHF: 'Fr',
  XOF: 'XOF', XAF: 'XAF', NGN: '₦', GHS: '₵', KES: 'KSh',
  MAD: 'MAD', ZAR: 'R', EGP: '£E', SEK: 'kr', NOK: 'kr',
}

export default function RegisterScreen() {
  const navigation = useNavigation()
  const [step, setStep] = useState(0)
  const [userType, setUserType] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)

  const countries = userType === 'sender' ? SENDER_COUNTRIES : RECEIVER_COUNTRIES

  const submit = async () => {
    setLoading(true)
    try {
      const phone = (selectedCountry.dial + phoneNumber).replace(/\s/g, '')
      const { data } = await api.post('/auth/register', {
        phone_number: phone,
        country_code: selectedCountry.dial,
        full_name: fullName,
      })
      Toast.show({ type: 'success', text1: 'OTP sent!' })
      navigation.navigate('VerifyOTP', {
        phone_number: phone,
        otp: data.otp,
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

  // Step 0: Role selection
  if (step === 0) {
    return (
      <View style={s.container}>
        <View style={s.logoWrap}>
          <View style={[s.iconBox, { backgroundColor: '#4F46E5' }]}>
            <Globe size={30} color="#fff" />
          </View>
          <Text style={s.title}>Welcome</Text>
          <Text style={s.sub}>How will you use Kalipeh?</Text>
        </View>

        <TouchableOpacity style={s.roleCard} onPress={() => { setUserType('sender'); setStep(1) }}>
          <Text style={s.roleIcon}>✈️</Text>
          <View style={s.roleInfo}>
            <Text style={s.roleTitle}>I'm sending money</Text>
            <Text style={s.roleSub}>From North America or Europe to Africa</Text>
          </View>
          <View style={[s.badge, { backgroundColor: '#EEF2FF' }]}>
            <Text style={[s.badgeText, { color: '#4338CA' }]}>Diaspora</Text>
          </View>
          <ArrowRight size={16} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity style={s.roleCard} onPress={() => { setUserType('receiver'); setStep(1) }}>
          <Text style={s.roleIcon}>🌍</Text>
          <View style={s.roleInfo}>
            <Text style={s.roleTitle}>I'm receiving money</Text>
            <Text style={s.roleSub}>I'm based in Africa</Text>
          </View>
          <View style={[s.badge, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[s.badgeText, { color: '#166534' }]}>Africa</Text>
          </View>
          <ArrowRight size={16} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.linkText}>Already have an account? <Text style={s.link}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Step 1: Country selection
  if (step === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => setStep(0)} style={s.backBtn}>
            <ArrowLeft size={16} color="#9CA3AF" />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={s.stepTitle}>{userType === 'sender' ? 'Where are you sending from?' : 'Where are you based?'}</Text>
          <Text style={s.stepSub}>Select your country</Text>
        </View>
        <FlatList
          data={countries}
          keyExtractor={c => c.name}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={s.countryRow}
              onPress={() => { setSelectedCountry(c); setStep(2) }}
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
          )}
        />
      </View>
    )
  }

  // Step 2: Name + Phone
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
          <ArrowLeft size={16} color="#9CA3AF" />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <View style={s.countryHeader}>
          <Text style={{ fontSize: 32 }}>{selectedCountry?.flag}</Text>
          <View>
            <Text style={s.title}>Create Account</Text>
            <Text style={s.sub}>{selectedCountry?.name} · {selectedCountry?.currency}</Text>
          </View>
        </View>

        <Text style={s.label}>Full Name</Text>
        <TextInput style={s.input} placeholder="Your full name" placeholderTextColor="#9CA3AF" value={fullName} onChangeText={setFullName} />

        <Text style={[s.label, { marginTop: 16 }]}>Phone Number</Text>
        <View style={s.phoneRow}>
          <View style={s.dialBox}>
            <Text style={s.dialText}>{selectedCountry?.dial}</Text>
          </View>
          <TextInput
            style={[s.input, { flex: 1, marginLeft: 8 }]}
            placeholder="770000000"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>
        <Text style={s.hint}>Full number: {selectedCountry?.dial}{phoneNumber}</Text>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading
            ? <Spinner size="sm" color="#fff" />
            : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.btnText}>Send OTP</Text>
                <ArrowRight size={16} color="#fff" />
              </View>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 16 }}>
          <Text style={s.linkText}>Already have an account? <Text style={s.link}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, backgroundColor: '#F9FAFB' },
  logoWrap:     { alignItems: 'center', marginBottom: 40 },
  iconBox:      { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:        { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:          { fontSize: 14, color: '#6B7280', marginTop: 4 },
  topBar:       { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText:     { fontSize: 14, color: '#9CA3AF' },
  stepTitle:    { fontSize: 20, fontWeight: '700', color: '#111827' },
  stepSub:      { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  roleCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#F3F4F6' },
  roleIcon:     { fontSize: 28, width: 40, textAlign: 'center' },
  roleInfo:     { flex: 1 },
  roleTitle:    { fontSize: 15, fontWeight: '700', color: '#111827' },
  roleSub:      { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText:    { fontSize: 11, fontWeight: '600' },
  countryRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  flag:         { fontSize: 24, width: 32, textAlign: 'center' },
  countryName:  { fontSize: 14, fontWeight: '600', color: '#111827' },
  dial:         { fontSize: 12, color: '#9CA3AF' },
  currencyBadge:{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  currencyText: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },
  countryHeader:{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  label:        { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:        { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  phoneRow:     { flexDirection: 'row', alignItems: 'center' },
  dialBox:      { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  dialText:     { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  hint:         { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  btn:          { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnDisabled:  { opacity: 0.7 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkText:     { textAlign: 'center', fontSize: 14, color: '#6B7280' },
  link:         { color: '#4F46E5', fontWeight: '700' },
})
