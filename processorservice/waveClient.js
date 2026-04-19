/**
 * waveClient.js — Wave Mobile Money API integration
 *
 * Wraps the Wave REST API for initiating outbound transfers to Wave wallet holders.
 * Docs: https://docs.wave.com
 */

'use strict'

const axios = require('axios')

const waveApi = axios.create({
  baseURL: process.env.WAVE_API_BASE_URL || 'https://api.wave.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.WAVE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})

/**
 * Initiate a payout to a Wave wallet.
 *
 * @param {object} params
 * @param {string} params.recipient_phone   — E.164 phone number of the Wave wallet holder
 * @param {number} params.amount            — amount in the destination currency (smallest unit for some APIs, full float here)
 * @param {string} params.currency          — ISO 4217 currency code (e.g. "XOF")
 * @param {string} params.transaction_ref   — your internal reference (idempotency key)
 * @param {string} [params.description]     — human-readable memo shown to recipient
 *
 * @returns {Promise<{ wave_transfer_id: string, status: string, wave_ref: string }>}
 */
async function sendToWallet({ recipient_phone, amount, currency, transaction_ref, description }) {
  const payload = {
    receive_amount:  String(amount),
    currency,
    mobile:          recipient_phone,
    client_reference: transaction_ref,
    name:            description || 'Remittance transfer',
  }

  const { data } = await waveApi.post('/payout', payload)

  return {
    wave_transfer_id: data.id,
    wave_ref:         data.client_reference || data.id,
    status:           data.status,          // e.g. "succeeded" | "pending" | "failed"
    raw:              data,
  }
}

/**
 * Look up the current status of a Wave transfer.
 *
 * @param {string} waveTransferId — the `id` returned by sendToWallet
 * @returns {Promise<{ status: string, raw: object }>}
 */
async function getTransferStatus(waveTransferId) {
  const { data } = await waveApi.get(`/payout/${waveTransferId}`)
  return { status: data.status, raw: data }
}

module.exports = { sendToWallet, getTransferStatus }
