import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import * as ImagePicker from 'expo-image-picker'
import {
  ArrowLeft, ShieldCheck, ShieldX, Clock, CheckCircle,
  ChevronRight, ChevronLeft, User, CreditCard, Camera, Upload,
} from 'lucide-react-native'
import api from '../api/client'
import COUNTRIES from '../data/countries'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const ID_TYPES = [
  { value: 'national_id',     label: 'National ID Card' },
  { value: 'passport',        label: 'Passport' },
  { value: 'drivers_license', label: "Driver's Licence" },
  { value: 'residence_permit',label: 'Residence Permit' },
]
const STEPS = ['Personal Info', 'Document', 'Photos', 'Review']

export default function KYCScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user, refreshProfile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [kycData, setKycData] = useState(null)
  const [step, setStep] = useState(0)

  const [form, setForm] = useState({
    full_name: user?.full_name || '', date_of_birth: '',
    nationality: COUNTRIES[0].name, address: '', city: '', country: COUNTRIES[0].name,
    id_type: 'national_id', id_number: '', id_expiry: '',
    id_front_url: '', id_back_url: '', selfie_url: '',
  })

  // Pre-fill from profile
  useEffect(() => {
    if (user) setForm(f => ({
      ...f,
      full_name: user.full_name || f.full_name,
      address: user.street || f.address,
      city: user.city || f.city,
      country: user.country || f.country,
    }))
  }, [user])

  useEffect(() => {
    api.get('/kyc/status')
      .then(({ data }) => setKycData(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setSubmitting(true)
    try {
      await api.post('/kyc/submit', form)
      Toast.show({ type: 'success', text1: "KYC submitted! We'll review it shortly." })
      await refreshProfile()
      navigation.goBack()
    } catch (err) {
      Toast.show({ type: 'error', text1: err.response?.data?.detail || 'Submission failed' })
    } finally { setSubmitting(false) }
  }

  const canNext = () => {
    if (step === 0) return form.full_name && form.date_of_birth && form.nationality && form.address && form.city && form.country
    if (step === 1) return form.id_type && form.id_number && form.id_expiry
    if (step === 2) return form.id_front_url && form.id_back_url && form.selfie_url
    return true
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#4F46E5" /></View>
  }

  const kycKey = kycData?.kyc_status
  if (kycKey === 'verified') return <StatusScreen status="verified" navigation={navigation} />
  if (kycKey === 'pending' && kycData.submission) return <StatusScreen status="pending" navigation={navigation} />
  if (kycKey === 'rejected') return (
    <StatusScreen status="rejected" reason={kycData.submission?.rejection_reason} navigation={navigation}
      onRetry={() => setKycData({ kyc_status: null, submission: null })} />
  )

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={s.title}>Identity Verification</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Step indicators */}
      <View style={s.stepRow}>
        {STEPS.map((label, i) => (
          <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.stepDot, i < step ? s.stepDotDone : i === step ? s.stepDotActive : s.stepDotInactive]}>
              {i < step ? <CheckCircle size={14} color="#fff" /> : <Text style={[s.stepNum, i === step ? { color: '#fff' } : {}]}>{i + 1}</Text>}
            </View>
            {i < STEPS.length - 1 && <View style={[s.stepLine, i < step ? s.stepLineDone : {}]} />}
          </View>
        ))}
      </View>
      <Text style={s.stepLabel}>{STEPS[step]}</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {step === 0 && <StepPersonal form={form} set={set} />}
        {step === 1 && <StepDocument form={form} set={set} />}
        {step === 2 && <StepPhotos form={form} set={set} />}
        {step === 3 && <StepReview form={form} />}
      </ScrollView>

      <View style={s.navRow}>
        {step > 0 && (
          <TouchableOpacity style={s.backNavBtn} onPress={() => setStep(s => s - 1)}>
            <ChevronLeft size={16} color="#374151" />
            <Text style={s.backNavText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < 3 ? (
          <TouchableOpacity style={[s.nextBtn, !canNext() && s.nextBtnDisabled, step === 0 && { flex: 1 }]} onPress={() => setStep(s => s + 1)} disabled={!canNext()}>
            <Text style={s.nextBtnText}>Next</Text>
            <ChevronRight size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.nextBtn, { flex: 1 }, submitting && s.nextBtnDisabled]} onPress={submit} disabled={submitting}>
            {submitting ? <Spinner size="sm" color="#fff" /> : <Text style={s.nextBtnText}>Submit for Verification</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function StepPersonal({ form, set }) {
  return (
    <View style={{ gap: 12 }}>
      <Field label="Full legal name *">
        <TextInput style={sF.input} placeholder="As on your ID document" placeholderTextColor="#9CA3AF" value={form.full_name} onChangeText={v => set('full_name', v)} />
      </Field>
      <Field label="Date of birth *">
        <TextInput style={sF.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={form.date_of_birth} onChangeText={v => set('date_of_birth', v)} />
      </Field>
      <Field label="Nationality *">
        <TextInput style={sF.input} placeholder="Country" placeholderTextColor="#9CA3AF" value={form.nationality} onChangeText={v => set('nationality', v)} />
      </Field>
      <Field label="Residential address *">
        <TextInput style={sF.input} placeholder="Street address" placeholderTextColor="#9CA3AF" value={form.address} onChangeText={v => set('address', v)} />
      </Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="City *">
            <TextInput style={sF.input} placeholder="City" placeholderTextColor="#9CA3AF" value={form.city} onChangeText={v => set('city', v)} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Country *">
            <TextInput style={sF.input} placeholder="Country" placeholderTextColor="#9CA3AF" value={form.country} onChangeText={v => set('country', v)} />
          </Field>
        </View>
      </View>
    </View>
  )
}

function StepDocument({ form, set }) {
  return (
    <View style={{ gap: 12 }}>
      <Field label="Document type *">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ID_TYPES.map(t => (
            <TouchableOpacity key={t.value} style={[sF.typeBtn, form.id_type === t.value && sF.typeBtnActive]} onPress={() => set('id_type', t.value)}>
              <Text style={[sF.typeBtnText, form.id_type === t.value && sF.typeBtnTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Field>
      <Field label="Document number *">
        <TextInput style={sF.input} placeholder="e.g. 1234567890" placeholderTextColor="#9CA3AF" value={form.id_number} onChangeText={v => set('id_number', v)} />
      </Field>
      <Field label="Expiry date *">
        <TextInput style={sF.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={form.id_expiry} onChangeText={v => set('id_expiry', v)} />
      </Field>
    </View>
  )
}

function StepPhotos({ form, set }) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Take clear, well-lit photos. All 4 corners must be visible.</Text>
      <PhotoUploader label="Front of document *" value={form.id_front_url} onChange={v => set('id_front_url', v)} hint="Place document on a dark surface" />
      <PhotoUploader label="Back of document *" value={form.id_back_url} onChange={v => set('id_back_url', v)} hint="Required for ID cards and licences" />
      <PhotoUploader label="Selfie holding document *" value={form.selfie_url} onChange={v => set('selfie_url', v)} hint="Hold document next to your face" selfie />
    </View>
  )
}

function StepReview({ form }) {
  const idLabel = ID_TYPES.find(t => t.value === form.id_type)?.label || form.id_type
  return (
    <View style={{ gap: 12 }}>
      <View style={sF.reviewCard}>
        <ReviewRow label="Full name" value={form.full_name} />
        <ReviewRow label="Date of birth" value={form.date_of_birth} />
        <ReviewRow label="Nationality" value={form.nationality} />
        <ReviewRow label="Address" value={`${form.address}, ${form.city}, ${form.country}`} />
      </View>
      <View style={sF.reviewCard}>
        <ReviewRow label="Document" value={idLabel} />
        <ReviewRow label="Number" value={form.id_number} />
        <ReviewRow label="Expiry" value={form.id_expiry} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[{ url: form.id_front_url, label: 'Front' }, { url: form.id_back_url, label: 'Back' }, { url: form.selfie_url, label: 'Selfie' }].map(({ url, label }) => (
          <View key={label} style={sF.thumb}>
            <View style={[sF.thumbInner, url && { backgroundColor: '#E5E7EB' }]}>
              {url ? <CheckCircle size={20} color="#16A34A" /> : <Upload size={20} color="#D1D5DB" />}
            </View>
            <Text style={sF.thumbLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>By submitting you confirm this information is accurate. Verification takes 1–2 business days.</Text>
    </View>
  )
}

function PhotoUploader({ label, value, onChange, hint, selfie }) {
  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Camera roll permission required' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      onChange('data:image/jpeg;base64,' + result.assets[0].base64)
    }
  }

  return (
    <View>
      <Text style={sF.photoLabel}>{label}</Text>
      <TouchableOpacity style={[sF.uploadBtn, value && sF.uploadBtnDone]} onPress={value ? () => onChange('') : pick}>
        {value ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={18} color="#16A34A" />
            <Text style={{ fontSize: 14, color: '#16A34A', fontWeight: '600' }}>Photo added — tap to remove</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Upload size={22} color="#9CA3AF" />
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280' }}>Tap to upload or take photo</Text>
            {hint && <Text style={{ fontSize: 11, color: '#D1D5DB' }}>{hint}</Text>}
          </View>
        )}
      </TouchableOpacity>
    </View>
  )
}

function StatusScreen({ status, reason, navigation, onRetry }) {
  const cfg = {
    verified: { Icon: ShieldCheck, color: '#16A34A', bg: '#DCFCE7', title: 'Identity Verified', sub: 'Your account is fully verified.' },
    pending:  { Icon: Clock,       color: '#CA8A04', bg: '#FEF9C3', title: 'Under Review',      sub: "We're reviewing your documents." },
    rejected: { Icon: ShieldX,     color: '#DC2626', bg: '#FEE2E2', title: 'Verification Failed', sub: 'Your submission was rejected.' },
  }[status]
  const Icon = cfg.Icon
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
      <View style={[s.statusIcon, { backgroundColor: cfg.bg }]}><Icon size={36} color={cfg.color} /></View>
      <Text style={s.statusTitle}>{cfg.title}</Text>
      <Text style={s.statusSub}>{cfg.sub}</Text>
      {reason && <View style={s.rejectedReason}><Text style={s.rejectedLabel}>Reason</Text><Text style={s.rejectedText}>{reason}</Text></View>}
      <View style={{ width: '100%', gap: 10, marginTop: 16 }}>
        {status === 'rejected' && onRetry && (
          <TouchableOpacity style={s.btnPrimary} onPress={onRetry}><Text style={s.btnPrimaryText}>Try Again</Text></TouchableOpacity>
        )}
        <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.goBack()}>
          <Text style={s.btnSecondaryText}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Field({ label, children }) {
  return (
    <View>
      <Text style={sF.label}>{label}</Text>
      {children}
    </View>
  )
}

function ReviewRow({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 8 }}>
      <Text style={{ fontSize: 13, color: '#9CA3AF', flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right', flex: 1 }}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F9FAFB' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn:    { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 16, fontWeight: '700', color: '#111827' },
  stepRow:    { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 4 },
  stepDot:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepDotDone:{ backgroundColor: '#4F46E5' },
  stepDotActive:{ backgroundColor: '#4F46E5' },
  stepDotInactive:{ backgroundColor: '#E5E7EB' },
  stepNum:    { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  stepLine:   { flex: 1, height: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginHorizontal: 4 },
  stepLineDone:{ backgroundColor: '#4F46E5' },
  stepLabel:  { fontSize: 12, color: '#9CA3AF', paddingHorizontal: 20, marginBottom: 12 },
  content:    { paddingHorizontal: 20, paddingBottom: 24 },
  navRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff' },
  backNavBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  backNavText:{ fontSize: 15, fontWeight: '600', color: '#374151' },
  nextBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: '#4F46E5' },
  nextBtnDisabled:{ opacity: 0.4 },
  nextBtnText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
  statusIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statusTitle:{ fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  statusSub:  { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6 },
  rejectedReason:{ backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12, width: '100%', marginTop: 12 },
  rejectedLabel: { fontSize: 12, fontWeight: '700', color: '#DC2626', marginBottom: 4 },
  rejectedText:  { fontSize: 13, color: '#B91C1C' },
  btnPrimary: { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSecondary:{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText:{ fontSize: 15, fontWeight: '600', color: '#374151' },
})

const sF = StyleSheet.create({
  label:     { fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  input:     { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  typeBtn:   { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB' },
  typeBtnActive:{ borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  typeBtnText:  { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  typeBtnTextActive:{ color: '#4338CA' },
  reviewCard:{ backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 2 },
  thumb:     { flex: 1, alignItems: 'center', gap: 4 },
  thumbInner:{ width: '100%', aspectRatio: 1.5, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  thumbLabel:{ fontSize: 11, color: '#6B7280' },
  photoLabel:{ fontSize: 12, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  uploadBtn: { borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 14, padding: 20, alignItems: 'center' },
  uploadBtnDone:{ borderColor: '#86EFAC', backgroundColor: '#F0FDF4', borderStyle: 'solid' },
})
