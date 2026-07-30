import { useState, useEffect } from 'react'
import api from '../api/client'
import COUNTRIES_FALLBACK from '../data/countries'

let cache = null

// Fetches the DB-backed country list once, caches it in-module, and falls
// back to the bundled list while loading or if the request fails (offline).
export default function useCountries() {
  const [countries, setCountries] = useState(cache || COUNTRIES_FALLBACK)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) return
    api.get('countries')
      .then(({ data }) => {
        if (data.countries?.length) {
          cache = data.countries
          setCountries(data.countries)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { countries, loading }
}
