import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

// Fetch and manage the current user's wallet balance and recent transactions.
export default function useWalletBalance() {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [balanceRes, txRes] = await Promise.all([
        api.get('wallet/balance'),
        api.get('wallet/transactions?page=1&limit=5'),
      ])
      setWallet(balanceRes.data)
      setTransactions(txRes.data.transactions || [])
    } catch (err) {
      console.warn('Failed to load wallet:', err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { wallet, setWallet, transactions, setTransactions, loading, refresh }
}
