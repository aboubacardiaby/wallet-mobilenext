/**
 * index.js — Processor service entry point
 *
 * Loads environment variables, then polls the Transaction table on a fixed
 * interval, delegating each batch to processor.js.
 *
 * Usage:
 *   cp .env.example .env       # fill in credentials
 *   npm install
 *   npm start                  # production
 *   npm run dev                # development (auto-restarts on file change)
 */

'use strict'

require('dotenv').config()

const { processPendingTransactions } = require('./processor')
const { pool } = require('./db')

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000', 10)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Transaction Processor Service')
console.log(`  Poll interval : ${POLL_INTERVAL_MS / 1000}s`)
console.log(`  Batch size    : ${process.env.BATCH_SIZE || 50}`)
console.log(`  Environment   : ${process.env.NODE_ENV || 'development'}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// ── Verify DB connectivity before starting the loop ───────────────────────────
async function assertDbConnected() {
  const { rows } = await pool.query('SELECT NOW() AS now')
  console.log(`[startup] DB connected — server time: ${rows[0].now}`)
}

// ── Single-execution guard — prevents overlapping cycles ──────────────────────
let running = false

async function tick() {
  if (running) {
    console.log('[processor] Previous cycle still running — skipping this tick')
    return
  }
  running = true
  try {
    await processPendingTransactions()
  } catch (err) {
    console.error('[processor] Unhandled error in cycle:', err.message)
  } finally {
    running = false
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[shutdown] Received ${signal}. Closing DB pool…`)
  clearInterval(intervalId)
  pool.end(() => {
    console.log('[shutdown] DB pool closed. Bye!')
    process.exit(0)
  })
}

process.on('SIGINT',  () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// ── Start ─────────────────────────────────────────────────────────────────────
let intervalId

assertDbConnected()
  .then(() => {
    // Run immediately on startup, then on every interval
    tick()
    intervalId = setInterval(tick, POLL_INTERVAL_MS)
    console.log(`[startup] Polling every ${POLL_INTERVAL_MS / 1000}s — Ctrl+C to stop`)
  })
  .catch((err) => {
    console.error('[startup] Cannot connect to database:', err.message)
    process.exit(1)
  })
