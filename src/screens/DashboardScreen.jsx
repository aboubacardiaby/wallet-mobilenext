import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Dimensions,
} from 'react-native'

const { width: SCREEN_W } = Dimensions.get('window')
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import {
  Send, Download, ArrowDownToLine, Banknote,
  Eye, EyeOff, RefreshCw, TrendingUp, QrCode,
} from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import TransactionItem from '../components/TransactionItem'
import Spinner from '../components/Spinner'

const QUICK_ACTIONS = [
  { label: 'Send',     icon: Send,            screen: 'SendMoney',   bg: '#EEF2FF', color: '#4F46E5' },
  { label: 'Request',  icon: Download,        screen: 'RequestMoney',bg: '#F5F3FF', color: '#7C3AED' },
  { label: 'Cash In',  icon: ArrowDownToLine, screen: 'CashIn',      bg: '#F0FDF4', color: '#16A34A' },
  { label: 'Cash Out', icon: Banknote,        screen: 'CashOut',     bg: '#FFF7ED', color: '#EA580C' },
  { label: 'Exchange', icon: TrendingUp,      screen: 'Exchange',    bg: '#F0FDFA', color: '#0D9488' },
  { label: 'QR Code',  icon: QrCode,          screen: 'QR',          bg: '#EFF6FF', color: '#2563EB' },
]

export default function DashboardScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [wallet, setWallet] = useState(null)
  const [txs, setTxs] = useState([])
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [loadingTxs, setLoadingTxs] = useState(true)
  const [hideBalance, setHideBalance] = useState(false)
  const [ticker, setTicker] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchWallet = async () => {
    try {
      const { data } = await api.get('/wallet/balance')
      setWallet(data)
    } catch { Toast.show({ type: 'error', text1: 'Could not load balance' }) }
    finally { setLoadingWallet(false) }
  }

  const fetchTxs = async () => {
    try {
      const { data } = await api.get('/wallet/transactions?limit=5')
      setTxs(data.transactions)
    } catch { /* silent */ }
    finally { setLoadingTxs(false) }
  }

  const fetchTicker = async () => {
    try {
      const { data } = await api.get('/exchange/rates?base=XOF&popular_only=true')
      const picks = ['EUR', 'USD', 'GBP']
      setTicker(picks.map(code => ({ code, rate: data.rates[code] })).filter(x => x.rate))
    } catch { /* silent */ }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchWallet(), fetchTxs(), fetchTicker()])
    setRefreshing(false)
  }

  useEffect(() => { fetchWallet(); fetchTxs(); fetchTicker() }, [])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerGreeting}>Good day,</Text>
            <Text style={s.headerName}>{user?.full_name || user?.phone_number || 'User'}</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={fetchWallet}>
            <RefreshCw size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Balance card */}
        <View style={s.balanceCard}>
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>Available Balance</Text>
            <TouchableOpacity onPress={() => setHideBalance(h => !h)}>
              {hideBalance ? <EyeOff size={14} color="#A5B4FC" /> : <Eye size={14} color="#A5B4FC" />}
            </TouchableOpacity>
          </View>
          {loadingWallet
            ? <View style={{ height: 40, justifyContent: 'center' }}><Spinner /></View>
            : <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <Text style={s.balanceAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {hideBalance ? '••••••' : Number(wallet?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
                <Text style={s.balanceCurrency}>{wallet?.currency ?? 'XOF'}</Text>
              </View>
          }
          {!loadingWallet && user?.user_type === 'sender' && (
            <Text style={s.balanceSub}>Diaspora account · {wallet?.currency}</Text>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={s.section}>
        <View style={s.quickGrid}>
          {QUICK_ACTIONS.map(({ label, icon: Icon, screen, bg, color }) => (
            <TouchableOpacity
              key={label}
              style={s.quickItem}
              onPress={() => navigation.navigate(screen)}
              activeOpacity={0.8}
            >
              <View style={[s.quickIcon, { backgroundColor: bg }]}>
                <Icon size={18} color={color} />
              </View>
              <Text style={s.quickLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Rate Ticker */}
      {ticker && ticker.length > 0 && (
        <View style={s.px}>
          <TouchableOpacity style={s.tickerCard} onPress={() => navigation.navigate('Exchange')} activeOpacity={0.8}>
            <TrendingUp size={16} color="#0D9488" />
            <View style={s.tickerRates}>
              {ticker.map(({ code, rate }) => (
                <View key={code} style={s.tickerItem}>
                  <Text style={s.tickerCode}>{code} </Text>
                  <Text style={s.tickerRate}>{rate < 0.01 ? rate.toFixed(6) : rate.toFixed(4)}</Text>
                </View>
              ))}
            </View>
            <Text style={s.tickerCta}>per XOF →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={[s.section, s.px]}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={s.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={s.card}>
          {loadingTxs
            ? <View style={{ paddingVertical: 24, alignItems: 'center' }}><Spinner /></View>
            : txs.length === 0
              ? <Text style={s.empty}>No transactions yet</Text>
              : txs.map((tx, i) => (
                  <View key={tx.id}>
                    {i > 0 && <View style={s.divider} />}
                    <TransactionItem tx={tx} userId={user?.id} />
                  </View>
                ))
          }
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

// 3 columns, 16px horizontal padding each side, 10px gap between
const GRID_PAD  = 16
const GRID_GAP  = 10
const ITEM_W    = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * 2) / 3)

const s = StyleSheet.create({
  header:        { paddingHorizontal: 20, paddingBottom: 28, backgroundColor: '#4F46E5' },
  headerTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerGreeting:{ fontSize: 13, color: '#A5B4FC' },
  headerName:    { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 2 },
  refreshBtn:    { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  balanceCard:   { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  balanceRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  balanceLabel:  { fontSize: 12, color: '#A5B4FC', fontWeight: '500' },
  balanceAmount: { fontSize: 30, fontWeight: '700', color: '#fff', letterSpacing: -0.5, flexShrink: 1 },
  balanceCurrency:{ fontSize: 15, fontWeight: '500', color: '#A5B4FC' },
  balanceSub:    { fontSize: 12, color: '#A5B4FC', marginTop: 2 },
  section:       { marginTop: 20 },
  px:            { paddingHorizontal: 20 },
  quickGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GRID_PAD, gap: GRID_GAP },
  quickItem:     { width: ITEM_W, alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  quickIcon:     { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickLabel:    { fontSize: 11, fontWeight: '600', color: '#4B5563', textAlign: 'center' },
  tickerCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tickerRates:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tickerItem:    { flexDirection: 'row', alignItems: 'center' },
  tickerCode:    { fontSize: 12, color: '#9CA3AF' },
  tickerRate:    { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  tickerCta:     { fontSize: 12, color: '#0D9488', fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll:        { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  card:          { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  divider:       { height: 1, backgroundColor: '#F9FAFB', marginVertical: 2 },
  empty:         { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 24 },
})
