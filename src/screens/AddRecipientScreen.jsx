import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, FlatList, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import {
  ArrowLeft, ChevronDown, ChevronRight,
  User, Phone, Shield, Zap, Send,
} from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

const NAVY        = '#0A1628'
const TEAL        = '#0E9E98'
const TEAL_LIGHT  = '#F0FAF9'
const TEAL_BORDER = '#C9EDE9'
const YELLOW      = '#F5C842'

const DEST_COUNTRIES = [
  { name: 'Senegal',       flag: '🇸🇳', currency: 'XOF', dial: '+221' },
  { name: "Côte d'Ivoire", flag: '🇨🇮', currency: 'XOF', dial: '+225' },
  { name: 'Mali',          flag: '🇲🇱', currency: 'XOF', dial: '+223' },
  { name: 'Burkina Faso',  flag: '🇧🇫', currency: 'XOF', dial: '+226' },
  { name: 'Niger',         flag: '🇳🇪', currency: 'XOF', dial: '+227' },
  { name: 'Togo',          flag: '🇹🇬', currency: 'XOF', dial: '+228' },
  { name: 'Benin',         flag: '🇧🇯', currency: 'XOF', dial: '+229' },
  { name: 'Guinea',        flag: '🇬🇳', currency: 'GNF', dial: '+224' },
  { name: 'Cameroon',      flag: '🇨🇲', currency: 'XAF', dial: '+237' },
  { name: 'Nigeria',       flag: '🇳🇬', currency: 'NGN', dial: '+234' },
  { name: 'Ghana',         flag: '🇬🇭', currency: 'GHS', dial: '+233' },
  { name: 'Kenya',         flag: '🇰🇪', currency: 'KES', dial: '+254' },
  { name: 'Morocco',       flag: '🇲🇦', currency: 'MAD', dial: '+212' },
  { name: 'South Africa',  flag: '🇿🇦', currency: 'ZAR', dial: '+27'  },
  { name: 'Egypt',         flag: '🇪🇬', currency: 'EGP', dial: '+20'  },
  { name: 'Ethiopia',      flag: '🇪🇹', currency: 'ETB', dial: '+251' },
  { name: 'Gambia',        flag: '🇬🇲', currency: 'GMD', dial: '+220' },
]

const PAYOUT_METHODS = [
  { id: 'wallet', label: 'Sendwave Wallet', sub: 'USDC digital dollars' },
  { id: 'wave',   label: 'Wave Mobile Money', sub: 'Local currency wallet' },
  { id: 'cash',   label: 'Cash Pickup',     sub: 'Agent collection point' },
]

function FieldLabel({ text }) {
  return <Text style={s.fieldLabel}>{text}</Text>
}

