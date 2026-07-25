
import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.0.72:8080/api/v1/',
  headers: { 'Content-Type': 'application/json' },
})

let onUnauthorized = null
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const hadToken = !!err.config?.headers?.Authorization
    if (err.response?.status === 401 && hadToken) {
      await AsyncStorage.multiRemove(['token', 'user'])
      onUnauthorized?.()
    }
    return Promise.reject(err)
  }
)

export default api
