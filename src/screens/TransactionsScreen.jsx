import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import TransactionItem from '../components/TransactionItem'

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

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

  const renderItem = ({ item: tx, index }) => (
    <View>
      {index > 0 && <View style={s.divider} />}
      <TransactionItem tx={tx} userId={user?.id} />
    </View>
  )

  const renderFooter = () => {
    if (!loadingMore) return null
    return <View style={{ paddingVertical: 16, alignItems: 'center' }}><ActivityIndicator color="#4F46E5" /></View>
  }

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
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar:    { paddingHorizontal: 20, paddingVertical: 16 },
  title:     { fontSize: 22, fontWeight: '700', color: '#111827' },
  list:      { paddingHorizontal: 20, paddingBottom: 24 },
  card:      { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  divider:   { height: 1, backgroundColor: '#F9FAFB' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle:{ fontSize: 18, fontWeight: '600', color: '#9CA3AF' },
  emptySub:  { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
})
