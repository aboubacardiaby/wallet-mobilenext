import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ShieldCheck } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

const RESEND_COOLDOWN = 60

export default function VerifyOTPScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const route = useRoute()
  const params = route.params || {}
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)
  const inputs = useRef([])
  const timerRef = useRef(null)

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

  useEffect(() => {
    if (!params.phone_number) return navigation.navigate('Register')
    setTimeout(() => inputs.current[0]?.focus(), 300)
    startCooldown()
    return () => clearInterval(timerRef.current)
  }, [startCooldown])

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
    if (code.length < 6) return Toast.show({ type: 'error', text1: 'Enter the 6-digit code' })
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-otp', {
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
      await api.post('/auth/register', {
        phone_number: params.phone_number,
        country_code: params.country_code || '',
        full_name:    params.full_name    || '',
      })
      Toast.show({ type: 'success', text1: 'New code sent!' })
      startCooldown()
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
          <Text style={s.phone}>{params.phone_number}</Text>
        </View>

        <View style={s.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={el => inputs.current[i] = el}
              style={[s.otpBox, d ? s.otpBoxFilled : null]}
              value={d}
              onChangeText={v => handleDigit(i, v)}
              onKeyPress={e => handleKey(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Verify</Text>}
        </TouchableOpacity>

        <View style={s.resendWrap}>
          {resending ? (
            <Spinner size="sm" color="#4F46E5" />
          ) : cooldown > 0 ? (
            <Text style={s.cooldownText}>Resend code in {cooldown}s</Text>
          ) : (
            <TouchableOpacity onPress={resend}>
              <Text style={s.resendText}>Didn't receive a code? <Text style={s.resendLink}>Resend</Text></Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  iconWrap:     { alignItems: 'center', marginBottom: 40 },
  iconBox:      { width: 64, height: 64, backgroundColor: '#22C55E', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:        { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:          { fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  phone:        { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 4 },
  otpRow:       { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  otpBox:       { width: 48, height: 56, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 14, fontSize: 22, fontWeight: '700', color: '#111827', backgroundColor: '#fff' },
  otpBoxFilled: { borderColor: '#4F46E5' },
  btn:          { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnDisabled:  { opacity: 0.7 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendWrap:   { alignItems: 'center', marginTop: 24, minHeight: 24 },
  cooldownText: { fontSize: 14, color: '#9CA3AF' },
  resendText:   { fontSize: 14, color: '#6B7280' },
  resendLink:   { color: '#4F46E5', fontWeight: '700' },
})
