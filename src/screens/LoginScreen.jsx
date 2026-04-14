import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { Wallet } from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function LoginScreen() {
  const navigation = useNavigation()
  const { saveSession } = useAuth()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!phone || !pin) return Toast.show({ type: 'error', text1: 'Fill in all fields' })
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { phone_number: phone, pin })
      await saveSession(data.token, data.user)
      Toast.show({ type: 'success', text1: 'Welcome back!' })
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Login failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoBox}>
            <Wallet size={32} color="#fff" />
          </View>
          <Text style={s.title}>Kalipeh Wallet</Text>
          <Text style={s.sub}>Sign in to your account</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>Phone Number</Text>
          <TextInput
            style={s.input}
            placeholder="+221 700 000 000"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={[s.label, { marginTop: 16 }]}>PIN</Text>
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

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={s.linkText}>Don't have an account? <Text style={s.link}>Register</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48, backgroundColor: '#F9FAFB' },
  logoWrap:    { alignItems: 'center', marginBottom: 40 },
  logoBox:     { width: 64, height: 64, backgroundColor: '#4F46E5', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  title:       { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:         { fontSize: 14, color: '#6B7280', marginTop: 4 },
  form:        { marginBottom: 24 },
  label:       { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:       { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  pinInput:    { textAlign: 'center', fontSize: 22, letterSpacing: 8 },
  btn:         { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24, shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnDisabled: { opacity: 0.7 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkText:    { textAlign: 'center', fontSize: 14, color: '#6B7280' },
  link:        { color: '#4F46E5', fontWeight: '700' },
})
