import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import {
  User, LogOut, Shield, Phone, Mail, Users,
  ShieldCheck, ShieldX, Clock, ChevronRight,
  CreditCard, Smartphone, Pencil, Check, X,
} from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const NAVY        = '#0A1628'
const TEAL        = '#0E9E98'
const TEAL_LIGHT  = '#F0FAF9'
const TEAL_BORDER = '#C9EDE9'

const KYC_CONFIG = {
  verified:     { Icon: ShieldCheck, label: 'Verified',      color: '#10B981', bg: '#ECFDF5' },
  pending:      { Icon: Clock,       label: 'Pending',        color: '#F59E0B', bg: '#FFFBEB' },
  under_review: { Icon: Clock,       label: 'Under Review',   color: '#3B82F6', bg: '#EFF6FF' },
  rejected:     { Icon: ShieldX,     label: 'Action needed',  color: '#EF4444', bg: '#FEF2F2' },
}

export default function ProfileScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user, logout, refreshProfile } = useAuth()

  const [profile, setProfile]   = useState(user)
  const [loading, setLoading]   = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail]       = useState(user?.email || '')

  useEffect(() => {
    refreshProfile().then(p => {
      if (p) { setProfile(p); setFullName(p.full_name || ''); setEmail(p.email || '') }
    })
  }, [])

  const save = async () => {
    setLoading(true)
    try {
      await api.put('/user/profile', { full_name: fullName, email })
      Toast.show({ type: 'success', text1: 'Profile updated!' })
      const p = await refreshProfile()
      if (p) setProfile(p)
      setEditMode(false)
    } catch {
      Toast.show({ type: 'error', text1: 'Update failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  const kycKey = profile?.kyc_status || 'pending'
  const kyc    = KYC_CONFIG[kycKey] || KYC_CONFIG.pending
  const KycIcon = kyc.Icon

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (profile?.email?.[0] || 'U').toUpperCase()

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Dark header band ── */}
        <View style={s.headerBand}>
          <View style={s.headerTop}>
            <Text style={s.headerSub}>ACCOUNT</Text>
            <Text style={s.headerTitle}>My Profile</Text>
          </View>

          {/* Avatar + identity */}
          <View style={s.identityRow}>
            <View style={s.avatarWrap}>
              <Text style={s.avatarText}>{initials}</Text>
              <View style={[s.kycDot, { backgroundColor: kyc.color }]} />
            </View>

            <View style={s.identityInfo}>
              <Text style={s.profileName} numberOfLines={1}>
                {profile?.full_name || 'Set your name'}
              </Text>
              <Text style={s.profilePhone}>{profile?.phone_number}</Text>
              <TouchableOpacity
                style={[s.kycBadge, { backgroundColor: kyc.bg, borderColor: kyc.color + '40' }]}
                onPress={() => navigation.navigate('KYC')}
                activeOpacity={0.8}
              >
                <KycIcon size={11} color={kyc.color} />
                <Text style={[s.kycBadgeText, { color: kyc.color }]}>KYC: {kyc.label}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={s.editAvatarBtn}
              onPress={() => setEditMode(v => !v)}
              activeOpacity={0.8}
            >
              {editMode
                ? <X size={16} color="rgba(255,255,255,0.8)" />
                : <Pencil size={16} color="rgba(255,255,255,0.8)" />
              }
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.content}>

          {/* ── KYC banner (non-verified only) ── */}
          {kycKey !== 'verified' && (
            <TouchableOpacity
              style={[s.kycBanner, { borderLeftColor: kyc.color }]}
              onPress={() => navigation.navigate('KYC')}
              activeOpacity={0.88}
            >
              <View style={[s.kycBannerIcon, { backgroundColor: kyc.bg }]}>
                <KycIcon size={18} color={kyc.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.kycBannerTitle, { color: kyc.color }]}>
                  {kycKey === 'rejected'     ? 'Verification failed — resubmit'
                    : kycKey === 'pending'   ? 'Complete identity verification'
                    : 'Verification in progress'}
                </Text>
                <Text style={s.kycBannerSub}>
                  {kycKey === 'rejected'     ? 'Your submission was rejected. Tap to try again.'
                    : kycKey === 'pending'   ? 'Submit your ID to unlock higher limits.'
                    : "We're reviewing your documents. Sit tight!"}
                </Text>
              </View>
              <ChevronRight size={16} color="#D1D5DB" />
            </TouchableOpacity>
          )}

          {/* ── Personal info card ── */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Personal Info</Text>
              {!editMode
                ? <TouchableOpacity onPress={() => setEditMode(true)} style={s.editBtn} activeOpacity={0.8}>
                    <Pencil size={13} color={TEAL} />
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                : <TouchableOpacity onPress={() => setEditMode(false)} style={s.cancelBtn} activeOpacity={0.8}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
              }
            </View>

            {editMode ? (
              <View style={s.editForm}>
                <View style={s.inputWrap}>
                  <User size={16} color="#9CA3AF" style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholderTextColor="#C4C9D4"
                  />
                </View>
                <View style={s.inputWrap}>
                  <Mail size={16} color="#9CA3AF" style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    placeholder="Email address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    placeholderTextColor="#C4C9D4"
                  />
                </View>
                <TouchableOpacity
                  style={[s.saveBtn, loading && { opacity: 0.7 }]}
                  onPress={save}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <Spinner size="sm" color="#fff" />
                    : <>
                        <Check size={16} color="#fff" />
                        <Text style={s.saveBtnText}>Save Changes</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.infoList}>
                <InfoRow icon={Phone} label="Phone number" value={profile?.phone_number || '—'} />
                <View style={s.rowDivider} />
                <InfoRow icon={Mail}  label="Email address" value={profile?.email || '—'} />
              </View>
            )}
          </View>

          {/* ── Navigation menu ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Settings</Text>
            <View style={{ marginTop: 14, gap: 0 }}>
              <MenuRow
                icon={KycIcon} iconBg={kyc.bg} iconColor={kyc.color}
                title="Identity Verification"
                sub={`KYC: ${kyc.label}`}
                onPress={() => navigation.navigate('KYC')}
              />
              <View style={s.menuDivider} />
              <MenuRow
                icon={Users} iconBg="#EEF2FF" iconColor="#6366F1"
                title="Recipients"
                sub="Manage saved contacts"
                onPress={() => navigation.navigate('Recipients')}
              />
              {profile?.user_type === 'sender' && (
                <>
                  <View style={s.menuDivider} />
                  <MenuRow
                    icon={CreditCard} iconBg={TEAL_LIGHT} iconColor={TEAL}
                    title="Payment Methods"
                    sub="Cards, bank & wallets"
                    onPress={() => navigation.navigate('PaymentMethods')}
                  />
                </>
              )}
              <View style={s.menuDivider} />
              <MenuRow
                icon={Shield} iconBg="#EEF2FF" iconColor="#6366F1"
                title="Security"
                sub="PIN & biometrics"
              />
              <View style={s.menuDivider} />
              <MenuRow
                icon={Smartphone} iconBg="#EFF6FF" iconColor="#3B82F6"
                title="Device Manager"
                sub="Trusted devices"
                onPress={() => navigation.navigate('DeviceManager')}
              />
            </View>
          </View>

          {/* ── Sign out ── */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <View style={s.logoutIconWrap}>
              <LogOut size={17} color="#EF4444" />
            </View>
            <Text style={s.logoutText}>Sign Out</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <Icon size={16} color="#9CA3AF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    </View>
  )
}

