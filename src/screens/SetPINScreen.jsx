import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { Lock } from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function SetPINScreen() {
  const insets = useSafeAreaInsets()
  const route = useRoute()
  const { token, user } = route.params || {}
  const { saveSession } = useAuth()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (pin.length !== 4) return Toast.show({ type: 'error', text1: 'PIN must be 4 digits' })
    if (pin !== confirmPin) return Toast.show({ type: 'error', text1: 'PINs do not match' })
    setLoading(true)
    try {
      await api.post('/user/pin', { pin, confirm_pin: confirmPin }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      Toast.show({ type: 'success', text1: 'PIN set successfully!' })
      // saveSession flips isAuthenticated → navigator switches to authenticated stack
      await saveSession(token, user)
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed to set PIN' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.iconWrap}>
          <View style={s.iconBox}>
            <Lock size={32} color="#fff" />
          </View>
          <Text style={s.title}>Set Your PIN</Text>
          <Text style={s.sub}>Choose a 4-digit PIN to secure your wallet</Text>
        </View>

        <Text style={s.label}>PIN</Text>
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

        <Text style={[s.label, { marginTop: 16 }]}>Confirm PIN</Text>
        <TextInput
          style={[s.input, s.pinInput]}
          placeholder="••••"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
          value={confirmPin}
          onChangeText={setConfirmPin}
        />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Set PIN</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  iconWrap:    { alignItems: 'center', marginBottom: 40 },
  iconBox:     { width: 64, height: 64, backgroundColor: '#4F46E5', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:       { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:         { fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  label:       { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:       { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  pinInput:    { textAlign: 'center', fontSize: 24, letterSpacing: 12 },
  btn:         { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnDisabled: { opacity: 0.7 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
})
