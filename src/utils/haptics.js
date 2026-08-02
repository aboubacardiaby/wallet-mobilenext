import { Vibration, Platform } from 'react-native'

export const Haptics = {
  light: () => {
    if (Platform.OS === 'web') return
    Vibration.vibrate(15)
  },
  success: () => {
    if (Platform.OS === 'web') return
    Vibration.vibrate(25)
  },
  error: () => {
    if (Platform.OS === 'web') return
    Vibration.vibrate([0, 40, 60, 40])
  },
}
