import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Send, ShieldCheck, TrendingUp } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width: SCREEN_W } = Dimensions.get('window')
const TEAL = '#0E9E98'

const SLIDES = [
  {
    icon: (color) => <Send size={64} color={color} />,
    title: 'Send money home',
    body: 'Transfer money to friends and family across Africa in under a minute.',
  },
  {
    icon: (color) => <ShieldCheck size={64} color={color} />,
    title: 'Secure by design',
    body: 'Every transfer is protected by PIN and bank-grade encryption.',
  },
  {
    icon: (color) => <TrendingUp size={64} color={color} />,
    title: 'Track it all',
    body: 'Watch live rates and follow every transaction from send to delivery.',
  },
]

export default function OnboardingScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [active, setActive] = useState(0)
  const scrollRef = useRef(null)

  const onScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x
    const index = Math.round(x / SCREEN_W)
    if (index !== active) setActive(index)
  }

  const finish = async () => {
    await AsyncStorage.setItem('has_seen_onboarding', '1')
    navigation.replace('Login')
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[s.slide, { width: SCREEN_W }]}>
            <View style={s.iconWrap}>
              {slide.icon(TEAL)}
            </View>
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === active && s.dotActive]} />
        ))}
      </View>

      <TouchableOpacity
        style={s.btn}
        onPress={finish}
        activeOpacity={0.9}
      >
        <Text style={s.btnText}>{active === SLIDES.length - 1 ? 'Get Started' : 'Skip'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36 },
  iconWrap: { width: 120, height: 120, borderRadius: 40, backgroundColor: '#F0FAF9', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 12, textAlign: 'center' },
  body:  { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  dots:  { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: TEAL, width: 20 },
  btn:   { backgroundColor: TEAL, borderRadius: 32, paddingVertical: 18, alignItems: 'center', marginHorizontal: 24, marginBottom: 8 },
  btnText:{ fontSize: 17, fontWeight: '700', color: '#fff' },
})
