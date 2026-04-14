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
  ShieldCheck, ShieldX, Clock, ChevronRight, CreditCard, Smartphone,
} from 'lucide-react-native'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const KYC_CONFIG = {
  verified:     { Icon: ShieldCheck, label: 'Verified',     color: '#16A34A', bg: '#F0FDF4' },
  pending:      { Icon: Clock,       label: 'Pending',      color: '#CA8A04', bg: '#FEFCE8' },
  under_review: { Icon: Clock,       label: 'Under Review', color: '#2563EB', bg: '#EFF6FF' },
  rejected:     { Icon: ShieldX,     label: 'Rejected',     color: '#DC2626', bg: '#FEF2F2' },
}

export default function ProfileScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user, logout, refreshProfile } = useAuth()
  const [profile, setProfile] = useState(user)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')

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
    } catch { Toast.show({ type: 'error', text1: 'Update failed' }) }
    finally { setLoading(false) }
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  const kycKey = profile?.kyc_status || 'pending'
  const kyc = KYC_CONFIG[kycKey] || KYC_CONFIG.pending
  const KycIcon = kyc.Icon

  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <Text style={s.title}>Profile</Text>
      </View>

      {/* Avatar + KYC */}
      <View style={[s.card, s.px]}>
        <View style={s.avatarRow}>
          <View style={s.avatar}>
            <User size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{profile?.full_name || 'Set your name'}</Text>
            <Text style={s.profilePhone}>{profile?.phone_number}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('KYC')}>
              <View style={[s.kycBadge, { backgroundColor: kyc.bg }]}>
                <KycIcon size={11} color={kyc.color} />
                <Text style={[s.kycText, { color: kyc.color }]}>KYC: {kyc.label}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* KYC banner */}
      {kycKey !== 'verified' && (
        <TouchableOpacity style={[s.kycBanner, s.px, { borderColor: kyc.color + '40' }]} onPress={() => navigation.navigate('KYC')}>
          <KycIcon size={20} color={kyc.color} />
          <View style={{ flex: 1 }}>
            <Text style={[s.kycBannerTitle, { color: kyc.color }]}>
              {kycKey === 'rejected' ? 'Verification failed — try again'
                : kycKey === 'pending' ? 'Complete identity verification'
                : 'Verification in progress'}
            </Text>
            <Text style={s.kycBannerSub}>
              {kycKey === 'rejected' ? 'Your submission was rejected. Tap to resubmit.'
                : kycKey === 'pending' ? 'Submit your ID to unlock higher limits.'
                : "We're reviewing your documents."}
            </Text>
          </View>
          <ChevronRight size={16} color="#D1D5DB" />
        </TouchableOpacity>
      )}

      {/* Edit info */}
      <View style={[s.card, s.px]}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Personal Info</Text>
          {!editMode
            ? <TouchableOpacity onPress={() => setEditMode(true)}><Text style={s.editLink}>Edit</Text></TouchableOpacity>
            : <TouchableOpacity onPress={() => setEditMode(false)}><Text style={s.cancelLink}>Cancel</Text></TouchableOpacity>
          }
        </View>
        {editMode ? (
          <View style={{ gap: 10 }}>
            <TextInput style={s.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} placeholderTextColor="#9CA3AF" />
            <TextInput style={s.input} placeholder="Email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={save} disabled={loading}>
              {loading ? <Spinner size="sm" color="#fff" /> : <Text style={s.btnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <InfoRow icon={Phone} label="Phone" value={profile?.phone_number} />
            <InfoRow icon={Mail}  label="Email" value={profile?.email || '—'} />
          </View>
        )}
      </View>

      {/* Nav rows */}
      <View style={[s.card, s.px]}>
        <NavRow icon={KycIcon} iconBg={kyc.bg} iconColor={kyc.color} title="Identity Verification" sub={`KYC status: ${kyc.label}`} onPress={() => navigation.navigate('KYC')} />
        <View style={s.divider} />
        <NavRow icon={Users} iconBg="#EEF2FF" iconColor="#4F46E5" title="Recipients" sub="Saved contacts" onPress={() => navigation.navigate('Recipients')} />
        {profile?.user_type === 'sender' && (
          <>
            <View style={s.divider} />
            <NavRow icon={CreditCard} iconBg="#F0FDF4" iconColor="#16A34A" title="Payment Methods" sub="Cards, bank & digital wallets" onPress={() => navigation.navigate('PaymentMethods')} />
          </>
        )}
        <View style={s.divider} />
        <NavRow icon={Shield} iconBg="#EEF2FF" iconColor="#4F46E5" title="Security" sub="PIN & biometrics" />
        <View style={s.divider} />
        <NavRow icon={Smartphone} iconBg="#EFF6FF" iconColor="#2563EB" title="Device Manager" sub="Manage trusted devices" onPress={() => navigation.navigate('DeviceManager')} />
      </View>

      {/* Logout */}
      <View style={s.px}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <LogOut size={16} color="#EF4444" />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

function NavRow({ icon: Icon, iconBg = '#EEF2FF', iconColor = '#4F46E5', title, sub, onPress }) {
  return (
    <TouchableOpacity style={s.navRow} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <View style={[s.navIcon, { backgroundColor: iconBg }]}>
        <Icon size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.navTitle}>{title}</Text>
        <Text style={s.navSub}>{sub}</Text>
      </View>
      {onPress && <ChevronRight size={16} color="#D1D5DB" />}
    </TouchableOpacity>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon size={15} color="#9CA3AF" />
      <View>
        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#1F2937' }}>{value}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F9FAFB' },
  topBar:        { paddingHorizontal: 20, paddingVertical: 16 },
  title:         { fontSize: 22, fontWeight: '700', color: '#111827' },
  px:            { paddingHorizontal: 20, marginBottom: 12 },
  card:          { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  avatarRow:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar:        { width: 64, height: 64, backgroundColor: '#4F46E5', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileName:   { fontSize: 16, fontWeight: '700', color: '#111827' },
  profilePhone:  { fontSize: 14, color: '#6B7280', marginTop: 2 },
  kycBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6 },
  kycText:       { fontSize: 11, fontWeight: '600' },
  kycBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1 },
  kycBannerTitle:{ fontSize: 13, fontWeight: '700' },
  kycBannerSub:  { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: '#111827' },
  editLink:      { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  cancelLink:    { fontSize: 13, color: '#9CA3AF' },
  input:         { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827' },
  btn:           { backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnDisabled:   { opacity: 0.7 },
  btnText:       { color: '#fff', fontSize: 15, fontWeight: '700' },
  navRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  navIcon:       { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navTitle:      { fontSize: 14, fontWeight: '700', color: '#111827' },
  navSub:        { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  divider:       { height: 1, backgroundColor: '#F9FAFB', marginVertical: 2 },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#FEE2E2' },
  logoutText:    { fontSize: 14, fontWeight: '700', color: '#EF4444' },
})
