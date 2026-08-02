import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

const RESEND_COOLDOWN = 60
const CODE_TTL = 300

function maskPhone(phone) {
  if (!phone || phone.length <= 8) return phone
  const prefix = phone.slice(0, -5)
  return `${prefix} •••• ${phone.slice(-4)}`
}

function fmtSeconds(total) {
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function VerifyOTPScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const route = useRoute()
  const params = route.params || {}
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const [expiry, setExpiry] = useState(CODE_TTL)
  const [showHelp, setShowHelp] = useState(false)
  const inputs = useRef([])
  const timerRef = useRef(null)
  const expiryRef = useRef(null)

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  const startExpiry = useCallback(() => {
    setExpiry(CODE_TTL)
    clearInterval(expiryRef.current)
    expiryRef.current = setInterval(() => {
      setExpiry(prev => {
        if (prev <= 1) { clearInterval(expiryRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    if (!params.phone_number) return navigation.navigate('Register')
    setTimeout(() => inputs.current[0]?.focus(), 300)
    startCooldown()
    startExpiry()
    return () => {
      clearInterval(timerRef.current)
      clearInterval(expiryRef.current)
    }
  }, [startCooldown, startExpiry])

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) {
      inputs.current[i + 1]?.focus()
    } else if (val && i === 5) {
      inputs.current[5]?.blur()
      submit(next.join(''))
    }
  }

  const handleKey = (i, e) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const submit = async (overrideCode) => {
    const code = overrideCode ?? digits.join('')
    if (expiry <= 0) return Toast.show({ type: 'error', text1: 'Code has expired. Resend for a new one.' })
    if (code.length < 6) return Toast.show({ type: 'error', text1: 'Enter the 6-digit code' })
    setLoading(true)
    try {
      const { data } = await api.post('auth/verify-otp', {
        phone_number: params.phone_number,
        code,
        user_type:     params.user_type     || 'receiver',
        home_currency: params.home_currency || 'USD',
        full_name:     params.full_name     || '',
        home_country:  params.home_country  || '',
      })
      Toast.show({ type: 'success', text1: 'Account created! Set your PIN.' })
      navigation.navigate('SetPIN', {
        token: data.token,
        user: {
          id: data.user_id,
          phone_number: params.phone_number,
          full_name:     params.full_name     || '',
          user_type:     params.user_type     || 'receiver',
          home_country:  params.home_country  || '',
          home_currency: params.home_currency || '',
        },
      })
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Invalid OTP' })
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    setDigits(['', '', '', '', '', ''])
    try {
      await api.post('auth/register', {
        phone_number: params.phone_number,
        country_code: params.country_code || '',
        full_name:    params.full_name    || '',
      })
      Toast.show({ type: 'success', text1: 'New code sent!' })
      startCooldown()
      startExpiry()
      setTimeout(() => inputs.current[0]?.focus(), 300)
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Could not resend code' })
    } finally {
      setResending(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.iconWrap}>
          <View style={s.iconBox}>
            <ShieldCheck size={32} color="#fff" />
          </View>
          <Text style={s.title}>Verify OTP</Text>
          <Text style={s.sub}>Enter the 6-digit code sent to</Text>
          <Text style={s.phone}>{maskPhone(params.phone_number)}</Text>
          <Text style={[s.expiry, expiry <= 0 && s.expiryExpired]}>
            {expiry > 0 ? `Code expires in ${fmtSeconds(expiry)}` : 'Code expired. Resend for a new one.'}
          </Text>
        </View>

        <View style={s.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={el => inputs.current[i] = el}
              style={[s.otpBox, d ? s.otpBoxFilled : null, expiry <= 0 && s.otpBoxExpired]}
              value={d}
              onChangeText={v => handleDigit(i, v)}
              onKeyPress={e => handleKey(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              editable={expiry > 0}
            />
          ))}
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={() => submit()} disabled={loading || expiry <= 0}>
          {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Verify</Text>}
        </TouchableOpacity>

        <View style={s.resendWrap}>
          {resending ? (
            <Spinner size="sm" color="#4F46E5" />
          ) : cooldown > 0 ? (
            <Text style={s.cooldownText}>Resend code in {cooldown}s</Text>
          ) : (
            <TouchableOpacity style={s.resendBtn} onPress={resend} activeOpacity={0.8}>
              <Text style={s.resendBtnText}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={s.helpToggle} onPress={() => setShowHelp(v => !v)} activeOpacity={0.7}>
          <Text style={s.helpToggleText}>Didn't receive the code?</Text>
          {showHelp ? <ChevronUp size={16} color="#4F46E5" /> : <ChevronDown size={16} color="#4F46E5" />}
        </TouchableOpacity>

        {showHelp && (
          <View style={s.helpCard}>
            <Text style={s.helpItem}>Make sure your phone has signal and can receive SMS.</Text>
            <Text style={s.helpItem}>Double-check that the number {maskPhone(params.phone_number)} is correct.</Text>
            <Text style={s.helpItem}>Wait a few seconds — some carriers can delay messages.</Text>
            <Text style={s.helpItem}>Still nothing? Use Resend Code or contact support.</Text>

            <TouchableOpacity onPress={() => navigation.goBack()} style={s.wrongNumber} activeOpacity={0.7}>
              <Text style={s.wrongNumberText}>Wrong number? Go back and edit it</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:      { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  iconWrap:       { alignItems: 'center', marginBottom: 40 },
  iconBox:        { width: 64, height: 64, backgroundColor: '#22C55E', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:          { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:            { fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  phone:          { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 4 },
  expiry:         { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginTop: 8 },
  expiryExpired:  { color: '#EF4444' },
  otpRow:         { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  otpBox:         { width: 48, height: 56, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 14, fontSize: 22, fontWeight: '700', color: '#111827', backgroundColor: '#fff' },
  otpBoxFilled:   { borderColor: '#4F46E5' },
  otpBoxExpired:  { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  btn:            { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnDisabled:    { opacity: 0.5 },
  btnText:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendWrap:     { alignItems: 'center', marginTop: 24, minHeight: 40 },
  cooldownText:   { fontSize: 14, color: '#9CA3AF' },
  resendBtn:      { borderWidth: 1.5, borderColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  resendBtnText:  { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  helpToggle:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  helpToggleText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  helpCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 16, borderWidth: 1.5, borderColor: '#E5E7EB' },
  helpItem:       { fontSize: 13, color: '#4B5563', marginBottom: 10, lineHeight: 20 },
  wrongNumber:    { marginTop: 8, alignSelf: 'center' },
  wrongNumberText:{ fontSize: 13, fontWeight: '700', color: '#4F46E5' },
})
