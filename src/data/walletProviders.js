// Configurable mobile money wallet providers.
// Add/edit providers and the countries they operate in here; the UI and
// transfer calls will pick them up automatically.
import COUNTRIES from './countries'

// Provider definition:
//   id               - string used in API payloads and state
//   name             - display label
//   icon             - emoji or short badge shown in the UI
//   countries        - array of ISO 3166-1 alpha-2 country codes
//   transferEndpoint - backend path for sending to this wallet (POST)
//   paymentEndpoint  - backend path for adding this wallet as a payment method (POST)
const MOBILE_WALLET_PROVIDERS = [
  {
    id: 'orange_money',
    name: 'Orange Money',
    icon: '🍊',
    countries: ['SN', 'ML', 'BF', 'NE', 'TG', 'BJ', 'CI', 'GN', 'MG'],
    transferEndpoint: 'transfer/orange-money',
    paymentEndpoint: 'payment-methods/orange-money',
  },
  {
    id: 'mtn_mobile_money',
    name: 'MTN Mobile Money',
    icon: '💛',
    countries: ['GH', 'NG', 'SN', 'UG', 'RW', 'ZA', 'SS', 'SL', 'LR', 'GM'],
    transferEndpoint: 'transfer/mtn-mobile-money',
    paymentEndpoint: 'payment-methods/mtn-mobile-money',
  },
  {
    id: 'airtel_money',
    name: 'Airtel Money',
    icon: '🔴',
    countries: ['KE', 'UG', 'ZM', 'MW', 'CD', 'TZ', 'NG', 'RW', 'SL'],
    transferEndpoint: 'transfer/airtel-money',
    paymentEndpoint: 'payment-methods/airtel-money',
  },
]

function normalizeCountryKey(key) {
  if (key == null) return ''
  let raw = key
  if (typeof key === 'object' && !Array.isArray(key)) {
    raw = key.code || key.name || key.dial || String(key)
  }
  return String(raw).toLowerCase().trim().replace(/^the\s+/, '')
}

function getCountryCode(key) {
  if (!key) return null
  const n = normalizeCountryKey(key)
  const match = COUNTRIES.find(c =>
    c.code.toLowerCase() === n ||
    c.name.toLowerCase() === n ||
    c.dial.replace(/\+/g, '') === n.replace(/\+/g, '')
  )
  return match?.code || null
}

function getWalletProvidersForCountry(countryKey) {
  const code = getCountryCode(countryKey)
  if (!code) return []
  return MOBILE_WALLET_PROVIDERS.filter(p => p.countries.includes(code))
}

function getProviderById(id) {
  return MOBILE_WALLET_PROVIDERS.find(p => p.id === id) || null
}

export { MOBILE_WALLET_PROVIDERS, getWalletProvidersForCountry, getProviderById, getCountryCode }
