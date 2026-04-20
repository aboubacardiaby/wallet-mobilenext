import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import {
  ArrowLeft, ChevronDown, ChevronRight,
  Smartphone, UserPlus, Zap, Shield,
} from 'lucide-react-native'

const NAVY  = '#0A1628'
const TEAL  = '#0E9E98'
const TEAL_LIGHT  = '#F0FAF9'
const TEAL_BORDER = '#C9EDE9'
const TEAL_BG     = '#3A8C7E'

const DEST_COUNTRIES = [
  { name: 'Senegal',       flag: '🇸🇳', currency: 'XOF' },
  { name: "Côte d'Ivoire", flag: '🇨🇮', currency: 'XOF' },
  { name: 'Mali',          flag: '🇲🇱', currency: 'XOF' },
  { name: 'Burkina Faso',  flag: '🇧🇫', currency: 'XOF' },
  { name: 'Niger',         flag: '🇳🇪', currency: 'XOF' },
  { name: 'Togo',          flag: '🇹🇬', currency: 'XOF' },
  { name: 'Benin',         flag: '🇧🇯', currency: 'XOF' },
  { name: 'Guinea',        flag: '🇬🇳', currency: 'GNF' },
  { name: 'Cameroon',      flag: '🇨🇲', currency: 'XAF' },
  { name: 'Nigeria',       flag: '🇳🇬', currency: 'NGN' },
  { name: 'Ghana',         flag: '🇬🇭', currency: 'GHS' },
  { name: 'Kenya',         flag: '🇰🇪', currency: 'KES' },
  { name: 'Morocco',       flag: '🇲🇦', currency: 'MAD' },
  { name: 'South Africa',  flag: '🇿🇦', currency: 'ZAR' },
  { name: 'Egypt',         flag: '🇪🇬', currency: 'EGP' },
  { name: 'Ethiopia',      flag: '🇪🇹', currency: 'ETB' },
  { name: 'Gambia',        flag: '🇬🇲', currency: 'GMD' },
]

function Feature({ icon, text }) {
  return (
    <View style={s.featureChip}>
      {icon}
      <Text style={s.featureText}>{text}</Text>
    </View>
  )
}

