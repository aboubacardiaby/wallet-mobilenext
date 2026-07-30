import { useState, useEffect } from 'react'
import api from '../api/client'
import REGIONS_FALLBACK from '../data/regions'

const cache = new Map()

// Fetches the region/state/province list for a given ISO country code,
// cached per code. Returns an empty list for countries with no structured
// data (e.g. no seeded regions) so callers can fall back to free text.
export default function useRegions(countryCode) {
  const [regions, setRegions] = useState(() =>
    countryCode ? cache.get(countryCode) || REGIONS_FALLBACK[countryCode] || [] : []
  )
  const [loading, setLoading] = useState(!!countryCode && !cache.has(countryCode))

  useEffect(() => {
    if (!countryCode) { setRegions([]); return }

    const fallback = REGIONS_FALLBACK[countryCode] || []
    if (cache.has(countryCode)) {
      setRegions(cache.get(countryCode))
      return
    }
    setRegions(fallback)
    setLoading(true)
    api.get(`regions?country_code=${countryCode}`)
      .then(({ data }) => {
        cache.set(countryCode, data.regions || [])
        setRegions(data.regions || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [countryCode])

  return { regions, loading }
}
