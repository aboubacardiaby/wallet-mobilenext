/**
 * processor.js — Core transaction processing logic
 *
 * Each cycle:
 *   1. SELECT pending rows from the Transaction table (with a row-level lock so
 *      multiple instances don't double-process the same row).
 *   2. Deserialize the extra_data JSON column to determine delivery type.
 *   3. Route:
 *        • delivery_type = "wave"         → call Wave API → mark completed
 *        • delivery_type = "agent_pickup" → insert agent info into ReceivedTrans
 *                                           so the mobile app can show pickup details
 *        • (fallback)                     → insert as-is and mark for review
 *   4. Insert a row into ReceivedTrans to confirm availability for the recipient.
 *   5. Update Transaction.status to "processed" (or "failed" on error).
 */

'use strict'

const { getClient } = require('./db')
const { sendToWallet } = require('./waveClient')

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50', 10)

// ── Delivery type constants ────────────────────────────────────────────────────
const DELIVERY_WAVE   = 'wave'
const DELIVERY_AGENT  = 'agent_pickup'

// ─────────────────────────────────────────────────────────────────────────────
// Main exported function — called on every poll tick from index.js
// ─────────────────────────────────────────────────────────────────────────────
async function processPendingTransactions() {
  const client = await getClient()

  try {
    await client.query('BEGIN')

    // 1. Fetch a batch of pending transactions and lock them so concurrent
    //    processor instances skip already-locked rows (SKIP LOCKED).
    const { rows: transactions } = await client.query(
      `SELECT
         id,
         transaction_ref,
         from_user_id        AS sender_user_id,
         to_phone            AS recipient_phone,
         NULL::text          AS recipient_name,
         amount              AS send_amount,
         currency            AS send_currency,
         amount              AS received_amount,
         currency            AS recv_currency,
         fee,
         NULL::numeric       AS exchange_rate,
         extra_data,
         created_at
       FROM transactions
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE]
    )

    if (transactions.length === 0) {
      await client.query('ROLLBACK')
      return { processed: 0, failed: 0 }
    }

    console.log(`[processor] Processing ${transactions.length} pending transaction(s)…`)

    let processed = 0
    let failed    = 0

    for (const tx of transactions) {
      try {
        await processSingleTransaction(client, tx)
        processed++
      } catch (err) {
        console.error(`[processor] Failed tx ${tx.transaction_ref}:`, err.message)
        // Mark as failed so it isn't retried indefinitely
        await client.query(
          `UPDATE transactions
           SET status = 'failed',
               processor_error = $1
           WHERE id = $2`,
          [err.message, tx.id]
        )
        failed++
      }
    }

    await client.query('COMMIT')
    console.log(`[processor] Cycle complete — processed: ${processed}, failed: ${failed}`)
    return { processed, failed }

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[processor] Batch-level error, rolled back:', err.message)
    throw err
  } finally {
    client.release()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Process a single transaction row inside the open transaction
// ─────────────────────────────────────────────────────────────────────────────
async function processSingleTransaction(client, tx) {
  // 2. Deserialize extra_data JSON
  //    The column may already be a parsed object (pg returns JSONB as object)
  //    or a JSON string — handle both.
  let extraData = {}
  if (tx.extra_data) {
    extraData = typeof tx.extra_data === 'string'
      ? JSON.parse(tx.extra_data)
      : tx.extra_data
  }

  // Determine delivery type from extra_data, falling back to presence of known keys
  const deliveryType = resolveDeliveryType(extraData)

  console.log(`[processor] tx=${tx.transaction_ref} delivery=${deliveryType}`)

  if (deliveryType === DELIVERY_WAVE) {
    await handleWaveDelivery(client, tx, extraData)
  } else if (deliveryType === DELIVERY_AGENT) {
    await handleAgentPickup(client, tx, extraData)
  } else {
    // Unknown / wallet-to-wallet — insert into ReceivedTrans for review
    await insertReceivedTrans(client, tx, extraData, 'wallet', null, null)
    await markTransactionProcessed(client, tx.id)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery type resolver
// ─────────────────────────────────────────────────────────────────────────────
function resolveDeliveryType(extraData) {
  if (extraData.delivery_type) return extraData.delivery_type
  // Infer from fields present in extra_data
  if (extraData.wave_ref || extraData.wave_transfer_id || extraData.has_wave) return DELIVERY_WAVE
  if (extraData.pickup_code || extraData.agent)                               return DELIVERY_AGENT
  return 'wallet'
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave wallet delivery
// ─────────────────────────────────────────────────────────────────────────────
async function handleWaveDelivery(client, tx, extraData) {
  // If a wave_transfer_id already exists in extra_data this tx was already
  // initiated — just sync the status rather than firing a duplicate transfer.
  if (extraData.wave_transfer_id) {
    console.log(`[processor] tx=${tx.transaction_ref} already has wave_transfer_id — skipping re-initiation`)
    await insertReceivedTrans(client, tx, extraData, DELIVERY_WAVE, null, {
      wave_transfer_id: extraData.wave_transfer_id,
      wave_ref:         extraData.wave_ref,
    })
    await markTransactionProcessed(client, tx.id)
    return
  }

  // Call Wave API to push funds to the recipient's Wave wallet
  const waveResult = await sendToWallet({
    recipient_phone: tx.recipient_phone,
    amount:          tx.received_amount,
    currency:        tx.recv_currency,
    transaction_ref: tx.transaction_ref,
    description:     extraData.description || `Remittance from ${tx.send_currency} sender`,
  })

  // Persist Wave result into ReceivedTrans
  await insertReceivedTrans(client, tx, extraData, DELIVERY_WAVE, null, {
    wave_transfer_id: waveResult.wave_transfer_id,
    wave_ref:         waveResult.wave_ref,
    wave_status:      waveResult.status,
  })

  // Stamp the Transaction row with the Wave reference for traceability
  await client.query(
    `UPDATE transactions
     SET status       = 'completed',
         completed_at = NOW()
     WHERE id = $1`,
    [tx.id]
  )

  console.log(`[processor] Wave transfer initiated — ref=${waveResult.wave_ref} status=${waveResult.status}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent cash-pickup delivery
// ─────────────────────────────────────────────────────────────────────────────
async function handleAgentPickup(client, tx, extraData) {
  // extra_data.agent contains the agent object set at send time:
  // { id, name, address, city, country, phone, latitude?, longitude? }
  const agent = extraData.agent || {}

  const agentInfo = {
    agent_id:      agent.id      || null,
    agent_name:    agent.name    || 'Authorized agent',
    agent_address: agent.address || null,
    agent_city:    agent.city    || null,
    agent_country: agent.country || null,
    agent_phone:   agent.phone   || null,
    agent_lat:     agent.latitude  != null ? parseFloat(agent.latitude)  : null,
    agent_lng:     agent.longitude != null ? parseFloat(agent.longitude) : null,
  }

  if (!extraData.pickup_code) {
    throw new Error('agent_pickup transaction is missing pickup_code — cannot complete')
  }

  await insertReceivedTrans(client, tx, extraData, DELIVERY_AGENT, extraData.pickup_code, agentInfo)
  await markTransactionProcessed(client, tx.id)

  console.log(
    `[processor] Agent pickup ready — code=${extraData.pickup_code} ` +
    `agent="${agentInfo.agent_name}" address="${agentInfo.agent_address}"`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert a row into ReceivedTrans
// ─────────────────────────────────────────────────────────────────────────────
async function insertReceivedTrans(client, tx, extraData, deliveryType, pickupCode, deliveryMeta) {
  const meta = deliveryMeta || {}

  await client.query(
    `INSERT INTO "ReceivedTrans" (
       transaction_id,
       transaction_ref,
       sender_user_id,
       recipient_phone,
       recipient_name,
       amount,
       currency,
       send_amount,
       send_currency,
       fee,
       exchange_rate,
       delivery_type,
       pickup_code,
       agent_id,
       agent_name,
       agent_address,
       agent_city,
       agent_country,
       agent_phone,
       agent_lat,
       agent_lng,
       wave_transfer_id,
       wave_ref,
       wave_status,
       status,
       extra_data,
       created_at,
       updated_at
     ) VALUES (
       $1,  $2,  $3,  $4,  $5,
       $6,  $7,  $8,  $9,  $10,
       $11, $12, $13, $14, $15,
       $16, $17, $18, $19, $20,
       $21, $22, $23, $24, $25,
       $26, $27, NOW()
     )
     ON CONFLICT (transaction_id) DO UPDATE SET
       wave_transfer_id = EXCLUDED.wave_transfer_id,
       wave_ref         = EXCLUDED.wave_ref,
       wave_status      = EXCLUDED.wave_status,
       status           = EXCLUDED.status,
       updated_at       = NOW()`,
    [
      tx.id,                         // $1  transaction_id
      tx.transaction_ref,            // $2  transaction_ref
      tx.sender_user_id,             // $3  sender_user_id
      tx.recipient_phone,            // $4  recipient_phone
      tx.recipient_name,             // $5  recipient_name
      tx.received_amount,            // $6  amount
      tx.recv_currency,              // $7  currency
      tx.send_amount,                // $8  send_amount
      tx.send_currency,              // $9  send_currency
      tx.fee,                        // $10 fee
      tx.exchange_rate,              // $11 exchange_rate
      deliveryType,                  // $12 delivery_type
      pickupCode || null,            // $13 pickup_code
      meta.agent_id      || null,    // $14 agent_id
      meta.agent_name    || null,    // $15 agent_name
      meta.agent_address || null,    // $16 agent_address
      meta.agent_city    || null,    // $17 agent_city
      meta.agent_country || null,    // $18 agent_country
      meta.agent_phone   || null,    // $19 agent_phone
      meta.agent_lat     ?? null,    // $20 agent_lat
      meta.agent_lng     ?? null,    // $21 agent_lng
      meta.wave_transfer_id || null, // $22 wave_transfer_id
      meta.wave_ref         || null, // $23 wave_ref
      meta.wave_status      || null, // $24 wave_status
      deliveryType === DELIVERY_WAVE && meta.wave_transfer_id
        ? 'wave_initiated'
        : deliveryType === DELIVERY_AGENT
          ? 'ready_for_pickup'
          : 'ready',                 // $25 status
      extraData,                     // $26 extra_data (stored as JSONB)
      tx.created_at,                 // $27 created_at (preserve original timestamp)
    ]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark the source Transaction as processed
// ─────────────────────────────────────────────────────────────────────────────
async function markTransactionProcessed(client, transactionId) {
  await client.query(
    `UPDATE transactions
     SET status       = 'completed',
         completed_at = NOW()
     WHERE id = $1`,
    [transactionId]
  )
}

module.exports = { processPendingTransactions }
