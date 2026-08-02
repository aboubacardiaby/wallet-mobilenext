import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

export default function EmptyState({ icon: Icon, title, sub, cta, onCta }) {
  return (
    <View style={s.wrap}>
      {Icon && (
        <View style={s.iconWrap}>
          <Icon size={32} color="#9CA3AF" />
        </View>
      )}
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>{sub}</Text>
      {cta && onCta && (
        <TouchableOpacity style={s.cta} onPress={onCta} activeOpacity={0.85}>
          <Text style={s.ctaText}>{cta}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap:     { alignItems: 'center', padding: 32 },
  iconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  sub:      { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
  cta:      { marginTop: 18, backgroundColor: '#0E9E98', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 },
  ctaText:  { color: '#fff', fontSize: 14, fontWeight: '700' },
})
