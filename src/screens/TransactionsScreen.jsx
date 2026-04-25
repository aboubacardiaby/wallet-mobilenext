import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ArrowUpRight, ArrowDownLeft, Banknote, ArrowDownToLine, RefreshCw, Edit3, X } from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import TransactionItem from '../components/TransactionItem'

const TYPE_CONFIG = {
  send:     { icon: ArrowUpRight,    color: '#EF4444', bg: '#FEF2F2', label: 'Sent' },
  receive:  { icon: ArrowDownLeft,   color: '#22C55E', bg: '#F0FDF4', label: 'Received' },
  cash_in:  { icon: ArrowDownToLine, color: '#3B82F6', bg: '#EFF6FF', label: 'Cash In' },
  cash_out: { icon: Banknote,        color: '#F97316', bg: '#FFF7ED', label: 'Cash Out' },
}

function DetailRow({ label, value, valueStyle }) {
  if (value == null || value === '') return null
  return (
    <View style={d.row}>
      <Text style={d.label}>{label}</Text>
      <Text style={[d.value, valueStyle]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { user } = useAuth()
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedTx, setSelectedTx] = useState(null)

  const load = async (p = 1, replace = true) => {
    if (p === 1) setLoading(true); else setLoadingMore(true)
    try {
      const { data } = await api.get(`/wallet/transactions?page=${p}&limit=20`)
      setTxs(prev => replace ? data.transactions : [...prev, ...data.transactions])
      setHasMore(data.transactions.length === 20)
    } catch { Toast.show({ type: 'error', text1: 'Failed to load transactions' }) }
    finally { setLoading(false); setLoadingMore(false) }
  }

  useEffect(() => { load(1) }, [])

  const loadMore = () => {
    if (!hasMore || loadingMore) return
    const next = page + 1
    setPage(next)
    load(next, false)
  }

  const goToSend = (tx, autoConfirm = false) => {
    setSelectedTx(null)
    const amount = String(tx.send_amount ?? tx.amount ?? '')
    navigation.navigate('SendMoney', {
      to_phone: tx.to_phone,
      amount,
      ...(autoConfirm && { autoConfirm: Date.now() }), // unique value forces param change
    })
  }

  // ── Detail sheet ─────────────────────────────────────────────────────────────
  const tx = selectedTx
  const isSend = tx && (tx.type === 'send' || tx.type === 'cash_out')
  const cfg = tx ? (TYPE_CONFIG[tx.type] ?? TYPE_CONFIG.receive) : null
  const date = tx
    ? new Date(tx.created_at).toLocaleDateString('en', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : ''

  const renderItem = ({ item: tx, index }) => (
    <View>
      {index > 0 && <View style={s.divider} />}
      <TransactionItem tx={tx} userId={user?.id} onPress={() => setSelectedTx(tx)} />
    </View>
  )

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <Text style={s.title}>Transactions</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#4F46E5" /></View>
      ) : txs.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>No transactions yet</Text>
          <Text style={s.emptySub}>Your history will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={txs}
          keyExtractor={tx => String(tx.id)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore
            ? <View style={{ paddingVertical: 16, alignItems: 'center' }}><ActivityIndicator color="#4F46E5" /></View>
            : null}
        />
      )}

      {/* ── Transaction detail bottom sheet ── */}
      <Modal
        visible={!!selectedTx}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={d.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSelectedTx(null)} />
          {tx && cfg && (
            <View style={[d.sheet, { paddingBottom: insets.bottom + 24 }]}>

              {/* Header */}
              <View style={d.sheetHeader}>
                <View style={[d.typeIcon, { backgroundColor: cfg.bg }]}>
                  {(() => { const Icon = cfg.icon; return <Icon size={22} color={cfg.color} /> })()}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={d.typeLabel}>{cfg.label}</Text>
                  <Text style={d.dateText}>{date}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedTx(null)} style={d.closeBtn}>
                  <X size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Amount hero */}
                <View style={d.amountHero}>
                  <Text style={[d.heroAmount, { color: isSend ? '#DC2626' : '#16A34A' }]}>
                    {isSend ? '-' : '+'}{Number(tx.send_amount ?? tx.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    {' '}<Text style={d.heroCcy}>{tx.send_currency ?? tx.currency}</Text>
                  </Text>
                  {tx.received_amount != null && tx.recv_currency && tx.recv_currency !== (tx.send_currency ?? tx.currency) && (
                    <Text style={d.heroReceived}>
                      Recipient got {Number(tx.received_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tx.recv_currency}
                    </Text>
                  )}
                </View>

                {/* Details */}
                <View style={d.detailCard}>
                  <DetailRow label="Recipient"  value={tx.recipient_name || tx.to_phone} />
                  <DetailRow label="Phone"      value={tx.to_phone} />
                  <DetailRow label="Fee"        value={tx.fee != null ? `${Number(tx.fee).toFixed(2)} ${tx.send_currency ?? tx.currency}` : null} />
                  <DetailRow label="Rate"       value={tx.exchange_rate != null ? `1 ${tx.send_currency ?? tx.currency} = ${tx.exchange_rate} ${tx.recv_currency}` : null} />
                  <DetailRow
                    label="Status"
                    value={tx.status}
                    valueStyle={{ textTransform: 'capitalize', color: tx.status === 'completed' ? '#16A34A' : '#CA8A04', fontWeight: '700' }}
                  />
                  <DetailRow label="Reference"  value={tx.transaction_ref ? tx.transaction_ref.slice(0, 20) + '…' : null} />
                  <DetailRow label="Description" value={tx.description} />
                </View>
              </ScrollView>

              {/* Action buttons — only for outgoing transfers */}
              {isSend && (
                <View style={d.actions}>
                  <TouchableOpacity
                    style={d.repeatBtn}
                    onPress={() => goToSend(tx, true)}
                    activeOpacity={0.85}
                  >
                    <RefreshCw size={16} color="#5A4500" />
                    <Text style={d.repeatBtnText}>Repeat Transfer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={d.modifyBtn}
                    onPress={() => goToSend(tx, false)}
                    activeOpacity={0.85}
                  >
                    <Edit3 size={16} color="#374151" />
                    <Text style={d.modifyBtnText}>Modify & Send</Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F9FAFB' },
  topBar:     { paddingHorizontal: 20, paddingVertical: 16 },
  title:      { fontSize: 22, fontWeight: '700', color: '#111827' },
  list:       { paddingHorizontal: 20, paddingBottom: 24 },
  divider:    { height: 1, backgroundColor: '#F9FAFB' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#9CA3AF' },
  emptySub:   { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
})

const d = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 20,
    maxHeight: '85%',
  },

  sheetHeader:{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  typeIcon:   { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  typeLabel:  { fontSize: 17, fontWeight: '700', color: '#111' },
  dateText:   { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  amountHero: { alignItems: 'center', paddingVertical: 20 },
  heroAmount: { fontSize: 36, fontWeight: '800' },
  heroCcy:    { fontSize: 20, fontWeight: '600' },
  heroReceived:{ fontSize: 13, color: '#6B7280', marginTop: 6 },

  detailCard: { backgroundColor: '#F9FAFB', borderRadius: 16, paddingHorizontal: 16, marginBottom: 20 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  label:      { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  value:      { fontSize: 14, fontWeight: '600', color: '#111', maxWidth: '60%', textAlign: 'right' },

  actions:    { gap: 10, marginTop: 4 },
  repeatBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F5C842', borderRadius: 28, paddingVertical: 16,
  },
  repeatBtnText: { fontSize: 16, fontWeight: '700', color: '#5A4500' },
  modifyBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 28, paddingVertical: 16,
  },
  modifyBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
})
