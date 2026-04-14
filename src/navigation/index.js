import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, View } from 'react-native'
import { Home, ArrowLeftRight, TrendingUp, Bell, User } from 'lucide-react-native'

import { useAuth } from '../context/AuthContext'

// Auth screens
import LoginScreen        from '../screens/LoginScreen'
import RegisterScreen     from '../screens/RegisterScreen'
import VerifyOTPScreen    from '../screens/VerifyOTPScreen'
import SetPINScreen       from '../screens/SetPINScreen'

// Main tab screens
import DashboardScreen    from '../screens/DashboardScreen'
import TransactionsScreen from '../screens/TransactionsScreen'
import ExchangeScreen     from '../screens/ExchangeScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import ProfileScreen      from '../screens/ProfileScreen'

// Stack screens (within authenticated flow)
import SendMoneyScreen    from '../screens/SendMoneyScreen'
import RequestMoneyScreen from '../screens/RequestMoneyScreen'
import CashScreen         from '../screens/CashScreen'
import QRScreen           from '../screens/QRScreen'
import RecipientsScreen   from '../screens/RecipientsScreen'
import KYCScreen          from '../screens/KYCScreen'
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen'
import DeviceManagerScreen  from '../screens/DeviceManagerScreen'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

const INDIGO = '#4F46E5'
const GRAY   = '#9CA3AF'

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: INDIGO,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#F3F4F6',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen}
        options={{ tabBarLabel: 'History', tabBarIcon: ({ color, size }) => <ArrowLeftRight size={size} color={color} /> }} />
      <Tab.Screen name="Exchange" component={ExchangeScreen}
        options={{ tabBarLabel: 'Exchange', tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} /> }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen}
        options={{ tabBarLabel: 'Alerts', tabBarIcon: ({ color, size }) => <Bell size={size} color={color} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tab.Navigator>
  )
}

export default function RootNavigator() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={INDIGO} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login"     component={LoginScreen} />
            <Stack.Screen name="Register"  component={RegisterScreen} />
            <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
            <Stack.Screen name="SetPIN"    component={SetPINScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main"           component={MainTabs} />
            <Stack.Screen name="SendMoney"      component={SendMoneyScreen} />
            <Stack.Screen name="RequestMoney"   component={RequestMoneyScreen} />
            <Stack.Screen name="CashIn"         component={CashScreen} initialParams={{ type: 'in' }} />
            <Stack.Screen name="CashOut"        component={CashScreen} initialParams={{ type: 'out' }} />
            <Stack.Screen name="QR"             component={QRScreen} />
            <Stack.Screen name="Recipients"     component={RecipientsScreen} />
            <Stack.Screen name="KYC"            component={KYCScreen} />
            <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <Stack.Screen name="DeviceManager"  component={DeviceManagerScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
