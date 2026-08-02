// ISO 4217 / ISO 3166-1 currency helpers used by the send-money flow.
import COUNTRIES from './countries'

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'C$', CHF: 'Fr',
  XOF: 'XOF', XAF: 'XAF', NGN: '₦', GHS: '₵', KES: 'KSh',
  MAD: 'MAD', ZAR: 'R', EGP: '£E', GNF: 'GNF', ETB: 'Br', GMD: 'D',
  SEK: 'kr', NOK: 'kr', DKK: 'kr', AUD: 'A$', NZD: 'NZ$',
}

// ISO 3166-1 alpha-2 region → ISO 4217 currency for sender countries.
// Manual overrides first, then fill in from the full country list so every
// supported/customer location maps to a currency instead of falling back to USD.
const REGION_CURRENCY = {
  US: 'USD', CA: 'CAD', GB: 'GBP', CH: 'CHF',
  FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR',
  BE: 'EUR', NL: 'EUR', AT: 'EUR', FI: 'EUR', IE: 'EUR',
  LU: 'EUR', MT: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR',
  LV: 'EUR', LT: 'EUR', CY: 'EUR', GR: 'EUR',
  SE: 'SEK', NO: 'NOK', DK: 'DKK',
  AU: 'AUD', NZ: 'NZD',
  ...Object.fromEntries(COUNTRIES.map(c => [c.code, c.currency])),
}

function getDeviceCurrency() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale // e.g. "en-US", "fr-FR"
    const parts = locale.split('-')
    // Region tag is always the last BCP-47 subtag that is 2 uppercase letters
    const region = parts.reverse().find(p => /^[A-Z]{2}$/.test(p))
    return region ? (REGION_CURRENCY[region] || null) : null
  } catch {
    return null
  }
}

function getCurrencyByCountryName(name) {
  if (!name) return null
  const n = String(name).toLowerCase().trim().replace(/^the\s+/, '')
  const match = COUNTRIES.find(c =>
    c.name.toLowerCase() === n ||
    c.code.toLowerCase() === n ||
    c.dial.replace(/\+/g, '') === n.replace(/\+/g, '')
  )
  return match?.currency || null
}

function fmt(n, ccy) {
  if (n == null || isNaN(n)) return '—'
  const sym = CURRENCY_SYMBOLS[ccy] || ccy
  return `${sym} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export { CURRENCY_SYMBOLS, REGION_CURRENCY, getDeviceCurrency, getCurrencyByCountryName, fmt }