function MenuRow({ icon: Icon, iconBg, iconColor, title, sub, onPress }) {
  return (
    <TouchableOpacity
      style={s.menuRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      <View style={[s.menuIconWrap, { backgroundColor: iconBg }]}>
        <Icon size={17} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.menuTitle}>{title}</Text>
        <Text style={s.menuSub}>{sub}</Text>
      </View>
      {onPress && <ChevronRight size={16} color="#D1D5DB" />}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F9' },

  // ── Header band ──────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerTop: { paddingTop: 16, marginBottom: 24 },
  headerSub:   { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },

  identityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  avatarWrap: {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  kycDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: NAVY,
  },

  identityInfo:  { flex: 1 },
  profileName:   { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 3 },
  profilePhone:  { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 },
  kycBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  kycBadgeText: { fontSize: 11, fontWeight: '700' },

  editAvatarBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  content: { padding: 16, gap: 12 },

  // ── KYC banner ───────────────────────────────────────────────────────────────
  kycBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16, padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3,
  },
  kycBannerIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  kycBannerTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  kycBannerSub:   { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  // ── Cards ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111' },

  editBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: TEAL_LIGHT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: TEAL_BORDER },
  editBtnText:  { fontSize: 13, fontWeight: '700', color: TEAL },
  cancelBtn:    { paddingHorizontal: 10, paddingVertical: 6 },
  cancelBtnText:{ fontSize: 13, color: '#9CA3AF', fontWeight: '600' },

  // Edit form
  editForm: { gap: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  inputIcon: {},
  input: { flex: 1, fontSize: 15, color: '#111', paddingVertical: 0 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: TEAL,
    borderRadius: 14, paddingVertical: 14,
    marginTop: 4,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Info rows
  infoList: { gap: 0 },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: '#F4F6F9',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 3 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowDivider:{ height: 1, backgroundColor: '#F3F4F6' },

  // Menu rows
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13,
  },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  menuTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 2 },
  menuSub:   { fontSize: 12, color: '#9CA3AF' },
  menuDivider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 54 },

  // Sign out
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18, paddingVertical: 16,
    borderWidth: 1.5, borderColor: '#FEE2E2',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  logoutIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
})
