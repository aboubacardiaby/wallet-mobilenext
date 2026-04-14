import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import { ArrowLeft, UserPlus, Trash2, Send, X, Search, ChevronDown } from 'lucide-react-native'
import api from '../api/client'
import COUNTRIES from '../data/countries'
import Spinner from '../components/Spinner'

const DEFAULT_COUNTRY = COUNTRIES[0]

export default function RecipientsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const [showCountryModal, setShowCountryModal] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const { data } = await api.get('/user/recipients')
      setRecipients(data.recipients || [])
    } catch { Toast.show({ type: 'error', text1: 'Failed to load recipients' }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => { setPhone(''); setFullName(''); setNickname(''); setCountry(DEFAULT_COUNTRY) }

  const save = async () => {
    if (!phone || !fullName) return Toast.show({ type: 'error', text1: 'Phone and name are required' })
    setSaving(true)
    try {
      let p = phone.replace(/[\s\-().]/g, '')
      if (!p.startsWith('+')) p = country.dial + p.replace(/^0+/, '')
      await api.post('/user/recipients', {
        phone_number: p, full_name: fullName, nickname,
        country_code: country.code, country_name: country.name,
      })
      Toast.show({ type: 'success', text1: 'Recipient saved!' })
      resetForm()
      setShowForm(false)
      load()
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed to save' })
    } finally { setSaving(false) }
  }

  const remove = (id, name) => {
    Alert.alert('Remove Recipient', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/user/recipients/${id}`)
          Toast.show({ type: 'success', text1: 'Removed' })
          setRecipients(r => r.filter(x => x.id !== id))
        } catch { Toast.show({ type: 'error', text1: 'Failed to remove' }) }
      }},
    ])
  }

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.dial.includes(countrySearch))
    : COUNTRIES

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={s.title}>Recipients</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={recipients}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={s.list}
        ListHeaderComponent={() => (
          <View>
            {!showForm ? (
              <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)}>
                <UserPlus size={16} color="#4F46E5" />
                <Text style={s.addBtnText}>Add New Recipient</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.formCard}>
                <View style={s.formHeader}>
                  <Text style={s.formTitle}>New Recipient</Text>
                  <TouchableOpacity onPress={() => { setShowForm(false); resetForm() }}>
                    <X size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Country picker */}
                <Text style={s.label}>Country</Text>
                <TouchableOpacity style={s.countryTrigger} onPress={() => setShowCountryModal(true)}>
                  <Text style={{ fontSize: 18 }}>{country.flag}</Text>
                  <Text style={s.countryName}>{country.name}</Text>
                  <Text style={s.dialText}>{country.dial}</Text>
                  <ChevronDown size={14} color="#9CA3AF" />
                </TouchableOpacity>

                <TextInput style={[s.input, { marginTop: 10 }]} placeholder="Phone number *" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                <TextInput style={[s.input, { marginTop: 10 }]} placeholder="Full name *" placeholderTextColor="#9CA3AF" value={fullName} onChangeText={setFullName} />
                <TextInput style={[s.input, { marginTop: 10 }]} placeholder="Nickname (optional)" placeholderTextColor="#9CA3AF" value={nickname} onChangeText={setNickname} />

                <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={save} disabled={saving}>
                  {saving ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Save Recipient</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={() => !loading ? (
          <View style={s.empty}>
            <UserPlus size={40} color="#E5E7EB" />
            <Text style={s.emptyText}>No saved recipients yet</Text>
          </View>
        ) : null}
        renderItem={({ item: r }) => {
          const c = COUNTRIES.find(x => x.code === r.country_code)
          const initials = (r.full_name || r.phone_number).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
          return (
            <View style={s.recipientCard}>
              <View style={[s.avatar, { backgroundColor: r.avatar_color || '#4F46E5' }]}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.recipientName}>{r.full_name || r.phone_number}</Text>
                {r.nickname ? <Text style={s.recipientNickname}>{r.nickname}</Text> : null}
                <Text style={s.recipientMeta}>{c?.flag || ''} {r.country_name} · {r.phone_number}</Text>
              </View>
              <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('SendMoney', { to_phone: r.phone_number })}>
                <Send size={14} color="#4F46E5" />
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => remove(r.id, r.full_name || r.phone_number)}>
                <Trash2 size={14} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )
        }}
      />

      {loading && (
        <View style={s.loadingOverlay}><ActivityIndicator size="large" color="#4F46E5" /></View>
      )}

      {/* Country modal */}
      <Modal visible={showCountryModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalSearch}>
              <Search size={14} color="#9CA3AF" />
              <TextInput
                style={s.modalSearchInput}
                placeholder="Search country…"
                placeholderTextColor="#9CA3AF"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={c => c.code}
              style={{ maxHeight: 400 }}
              renderItem={({ item: c }) => (
                <TouchableOpacity style={[s.modalOption, c.code === country.code && s.modalOptionActive]} onPress={() => { setCountry(c); setShowCountryModal(false); setCountrySearch('') }}>
                  <Text style={{ fontSize: 20, width: 28 }}>{c.flag}</Text>
                  <Text style={s.modalOptionName}>{c.name}</Text>
                  <Text style={s.modalOptionDial}>{c.dial}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F9FAFB' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '700', color: '#111827' },
  list:         { padding: 20, gap: 10 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: '#C7D2FE', borderStyle: 'dashed', marginBottom: 10 },
  addBtnText:   { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
  formCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 10 },
  formHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formTitle:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  label:        { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  countryTrigger:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  countryName:  { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
  dialText:     { fontSize: 12, color: '#9CA3AF' },
  input:        { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  btn:          { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  btnDisabled:  { opacity: 0.7 },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  recipientCard:{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  avatar:       { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  recipientName:{ fontSize: 14, fontWeight: '700', color: '#111827' },
  recipientNickname:{ fontSize: 12, color: '#6366F1' },
  recipientMeta:{ fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  actionBtn:    { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  empty:        { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText:    { fontSize: 14, color: '#9CA3AF' },
  loadingOverlay:{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 32 },
  modalHandle:  { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalSearch:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  modalSearchInput:{ flex: 1, fontSize: 14, color: '#374151' },
  modalOption:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  modalOptionActive:{ backgroundColor: '#EEF2FF' },
  modalOptionName:{ flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  modalOptionDial:{ fontSize: 12, color: '#9CA3AF' },
})
