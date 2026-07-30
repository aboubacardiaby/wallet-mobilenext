import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

// Debounced transfer quote lookup.
// Pass null/empty values to clear the quote without an API call.
export default function useTransferQuote(phone, amount, sendCcy, recvCcy) {
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const amt = parseFloat(amount)
    if (!phone || !amount || amt <= 0 || !sendCcy || !recvCcy) {
      setQuote(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data } = await api.get(
        `transfer/quote?to_phone=${encodeURIComponent(phone)}&amount=${amount}&send_currency=${sendCcy}&recv_currency=${recvCcy}`
      )
      setQuote(data)
    } catch (err) {
      console.warn('Quote failed:', err.message)
      setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [phone, amount, sendCcy, recvCcy])

  useEffect(() => {
    const t = setTimeout(refresh, 600)
    return () => clearTimeout(t)
  }, [refresh])

  return { quote, loading, refresh }
}
