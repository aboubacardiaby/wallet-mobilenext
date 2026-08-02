import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { AlertCircle, RefreshCw } from 'lucide-react-native'

export default function ErrorState({ title, sub, onRetry }) {
  return (
    <View style={s.wrap}>
      <View style={s.iconWrap}>
        <AlertCircle size={32} color="#DC2626" />
      </View>
      <Text style={s.title}>{title || 'Something went wrong'}</Text>
      <Text style={s.sub}>{sub || 'Could not load the data. Try again.'}</Text>
      {onRetry && (
        <TouchableOpacity style={s.btn} onPress={onRetry} activeOpacity={0.85}>
          <RefreshCw size={16} color="#fff" />
          <Text style={s.btnText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap:     { alignItems: 'center', padding: 32 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  sub:      { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 6, marginBottom: 16 },
  btn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DC2626', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 },
  btnText:  { color: '#fff', fontSize: 14, fontWeight: '700' },
})