export default function RecipientsScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()

  const initialCountry =
    DEST_COUNTRIES.find(c => c.name === route.params?.country_name) ||
    DEST_COUNTRIES[16]

  const [country, setCountry] = useState(initialCountry)
  const [showCountryPicker, setShowCountryPicker] = useState(false)

  const toPhone = route.params?.to_phone || ''

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── Dark header band ── */}
      <View style={s.headerBand}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={s.headerSub}>TRANSFER</Text>
            <Text style={s.headerTitle}>Receive method</Text>
          </View>

          <TouchableOpacity
            style={s.countryPill}
            onPress={() => setShowCountryPicker(v => !v)}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 16 }}>{country.flag}</Text>
            <Text style={s.countryPillText}>{country.name}</Text>
            <ChevronDown size={12} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <Text style={s.headerQuestion}>
          How should your recipient{'\n'}receive the money?
        </Text>
      </View>

      {/* ── Country dropdown ── */}
      {showCountryPicker && (
        <View style={s.dropdown}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {DEST_COUNTRIES.map(c => (
              <TouchableOpacity
                key={c.name}
                style={[s.dropdownOption, c.name === country.name && s.dropdownOptionActive]}
                onPress={() => { setCountry(c); setShowCountryPicker(false) }}
              >
                <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                <Text style={s.dropdownName}>{c.name}</Text>
                <Text style={s.dropdownCcy}>{c.currency}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Method 1: Sendwave Wallet ── */}
        <TouchableOpacity
          style={s.methodCard}
          onPress={() => navigation.navigate('AddRecipient', {
            country_name: country.name,
            to_phone:     toPhone,
            delivery:     'wallet',
          })}
          activeOpacity={0.88}
        >
          {/* Recommended ribbon */}
          <View style={s.recommendedRibbon}>
            <Text style={s.recommendedText}>RECOMMENDED</Text>
          </View>

          <View style={s.methodInner}>
            {/* Icon */}
            <View style={[s.methodIconWrap, { backgroundColor: TEAL_BG }]}>
              <Text style={s.methodIconLetter}>S</Text>
            </View>

            <View style={s.methodBody}>
              <Text style={s.methodTitle}>Sendwave Wallet</Text>
              <Text style={s.methodDesc}>
                Send digital dollars directly to their Sendwave Wallet. They choose when and how to cash out.
              </Text>
              <View style={s.featureRow}>
                <Feature
                  icon={<Zap size={11} color={TEAL} />}
                  text="Instant"
                />
                <Feature
                  icon={<Shield size={11} color={TEAL} />}
                  text="USDC secured"
                />
              </View>
            </View>
          </View>

          <View style={s.methodFooter}>
            <Text style={s.methodFooterText}>Continue with Wallet</Text>
            <ChevronRight size={16} color={TEAL} />
          </View>
        </TouchableOpacity>

        {/* ── Method 2: Wave / Cash pickup ── */}
        <TouchableOpacity
          style={[s.methodCard, s.methodCardAlt]}
          onPress={() => navigation.navigate('AddRecipient', {
            country_name: country.name,
            to_phone:     toPhone,
            delivery:     'wave',
          })}
          activeOpacity={0.88}
        >
          <View style={s.methodInner}>
            {/* Icon */}
            <View style={[s.methodIconWrap, { backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#E0E0E0' }]}>
              <Smartphone size={22} color="#888" />
            </View>

            <View style={s.methodBody}>
              <Text style={s.methodTitle}>Wave / Cash pickup</Text>
              <Text style={s.methodDesc}>
                Send to their Wave mobile wallet or have them collect cash at an agent location.
              </Text>
              <View style={s.featureRow}>
                <Feature
                  icon={<Text style={{ fontSize: 11 }}>📱</Text>}
                  text="Mobile money"
                />
                <Feature
                  icon={<Text style={{ fontSize: 11 }}>🏪</Text>}
                  text="Agent pickup"
                />
              </View>
            </View>
          </View>

          <View style={[s.methodFooter, { borderTopColor: '#F0F0F0' }]}>
            <Text style={[s.methodFooterText, { color: '#555' }]}>Continue with Wave</Text>
            <ChevronRight size={16} color="#888" />
          </View>
        </TouchableOpacity>

        {/* ── Add new recipient ── */}
        <TouchableOpacity
          style={s.addRow}
          onPress={() => navigation.navigate('AddRecipient', { country_name: country.name, to_phone: toPhone })}
          activeOpacity={0.8}
        >
          <View style={s.addIconWrap}>
            <UserPlus size={17} color={TEAL} />
          </View>
          <Text style={s.addText}>Add a new recipient</Text>
          <ChevronRight size={16} color="#BBBBBB" />
        </TouchableOpacity>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F9' },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingTop: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub:    { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginBottom: 2 },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#fff' },

  countryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  countryPillText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  headerQuestion: {
    fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 30,
  },

  // ── Country dropdown ──────────────────────────────────────────────────────
  dropdown: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    marginHorizontal: 16, marginTop: 8, overflow: 'hidden', zIndex: 99,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 8,
  },
  dropdownOption:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownOptionActive: { backgroundColor: '#F0FAF9' },
  dropdownName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111' },
  dropdownCcy:  { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  // ── Content ────────────────────────────────────────────────────────────────
  content: { padding: 16, gap: 12 },

  // ── Method cards ──────────────────────────────────────────────────────────
  methodCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 5,
    borderWidth: 1.5, borderColor: TEAL_BORDER,
  },
  methodCardAlt: {
    borderColor: '#E5E7EB',
  },
  recommendedRibbon: {
    backgroundColor: TEAL,
    paddingHorizontal: 14, paddingVertical: 7,
    alignItems: 'center',
  },
  recommendedText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1.2 },

  methodInner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    padding: 20,
  },
  methodIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  methodIconLetter: { fontSize: 24, fontWeight: '900', color: '#fff' },
  methodBody:  { flex: 1 },
  methodTitle: { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 6 },
  methodDesc:  { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 12 },

  featureRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: TEAL_LIGHT,
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: TEAL_BORDER,
  },
  featureText: { fontSize: 11, fontWeight: '600', color: TEAL },

  methodFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: TEAL_BORDER,
  },
  methodFooterText: { fontSize: 14, fontWeight: '700', color: TEAL },

  // ── Add recipient row ──────────────────────────────────────────────────────
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  addIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: TEAL_BORDER,
  },
  addText: { flex: 1, fontSize: 15, fontWeight: '700', color: TEAL },
})
