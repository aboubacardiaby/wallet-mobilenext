import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import AsyncStorage from '@react-native-async-storage/async-storage'

const WEAK_PINS = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212', '1010']

function PinField({ value, onChangeText, placeholder, label, show, onToggle }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <View style={[s.input, s.pinWrap]}>
        <TextInput
          style={s.pinInput}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!show}
          keyboardType="number-pad"
          maxLength={4}
          value={value}
          onChangeText={onChangeText}
          textAlign="center"
        />
        <TouchableOpacity style={s.eyeBtn} onPress={onToggle} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          {show
            ? <EyeOff size={20} color="#6B7280" />
            : <Eye    size={20} color="#6B7280" />
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function SetPINScreen() {
  const insets = useSafeAreaInsets()
  const route = useRoute()
  const { token, user } = route.params || {}
  const { saveSession } = useAuth()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [useBiometric, setUseBiometric] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('biometric_enabled').then(v => setUseBiometric(v === '1'))
  }, [])

  const bothFull = pin.length === 4 && confirmPin.length === 4
  const match = bothFull && pin === confirmPin
  const mismatch = bothFull && pin !== confirmPin
  const weak = pin.length === 4 && WEAK_PINS.includes(pin)

  const submit = async () => {
    if (pin.length !== 4) return Toast.show({ type: 'error', text1: 'PIN must be 4 digits' })
    if (WEAK_PINS.includes(pin)) return Toast.show({ type: 'error', text1: 'Choose a less common PIN' })
    if (pin !== confirmPin) return Toast.show({ type: 'error', text1: 'PINs do not match' })
    setLoading(true)
    try {
      await api.post('user/pin', { pin, confirm_pin: confirmPin }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      Toast.show({ type: 'success', text1: 'PIN set successfully!' })
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
          <Text style={s.warning}>Avoid simple patterns like 1234 or 0000. You'll enter this PIN every time you open the app.</Text>
        </View>

        <PinField
          label="PIN"
          placeholder="••••"
          value={pin}
          onChangeText={setPin}
          show={showPin}
          onToggle={() => setShowPin(v => !v)}
        />

        {weak && (
          <View style={[s.badgeRow, { marginTop: 8 }]}>
            <XCircle size={16} color="#EF4444" />
            <Text style={s.badgeTextError}>This PIN is too easy to guess</Text>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <PinField
            label="Confirm PIN"
            placeholder="••••"
            value={confirmPin}
            onChangeText={setConfirmPin}
            show={showConfirm}
            onToggle={() => setShowConfirm(v => !v)}
          />
        </View>

        {match && (
          <View style={[s.badgeRow, { marginTop: 8 }]}>
            <CheckCircle size={16} color="#16A34A" />
            <Text style={s.badgeTextSuccess}>PINs match</Text>
          </View>
        )}

        {mismatch && (
          <View style={[s.badgeRow, { marginTop: 8 }]}>
            <XCircle size={16} color="#EF4444" />
            <Text style={s.badgeTextError}>PINs do not match</Text>
          </View>
        )}

        <View style={s.biometricRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.biometricLabel}>Use Face ID / Fingerprint</Text>
            <Text style={s.biometricSub}>Unlock the app with biometrics next time</Text>
          </View>
          <Switch
            value={useBiometric}
            onValueChange={async (v) => { setUseBiometric(v); await AsyncStorage.setItem('biometric_enabled', v ? '1' : '0') }}
            trackColor={{ true: '#4F46E5' }}
          />
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Set PIN</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:         { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  iconWrap:          { alignItems: 'center', marginBottom: 32 },
  iconBox:           { width: 64, height: 64, backgroundColor: '#4F46E5', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:             { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub:               { fontSize: 14, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  warning:           { fontSize: 13, color: '#9CA3AF', marginTop: 12, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  label:             { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:             { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  pinWrap:           { flexDirection: 'row', alignItems: 'center', paddingRight: 44, paddingVertical: 0 },
  pinInput:          { flex: 1, textAlign: 'center', fontSize: 24, letterSpacing: 12, color: '#111827', paddingVertical: 10 },
  eyeBtn:            { position: 'absolute', right: 12, padding: 4 },
  badgeRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeTextSuccess:  { fontSize: 13, fontWeight: '600', color: '#16A34A' },
  badgeTextError:    { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  biometricRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 20 },
  biometricLabel:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  biometricSub:      { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  btn:               { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnDisabled:       { opacity: 0.7 },
  btnText:           { color: '#fff', fontSize: 16, fontWeight: '700' },
})
