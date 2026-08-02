import { createContext, useContext, useState, useEffect } from 'react'
import { useColorScheme, Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
})

export const themes = {
  light: {
    background: '#F9FAFB',
    surface: '#FFFFFF',
    text: '#111827',
    sub: '#6B7280',
    muted: '#9CA3AF',
    border: '#E5E7EB',
    primary: '#0E9E98',
  },
  dark: {
    background: '#0A1628',
    surface: '#111827',
    text: '#F9FAFB',
    sub: '#9CA3AF',
    muted: '#6B7280',
    border: '#1F2937',
    primary: '#2DD4BF',
  },
}

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme()
  const [theme, setTheme] = useState('light')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then(saved => {
      const next = saved || systemScheme || 'light'
      setTheme(next)
      setLoading(false)
    })
  }, [systemScheme])

  const apply = async (next) => {
    setTheme(next)
    Appearance.setColorScheme(next)
    await AsyncStorage.setItem('app_theme', next)
  }

  const toggleTheme = () => apply(theme === 'light' ? 'dark' : 'light')

  if (loading) return children

  return (
    <ThemeContext.Provider value={{ theme, setTheme: apply, toggleTheme, isDark: theme === 'dark', colors: themes[theme] }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
