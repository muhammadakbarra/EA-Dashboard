import { query } from "@/lib/db";

type ActiveInstanceRow = {
  ea_name: string;
  account: number;
  magic_number: number;
  symbol: string;
  timeframe: string;
};

type CandleSummaryRow = {
  total_candles: number;
  valid_buy: number;
  valid_sell: number;
  no_entry: number;
  trade_opened: number;
};

type TradeSummaryRow = {
  tp_count: number;
  sl_count: number;
  winrate: number | null;
  net_profit: number | null;
};

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatPercent(value: number | null | undefined): string {
  const safe = value ?? 0;
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)}%`;
}

function formatMoney(value: number | null | undefined): string {
  const safe = value ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "always",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export default async function DashboardPage() {
  const activeInstance = await query<ActiveInstanceRow>(
    `SELECT ea_name, account, magic_number, symbol, timeframe
     FROM ea_instances
     ORDER BY last_seen_at DESC
     LIMIT 1`,
  );

  const instance = activeInstance.rows[0];

  if (!instance) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <h2 className="text-3xl font-semibold text-slate-900">Overview</h2>
        <p className="mt-4 text-lg text-slate-600">
          Belum ada data EA. Silakan kirim event EA dulu ke API.
        </p>
      </div>
    );
  }

  const [candleSummary, tradeSummary] = await Promise.all([
    query<CandleSummaryRow>(
      `SELECT
        COUNT(*)::int AS total_candles,
        SUM(CASE WHEN status = 'VALID_BUY' THEN 1 ELSE 0 END)::int AS valid_buy,
        SUM(CASE WHEN status = 'VALID_SELL' THEN 1 ELSE 0 END)::int AS valid_sell,
        SUM(CASE WHEN action = 'NO_ENTRY' THEN 1 ELSE 0 END)::int AS no_entry,
        SUM(CASE WHEN action = 'TRADE_OPENED' THEN 1 ELSE 0 END)::int AS trade_opened
      FROM mt5_candle_results
      WHERE account = $1
        AND magic_number = $2
        AND symbol = $3
        AND timeframe = $4
        AND broker_time::date = CURRENT_DATE`,
      [instance.account, instance.magic_number, instance.symbol, instance.timeframe],
    ),
    query<TradeSummaryRow>(
      `SELECT
        SUM(CASE WHEN close_reason = 'TP' THEN 1 ELSE 0 END)::int AS tp_count,
        SUM(CASE WHEN close_reason = 'SL' THEN 1 ELSE 0 END)::int AS sl_count,
        ROUND(
          100.0 * SUM(CASE WHEN net_profit > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
          2
        )::float8 AS winrate,
        SUM(net_profit)::float8 AS net_profit
      FROM mt5_trade_closes
      WHERE account = $1
        AND magic_number = $2
        AND symbol = $3
        AND (timeframe = $4 OR timeframe IS NULL)
        AND broker_time::date = CURRENT_DATE`,
      [instance.account, instance.magic_number, instance.symbol, instance.timeframe],
    ),
  ]);

  const candle = candleSummary.rows[0] ?? {
    total_candles: 0,
    valid_buy: 0,
    valid_sell: 0,
    no_entry: 0,
    trade_opened: 0,
  };

  const trade = tradeSummary.rows[0] ?? {
    tp_count: 0,
    sl_count: 0,
    winrate: 0,
    net_profit: 0,
  };

  const validSignal = candle.valid_buy + candle.valid_sell;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <h2 className="text-3xl font-semibold text-slate-900">Overview</h2>
        <p className="mt-3 text-lg text-slate-600">
          {instance.ea_name} - {instance.symbol} {instance.timeframe}
        </p>
        <p className="mt-1 text-base text-slate-500">
          Account: {instance.account} | Magic Number: {instance.magic_number}
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
          Summary Hari Ini
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Candle Checked", value: formatCount(candle.total_candles) },
            { label: "Valid Signal", value: formatCount(validSignal) },
            { label: "Trade Opened", value: formatCount(candle.trade_opened) },
            { label: "No Entry", value: formatCount(candle.no_entry) },
            { label: "TP", value: formatCount(trade.tp_count) },
            { label: "SL", value: formatCount(trade.sl_count) },
            { label: "Winrate", value: formatPercent(trade.winrate) },
            { label: "Net Profit", value: formatMoney(trade.net_profit) },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
