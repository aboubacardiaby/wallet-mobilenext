import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

// Fetch and manage the current user's saved recipients.
export default function useRecipients() {
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('user/recipients')
      setRecipients(data.recipients || [])
    } catch (err) {
      console.warn('Failed to load recipients:', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { recipients, setRecipients, loading, refresh }
}
