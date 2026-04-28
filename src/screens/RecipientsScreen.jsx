import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { ArrowLeft, Search, UserPlus, ChevronRight, Pencil, Wallet, Smartphone, Building2 } from 'lucide-react-native'
import api from '../api/client'

const TEAL       = '#0E9E98'
const TEAL_LIGHT = '#E6F7F7'
const NAVY       = '#0A1628'

const DELIVERY_OPTIONS = [
  {
    id:    'wallet',
    label: 'Wallet Transfer',
    sub:   'Direct to mobile wallet',
    icon:  (color) => <Wallet size={22} color={color} />,
    color: TEAL,
    bg:    TEAL_LIGHT,
  },
  {
    id:    'wave',
    label: 'Wave Mobile Money',
    sub:   'Local currency wallet',
    icon:  (color) => <Smartphone size={22} color={color} />,
    color: '#1BAEC2',
    bg:    '#E6F7FA',
  },
  {
    id:    'cash',
    label: 'Cash Pickup',
    sub:   'Agent collection point',
    icon:  (color) => <Building2 size={22} color={color} />,
    color: '#F59E0B',
    bg:    '#FEF9C3',
  },
]

const DIAL_MAP = [
  { dial: '+221', flag: '🇸🇳', currency: 'XOF', name: 'Senegal' },
  { dial: '+225', flag: '🇨🇮', currency: 'XOF', name: "Côte d'Ivoire" },
  { dial: '+223', flag: '🇲🇱', currency: 'XOF', name: 'Mali' },
  { dial: '+226', flag: '🇧🇫', currency: 'XOF', name: 'Burkina Faso' },
  { dial: '+227', flag: '🇳🇪', currency: 'XOF', name: 'Niger' },
  { dial: '+228', flag: '🇹🇬', currency: 'XOF', name: 'Togo' },
  { dial: '+229', flag: '🇧🇯', currency: 'XOF', name: 'Benin' },
  { dial: '+224', flag: '🇬🇳', currency: 'GNF', name: 'Guinea' },
  { dial: '+237', flag: '🇨🇲', currency: 'XAF', name: 'Cameroon' },
  { dial: '+234', flag: '🇳🇬', currency: 'NGN', name: 'Nigeria' },
  { dial: '+233', flag: '🇬🇭', currency: 'GHS', name: 'Ghana' },
  { dial: '+254', flag: '🇰🇪', currency: 'KES', name: 'Kenya' },
  { dial: '+212', flag: '🇲🇦', currency: 'MAD', name: 'Morocco' },
  { dial: '+27',  flag: '🇿🇦', currency: 'ZAR', name: 'South Africa' },
  { dial: '+20',  flag: '🇪🇬', currency: 'EGP', name: 'Egypt' },
  { dial: '+251', flag: '🇪🇹', currency: 'ETB', name: 'Ethiopia' },
  { dial: '+220', flag: '🇬🇲', currency: 'GMD', name: 'Gambia' },
].sort((a, b) => b.dial.length - a.dial.length)

function detectCountry(phone) {
  const n = (phone || '').replace(/[\s\-()]/g, '')
  return DIAL_MAP.find(c => n.startsWith(c.dial)) || { flag: '🌍', currency: '', name: '' }
}

function deliveryLabel(type) {
  if (type === 'wave_transfer') return 'Wave Mobile Money'
  if (type === 'cash_pickup')   return 'Cash Pickup'
  return 'Wallet Transfer'
}

function extractRecipients(transactions) {
  const seen = new Map()
  for (const tx of transactions) {
    const phone = tx.to_phone
    if (!phone) continue
    if (tx.type === 'top_up' || tx.type === 'receive') continue
    if (!seen.has(phone)) {
      const d = tx.extra_data || {}
      seen.set(phone, {
        phone,
        name:     d.recipient_name || tx.to_phone,
        currency: d.recv_currency  || '',
        type:     tx.type,
      })
    }
  }
  return Array.from(seen.values())
}

