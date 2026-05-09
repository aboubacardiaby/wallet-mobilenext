import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { Wallet } from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function LoginScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { saveSession } = useAuth()
  const [dialCode, setDialCode] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!phone || !pin) return Toast.show({ type: 'error', text1: 'Fill in all fields' })
    if (!dialCode.startsWith('+')) return Toast.show({ type: 'error', text1: 'Enter a valid dial code (e.g. +221)' })
    setLoading(true)
    const fullPhone = (dialCode + phone).replace(/\s/g, '')
    try {
      const { data } = await api.post('/auth/login', { phone_number: fullPhone, pin: String(pin) })
      await saveSession(data.token, data.user)
      Toast.show({ type: 'success', text1: 'Welcome back!' })
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Login failed' })
    } finally {
      setLoading(false)
    }
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
              style={[s.input, s.dialInput]}
              value={dialCode}
              onChangeText={v => setDialCode(v.startsWith('+') ? v : '+' + v.replace(/\D/g, ''))}
              keyboardType="phone-pad"
              maxLength={5}
              placeholder="+221"
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={[s.input, s.phoneInput]}
              placeholder="700 000 000"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCorrect={false}
            />
          </View>

          <Text style={[s.label, { marginTop: 18 }]}>PIN</Text>
          <TextInput
            style={[s.input, s.pinInput]}
            placeholder="••••"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            keyboardType="number-pad"
            maxLength={4}
            value={pin}
            onChangeText={setPin}
          />

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
  phoneRow:    { flexDirection: 'row', gap: 8 },
  dialInput:   { width: 72, textAlign: 'center' },
  phoneInput:  { flex: 1 },
  pinInput:    { textAlign: 'center', fontSize: 24, letterSpacing: 10 },
  btn:         { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnDisabled: { opacity: 0.7 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkWrap:    { alignItems: 'center' },
  linkText:    { fontSize: 14, color: '#6B7280' },
  link:        { color: '#4F46E5', fontWeight: '700' },
})
