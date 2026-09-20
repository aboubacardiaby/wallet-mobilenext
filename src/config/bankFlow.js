import { bankFlowConfig } from '../utils/bankFlow'

// The two values below are legal content shown inside the bank-debit authorization. They are
// configuration, never defaults in code: with either missing or unusable the bank option stays off.
// (Each must be read as a literal `process.env.EXPO_PUBLIC_*` so Expo can inline it at build time.)
//
//   EXPO_PUBLIC_MANDATE_BUSINESS_NAME   the business name in the authorization text
//   EXPO_PUBLIC_TERMS_URL               https link to the terms the authorization refers to
//
// Counsel must approve the real values and wording before production (spec.md, T032).
export const BANK_FLOW = bankFlowConfig({
  businessName: process.env.EXPO_PUBLIC_MANDATE_BUSINESS_NAME,
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL,
})

// Stripe's collector also needs the publishable key; without it the native SDK cannot start.
export const BANK_FLOW_AVAILABLE = BANK_FLOW.enabled && !!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
