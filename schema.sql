CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
DO $$ BEGIN CREATE TYPE ledger_status AS ENUM ('PENDING','BOOKED','SETTLED','FAILED','REVERSED','ONCHAIN_PENDING','ONCHAIN_CONFIRMED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_type AS ENUM ('FIAT_EUR','ETH','ERC20'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE direction AS ENUM ('IN','OUT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE channel AS ENUM ('SEPA_CAMT054','SEPA_CAMT053','PAIN001_OUT','ARBITRUM_L2','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  external_ref CITEXT UNIQUE,
  display_name TEXT NOT NULL,
  iban TEXT,
  crypto_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_crypto_address ON users (LOWER(crypto_address)) WHERE crypto_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_iban ON users (iban) WHERE iban IS NOT NULL;
CREATE TABLE IF NOT EXISTS user_ledgers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  asset asset_type NOT NULL DEFAULT 'FIAT_EUR',
  token_address TEXT,
  accounting_balance NUMERIC(36,18) NOT NULL DEFAULT 0 CHECK (accounting_balance >= 0),
  available_balance NUMERIC(36,18) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  reserved_balance NUMERIC(36,18) NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
  last_tx_id TEXT,
  last_onchain_block BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_ledgers_asset ON user_ledgers (user_id, asset, COALESCE(token_address, ''));
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  ledger_id BIGINT REFERENCES user_ledgers(id) ON DELETE RESTRICT,
  direction direction NOT NULL,
  channel channel NOT NULL,
  asset asset_type NOT NULL,
  amount NUMERIC(36,18) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  status ledger_status NOT NULL DEFAULT 'PENDING',
  end_to_end_id TEXT,
  camt_msgid TEXT,
  pain_msgid TEXT,
  debtor_iban TEXT,
  creditor_iban TEXT,
  debtor_name TEXT,
  creditor_name TEXT,
  chain_id INTEGER,
  tx_hash TEXT,
  from_address TEXT,
  to_address TEXT,
  block_number BIGINT,
  log_index INTEGER,
  confirmations INTEGER NOT NULL DEFAULT 0,
  booked_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  raw_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_end_to_end ON transactions (end_to_end_id) WHERE end_to_end_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_hash_log ON transactions (tx_hash, log_index) WHERE tx_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS chain_sync (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  chain_id INTEGER NOT NULL DEFAULT 42161,
  last_block BIGINT NOT NULL DEFAULT 0,
  last_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO chain_sync (id, chain_id, last_block) VALUES (1, 42161, 0) ON CONFLICT (id) DO NOTHING;
CREATE OR REPLACE FUNCTION credit_deposit(
  p_user_id BIGINT, p_asset asset_type, p_token TEXT, p_amount NUMERIC,
  p_channel channel, p_end_to_end TEXT, p_tx_hash TEXT, p_from_addr TEXT,
  p_to_addr TEXT, p_block BIGINT, p_log_index INTEGER, p_payload JSONB
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_ledger_id BIGINT; v_tx_id BIGINT;
BEGIN
  SELECT id INTO v_ledger_id FROM user_ledgers
   WHERE user_id = p_user_id AND asset = p_asset AND COALESCE(token_address,'') = COALESCE(p_token,'')
   FOR UPDATE;
  IF v_ledger_id IS NULL THEN
    INSERT INTO user_ledgers (user_id, asset, token_address, accounting_balance, available_balance)
    VALUES (p_user_id, p_asset, p_token, p_amount, p_amount) RETURNING id INTO v_ledger_id;
  ELSE
    UPDATE user_ledgers SET accounting_balance = accounting_balance + p_amount,
      available_balance = available_balance + p_amount,
      last_tx_id = COALESCE(p_end_to_end, p_tx_hash),
      last_onchain_block = COALESCE(p_block, last_onchain_block)
    WHERE id = v_ledger_id;
  END IF;
  INSERT INTO transactions (user_id, ledger_id, direction, channel, asset, amount, currency, status,
    end_to_end_id, tx_hash, from_address, to_address, chain_id, block_number, log_index, booked_at, settled_at, raw_payload)
  VALUES (p_user_id, v_ledger_id, 'IN', p_channel, p_asset, p_amount,
    CASE WHEN p_asset = 'FIAT_EUR' THEN 'EUR' ELSE 'ETH' END, 'SETTLED',
    p_end_to_end, p_tx_hash, p_from_addr, p_to_addr,
    CASE WHEN p_channel = 'ARBITRUM_L2' THEN 42161 ELSE NULL END,
    p_block, p_log_index, NOW(), NOW(), p_payload)
  ON CONFLICT DO NOTHING RETURNING id INTO v_tx_id;
  RETURN v_tx_id;
END $$;
