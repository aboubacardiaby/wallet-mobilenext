import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { BellOff } from 'lucide-react-native'
import api from '../api/client'

const TYPE_COLOR = {
  transaction: { bg: '#F0FDF4', text: '#16A34A' },
  security:    { bg: '#FEF2F2', text: '#DC2626' },
  promotion:   { bg: '#F5F3FF', text: '#7C3AED' },
  system:      { bg: '#F3F4F6', text: '#6B7280' },
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notifications')
      .then(({ data }) => setItems(data.notifications))
      .catch(() => Toast.show({ type: 'error', text1: 'Failed to load' }))
      .finally(() => setLoading(false))
  }, [])

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch { /* silent */ }
  }

  const renderItem = ({ item: n }) => {
    const tc = TYPE_COLOR[n.type] ?? TYPE_COLOR.system
    const date = new Date(n.created_at).toLocaleString('en', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    return (
      <TouchableOpacity
        style={[s.card, !n.is_read && s.cardUnread]}
        onPress={() => !n.is_read && markRead(n.id)}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <View style={[s.typeBadge, { backgroundColor: tc.bg }]}>
            <Text style={[s.typeText, { color: tc.text }]}>{n.type}</Text>
          </View>
          {!n.is_read && <View style={s.unreadDot} />}
        </View>
        <Text style={s.notifTitle}>{n.title}</Text>
        <Text style={s.notifMsg}>{n.message}</Text>
        <Text style={s.notifDate}>{date}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <Text style={s.title}>Notifications</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#4F46E5" /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <BellOff size={40} color="#D1D5DB" />
          <Text style={s.emptyText}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => String(n.id)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar:    { paddingHorizontal: 20, paddingVertical: 16 },
  title:     { fontSize: 22, fontWeight: '700', color: '#111827' },
  list:      { padding: 20, gap: 10 },
  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardUnread:{ borderLeftWidth: 4, borderLeftColor: '#4F46E5' },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  typeText:  { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4F46E5' },
  notifTitle:{ fontSize: 14, fontWeight: '700', color: '#1F2937' },
  notifMsg:  { fontSize: 13, color: '#6B7280', marginTop: 3 },
  notifDate: { fontSize: 11, color: '#D1D5DB', marginTop: 8 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '500', color: '#9CA3AF' },
})
