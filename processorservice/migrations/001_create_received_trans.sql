-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Create ReceivedTrans table
--
-- This table is written by the processor service and read by the mobile API
-- so the recipient's app can see:
--   • a ready-to-collect Wave transfer, or
--   • the exact agent location and pickup code for cash collection.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ReceivedTrans" (
    -- ── Identity ────────────────────────────────────────────────────────────
    id                  BIGSERIAL PRIMARY KEY,
    transaction_id      UUID            NOT NULL UNIQUE
                            REFERENCES transactions(id) ON DELETE CASCADE,
    transaction_ref     VARCHAR(64)     NOT NULL,

    -- ── Parties ─────────────────────────────────────────────────────────────
    sender_user_id      BIGINT,                         -- nullable: sender may be anonymous
    recipient_phone     VARCHAR(32)     NOT NULL,
    recipient_name      VARCHAR(255),

    -- ── Amounts ─────────────────────────────────────────────────────────────
    amount              NUMERIC(18, 6)  NOT NULL,       -- amount recipient receives
    currency            VARCHAR(8)      NOT NULL,       -- destination currency (e.g. XOF)
    send_amount         NUMERIC(18, 6),                 -- original send amount
    send_currency       VARCHAR(8),                     -- origin currency (e.g. USD)
    fee                 NUMERIC(18, 6),
    exchange_rate       NUMERIC(18, 8),

    -- ── Delivery type ────────────────────────────────────────────────────────
    -- 'wave'          → funds pushed to Wave wallet via API
    -- 'agent_pickup'  → recipient must visit a cash agent
    -- 'wallet'        → in-app wallet credit (fallback)
    delivery_type       VARCHAR(32)     NOT NULL DEFAULT 'wallet',

    -- ── Cash pickup (agent_pickup only) ─────────────────────────────────────
    pickup_code         VARCHAR(16),                    -- PIN / code shown to recipient
    agent_id            BIGINT,
    agent_name          VARCHAR(255),
    agent_address       TEXT,
    agent_city          VARCHAR(128),
    agent_country       VARCHAR(128),
    agent_phone         VARCHAR(32),
    agent_lat           DOUBLE PRECISION,
    agent_lng           DOUBLE PRECISION,

    -- ── Wave (wave only) ────────────────────────────────────────────────────
    wave_transfer_id    VARCHAR(128),                   -- Wave's own transfer ID
    wave_ref            VARCHAR(128),                   -- client_reference echoed back
    wave_status         VARCHAR(32),                    -- succeeded | pending | failed

    -- ── Record status ───────────────────────────────────────────────────────
    -- ready_for_pickup → agent cash, waiting for recipient to show up
    -- wave_initiated   → Wave API call succeeded
    -- picked_up        → recipient confirmed collection (set by mobile API)
    -- ready            → wallet / fallback
    status              VARCHAR(32)     NOT NULL DEFAULT 'ready',

    -- ── Raw deserialized extra_data for reference / debugging ───────────────
    extra_data          JSONB,

    -- ── Timestamps ──────────────────────────────────────────────────────────
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Recipient app polls by phone + status
CREATE INDEX IF NOT EXISTS idx_received_trans_recipient_phone
    ON "ReceivedTrans" (recipient_phone, status);

-- API looks up by transaction ref
CREATE INDEX IF NOT EXISTS idx_received_trans_ref
    ON "ReceivedTrans" (transaction_ref);

-- Agent dashboard queries by agent
CREATE INDEX IF NOT EXISTS idx_received_trans_agent
    ON "ReceivedTrans" (agent_id, status)
    WHERE delivery_type = 'agent_pickup';

-- Wave status reconciliation
CREATE INDEX IF NOT EXISTS idx_received_trans_wave
    ON "ReceivedTrans" (wave_transfer_id)
    WHERE delivery_type = 'wave';

-- ── Add processor_error column to Transaction (if not already present) ────────
-- The processor writes the failure reason here so ops can triage failed rows.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS processor_error TEXT;