export default function AddRecipientScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()

  const initialCountry =
    DEST_COUNTRIES.find(c => c.name === route.params?.country_name) ||
    DEST_COUNTRIES[16]

  const initialMethod =
    PAYOUT_METHODS.find(m => m.id === route.params?.delivery) || PAYOUT_METHODS[0]

  const walletOnly = route.params?.delivery === 'wallet'
  const isWave     = !walletOnly

  const [country, setCountry]           = useState(initialCountry)
  const [method, setMethod]             = useState(initialMethod)
  const [phone, setPhone]               = useState(route.params?.to_phone || '')
  const [phoneConfirm, setPhoneConfirm] = useState('')
  const [fullName, setFullName]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [showCountry, setShowCountry]   = useState(false)
  const [showMethod, setShowMethod]     = useState(false)

  const payoutCurrency = method.id === 'wallet' ? 'USDC' : country.currency

  const save = async () => {
    if (isWave && !fullName.trim())
      return Toast.show({ type: 'error', text1: 'Enter recipient full name' })
    if (!phone.trim())
      return Toast.show({ type: 'error', text1: 'Enter a mobile number' })
    if (isWave && phone !== phoneConfirm)
      return Toast.show({ type: 'error', text1: 'Mobile numbers do not match' })

    setSaving(true)
    try {
      let p = phone.replace(/[\s\-().]/g, '')
      if (!p.startsWith('+')) p = country.dial + p.replace(/^0+/, '')
      await api.post('/user/recipients', {
        phone_number:  p,
        full_name:     fullName || p,
        country_code:  country.code,
        country_name:  country.name,
        payout_method: method.id,
      })
      Toast.show({ type: 'success', text1: 'Recipient saved!' })
      navigation.navigate('SendMoney', {
        to_phone:     p,
        country_name: country.name,
        delivery:     method.id,
      })
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Failed to save recipient' })
    } finally {
      setSaving(false)
    }
  }

  const inviteFriend = async () => {
    try {
      await Share.share({
        message: 'Join me on Kalipeh Wallet for fast and easy money transfers! Download the app now.',
      })
    } catch { /* cancelled */ }
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── Dark header band ── */}
      <View style={s.headerBand}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerSub}>
              {walletOnly ? 'SENDWAVE WALLET' : 'WAVE / CASH PICKUP'}
            </Text>
            <Text style={s.headerTitle}>Add recipient</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Method badge */}
        <View style={s.methodBadgeRow}>
          <View style={[s.methodBadge, walletOnly && s.methodBadgeTeal]}>
            {walletOnly
              ? <Zap size={13} color={TEAL} />
              : <Send size={13} color="#888" />
            }
            <Text style={[s.methodBadgeText, walletOnly && { color: TEAL }]}>
              {method.label}
            </Text>
          </View>
          <View style={s.methodBadge}>
            <Text style={{ fontSize: 14 }}>{country.flag}</Text>
            <Text style={s.methodBadgeText}>{country.name}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Main card ── */}
        <View style={s.mainCard}>

          {/* Country selector */}
          <TouchableOpacity style={s.fieldRow} onPress={() => setShowCountry(true)} activeOpacity={0.85}>
            <View style={s.fieldIconWrap}>
              <Text style={{ fontSize: 20 }}>{country.flag}</Text>
            </View>
            <View style={s.fieldBody}>
              <FieldLabel text="COUNTRY" />
              <Text style={s.fieldValue}>{country.name}</Text>
            </View>
            <ChevronDown size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={s.rowDivider} />

          {/* Payout method */}
          <TouchableOpacity
            style={s.fieldRow}
            onPress={() => !walletOnly && setShowMethod(true)}
            activeOpacity={walletOnly ? 1 : 0.85}
          >
            <View style={[s.fieldIconWrap, walletOnly && { backgroundColor: TEAL_LIGHT }]}>
              {walletOnly
                ? <Text style={s.walletS}>S</Text>
                : <Text style={{ fontSize: 18 }}>📱</Text>
              }
            </View>
            <View style={s.fieldBody}>
              <FieldLabel text="PAYOUT METHOD" />
              <Text style={[s.fieldValue, walletOnly && { color: TEAL }]}>{method.label}</Text>
              <Text style={s.fieldSub}>{method.sub}</Text>
            </View>
            {!walletOnly && <ChevronDown size={16} color="#9CA3AF" />}
          </TouchableOpacity>

          {/* Payout currency — wallet only */}
          {walletOnly && (
            <>
              <View style={s.rowDivider} />
              <View style={s.fieldRow}>
                <View style={[s.fieldIconWrap, { backgroundColor: '#F8F9FA' }]}>
                  <Text style={{ fontSize: 18 }}>💲</Text>
                </View>
                <View style={s.fieldBody}>
                  <FieldLabel text="PAYOUT CURRENCY" />
                  <Text style={[s.fieldValue, { color: '#9CA3AF' }]}>{payoutCurrency}</Text>
                  <Text style={s.fieldSub}>Digital dollars, stable value</Text>
                </View>
                <Shield size={15} color={TEAL} />
              </View>
            </>
          )}

          <View style={s.rowDivider} />

          {/* Full name — wave only */}
          {isWave && (
            <>
              <View style={s.fieldRow}>
                <View style={s.fieldIconWrap}>
                  <User size={18} color="#9CA3AF" />
                </View>
                <View style={s.fieldBody}>
                  <FieldLabel text="FULL NAME" />
                  <TextInput
                    style={s.fieldInput}
                    placeholder="As on their ID"
                    placeholderTextColor="#C4C9D4"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>
              <View style={s.rowDivider} />
            </>
          )}

          {/* Mobile number */}
          <View style={s.fieldRow}>
            <View style={s.fieldIconWrap}>
              <Phone size={18} color="#9CA3AF" />
            </View>
            <View style={s.fieldBody}>
              <FieldLabel text="MOBILE NUMBER" />
              <TextInput
                style={s.fieldInput}
                placeholder={`${country.dial} ···`}
                placeholderTextColor="#C4C9D4"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          {/* Retype mobile — wave only */}
          {isWave && (
            <>
              <View style={s.rowDivider} />
              <View style={s.fieldRow}>
                <View style={s.fieldIconWrap}>
                  <Phone size={18} color={phoneConfirm && phone === phoneConfirm ? TEAL : '#9CA3AF'} />
                </View>
                <View style={s.fieldBody}>
                  <FieldLabel text="CONFIRM MOBILE" />
                  <TextInput
                    style={s.fieldInput}
                    placeholder="Retype mobile number"
                    placeholderTextColor="#C4C9D4"
                    keyboardType="phone-pad"
                    value={phoneConfirm}
                    onChangeText={setPhoneConfirm}
                  />
                </View>
                {phoneConfirm.length > 0 && (
                  <View style={[s.matchDot, { backgroundColor: phone === phoneConfirm ? TEAL : '#EF4444' }]} />
                )}
              </View>
            </>
          )}

        </View>

        {/* ── Warning box ── */}
        {walletOnly ? (
          <View style={s.warningCard}>
            <View style={s.warningIcon}>
              <Shield size={16} color={TEAL} />
            </View>
            <Text style={s.warningText}>
              USDC transfers can't be undone. Make sure you know this recipient and double-check all details. If you feel coerced or something seems off, don't send.
            </Text>
          </View>
        ) : (
          <View style={s.warningCard}>
            <View style={s.warningIcon}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
            </View>
            <Text style={s.warningText}>
              The recipient's name must match their ID. Their phone number must be correct so they receive the pickup SMS code. Transfers to incorrect numbers may not be refundable.
            </Text>
          </View>
        )}

        {/* ── Invite card ── */}
        <TouchableOpacity style={s.inviteCard} onPress={inviteFriend} activeOpacity={0.85}>
          <View style={s.inviteIconWrap}>
            <Text style={{ fontSize: 26 }}>💰</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.inviteTitle}>Invite your recipient</Text>
            <Text style={s.inviteDesc}>They can join Sendwave Wallet for faster transfers</Text>
          </View>
          <ChevronRight size={16} color="#BBBBBB" />
        </TouchableOpacity>

      </ScrollView>

      {/* ── Save button ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <Spinner size="sm" color="#5A4500" />
            : <Text style={s.saveBtnText}>Save recipient</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Country picker modal ── */}
      <Modal visible={showCountry} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <Text style={m.sheetTitle}>Select Country</Text>
            <FlatList
              data={DEST_COUNTRIES}
              keyExtractor={c => c.name}
              style={{ maxHeight: 440 }}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[m.option, c.name === country.name && m.optionActive]}
                  onPress={() => { setCountry(c); setShowCountry(false) }}
                >
                  <Text style={{ fontSize: 22, width: 32 }}>{c.flag}</Text>
                  <Text style={m.optionName}>{c.name}</Text>
                  <Text style={m.optionSub}>{c.currency}</Text>
                  {c.name === country.name && (
                    <View style={m.checkDot} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Payout method modal ── */}
      <Modal visible={showMethod} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <Text style={m.sheetTitle}>Payout Method</Text>
            {PAYOUT_METHODS.filter(pm => pm.id !== 'wallet').map(pm => (
              <TouchableOpacity
                key={pm.id}
                style={[m.option, pm.id === method.id && m.optionActive]}
                onPress={() => { setMethod(pm); setShowMethod(false) }}
              >
                <Text style={{ fontSize: 20 }}>
                  {pm.id === 'wave' ? '📱' : '🏪'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={m.optionName}>{pm.label}</Text>
                  <Text style={m.optionSub}>{pm.sub}</Text>
                </View>
                {pm.id === method.id && <View style={m.checkDot} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F9' },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, marginBottom: 18,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:   { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginBottom: 3 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  methodBadgeRow: { flexDirection: 'row', gap: 8 },
  methodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  methodBadgeTeal: { backgroundColor: 'rgba(14,158,152,0.15)', borderColor: TEAL },
  methodBadgeText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  // ── Main card ────────────────────────────────────────────────────────────────
  content: { padding: 16, gap: 12 },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    overflow: 'hidden',
  },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  fieldIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F4F6F9',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  walletS: { fontSize: 20, fontWeight: '900', color: '#3A8C7E' },
  fieldBody:  { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 4 },
  fieldValue: { fontSize: 15, fontWeight: '700', color: '#111' },
  fieldSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  fieldInput: { fontSize: 15, fontWeight: '600', color: '#111', paddingVertical: 0 },

  rowDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 72 },
  matchDot:   { width: 10, height: 10, borderRadius: 5 },

  // ── Warning ──────────────────────────────────────────────────────────────────
  warningCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: TEAL,
  },
  warningIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  warningText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20 },

  // ── Invite card ───────────────────────────────────────────────────────────────
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  inviteIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#FFF8E1',
    alignItems: 'center', justifyContent: 'center',
  },
  inviteTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 3 },
  inviteDesc:  { fontSize: 12, color: '#9CA3AF' },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: '#F4F6F9',
    borderTopWidth: 1, borderTopColor: '#EBEBEB',
  },
  saveBtn: {
    backgroundColor: YELLOW,
    borderRadius: 32, paddingVertical: 18,
    alignItems: 'center',
    shadowColor: YELLOW, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  saveBtnText: { fontSize: 17, fontWeight: '800', color: '#5A4500' },
})

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingBottom: 40,
  },
  handle:     { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111', paddingHorizontal: 22, marginBottom: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 22, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  optionActive: { backgroundColor: TEAL_LIGHT },
  optionName:   { fontSize: 15, fontWeight: '600', color: '#111' },
  optionSub:    { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  checkDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL,
  },
})
