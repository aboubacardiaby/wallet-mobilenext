import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { Wallet, Eye, EyeOff } from 'lucide-react-native'
import { Haptics } from '../utils/haptics'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function LoginScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { saveSession } = useAuth()

  const [dialCode, setDialCode] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [errors, setErrors] = useState({ phone: '', pin: '' })
  const [useBiometric, setUseBiometric] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('biometric_enabled').then(v => setUseBiometric(v === '1'))
  }, [])

  const submit = async () => {
    const nextErrors = { phone: '', pin: '' }
    if (!dialCode.trim()) nextErrors.phone = 'Enter a dial code'
    else if (!dialCode.startsWith('+')) nextErrors.phone = 'Use a dial code like +221'
    else if (!phone.trim()) nextErrors.phone = 'Enter your phone number'

    if (!pin.trim()) nextErrors.pin = 'Enter your 4-digit PIN'
    else if (pin.length !== 4) nextErrors.pin = 'PIN must be 4 digits'

    setErrors(nextErrors)
    if (nextErrors.phone || nextErrors.pin) {
      Haptics.error()
      return
    }

    setLoading(true)
    const fullPhone = (dialCode + phone).replace(/\s/g, '')
    try {
      const { data } = await api.post('auth/login', { phone_number: fullPhone, pin: String(pin) })
      await saveSession(data.token, data.user)
      Haptics.success()
      Toast.show({ type: 'success', text1: 'Welcome back!' })
    } catch (err) {
      Haptics.error()
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Login failed' })
    } finally {
      setLoading(false)
    }
  }

  const clearError = (field) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoBox}>
            <Wallet size={34} color="#fff" />
          </View>
          <Text style={s.title}>Kalipeh</Text>
          <Text style={s.sub}>Sign in to your account</Text>
        </View>

        {/* Form card */}
        <View style={s.card}>
          <Text style={s.label}>Phone Number</Text>
          <View style={s.phoneRow}>
            <TextInput
              style={[s.input, s.dialInput, errors.phone && s.inputError]}
              value={dialCode}
              onChangeText={v => {
                setDialCode(v.startsWith('+') ? v : '+' + v.replace(/\D/g, ''))
                clearError('phone')
              }}
              keyboardType="phone-pad"
              maxLength={5}
              placeholder="+221"
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={[s.input, s.phoneInput, errors.phone && s.inputError]}
              placeholder="700 000 000"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={v => { setPhone(v); clearError('phone') }}
              autoCorrect={false}
            />
          </View>
          <Text style={s.helper}>Country code + local number, e.g. +221 700 000 000</Text>
          {!!errors.phone && <Text style={s.errorText}>{errors.phone}</Text>}

          <Text style={[s.label, { marginTop: 22 }]}>PIN</Text>
          <View style={[s.input, s.pinWrap, errors.pin && s.inputError]}>
            <TextInput
              style={s.pinInput}
              placeholder="••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPin}
              keyboardType="number-pad"
              maxLength={4}
              value={pin}
              onChangeText={v => { setPin(v); clearError('pin') }}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPin(v => !v)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              {showPin
                ? <EyeOff size={20} color="#6B7280" />
                : <Eye    size={20} color="#6B7280" />
              }
            </TouchableOpacity>
          </View>
          {!!errors.pin && <Text style={s.errorText}>{errors.pin}</Text>}

          <TouchableOpacity
            style={s.forgotLink}
            onPress={() => Toast.show({ type: 'info', text1: 'Contact support to reset your PIN' })}
            activeOpacity={0.7}
          >
            <Text style={s.forgotText}>Forgot PIN?</Text>
          </TouchableOpacity>

          <View style={s.biometricRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.biometricLabel}>Use Face ID / Fingerprint</Text>
              <Text style={s.biometricSub}>Unlock with biometrics</Text>
            </View>
            <Switch
              value={useBiometric}
              onValueChange={async (v) => { setUseBiometric(v); await AsyncStorage.setItem('biometric_enabled', v ? '1' : '0') }}
              trackColor={{ true: '#4F46E5' }}
            />
          </View>

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={s.linkWrap}>
          <Text style={s.linkText}>Don't have an account? <Text style={s.link}>Register</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap:    { alignItems: 'center', marginBottom: 32 },
  logoBox:     { width: 72, height: 72, backgroundColor: '#4F46E5', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  title:       { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  sub:         { fontSize: 15, color: '#6B7280', marginTop: 4 },
  card:        { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, marginBottom: 20 },
  label:       { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input:       { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' },
  inputError:  { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  phoneRow:    { flexDirection: 'row', gap: 8 },
  dialInput:   { width: 76, textAlign: 'center' },
  phoneInput:  { flex: 1 },
  helper:      { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  errorText:   { fontSize: 12, color: '#EF4444', fontWeight: '500', marginTop: 6 },
  pinWrap:     { flexDirection: 'row', alignItems: 'center', paddingRight: 44, paddingVertical: 0 },
  pinInput:    { flex: 1, textAlign: 'center', fontSize: 24, letterSpacing: 10, color: '#111827', paddingVertical: 10 },
  eyeBtn:      { position: 'absolute', right: 12, padding: 4 },
  forgotLink:  { alignSelf: 'flex-end', marginTop: 10, marginBottom: 4 },
  forgotText:  { fontSize: 13, fontWeight: '600', color: '#4F46E5' },
  biometricRow:{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 14 },
  biometricLabel:{ fontSize: 14, fontWeight: '600', color: '#111827' },
  biometricSub:{ fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  btn:         { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnDisabled: { opacity: 0.7 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkWrap:    { alignItems: 'center' },
  linkText:    { fontSize: 14, color: '#6B7280' },
  link:        { color: '#4F46E5', fontWeight: '700' },
})
