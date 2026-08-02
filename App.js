import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StripeProvider } from '@stripe/stripe-react-native'
import Toast from 'react-native-toast-message'
import { AuthProvider } from './src/context/AuthContext'
import { ThemeProvider } from './src/context/ThemeContext'
import RootNavigator from './src/navigation'

export default function App() {
  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}>
        <AuthProvider>
          <ThemeProvider>
            <RootNavigator />
            <StatusBar style="auto" />
            <Toast />
          </ThemeProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  )
}
