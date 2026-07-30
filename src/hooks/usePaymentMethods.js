import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

// Fetch and manage the current user's saved payment methods.
export default function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('payment-methods')
      setPaymentMethods(data.payment_methods || [])
    } catch (err) {
      console.warn('Failed to load payment methods:', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { paymentMethods, setPaymentMethods, loading, refresh }
}
