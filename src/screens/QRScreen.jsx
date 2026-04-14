import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import QRCode from 'react-native-qrcode-svg'
import { ArrowLeft } from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function QRScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [tab, setTab] = useState('receive')
  const [amount, setAmount] = useState('')
  const [qrPayload, setQrPayload] = useState(null)
  const [scanData, setScanData] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/qr/generate', { amount: parseFloat(amount) || 0 })
      setQrPayload(data.payload)
    } catch { Toast.show({ type: 'error', text1: 'Failed to generate QR' }) }
    finally { setLoading(false) }
  }

  const scan = async () => {
    if (!scanData.trim()) return Toast.show({ type: 'error', text1: 'Paste QR data first' })
    setLoading(true)
    try {
      const { data } = await api.post('/qr/scan', { qr_data: scanData })
      setScanResult(data)
    } catch { Toast.show({ type: 'error', text1: 'Invalid QR data' }) }
    finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={s.title}>QR Code</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.content}>
          {/* Tabs */}
          <View style={s.tabs}>
            {['receive', 'pay'].map(t => (
              <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                  {t === 'receive' ? 'My QR' : 'Scan & Pay'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'receive' && (
            <View style={s.card}>
              <Text style={s.cardSub}>Share this code to receive money</Text>

              {qrPayload ? (
                <View style={{ alignItems: 'center', gap: 16 }}>
                  <View style={s.qrBox}>
                    <QRCode value={JSON.stringify(qrPayload)} size={200} />
                  </View>
                  <Text style={s.phoneText}>{user?.phone_number}</Text>
                  {amount ? <Text style={s.amountText}>{Number(amount).toLocaleString()} XOF</Text> : null}
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: 16 }}>
                  <View style={s.qrPlaceholder}>
                    <Text style={s.qrPlaceholderText}>QR will appear here</Text>
                  </View>
                  <TextInput
                    style={s.input}
                    placeholder="Amount (optional)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
              )}

              <TouchableOpacity style={s.btn} onPress={generate} disabled={loading}>
                {loading
                  ? <Spinner size="sm" color="#fff" />
                  : <Text style={s.btnText}>{qrPayload ? 'Regenerate' : 'Generate QR'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {tab === 'pay' && (
            <View style={s.card}>
              <Text style={s.cardSub}>Paste QR payload from another user</Text>
              <TextInput
                style={[s.input, { height: 100, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 }]}
                multiline
                placeholder='{"phone_number": "+221...", "amount": 0}'
                placeholderTextColor="#9CA3AF"
                value={scanData}
                onChangeText={setScanData}
              />
              <TouchableOpacity style={s.btn} onPress={scan} disabled={loading}>
                {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Parse QR</Text>}
              </TouchableOpacity>

              {scanResult && (
                <View style={s.scanResult}>
                  <Text style={s.scanResultName}>{scanResult.recipient?.full_name || 'Unknown'}</Text>
                  <Text style={s.scanResultPhone}>{scanResult.recipient?.phone_number}</Text>
                  {scanResult.amount > 0 && (
                    <Text style={s.scanResultAmount}>{Number(scanResult.amount).toLocaleString()} XOF</Text>
                  )}
                </View>
              )}
            </View>
          )}
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
  tabs:      { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 20 },
  tab:       { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText:   { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive:{ color: '#4F46E5' },
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardSub:   { fontSize: 13, color: '#6B7280' },
  qrBox:     { padding: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  qrPlaceholder:{ width: 200, height: 200, backgroundColor: '#F9FAFB', borderRadius: 20, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  qrPlaceholderText:{ fontSize: 13, color: '#D1D5DB' },
  phoneText: { fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' },
  amountText:{ fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  input:     { width: '100%', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  btn:       { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, alignItems: 'center', width: '100%' },
  btnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  scanResult:{ width: '100%', backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, gap: 4 },
  scanResultName: { fontSize: 15, fontWeight: '700', color: '#3730A3' },
  scanResultPhone:{ fontSize: 13, color: '#4F46E5' },
  scanResultAmount:{ fontSize: 18, fontWeight: '700', color: '#1E1B4B' },
})
