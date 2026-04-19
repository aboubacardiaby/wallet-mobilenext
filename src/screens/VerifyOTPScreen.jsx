import { useState, useRef, useEffect } from 'react'
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

export default function VerifyOTPScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const route = useRoute()
  const params = route.params || {}
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const inputs = useRef([])

  useEffect(() => {
    if (!params.phone_number) navigation.navigate('Register')
    if (params.otp) {
      const otp = String(params.otp).split('').slice(0, 6)
      setDigits([...otp, ...Array(6 - otp.length).fill('')])
    }
    setTimeout(() => inputs.current[0]?.focus(), 300)
  }, [])

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKey = (i, e) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const submit = async () => {
    const code = digits.join('')
    if (code.length < 6) return Toast.show({ type: 'error', text1: 'Enter the 6-digit code' })
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-otp', {
        phone_number: params.phone_number,
        code,
        user_type:     params.user_type     || 'receiver',
        home_currency: params.home_currency || 'XOF',
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
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  iconWrap:    { alignItems: 'center', marginBottom: 40 },
  iconBox:     { width: 64, height: 64, backgroundColor: '#22C55E', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:       { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:         { fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  phone:       { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 4 },
  otpRow:      { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  otpBox:      { width: 48, height: 56, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 14, fontSize: 22, fontWeight: '700', color: '#111827', backgroundColor: '#fff' },
  otpBoxFilled:{ borderColor: '#4F46E5' },
  btn:         { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
})
