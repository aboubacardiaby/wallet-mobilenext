import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, FlatList, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { ArrowLeftRight, RefreshCw, TrendingUp, TrendingDown, Search } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

const TABLE_CURRENCIES = [
  { code: 'EUR', name: 'Euro',            flag: '🇪🇺' },
  { code: 'USD', name: 'US Dollar',       flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound',   flag: '🇬🇧' },
  { code: 'XAF', name: 'CFA Franc BEAC',  flag: '🌍' },
  { code: 'MAD', name: 'Moroccan Dirham', flag: '🇲🇦' },
  { code: 'NGN', name: 'Nigerian Naira',  flag: '🇳🇬' },
  { code: 'GHS', name: 'Ghanaian Cedi',   flag: '🇬🇭' },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'ZAR', name: 'S. African Rand', flag: '🇿🇦' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc',     flag: '🇨🇭' },
  { code: 'AED', name: 'UAE Dirham',      flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal',     flag: '🇸🇦' },
  { code: 'CNY', name: 'Chinese Yuan',    flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee',    flag: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real',  flag: '🇧🇷' },
  { code: 'JPY', name: 'Japanese Yen',    flag: '🇯🇵' },
]

const ALL_CURRENCIES = [{ code: 'XOF', name: 'West African CFA', flag: '🌍' }, ...TABLE_CURRENCIES]

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toFixed(6)
}

function timeAgo(ts) {
  if (!ts) return ''
  const secs = Math.round(Date.now() / 1000 - ts)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export default function ExchangeScreen() {
  const insets = useSafeAreaInsets()
  const [rates, setRates] = useState({})
  const [prevRates, setPrevRates] = useState({})
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [fromCcy, setFromCcy] = useState('XOF')
  const [toCcy, setToCcy] = useState('EUR')
  const [fromAmt, setFromAmt] = useState('10000')
  const [toAmt, setToAmt] = useState('')
  const [converting, setConverting] = useState(false)

  const loadRates = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const { data } = await api.get('exchange/rates?base=XOF&popular_only=true')
      setPrevRates(rates)
      setRates(data.rates)
      setFetchedAt(data.fetched_at)
    } catch {
      if (!silent) Toast.show({ type: 'error', text1: 'Could not load exchange rates' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadRates() }, [loadRates])

  const convert = useCallback(async (amount, from, to) => {
    if (!amount || isNaN(parseFloat(amount))) { setToAmt(''); return }
    setConverting(true)
    try {
      const { data } = await api.get(`/exchange/convert?from=${from}&to=${to}&amount=${parseFloat(amount)}`)
      setToAmt(fmt(data.result))
    } catch { setToAmt('error') }
    finally { setConverting(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => convert(fromAmt, fromCcy, toCcy), 400)
    return () => clearTimeout(t)
  }, [fromAmt, fromCcy, toCcy, convert])

  const swap = () => {
    setFromCcy(toCcy)
    setToCcy(fromCcy)
    setFromAmt(toAmt.replace(/,/g, ''))
  }

  const filtered = TABLE_CURRENCIES.filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRates(true)} tintColor="#4F46E5" />}
    >
      <View style={s.header}>
        <Text style={s.title}>Exchange Rates</Text>
        <View style={s.headerRight}>
          <Text style={s.updatedText}>{fetchedAt ? `Updated ${timeAgo(fetchedAt)}` : 'Loading…'}</Text>
          <TouchableOpacity onPress={() => loadRates(true)} disabled={refreshing} style={s.refreshBtn}>
            {refreshing ? <ActivityIndicator size="small" color="#4F46E5" /> : <RefreshCw size={14} color="#4F46E5" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Converter */}
      <View style={[s.card, s.px]}>
        <View style={s.converterHeader}>
          <TrendingUp size={15} color="#4F46E5" />
          <Text style={s.converterTitle}>Currency Converter</Text>
        </View>

        <Text style={s.inputLabel}>From</Text>
        <View style={s.converterRow}>
          <CurrencyPicker value={fromCcy} onChange={setFromCcy} exclude={toCcy} />
          <TextInput
            style={[s.input, { flex: 1, textAlign: 'right', fontFamily: 'monospace' }]}
            value={fromAmt}
            onChangeText={setFromAmt}
            keyboardType="numeric"
            placeholder="Amount"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={s.swapRow}>
          <TouchableOpacity style={s.swapBtn} onPress={swap}>
            <ArrowLeftRight size={15} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        <Text style={s.inputLabel}>To</Text>
        <View style={s.converterRow}>
          <CurrencyPicker value={toCcy} onChange={setToCcy} exclude={fromCcy} />
          <View style={[s.input, s.resultBox, { flex: 1 }]}>
            {converting ? <Spinner size="sm" /> : <Text style={s.resultText}>{toAmt || '—'}</Text>}
          </View>
        </View>

        {!converting && toAmt && fromAmt ? (
          <Text style={s.rateHint}>1 {fromCcy} = {fmt(parseFloat(toAmt) / parseFloat(fromAmt.replace(/,/g, '') || 1))} {toCcy}</Text>
        ) : null}
      </View>

      {/* Rates table */}
      <View style={[s.px, { marginTop: 20 }]}>
        <View style={s.tableHeader}>
          <Text style={s.tableTitle}>1 XOF =</Text>
          <View style={s.searchBox}>
            <Search size={12} color="#9CA3AF" />
            <TextInput
              style={s.searchInput}
              placeholder="Search…"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}><Spinner /></View>
        ) : (
          <View style={s.card}>
            {filtered.map((c, i) => {
              const rate = rates[c.code]
              const prev = prevRates[c.code]
              const change = prev != null ? rate - prev : 0
              const Direction = change > 0 ? TrendingUp : change < 0 ? TrendingDown : null
              return (
                <View key={c.code}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.rateRow}>
                    <Text style={s.rateFlag}>{c.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rateCode}>{c.code}</Text>
                      <Text style={s.rateName}>{c.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.rateValue}>{rate !== undefined ? fmt(rate) : '—'}</Text>
                        {Direction && (
                          <Direction size={14} color={change > 0 ? '#16A34A' : '#DC2626'} />
                        )}
                      </View>
                      {rate && <Text style={s.rateInverse}>1 {c.code} = {fmt(1 / rate)} XOF</Text>}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
        <Text style={s.disclaimer}>Rates are indicative · Source: exchangerate-api.com</Text>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  )
}

function CurrencyPicker({ value, onChange, exclude }) {
  const [open, setOpen] = useState(false)
  const options = ALL_CURRENCIES.filter(c => c.code !== exclude)

  if (open) {
    return (
      <View style={cp.modal}>
        <FlatList
          data={options}
          keyExtractor={c => c.code}
          style={{ maxHeight: 200 }}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={[cp.option, c.code === value && cp.optionActive]}
              onPress={() => { onChange(c.code); setOpen(false) }}
            >
              <Text style={cp.optionFlag}>{c.flag}</Text>
              <Text style={cp.optionCode}>{c.code}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    )
  }

  const selected = ALL_CURRENCIES.find(c => c.code === value)
  return (
    <TouchableOpacity style={cp.trigger} onPress={() => setOpen(true)}>
      <Text style={cp.triggerFlag}>{selected?.flag}</Text>
      <Text style={cp.triggerCode}>{value}</Text>
    </TouchableOpacity>
  )
}

const cp = StyleSheet.create({
  trigger:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, marginRight: 8 },
  triggerFlag:  { fontSize: 16 },
  triggerCode:  { fontSize: 14, fontWeight: '700', color: '#374151' },
  modal:        { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8, overflow: 'hidden' },
  option:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  optionActive: { backgroundColor: '#EEF2FF' },
  optionFlag:   { fontSize: 14 },
  optionCode:   { fontSize: 13, fontWeight: '600', color: '#374151' },
})

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F9FAFB' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title:         { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updatedText:   { fontSize: 12, color: '#9CA3AF' },
  refreshBtn:    { padding: 4 },
  px:            { paddingHorizontal: 20 },
  card:          { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  converterHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  converterTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  inputLabel:    { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  converterRow:  { flexDirection: 'row', alignItems: 'center' },
  input:         { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#111827' },
  resultBox:     { backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'flex-end' },
  resultText:    { fontSize: 18, fontWeight: '700', color: '#374151' },
  swapRow:       { alignItems: 'center', marginVertical: 14 },
  swapBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  rateHint:      { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 10 },
  tableHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tableTitle:    { fontSize: 14, fontWeight: '700', color: '#111827' },
  searchBox:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  searchInput:   { fontSize: 12, color: '#374151', width: 100 },
  divider:       { height: 1, backgroundColor: '#F9FAFB' },
  rateRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rateFlag:      { fontSize: 20, width: 28, textAlign: 'center' },
  rateCode:      { fontSize: 15, fontWeight: '700', color: '#111827' },
  rateName:      { fontSize: 13, color: '#6B7280' },
  rateValue:     { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  rateInverse:   { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  disclaimer:    { fontSize: 11, color: '#D1D5DB', textAlign: 'center', marginTop: 12, marginBottom: 4 },
})