export default function RecipientsScreen() {
  const navigation = useNavigation()
  const insets     = useSafeAreaInsets()

  const [query, setQuery]               = useState('')
  const [recipients, setRecipients]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [pickedRecipient, setPickedRecipient] = useState(null)

  useEffect(() => {
    api.get('/wallet/transactions?page=1&limit=100')
      .then(({ data }) => setRecipients(extractRecipients(data.transactions || [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipients
    return recipients.filter(r =>
      r.name.toLowerCase().includes(q) || r.phone.includes(q)
    )
  }, [query, recipients])

  const confirmDelivery = (deliveryId) => {
    const r = pickedRecipient
    setPickedRecipient(null)
    const country = detectCountry(r.phone)
    navigation.navigate('SendMoney', {
      to_phone:     r.phone,
      country_name: country.name,
      delivery:     deliveryId,
    })
  }

  const renderRecipient = ({ item: r }) => {
    const country = detectCountry(r.phone)
    const flag    = country.flag
    const ccy     = r.currency || country.currency
    const label   = deliveryLabel(r.type)
    const hasName = r.name && r.name !== r.phone

    return (
      <TouchableOpacity style={s.row} onPress={() => setPickedRecipient(r)} activeOpacity={0.75}>
        <Text style={s.flag}>{flag}</Text>
        <View style={s.rowBody}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>
              {hasName ? r.name : r.phone}
            </Text>
            {ccy ? <View style={s.ccyBadge}><Text style={s.ccyText}>{ccy}</Text></View> : null}
          </View>
          {hasName && (
            <Text style={s.phone} numberOfLines={1}>{r.phone}</Text>
          )}
          <Text style={s.sub}>{label}</Text>
        </View>
        <Pencil size={16} color="#D1D5DB" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    )
  }

  // ── Delivery picker for the chosen recipient ──────────────────────────────
  const pc = pickedRecipient
  const pcCountry = pc ? detectCountry(pc.phone) : null
  const pcHasName = pc && pc.name && pc.name !== pc.phone

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Recipients</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        <Search size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Enter name to search"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Add new recipient ── */}
      <TouchableOpacity
        style={s.addRow}
        onPress={() => navigation.navigate('AddRecipient', {})}
        activeOpacity={0.8}
      >
        <View style={s.addIcon}>
          <UserPlus size={20} color={TEAL} />
        </View>
        <Text style={s.addText}>Add a new recipient</Text>
        <ChevronRight size={18} color={TEAL} />
      </TouchableOpacity>

      {/* ── Recipient list ── */}
      {loading ? (
        <ActivityIndicator color={TEAL} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.phone}
          renderItem={renderRecipient}
          ListHeaderComponent={
            filtered.length > 0
              ? <Text style={s.sectionLabel}>YOUR RECIPIENTS</Text>
              : null
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyTitle}>No recipients yet</Text>
              <Text style={s.emptySub}>
                {query
                  ? 'No match found. Try a different name or number.'
                  : 'Recipients from your past transfers will appear here.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Delivery method picker modal ── */}
      <Modal
        visible={!!pickedRecipient}
        animationType="slide"
        transparent
        onRequestClose={() => setPickedRecipient(null)}
      >
        <View style={m.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPickedRecipient(null)} />
          <View style={[m.sheet, { paddingBottom: insets.bottom + 20 }]}>

            {/* Handle */}
            <View style={m.handle} />

            {/* Recipient summary */}
            {pc && (
              <View style={m.recipientBanner}>
                <Text style={m.bannerFlag}>{pcCountry?.flag || '🌍'}</Text>
                <View>
                  <Text style={m.bannerName}>{pcHasName ? pc.name : pc.phone}</Text>
                  {pcHasName && <Text style={m.bannerPhone}>{pc.phone}</Text>}
                </View>
              </View>
            )}

            <Text style={m.question}>How should they receive the money?</Text>

            {DELIVERY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={m.optionRow}
                onPress={() => confirmDelivery(opt.id)}
                activeOpacity={0.8}
              >
                <View style={[m.optionIcon, { backgroundColor: opt.bg }]}>
                  {opt.icon(opt.color)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.optionLabel}>{opt.label}</Text>
                  <Text style={m.optionSub}>{opt.sub}</Text>
                </View>
                <ChevronRight size={18} color="#D1D5DB" />
              </TouchableOpacity>
            ))}

          </View>
        </View>
      </Modal>

    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: NAVY },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#F3F4F6', borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111' },

  addRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  addIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  addText: { flex: 1, fontSize: 16, fontWeight: '700', color: TEAL },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#9CA3AF',
    letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  flag:    { fontSize: 30, marginRight: 14, lineHeight: 36 },
  rowBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name:    { fontSize: 16, fontWeight: '700', color: '#111827', flexShrink: 1 },
  ccyBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  ccyText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  phone:   { fontSize: 13, color: '#374151', marginBottom: 2 },
  sub:     { fontSize: 13, color: '#6B7280' },

  emptyWrap:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon:  { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
})

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 20,
  },

  recipientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F9FAFB', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
  },
  bannerFlag:  { fontSize: 32 },
  bannerName:  { fontSize: 16, fontWeight: '800', color: '#111' },
  bannerPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  question: {
    fontSize: 13, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14,
  },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16, paddingHorizontal: 16,
    backgroundColor: '#F9FAFB', borderRadius: 16, marginBottom: 10,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  optionLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  optionSub:   { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
})
