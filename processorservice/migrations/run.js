/**
 * migrations/run.js — Minimal migration runner
 *
 * Runs all .sql files in this directory in filename order.
 * Skips files already recorded in the schema_migrations table.
 *
 * Usage:  npm run migrate
 */

'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const fs   = require('fs')
const path = require('path')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const client = await pool.connect()
  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)

    const { rows: applied } = await client.query('SELECT filename FROM schema_migrations')
    const appliedSet = new Set(applied.map(r => r.filename))

    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  skip  ${file}  (already applied)`)
        continue
      }

      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8')
      console.log(`  apply ${file} …`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`  ✓     ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  ✗     ${file}:`, err.message)
        process.exit(1)
      }
    }

    console.log('Migrations complete.')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('Migration runner error:', err.message)
  process.exit(1)
})
