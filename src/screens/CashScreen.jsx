import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ArrowLeft, ArrowDownToLine, Banknote } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

export default function CashScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const isCashIn = route.params?.type === 'in'

  const [agentId, setAgentId] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!agentId) return Toast.show({ type: 'error', text1: 'Enter Agent ID' })
    if (!amount) return Toast.show({ type: 'error', text1: 'Enter an amount' })
    setLoading(true)
    try {
      const endpoint = isCashIn ? '/cash/in' : '/cash/out'
      await api.post(endpoint, { agent_id: agentId, amount: parseFloat(amount) })
      Toast.show({ type: 'success', text1: isCashIn ? 'Cash added to wallet!' : 'Cash withdrawn!' })
      navigation.navigate('Main')
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Operation failed' })
    } finally { setLoading(false) }
  }

  const iconColor = isCashIn ? '#16A34A' : '#EA580C'
  const iconBg = isCashIn ? '#F0FDF4' : '#FFF7ED'
  const btnColor = isCashIn ? '#16A34A' : '#EA580C'

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.title}>{isCashIn ? 'Cash In' : 'Cash Out'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.content}>
          <View style={[s.iconBox, { backgroundColor: iconBg }]}>
            {isCashIn
              ? <ArrowDownToLine size={26} color={iconColor} />
              : <Banknote size={26} color={iconColor} />
            }
          </View>

          <Text style={s.label}>Agent ID</Text>
          <TextInput
            style={[s.input, { fontFamily: 'monospace', fontSize: 13 }]}
            placeholder="Agent UUID"
            placeholderTextColor="#9CA3AF"
            value={agentId}
            onChangeText={setAgentId}
            autoCapitalize="none"
          />

          <Text style={[s.label, { marginTop: 16 }]}>Amount (XOF)</Text>
          <TextInput
            style={s.input}
            placeholder="50 000"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />

          <TouchableOpacity style={[s.btn, { backgroundColor: btnColor }, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading
              ? <Spinner size="sm" color="#fff" />
              : <Text style={s.btnText}>{isCashIn ? 'Deposit Cash' : 'Withdraw Cash'}</Text>
            }
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
  iconBox:   { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  label:     { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input:     { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#111827' },
  btn:       { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnDisabled:{ opacity: 0.7 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
})
