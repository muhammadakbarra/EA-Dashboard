CREATE TABLE IF NOT EXISTS ea_instances (
  id BIGSERIAL PRIMARY KEY,
  ea_name TEXT NOT NULL,
  ea_version TEXT,
  account BIGINT NOT NULL,
  server_name TEXT,
  magic_number BIGINT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account, magic_number, symbol, timeframe)
);

CREATE TABLE IF NOT EXISTS mt5_candle_results (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT UNIQUE,
  ea_instance_id BIGINT REFERENCES ea_instances(id),
  source TEXT DEFAULT 'mt5',
  event TEXT NOT NULL DEFAULT 'candle_result',
  ea_name TEXT NOT NULL,
  ea_version TEXT,
  account BIGINT NOT NULL,
  server_name TEXT,
  magic_number BIGINT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  broker_time TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  open NUMERIC(18, 8),
  high NUMERIC(18, 8),
  low NUMERIC(18, 8),
  close NUMERIC(18, 8),
  candle_type TEXT,
  upper_wick_points NUMERIC(18, 2),
  lower_wick_points NUMERIC(18, 2),
  buy_checked_wick_points NUMERIC(18, 2),
  sell_checked_wick_points NUMERIC(18, 2),
  wick_tolerance_points INTEGER,
  use_ema_filter BOOLEAN,
  fast_ema_period INTEGER,
  slow_ema_period INTEGER,
  fast_ema_value NUMERIC(18, 8),
  slow_ema_value NUMERIC(18, 8),
  candle_buy_valid BOOLEAN,
  candle_sell_valid BOOLEAN,
  ema_buy_valid BOOLEAN,
  ema_sell_valid BOOLEAN,
  buy_signal BOOLEAN,
  sell_signal BOOLEAN,
  status TEXT,
  reason TEXT,
  spread_points NUMERIC(18, 2),
  max_spread_points INTEGER,
  has_position BOOLEAN,
  action TEXT,
  side TEXT,
  lot NUMERIC(18, 4),
  entry NUMERIC(18, 8),
  sl NUMERIC(18, 8),
  tp NUMERIC(18, 8),
  retcode INTEGER,
  retcode_description TEXT,
  skip_reason TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account, magic_number, symbol, timeframe, broker_time)
);

CREATE TABLE IF NOT EXISTS mt5_trade_closes (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT UNIQUE,
  ea_instance_id BIGINT REFERENCES ea_instances(id),
  source TEXT DEFAULT 'mt5',
  event TEXT NOT NULL DEFAULT 'trade_closed',
  ea_name TEXT NOT NULL,
  ea_version TEXT,
  account BIGINT NOT NULL,
  server_name TEXT,
  magic_number BIGINT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT,
  broker_time TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  side TEXT,
  status TEXT DEFAULT 'closed',
  close_reason TEXT,
  position_id BIGINT,
  deal_ticket BIGINT,
  order_ticket BIGINT,
  volume NUMERIC(18, 4),
  close_price NUMERIC(18, 8),
  profit NUMERIC(18, 8),
  commission NUMERIC(18, 8),
  swap NUMERIC(18, 8),
  fee NUMERIC(18, 8),
  net_profit NUMERIC(18, 8),
  comment TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account, deal_ticket)
);

CREATE INDEX IF NOT EXISTS idx_ea_instances_account_magic
ON ea_instances(account, magic_number);

CREATE INDEX IF NOT EXISTS idx_candle_results_symbol_time
ON mt5_candle_results(symbol, timeframe, broker_time DESC);

CREATE INDEX IF NOT EXISTS idx_candle_results_account_magic_time
ON mt5_candle_results(account, magic_number, broker_time DESC);

CREATE INDEX IF NOT EXISTS idx_candle_results_status_reason
ON mt5_candle_results(status, reason);

CREATE INDEX IF NOT EXISTS idx_candle_results_action
ON mt5_candle_results(action);

CREATE INDEX IF NOT EXISTS idx_trade_closes_symbol_time
ON mt5_trade_closes(symbol, broker_time DESC);

CREATE INDEX IF NOT EXISTS idx_trade_closes_account_magic_time
ON mt5_trade_closes(account, magic_number, broker_time DESC);

CREATE INDEX IF NOT EXISTS idx_trade_closes_reason
ON mt5_trade_closes(close_reason);

CREATE INDEX IF NOT EXISTS idx_trade_closes_position
ON mt5_trade_closes(position_id);
