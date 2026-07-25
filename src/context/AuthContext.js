import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import api, { setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restore = async () => {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet(['token', 'user'])
        if (storedToken[1]) setToken(storedToken[1])
        if (storedUser[1]) setUser(JSON.parse(storedUser[1]))
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    restore()
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setUser(null)
      Toast.show({ type: 'error', text1: 'Session expired', text2: 'Please sign in again.' })
    })
  }, [])

  const saveSession = useCallback(async (newToken, newUser) => {
    await AsyncStorage.multiSet([
      ['token', newToken],
      ['user', JSON.stringify(newUser)],
    ])
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'user'])
    setToken(null)
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await api.get('user/profile')
      const updated = data.user
      await AsyncStorage.setItem('user', JSON.stringify(updated))
      setUser(updated)
      return updated
    } catch { /* ignore */ }
  }, [])

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      saveSession, logout, refreshProfile,
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
