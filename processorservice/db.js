/**
 * db.js — PostgreSQL connection pool
 *
 * All queries in the processor go through this shared pool.
 * Configure via DATABASE_URL in your .env file.
 */

'use strict'

const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep a small pool — processor is a single-worker background job
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

/**
 * Run a query against the pool.
 * @param {string} text  — parameterised SQL
 * @param {any[]}  params — positional parameters ($1, $2, …)
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[db] query (${duration}ms) rows=${result.rowCount}`)
  }
  return result
}

/**
 * Acquire a client for multi-statement transactions (BEGIN / COMMIT / ROLLBACK).
 * Caller is responsible for calling client.release() in a finally block.
 */
async function getClient() {
  return pool.connect()
}

module.exports = { query, getClient, pool }
