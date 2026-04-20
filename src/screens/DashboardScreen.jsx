import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import {
  Send, Download, ArrowDownToLine, Banknote,
  Eye, EyeOff, TrendingUp, QrCode,
  Bell, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import TransactionItem from '../components/TransactionItem'
import Spinner from '../components/Spinner'

const { width: SCREEN_W } = Dimensions.get('window')

const NAVY       = '#0A1628'
const TEAL       = '#0E9E98'
const TEAL_LIGHT = '#F0FAF9'
const TEAL_BORDER= '#C9EDE9'

const QUICK_ACTIONS = [
  { label: 'Send',     icon: Send,            screen: 'SendMoney',    bg: TEAL_LIGHT,  color: TEAL,      border: TEAL_BORDER },
  { label: 'Request',  icon: Download,        screen: 'RequestMoney', bg: '#EEF2FF',   color: '#6366F1', border: '#C7D2FE' },
  { label: 'Cash In',  icon: ArrowDownToLine, screen: 'CashIn',       bg: '#ECFDF5',   color: '#10B981', border: '#A7F3D0' },
  { label: 'Cash Out', icon: Banknote,        screen: 'CashOut',      bg: '#FFF7ED',   color: '#F59E0B', border: '#FDE68A' },
  { label: 'Exchange', icon: TrendingUp,      screen: 'Exchange',     bg: '#F0FDFA',   color: TEAL,      border: TEAL_BORDER },
  { label: 'QR Code',  icon: QrCode,          screen: 'QR',           bg: '#EFF6FF',   color: '#3B82F6', border: '#BFDBFE' },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardScreen() {
  const navigation  = useNavigation()
  const insets      = useSafeAreaInsets()
  const { user }    = useAuth()

  const [wallet, setWallet]           = useState(null)
  const [txs, setTxs]                 = useState([])
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [loadingTxs, setLoadingTxs]   = useState(true)
  const [hideBalance, setHideBalance] = useState(false)
  const [ticker, setTicker]           = useState(null)
  const [refreshing, setRefreshing]   = useState(false)

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

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase()

  const firstName = user?.full_name?.split(' ')[0] || user?.phone_number || 'there'

  const balance = Number(wallet?.balance ?? 0)
  const balanceDisplay = hideBalance
    ? '••••••'
    : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F4F6F9' }}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
      }
    >

      {/* ── Dark header band ── */}
      <View style={[s.headerBand, { paddingTop: insets.top + 16 }]}>

        {/* Top row: greeting + avatar + bell */}
        <View style={s.topRow}>
          <View>
            <Text style={s.greeting}>{getGreeting()}</Text>
            <Text style={s.userName}>{firstName} 👋</Text>
          </View>
          <View style={s.topActions}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.8}
            >
              <Bell size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.avatarBtn}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <Text style={s.avatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance card */}
        <View style={s.balanceCard}>
          <View style={s.balanceCardTop}>
            <Text style={s.balanceLabel}>Total Balance</Text>
            <TouchableOpacity onPress={() => setHideBalance(h => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {hideBalance
                ? <EyeOff size={16} color="rgba(255,255,255,0.5)" />
                : <Eye    size={16} color="rgba(255,255,255,0.5)" />
              }
            </TouchableOpacity>
          </View>

          {loadingWallet
            ? <View style={{ height: 52, justifyContent: 'center' }}><Spinner color="rgba(255,255,255,0.6)" /></View>
            : <View style={s.balanceRow}>
                <Text style={s.balanceAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                  {balanceDisplay}
                </Text>
                <Text style={s.balanceCcy}>{wallet?.currency ?? 'USD'}</Text>
              </View>
          }

          {!loadingWallet && (
            <Text style={s.balanceSub}>
              {user?.user_type === 'sender' ? 'Diaspora wallet' : 'Available balance'} · {wallet?.currency}
            </Text>
          )}

          {/* Send + Receive CTAs */}
          <View style={s.ctaRow}>
            <TouchableOpacity
              style={s.ctaBtn}
              onPress={() => navigation.navigate('SendMoney')}
              activeOpacity={0.85}
            >
              <View style={s.ctaBtnIcon}>
                <ArrowUpRight size={16} color={NAVY} />
              </View>
              <Text style={s.ctaBtnText}>Send</Text>
            </TouchableOpacity>

            <View style={s.ctaSep} />

            <TouchableOpacity
              style={s.ctaBtn}
              onPress={() => navigation.navigate('RequestMoney')}
              activeOpacity={0.85}
            >
              <View style={s.ctaBtnIcon}>
                <ArrowDownLeft size={16} color={NAVY} />
              </View>
              <Text style={s.ctaBtnText}>Receive</Text>
            </TouchableOpacity>

            <View style={s.ctaSep} />

            <TouchableOpacity
              style={s.ctaBtn}
              onPress={() => navigation.navigate('CashIn')}
              activeOpacity={0.85}
            >
              <View style={s.ctaBtnIcon}>
                <ArrowDownToLine size={16} color={NAVY} />
              </View>
              <Text style={s.ctaBtnText}>Top up</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>

      {/* ── Quick actions grid ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={s.quickGrid}>
          {QUICK_ACTIONS.map(({ label, icon: Icon, screen, bg, color, border }) => (
            <TouchableOpacity
              key={label}
              style={s.quickItem}
              onPress={() => navigation.navigate(screen)}
              activeOpacity={0.8}
            >
              <View style={[s.quickIconWrap, { backgroundColor: bg, borderColor: border }]}>
                <Icon size={20} color={color} />
              </View>
              <Text style={s.quickLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Rate ticker ── */}
      {ticker && ticker.length > 0 && (
        <View style={s.px}>
          <TouchableOpacity
            style={s.tickerCard}
            onPress={() => navigation.navigate('Exchange')}
            activeOpacity={0.88}
          >
            <View style={s.tickerLeft}>
              <TrendingUp size={16} color={TEAL} />
              <Text style={s.tickerTitle}>Live Rates</Text>
            </View>
            <View style={s.tickerRates}>
              {ticker.map(({ code, rate }) => (
                <View key={code} style={s.tickerItem}>
                  <Text style={s.tickerCode}>{code}</Text>
                  <Text style={s.tickerRate}>
                    {rate < 0.01 ? rate.toFixed(6) : rate.toFixed(4)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.tickerCta}>per XOF →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recent transactions ── */}
      <View style={[s.section, s.px]}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')} activeOpacity={0.7}>
            <Text style={s.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={s.txCard}>
          {loadingTxs
            ? <View style={{ paddingVertical: 28, alignItems: 'center' }}><Spinner color={TEAL} /></View>
            : txs.length === 0
              ? <View style={s.emptyWrap}>
                  <Text style={s.emptyIcon}>💸</Text>
                  <Text style={s.emptyText}>No transactions yet</Text>
                  <Text style={s.emptySub}>Your transfer history will appear here</Text>
                </View>
              : txs.map((tx, i) => (
                  <View key={tx.id}>
                    {i > 0 && <View style={s.txDivider} />}
                    <TransactionItem tx={tx} userId={user?.id} />
                  </View>
                ))
          }
        </View>
      </View>

    </ScrollView>
  )
}

const GRID_PAD = 16
const GRID_GAP = 10
const ITEM_W   = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * 2) / 3)

const s = StyleSheet.create({
  // ── Header band ──────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginBottom: 4 },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff' },

  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // Balance card
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  balanceCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.5 },
  balanceRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, flexShrink: 1 },
  balanceCcy:    { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  balanceSub:    { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 20 },

  // CTA row
  ctaRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  ctaBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  ctaBtnIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F5C842',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtnText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  ctaSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },

  // ── Sections ─────────────────────────────────────────────────────────────────
  section:      { marginTop: 20 },
  px:           { paddingHorizontal: 16 },
  sectionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  seeAll:       { fontSize: 13, fontWeight: '700', color: TEAL },

  // Quick grid
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: GRID_PAD, gap: GRID_GAP,
  },
  quickItem: {
    width: ITEM_W, alignItems: 'center', gap: 9,
    backgroundColor: '#fff',
    borderRadius: 18, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3,
  },
  quickIconWrap: {
    width: 46, height: 46, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickLabel: { fontSize: 11, fontWeight: '700', color: '#374151' },

  // Ticker
  tickerCard: {
    backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: TEAL_BORDER,
  },
  tickerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tickerTitle: { fontSize: 12, fontWeight: '700', color: TEAL },
  tickerRates: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  tickerItem:  { alignItems: 'center' },
  tickerCode:  { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  tickerRate:  { fontSize: 13, fontWeight: '800', color: '#111' },
  tickerCta:   { fontSize: 11, color: TEAL, fontWeight: '700' },

  // Transactions
  txCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
    overflow: 'hidden',
  },
  txDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },

  emptyWrap: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySub:  { fontSize: 13, color: '#9CA3AF' },
})
