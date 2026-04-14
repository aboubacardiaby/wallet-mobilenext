import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ArrowLeft } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

export default function RequestMoneyScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [fromPhone, setFromPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!fromPhone) return Toast.show({ type: 'error', text1: 'Enter phone number' })
    if (!amount) return Toast.show({ type: 'error', text1: 'Enter an amount' })
    setLoading(true)
    try {
      await api.post('/transfer/request', {
        from_phone: fromPhone, amount: parseFloat(amount), description,
      })
      Toast.show({ type: 'success', text1: 'Request sent!' })
      navigation.navigate('Main')
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Request failed' })
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.title}>Request Money</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.content}>
          <Text style={s.label}>Request From</Text>
          <TextInput style={s.input} placeholder="+221 77 000 00 00" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={fromPhone} onChangeText={setFromPhone} />

          <Text style={[s.label, { marginTop: 16 }]}>Amount (XOF)</Text>
          <TextInput style={s.input} placeholder="10 000" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

          <Text style={[s.label, { marginTop: 16 }]}>Reason (optional)</Text>
          <TextInput style={s.input} placeholder="Rent, groceries…" placeholderTextColor="#9CA3AF" value={description} onChangeText={setDescription} />

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Request Money</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn:   { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 18, fontWeight: '700', color: '#111827' },
  content:   { paddingHorizontal: 20, paddingBottom: 40 },
  label:     { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:     { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  btn:       { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnDisabled:{ opacity: 0.7 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
})
