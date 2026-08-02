import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ArrowUpRight, ArrowDownLeft, Banknote, ArrowDownToLine, ChevronRight } from 'lucide-react-native'

const TYPE_CONFIG = {
  send:     { icon: ArrowUpRight,    color: '#EF4444', bg: '#FEF2F2', sign: '-', label: 'Sent' },
  receive:  { icon: ArrowDownLeft,   color: '#22C55E', bg: '#F0FDF4', sign: '+', label: 'Received' },
  cash_in:  { icon: ArrowDownToLine, color: '#3B82F6', bg: '#EFF6FF', sign: '+', label: 'Cash In' },
  cash_out: { icon: Banknote,        color: '#F97316', bg: '#FFF7ED', sign: '-', label: 'Cash Out' },
}

const STATUS_CONFIG = {
  completed: { bg: '#F0FDF4', color: '#16A34A' },
  pending:   { bg: '#FEFCE8', color: '#CA8A04' },
  processing:{ bg: '#FEFCE8', color: '#CA8A04' },
  failed:    { bg: '#FEF2F2', color: '#EF4444' },
  rejected:  { bg: '#FEF2F2', color: '#EF4444' },
}

export default function TransactionItem({ tx, userId, onPress }) {
  const isDebit = tx.from_user_id === userId || tx.type === 'send' || tx.type === 'cash_out'
  const cfg = TYPE_CONFIG[tx.type] ?? TYPE_CONFIG.receive
  const Icon = cfg.icon
  const sign = isDebit ? '-' : '+'
  const amountColor = isDebit ? '#DC2626' : '#16A34A'
  const counterparty = isDebit ? tx.to_phone : tx.from_phone
  const date = new Date(tx.created_at).toLocaleDateString('en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const statusCfg = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
        <Icon size={18} color={cfg.color} />
      </View>
      <View style={s.info}>
        <Text style={s.label}>{cfg.label}</Text>
        <Text style={s.sub} numberOfLines={1}>{counterparty || date}</Text>
      </View>
      <View style={s.right}>
        <Text style={[s.amount, { color: amountColor }]}>
          {sign}{Number(tx.amount).toLocaleString()}{' '}
          <Text style={s.currency}>{tx.currency}</Text>
        </Text>
        <View style={[s.badge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[s.badgeText, { color: statusCfg.color }]}>
            {tx.status}
          </Text>
        </View>
      </View>
      {onPress && <ChevronRight size={14} color="#D1D5DB" style={{ marginLeft: 4 }} />}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  iconBox:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:         { flex: 1, minWidth: 0 },
  label:        { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  sub:          { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  right:        { alignItems: 'flex-end' },
  amount:       { fontSize: 14, fontWeight: '700' },
  currency:     { fontSize: 11, fontWeight: '400' },
  badge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginTop: 3 },
  badgeText:    { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
})
