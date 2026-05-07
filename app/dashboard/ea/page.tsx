import Link from "next/link";

import { query } from "@/lib/db";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type EaGroupRow = {
  ea_name: string;
  instance_count: number;
  last_seen_at: string;
};

type EaInstanceFilterRow = {
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
  trade_failed: number;
  trade_skipped: number;
};

type TradeSummaryRow = {
  total_closed: number;
  tp_count: number;
  sl_count: number;
  manual_count: number;
  net_profit: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  avg_net_profit: number | null;
  best_trade: number | null;
  worst_trade: number | null;
  winrate: number | null;
  gross_profit: number | null;
  gross_loss: number | null;
};

type DistributionRow = {
  label: string;
  total: number;
};

type CandleTableRow = {
  broker_time: string;
  symbol: string;
  timeframe: string;
  candle_type: string | null;
  status: string | null;
  reason: string | null;
  action: string | null;
  side: string | null;
  spread_points: number | null;
  entry: number | null;
  sl: number | null;
  tp: number | null;
};

type TradeTableRow = {
  broker_time: string;
  symbol: string;
  side: string | null;
  close_reason: string | null;
  close_price: number | null;
  profit: number | null;
  commission: number | null;
  swap: number | null;
  net_profit: number | null;
  deal_ticket: number | null;
};

