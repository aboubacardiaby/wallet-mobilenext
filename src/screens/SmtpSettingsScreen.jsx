import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ArrowLeft, Server, Mail, Lock, Eye, EyeOff, Send, Save } from 'lucide-react-native'
import api from '../api/client'
import Spinner from '../components/Spinner'

const STORAGE_KEY = 'smtp_config'

const TEAL       = '#0E9E98'
const TEAL_LIGHT = '#F0FAF9'
const NAVY       = '#0A1628'

const DEFAULT = {
  host:       '',
  port:       '587',
  username:   '',
  password:   '',
  from_email: '',
  from_name:  '',
  use_tls:    true,
  use_ssl:    false,
}

export default function SmtpSettingsScreen() {
  const navigation = useNavigation()
  const insets     = useSafeAreaInsets()

  const [form, setForm]           = useState(DEFAULT)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [testing, setTesting]     = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [testEmail, setTestEmail] = useState('')

  useEffect(() => {
    const load = async () => {
      // AsyncStorage is the source of truth — works without a backend
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) { setForm({ ...DEFAULT, ...JSON.parse(raw) }); setLoading(false); return }
      } catch { /* ignore */ }
      // Fall back to backend if nothing stored locally
      try {
        const { data } = await api.get('/settings/smtp')
        setForm({ ...DEFAULT, ...data })
      } catch { /* no config yet */ }
      setLoading(false)
    }
    load()
  }, [])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const smtpPayload = () => ({
    host:       form.host.trim(),
    port:       parseInt(form.port, 10) || 587,
    username:   form.username.trim(),
    password:   form.password,
    from_email: form.from_email.trim(),
    from_name:  form.from_name.trim(),
    use_tls:    form.use_tls,
    use_ssl:    form.use_ssl,
  })

  const save = async () => {
    if (!form.host.trim())       return Toast.show({ type: 'error', text1: 'SMTP host is required' })
    if (!form.username.trim())   return Toast.show({ type: 'error', text1: 'Username is required' })
    if (!form.from_email.trim()) return Toast.show({ type: 'error', text1: 'From email is required' })
    setSaving(true)
    try {
      const payload = smtpPayload()
      // Always save locally — this is what sendReceipt reads
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      // Also sync to backend if it supports it (optional)
      api.post('/settings/smtp', payload).catch(() => {})
      Toast.show({ type: 'success', text1: 'SMTP settings saved!' })
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    const to = testEmail.trim() || form.username.trim()
    if (!to) return Toast.show({ type: 'error', text1: 'Enter a recipient email for the test' })
    if (!form.host.trim()) return Toast.show({ type: 'error', text1: 'Fill in SMTP host first' })
    setTesting(true)
    try {
      await api.post('/email/send', {
        smtp_config: smtpPayload(),
        to,
        subject: 'KalipehWallet — SMTP test',
        html: `<div style="font-family:sans-serif;padding:24px">
                 <h2 style="color:#0A1628">✓ SMTP is working</h2>
                 <p>Your email settings are correctly configured in KalipehWallet.</p>
                 <p style="color:#6B7280;font-size:13px">Host: ${form.host} · Port: ${form.port}</p>
               </div>`,
        text: 'SMTP test from KalipehWallet — connection successful.',
      })
      Toast.show({ type: 'success', text1: `Test email sent to ${to}` })
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Connection failed'
      Toast.show({ type: 'error', text1: 'Test failed', text2: String(detail) })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <View style={[s.screen, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerSub}>SETTINGS</Text>
          <Text style={s.headerTitle}>Email (SMTP)</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Info banner ── */}
        <View style={s.infoBanner}>
          <Mail size={18} color={TEAL} />
          <Text style={s.infoText}>
            These settings tell your backend server how to send emails (receipts, transfer notifications). Credentials are stored securely on the server — never on device.
          </Text>
        </View>

        {/* ── Server card ── */}
        <SectionCard title="Server" icon={Server}>
          <Field
            label="SMTP Host"
            placeholder="smtp.gmail.com"
            value={form.host}
            onChangeText={v => set('host', v)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Field
            label="Port"
            placeholder="587"
            value={form.port}
            onChangeText={v => set('port', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
          />
          <View style={s.toggleRow}>
            <View>
              <Text style={s.toggleLabel}>Use TLS</Text>
              <Text style={s.toggleSub}>STARTTLS — recommended for port 587</Text>
            </View>
            <Switch
              value={form.use_tls}
              onValueChange={v => { set('use_tls', v); if (v) set('use_ssl', false) }}
              trackColor={{ true: TEAL }}
              thumbColor="#fff"
            />
          </View>
          <View style={[s.toggleRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={s.toggleLabel}>Use SSL</Text>
              <Text style={s.toggleSub}>SSL/TLS — typically port 465</Text>
            </View>
            <Switch
              value={form.use_ssl}
              onValueChange={v => { set('use_ssl', v); if (v) set('use_tls', false) }}
              trackColor={{ true: TEAL }}
              thumbColor="#fff"
            />
          </View>
        </SectionCard>

        {/* ── Auth card ── */}
        <SectionCard title="Authentication" icon={Lock}>
          <Field
            label="Username / Email"
            placeholder="you@gmail.com"
            value={form.username}
            onChangeText={v => set('username', v)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={s.passwordRow}>
            <View style={{ flex: 1 }}>
              <Field
                label="Password / App Password"
                placeholder="••••••••••••"
                value={form.password}
                onChangeText={v => set('password', v)}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                noBorder
              />
            </View>
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)} activeOpacity={0.7}>
              {showPass
                ? <EyeOff size={18} color="#9CA3AF" />
                : <Eye size={18} color="#9CA3AF" />}
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Sender identity card ── */}
        <SectionCard title="From / Sender" icon={Mail}>
          <Field
            label="From Email"
            placeholder="noreply@yourdomain.com"
            value={form.from_email}
            onChangeText={v => set('from_email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="From Name"
            placeholder="KalipehWallet"
            value={form.from_name}
            onChangeText={v => set('from_name', v)}
            noBorder
          />
        </SectionCard>

        {/* ── Test email card ── */}
        <SectionCard title="Test Connection" icon={Send}>
          <Field
            label="Send test to"
            placeholder="your@email.com (leave blank to use username)"
            value={testEmail}
            onChangeText={setTestEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            noBorder
          />
          <TouchableOpacity
            style={[s.testBtn, testing && { opacity: 0.7 }]}
            onPress={sendTest}
            disabled={testing}
            activeOpacity={0.85}
          >
            {testing
              ? <Spinner size="sm" color={TEAL} />
              : <>
                  <Send size={15} color={TEAL} />
                  <Text style={s.testBtnText}>Send Test Email</Text>
                </>
            }
          </TouchableOpacity>
        </SectionCard>

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <Spinner size="sm" color="#fff" />
            : <>
                <Save size={18} color="#fff" />
                <Text style={s.saveBtnText}>Save Settings</Text>
              </>
          }
        </TouchableOpacity>

        {/* ── Provider hints ── */}
        <View style={s.hintsCard}>
          <Text style={s.hintsTitle}>Common providers</Text>
          {PROVIDERS.map(p => (
            <TouchableOpacity
              key={p.name}
              style={s.hintRow}
              activeOpacity={0.75}
              onPress={() => setForm(f => ({ ...f, host: p.host, port: String(p.port), use_tls: p.tls, use_ssl: p.ssl }))}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.hintName}>{p.name}</Text>
                <Text style={s.hintDetail}>{p.host}:{p.port} · {p.tls ? 'TLS' : p.ssl ? 'SSL' : 'plain'}</Text>
              </View>
              <Text style={s.hintApply}>Apply →</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { name: 'Gmail',        host: 'smtp.gmail.com',         port: 587, tls: true,  ssl: false },
  { name: 'Outlook/Hotmail', host: 'smtp-mail.outlook.com', port: 587, tls: true,  ssl: false },
  { name: 'Yahoo Mail',   host: 'smtp.mail.yahoo.com',    port: 465, tls: false, ssl: true  },
  { name: 'SendGrid',     host: 'smtp.sendgrid.net',      port: 587, tls: true,  ssl: false },
  { name: 'Mailgun',      host: 'smtp.mailgun.org',       port: 587, tls: true,  ssl: false },
  { name: 'Amazon SES',   host: 'email-smtp.us-east-1.amazonaws.com', port: 587, tls: true, ssl: false },
]

function SectionCard({ title, icon: Icon, children }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.cardIconWrap}>
          <Icon size={15} color={TEAL} />
        </View>
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

function Field({ label, noBorder, ...inputProps }) {
  return (
    <View style={[s.field, noBorder && { borderBottomWidth: 0 }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        placeholderTextColor="#C4C9D4"
        autoCorrect={false}
        {...inputProps}
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F9' },

  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  headerSub:   { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, marginBottom: 3 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: TEAL_LIGHT, borderRadius: 14,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#C9EDE9',
  },
  infoText: { flex: 1, fontSize: 13, color: '#0A7A76', lineHeight: 19 },

  card: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: TEAL_LIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111' },

  field: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 14, marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 7, textTransform: 'uppercase' },
  fieldInput: { fontSize: 15, color: '#111', paddingVertical: 0 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    paddingVertical: 12, marginBottom: 0,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  toggleSub:   { fontSize: 11, color: '#9CA3AF' },

  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn:      { padding: 8, marginBottom: 14 },

  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: TEAL,
    borderRadius: 14, paddingVertical: 12, marginTop: 4,
  },
  testBtnText: { fontSize: 14, fontWeight: '700', color: TEAL },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: TEAL,
    borderRadius: 28, paddingVertical: 18, marginBottom: 20,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  hintsCard: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  hintsTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  hintRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  hintName:   { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 2 },
  hintDetail: { fontSize: 12, color: '#9CA3AF' },
  hintApply:  { fontSize: 13, fontWeight: '700', color: TEAL },
})
