import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Alert, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import {
  ArrowLeft, Smartphone, Laptop, Monitor, Tablet,
  Trash2, ShieldCheck, ShieldOff, Wifi, WifiOff, Globe,
} from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'device_manager_list'

function detectCurrentDevice() {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Unknown'
  const type = Platform.OS === 'ios' || Platform.OS === 'android' ? 'mobile' : 'desktop'
  return {
    id: 'current',
    name: Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android Device' : 'This Device',
    os, browser: 'App', type, trusted: true, current: true,
    lastSeen: new Date().toISOString(),
  }
}

const MOCK_DEVICES = [
  { id: 'd1', name: 'MacBook Pro',        os: 'macOS 14',    browser: 'Chrome', type: 'desktop', trusted: true,  current: false, lastSeen: new Date(Date.now() - 2 * 3600000).toISOString(), ip: '192.168.1.5', location: 'New York, US' },
  { id: 'd2', name: 'Samsung Galaxy S23', os: 'Android 14',  browser: 'Chrome', type: 'mobile',  trusted: false, current: false, lastSeen: new Date(Date.now() - 2 * 86400000).toISOString(), ip: '10.0.0.5', location: 'Paris, FR' },
  { id: 'd3', name: 'iPad Pro',           os: 'iPadOS 17',   browser: 'Safari', type: 'tablet',  trusted: false, current: false, lastSeen: new Date(Date.now() - 7 * 86400000).toISOString(), ip: '172.16.0.3', location: 'London, UK' },
]

function formatLastSeen(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function isRecent(iso) {
  return Date.now() - new Date(iso).getTime() < 15 * 60000
}

export default function DeviceManagerScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const currentDevice = detectCurrentDevice()
  const [devices, setDevices] = useState([currentDevice, ...MOCK_DEVICES])

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved) {
        const parsed = JSON.parse(saved)
        setDevices([currentDevice, ...parsed.filter(d => d.id !== 'current')])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const others = devices.filter(d => d.id !== 'current')
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(others)).catch(() => {})
  }, [devices])

  const remove = (id) => {
    Alert.alert('Remove Device', 'Remove this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setDevices(prev => prev.filter(d => d.id !== id))
        Toast.show({ type: 'success', text1: 'Device removed' })
      }},
    ])
  }

  const toggleTrust = (id) => {
    setDevices(prev => prev.map(d => {
      if (d.id !== id) return d
      const next = { ...d, trusted: !d.trusted }
      Toast.show({ type: 'success', text1: next.trusted ? 'Device trusted' : 'Device untrusted' })
      return next
    }))
  }

  const trusted   = devices.filter(d => d.trusted)
  const untrusted = devices.filter(d => !d.trusted)

  const DeviceIcon = ({ type, color }) => {
    const props = { size: 22, color }
    if (type === 'mobile') return <Smartphone {...props} />
    if (type === 'tablet') return <Tablet {...props} />
    if (type === 'desktop') return <Laptop {...props} />
    return <Monitor {...props} />
  }

  const renderDevice = ({ item: d }) => {
    const active = isRecent(d.lastSeen)
    return (
      <View style={[s.card, d.current && s.cardCurrent]}>
        <View style={s.cardHeader}>
          <View style={[s.iconBox, { backgroundColor: d.current ? '#EEF2FF' : '#F3F4F6' }]}>
            <DeviceIcon type={d.type} color={d.current ? '#4F46E5' : '#6B7280'} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.nameTags}>
              <Text style={s.deviceName}>{d.name}</Text>
              {d.current && <View style={s.thisBadge}><Text style={s.thisBadgeText}>This device</Text></View>}
              {d.trusted && <View style={s.trustedBadge}><ShieldCheck size={9} color="#16A34A" /><Text style={s.trustedBadgeText}>Trusted</Text></View>}
            </View>
            <Text style={s.deviceMeta}>{d.os} · {d.browser}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={s.statusRow}>
              {active ? <Wifi size={10} color="#16A34A" /> : <WifiOff size={10} color="#9CA3AF" />}
              <Text style={[s.statusText, { color: active ? '#16A34A' : '#9CA3AF' }]}>{active ? 'Active' : formatLastSeen(d.lastSeen)}</Text>
            </View>
          </View>
        </View>

        {(d.ip || d.location) && (
          <View style={s.metaRow}>
            {d.ip && <View style={s.metaItem}><Globe size={11} color="#9CA3AF" /><Text style={s.metaText}>{d.ip}</Text></View>}
            {d.location && <Text style={s.metaText}>{d.location}</Text>}
          </View>
        )}

        {!d.current && (
          <View style={s.actionsRow}>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: d.trusted ? '#FEF2F2' : '#F0FDF4' }]} onPress={() => toggleTrust(d.id)}>
              {d.trusted ? <ShieldOff size={12} color="#DC2626" /> : <ShieldCheck size={12} color="#16A34A" />}
              <Text style={[s.actionText, { color: d.trusted ? '#DC2626' : '#16A34A' }]}>{d.trusted ? 'Untrust' : 'Trust'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#F3F4F6' }]} onPress={() => remove(d.id)}>
              <Trash2 size={12} color="#6B7280" />
              <Text style={[s.actionText, { color: '#6B7280' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={s.title}>Device Manager</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={[...trusted, ...untrusted]}
        keyExtractor={d => d.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={() => (
          <View style={s.statsRow}>
            <StatCard label="Total"     value={devices.length}    color="#4F46E5" bg="#EEF2FF" />
            <StatCard label="Trusted"   value={trusted.length}    color="#16A34A" bg="#F0FDF4" />
            <StatCard label="Untrusted" value={untrusted.length}  color="#EA580C" bg="#FFF7ED" />
          </View>
        )}
        renderItem={renderDevice}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListFooterComponent={() => devices.filter(d => !d.current).length > 0 ? (
          <TouchableOpacity style={s.removeAllBtn} onPress={() => {
            setDevices(prev => prev.filter(d => d.current))
            Toast.show({ type: 'success', text1: 'All other devices removed' })
          }}>
            <Trash2 size={15} color="#EF4444" />
            <Text style={s.removeAllText}>Remove all other devices</Text>
          </TouchableOpacity>
        ) : null}
      />
    </View>
  )
}

function StatCard({ label, value, color, bg }) {
  return (
    <View style={[s.statCard, { backgroundColor: bg }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F9FAFB' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontWeight: '700', color: '#111827' },
  list:        { padding: 20, gap: 0 },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:    { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statValue:   { fontSize: 24, fontWeight: '700' },
  statLabel:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  cardCurrent: { borderWidth: 2, borderColor: '#C7D2FE' },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBox:     { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nameTags:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  deviceName:  { fontSize: 14, fontWeight: '700', color: '#111827' },
  thisBadge:   { backgroundColor: '#4F46E5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  thisBadgeText:{ fontSize: 10, fontWeight: '700', color: '#fff' },
  trustedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  trustedBadgeText:{ fontSize: 10, fontWeight: '700', color: '#16A34A' },
  deviceMeta:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusText:  { fontSize: 10, fontWeight: '500' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, paddingLeft: 54 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 11, color: '#9CA3AF' },
  actionsRow:  { flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 54 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText:  { fontSize: 12, fontWeight: '600' },
  removeAllBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FEE2E2' },
  removeAllText:{ fontSize: 14, fontWeight: '700', color: '#EF4444' },
})