type ProfitCurveRow = {
  broker_time: string;
  cumulative_profit: number | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseDate(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return DATE_PATTERN.test(value) ? value : fallback;
}

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

function formatMoneyOptional(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return formatMoney(value);
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-GB", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function asDistributionLabel(value: string | null): string {
  if (!value) {
    return "UNKNOWN";
  }

  return value;
}

function sumTotals(items: DistributionRow[]): number {
  return items.reduce((acc, item) => acc + item.total, 0);
}

function buildEaHref(eaName: string): string {
  const params = new URLSearchParams();
  params.set("ea_name", eaName);
  return `/dashboard/ea?${params.toString()}`;
}

function asIntegerSet(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function asStringSet(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

type PageProps = {
  searchParams: SearchParams;
};

export default async function DashboardEaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const todayIso = new Date().toISOString().slice(0, 10);

  const eaGroups = await query<EaGroupRow>(
    `SELECT
      ea_name,
      COUNT(*)::int AS instance_count,
      MAX(last_seen_at)::text AS last_seen_at
    FROM ea_instances
    GROUP BY ea_name
    ORDER BY MAX(last_seen_at) DESC`,
  );

  if (eaGroups.rows.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <h2 className="text-3xl font-semibold text-slate-900">EA</h2>
        <p className="mt-4 text-lg text-slate-600">
          Belum ada data EA masuk. Kirim event ke endpoint{" "}
          <code>POST /api/broker-broken</code> dulu.
        </p>
      </div>
    );
  }

  const requestedEa = firstValue(params.ea_name);
  const selectedEaName =
    requestedEa &&
    eaGroups.rows.some((row) => row.ea_name === requestedEa)
      ? requestedEa
      : eaGroups.rows[0].ea_name;

  const filterRows = await query<EaInstanceFilterRow>(
    `SELECT account, magic_number, symbol, timeframe
     FROM ea_instances
     WHERE ea_name = $1
     ORDER BY last_seen_at DESC`,
    [selectedEaName],
  );

  const fallbackFilter = filterRows.rows[0];
  if (!fallbackFilter) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <h2 className="text-3xl font-semibold text-slate-900">EA</h2>
        <p className="mt-4 text-lg text-slate-600">
          Instance untuk EA <strong>{selectedEaName}</strong> belum tersedia.
        </p>
      </div>
    );
  }

  const accountFromQuery = parseNumber(firstValue(params.account));
  const magicFromQuery = parseNumber(firstValue(params.magic_number));
  const symbolFromQuery = firstValue(params.symbol);
  const timeframeFromQuery = firstValue(params.timeframe);

  const selectedAccount = accountFromQuery ?? fallbackFilter.account;
  const selectedMagic = magicFromQuery ?? fallbackFilter.magic_number;
  const selectedSymbol = symbolFromQuery ?? fallbackFilter.symbol;
  const selectedTimeframe = timeframeFromQuery ?? fallbackFilter.timeframe;
  const fromDate = parseDate(firstValue(params.from), todayIso);
  const toDate = parseDate(firstValue(params.to), todayIso);

  const candleFilterValues = [
    selectedAccount,
    selectedMagic,
    selectedSymbol,
    selectedTimeframe,
    fromDate,
    toDate,
  ];

  const tradeFilterValues = [
    selectedAccount,
    selectedMagic,
    selectedSymbol,
    selectedTimeframe,
    fromDate,
    toDate,
  ];

  const [candleSummary, tradeSummary, reasonDistribution, actionDistribution] =
    await Promise.all([
      query<CandleSummaryRow>(
        `SELECT
          COUNT(*)::int AS total_candles,
          SUM(CASE WHEN status = 'VALID_BUY' THEN 1 ELSE 0 END)::int AS valid_buy,
          SUM(CASE WHEN status = 'VALID_SELL' THEN 1 ELSE 0 END)::int AS valid_sell,
          SUM(CASE WHEN action = 'NO_ENTRY' THEN 1 ELSE 0 END)::int AS no_entry,
          SUM(CASE WHEN action = 'TRADE_OPENED' THEN 1 ELSE 0 END)::int AS trade_opened,
          SUM(CASE WHEN action = 'TRADE_FAILED' THEN 1 ELSE 0 END)::int AS trade_failed,
          SUM(CASE WHEN action = 'TRADE_SKIPPED' THEN 1 ELSE 0 END)::int AS trade_skipped
        FROM mt5_candle_results
        WHERE account = $1
          AND magic_number = $2
          AND symbol = $3
          AND timeframe = $4
          AND broker_time::date BETWEEN $5::date AND $6::date`,
        candleFilterValues,
      ),
      query<TradeSummaryRow>(
        `SELECT
          COUNT(*)::int AS total_closed,
          SUM(CASE WHEN close_reason = 'TP' THEN 1 ELSE 0 END)::int AS tp_count,
          SUM(CASE WHEN close_reason = 'SL' THEN 1 ELSE 0 END)::int AS sl_count,
          SUM(CASE WHEN close_reason = 'MANUAL' THEN 1 ELSE 0 END)::int AS manual_count,
          SUM(net_profit)::float8 AS net_profit,
          AVG(CASE WHEN net_profit > 0 THEN net_profit END)::float8 AS avg_win,
          AVG(CASE WHEN net_profit < 0 THEN net_profit END)::float8 AS avg_loss,
          AVG(net_profit)::float8 AS avg_net_profit,
          MAX(net_profit)::float8 AS best_trade,
          MIN(net_profit)::float8 AS worst_trade,
          ROUND(
            100.0 * SUM(CASE WHEN net_profit > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
            2
          )::float8 AS winrate,
          SUM(CASE WHEN net_profit > 0 THEN net_profit ELSE 0 END)::float8 AS gross_profit,
          ABS(SUM(CASE WHEN net_profit < 0 THEN net_profit ELSE 0 END))::float8 AS gross_loss
        FROM mt5_trade_closes
        WHERE account = $1
          AND magic_number = $2
          AND symbol = $3
          AND (timeframe = $4 OR timeframe IS NULL)
          AND broker_time::date BETWEEN $5::date AND $6::date`,
        tradeFilterValues,
      ),
      query<DistributionRow>(
        `SELECT
          COALESCE(reason, 'UNKNOWN') AS label,
          COUNT(*)::int AS total
        FROM mt5_candle_results
        WHERE account = $1
          AND magic_number = $2
          AND symbol = $3
          AND timeframe = $4
          AND broker_time::date BETWEEN $5::date AND $6::date
        GROUP BY reason
        ORDER BY total DESC`,
        candleFilterValues,
      ),
      query<DistributionRow>(
        `SELECT
          COALESCE(action, 'UNKNOWN') AS label,
          COUNT(*)::int AS total
        FROM mt5_candle_results
        WHERE account = $1
          AND magic_number = $2
          AND symbol = $3
          AND timeframe = $4
          AND broker_time::date BETWEEN $5::date AND $6::date
        GROUP BY action
        ORDER BY total DESC`,
        candleFilterValues,
      ),
    ]);

  const [profitCurve, candleRows, tradeRows] = await Promise.all([
    query<ProfitCurveRow>(
      `SELECT
        broker_time::text AS broker_time,
        SUM(net_profit) OVER (ORDER BY broker_time ASC, id ASC)::float8 AS cumulative_profit
      FROM mt5_trade_closes
      WHERE account = $1
        AND magic_number = $2
        AND symbol = $3
        AND (timeframe = $4 OR timeframe IS NULL)
        AND broker_time::date BETWEEN $5::date AND $6::date
      ORDER BY broker_time ASC, id ASC`,
      tradeFilterValues,
    ),
    query<CandleTableRow>(
      `SELECT
        broker_time::text AS broker_time,
        symbol,
        timeframe,
        candle_type,
        status,
        reason,
        action,
        side,
        spread_points::float8 AS spread_points,
        entry::float8 AS entry,
        sl::float8 AS sl,
        tp::float8 AS tp
      FROM mt5_candle_results
      WHERE account = $1
        AND magic_number = $2
        AND symbol = $3
        AND timeframe = $4
        AND broker_time::date BETWEEN $5::date AND $6::date
      ORDER BY broker_time DESC
      LIMIT 100`,
      candleFilterValues,
    ),
    query<TradeTableRow>(
      `SELECT
        broker_time::text AS broker_time,
        symbol,
        side,
        close_reason,
        close_price::float8 AS close_price,
        profit::float8 AS profit,
        commission::float8 AS commission,
        swap::float8 AS swap,
        net_profit::float8 AS net_profit,
        deal_ticket
      FROM mt5_trade_closes
      WHERE account = $1
        AND magic_number = $2
        AND symbol = $3
        AND (timeframe = $4 OR timeframe IS NULL)
        AND broker_time::date BETWEEN $5::date AND $6::date
      ORDER BY broker_time DESC
      LIMIT 100`,
      tradeFilterValues,
    ),
  ]);

  const candle = candleSummary.rows[0] ?? {
    total_candles: 0,
    valid_buy: 0,
    valid_sell: 0,
    no_entry: 0,
    trade_opened: 0,
    trade_failed: 0,
    trade_skipped: 0,
  };

  const trade = tradeSummary.rows[0] ?? {
    total_closed: 0,
    tp_count: 0,
    sl_count: 0,
    manual_count: 0,
    net_profit: 0,
    avg_win: 0,
    avg_loss: 0,
    avg_net_profit: 0,
    best_trade: 0,
    worst_trade: 0,
    winrate: 0,
    gross_profit: 0,
    gross_loss: 0,
  };

  const validSignalCount = candle.valid_buy + candle.valid_sell;
  const signalRate =
    candle.total_candles > 0
      ? (validSignalCount / candle.total_candles) * 100
      : 0;
  const executionRate =
    validSignalCount > 0 ? (candle.trade_opened / validSignalCount) * 100 : 0;
  const skipRate =
    validSignalCount > 0 ? (candle.trade_skipped / validSignalCount) * 100 : 0;
  const failedRate =
    validSignalCount > 0 ? (candle.trade_failed / validSignalCount) * 100 : 0;

  const profitFactor =
    (trade.gross_loss ?? 0) > 0
      ? (trade.gross_profit ?? 0) / (trade.gross_loss ?? 1)
      : null;

  const reasonTotal = sumTotals(reasonDistribution.rows);
  const actionTotal = sumTotals(actionDistribution.rows);

  const accountOptions = asIntegerSet(filterRows.rows.map((row) => row.account));
  const magicOptions = asIntegerSet(
    filterRows.rows.map((row) => row.magic_number),
  );
  const symbolOptions = asStringSet(filterRows.rows.map((row) => row.symbol));
  const timeframeOptions = asStringSet(
    filterRows.rows.map((row) => row.timeframe),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
          EA List
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">
          Pilih EA Untuk Analisis
        </h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {eaGroups.rows.map((ea) => {
            const active = ea.ea_name === selectedEaName;
            return (
              <Link
                key={ea.ea_name}
                href={buildEaHref(ea.ea_name)}
                className={`rounded-2xl border px-5 py-3 text-base font-semibold transition ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                }`}
              >
                {ea.ea_name} ({ea.instance_count})
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
          Filter
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">
          {selectedEaName} - Filter Data
        </h3>
        <form className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <input type="hidden" name="ea_name" value={selectedEaName} />
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-600">Account</span>
            <select
              name="account"
              defaultValue={String(selectedAccount)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-sky-400"
            >
              {accountOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-600">
              Magic Number
            </span>
            <select
              name="magic_number"
              defaultValue={String(selectedMagic)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-sky-400"
            >
              {magicOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-600">Symbol</span>
            <select
              name="symbol"
              defaultValue={selectedSymbol}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-sky-400"
            >
              {symbolOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-600">Timeframe</span>
            <select
              name="timeframe"
              defaultValue={selectedTimeframe}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-sky-400"
            >
              {timeframeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-600">From</span>
            <input
              type="date"
              name="from"
              defaultValue={fromDate}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-sky-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-600">To</span>
            <input
              type="date"
              name="to"
              defaultValue={toDate}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-sky-400"
            />
          </label>

          <div className="md:col-span-3">
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-sky-500 px-8 text-base font-semibold text-white transition hover:bg-sky-600"
            >
              Apply Filter
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
          Level 3 - Dashboard View
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">
          Overview Cards
        </h3>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Candle Checked", value: formatCount(candle.total_candles) },
            { label: "Valid Buy", value: formatCount(candle.valid_buy) },
            { label: "Valid Sell", value: formatCount(candle.valid_sell) },
            { label: "No Entry", value: formatCount(candle.no_entry) },
            { label: "Trade Opened", value: formatCount(candle.trade_opened) },
            { label: "Trade Failed", value: formatCount(candle.trade_failed) },
            { label: "Trade Skipped", value: formatCount(candle.trade_skipped) },
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

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
          Level 2 - Processed Summary
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">
          Signal Metrics
        </h3>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Valid Signal Count</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCount(validSignalCount)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Signal Rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatPercent(signalRate)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Execution Rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatPercent(executionRate)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Skip Rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatPercent(skipRate)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Failed Rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatPercent(failedRate)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Total Closed Trades</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCount(trade.total_closed)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Profit Factor</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {profitFactor === null
                ? "-"
                : new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(profitFactor)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Average Net Profit</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatMoney(trade.avg_net_profit)}
            </p>
          </div>
        </div>

        <h3 className="mt-8 text-2xl font-semibold text-slate-900">
          Distribution Snapshot
        </h3>
        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-base font-semibold text-slate-800">
              Reason Distribution
            </p>
            <div className="mt-4 space-y-3">
              {reasonDistribution.rows.length === 0 && (
                <p className="text-sm text-slate-500">Belum ada data reason.</p>
              )}
              {reasonDistribution.rows.map((item) => {
                const percent =
                  reasonTotal > 0 ? (item.total / reasonTotal) * 100 : 0;
                return (
                  <div key={`${item.label}-${item.total}`}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                      <span>{asDistributionLabel(item.label)}</span>
                      <span>{item.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-sky-500"
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-base font-semibold text-slate-800">
              Action Distribution
            </p>
            <div className="mt-4 space-y-3">
              {actionDistribution.rows.length === 0 && (
                <p className="text-sm text-slate-500">Belum ada data action.</p>
              )}
              {actionDistribution.rows.map((item) => {
                const percent =
                  actionTotal > 0 ? (item.total / actionTotal) * 100 : 0;
                return (
                  <div key={`${item.label}-${item.total}`}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                      <span>{asDistributionLabel(item.label)}</span>
                      <span>{item.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-5">
          <p className="text-base font-semibold text-slate-800">
            Trade Performance Quick View
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <p className="text-sm text-slate-700">
              Average Win:{" "}
              <span className="font-semibold text-slate-900">
                {formatMoneyOptional(trade.avg_win)}
              </span>
            </p>
            <p className="text-sm text-slate-700">
              Average Loss:{" "}
              <span className="font-semibold text-slate-900">
                {formatMoneyOptional(trade.avg_loss)}
              </span>
            </p>
            <p className="text-sm text-slate-700">
              Best Trade:{" "}
              <span className="font-semibold text-slate-900">
                {formatMoneyOptional(trade.best_trade)}
              </span>
            </p>
            <p className="text-sm text-slate-700">
              Worst Trade:{" "}
              <span className="font-semibold text-slate-900">
                {formatMoneyOptional(trade.worst_trade)}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
          Level 1 - Raw Data
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">
          Candle Result Table
        </h3>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Symbol</th>
                <th className="px-4 py-3 font-semibold">TF</th>
                <th className="px-4 py-3 font-semibold">Candle</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Side</th>
                <th className="px-4 py-3 font-semibold">Spread</th>
                <th className="px-4 py-3 font-semibold">Entry</th>
                <th className="px-4 py-3 font-semibold">SL</th>
                <th className="px-4 py-3 font-semibold">TP</th>
              </tr>
            </thead>
            <tbody>
              {candleRows.rows.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={12}>
                    Belum ada data candle pada filter ini.
                  </td>
                </tr>
              )}
              {candleRows.rows.map((row) => (
                <tr key={`${row.broker_time}-${row.reason}-${row.action}`}>
                  <td className="border-t border-slate-200 px-4 py-3 text-slate-700">
                    {formatDateTime(row.broker_time)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">{row.symbol}</td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.timeframe}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.candle_type ?? "-"}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.status ?? "-"}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.reason ?? "-"}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.action ?? "-"}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.side ?? "-"}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatPrice(row.spread_points)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatPrice(row.entry)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatPrice(row.sl)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatPrice(row.tp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <h3 className="text-2xl font-semibold text-slate-900">Trade Close Table</h3>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Close Time</th>
                <th className="px-4 py-3 font-semibold">Symbol</th>
                <th className="px-4 py-3 font-semibold">Side</th>
                <th className="px-4 py-3 font-semibold">Close Reason</th>
                <th className="px-4 py-3 font-semibold">Close Price</th>
                <th className="px-4 py-3 font-semibold">Profit</th>
                <th className="px-4 py-3 font-semibold">Commission</th>
                <th className="px-4 py-3 font-semibold">Swap</th>
                <th className="px-4 py-3 font-semibold">Net Profit</th>
                <th className="px-4 py-3 font-semibold">Deal Ticket</th>
              </tr>
            </thead>
            <tbody>
              {tradeRows.rows.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={10}>
                    Belum ada data close trade pada filter ini.
                  </td>
                </tr>
              )}
              {tradeRows.rows.map((row) => (
                <tr key={`${row.broker_time}-${row.deal_ticket}`}>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatDateTime(row.broker_time)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">{row.symbol}</td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.side ?? "-"}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.close_reason ?? "-"}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatPrice(row.close_price)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatMoney(row.profit)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatMoney(row.commission)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatMoney(row.swap)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3 font-semibold">
                    {formatMoney(row.net_profit)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {row.deal_ticket ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 text-2xl font-semibold text-slate-900">Profit Curve</h3>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Cumulative Profit</th>
              </tr>
            </thead>
            <tbody>
              {profitCurve.rows.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={2}>
                    Belum ada titik profit curve pada filter ini.
                  </td>
                </tr>
              )}
              {profitCurve.rows.map((row) => (
                <tr key={`${row.broker_time}-${row.cumulative_profit}`}>
                  <td className="border-t border-slate-200 px-4 py-3">
                    {formatDateTime(row.broker_time)}
                  </td>
                  <td className="border-t border-slate-200 px-4 py-3 font-semibold">
                    {formatMoney(row.cumulative_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
