import { useMemo } from 'react'
import { getDeviceCurrency } from '../data/currencies'

// Returns the sender currency inferred from the device locale.
// Only recalculates if the component is unmounted/remounted (locale is static).
export default function useDeviceCurrency() {
  return useMemo(getDeviceCurrency, [])
}
