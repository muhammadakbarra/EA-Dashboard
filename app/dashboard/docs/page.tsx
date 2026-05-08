export default function DashboardDocsPage() {
  const brokerEndpoint = "POST /api/broker-broken";
  const engulfingEndpoint = "POST /api/engulfing-broken";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-sky-700 uppercase">
          Docs
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">
          Broker Broken & Engulfing Broken
        </h2>
        <p className="mt-4 text-lg text-slate-600">
          API untuk menerima event dari EA MT5: `candle_result` dan
          `trade_closed`.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <h3 className="text-2xl font-semibold text-slate-900">Penggunaan API</h3>
        <div className="mt-5 space-y-4 text-base text-slate-700">
          <p>
            Endpoint 1: <code>{brokerEndpoint}</code>
          </p>
          <p>
            Endpoint 2: <code>{engulfingEndpoint}</code>
          </p>
          <p>
            Header: <code>Content-Type: application/json</code>
          </p>
          <p>
            Optional Header:{" "}
            <code>Authorization: Bearer YOUR_SECRET_TOKEN</code>
          </p>
        </div>
        <pre className="mt-6 overflow-x-auto rounded-2xl bg-slate-900 p-5 text-sm text-slate-100">
{`curl -X POST http://localhost:3000/api/engulfing-broken \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \\
  -d '{
    "event": "candle_result",
    "ea_name": "engulfing-broken",
    "account": 12345678,
    "magic_number": 260509,
    "symbol": "XAUUSD",
    "timeframe": "M5",
    "broker_time": "2026.05.07 01:00:00",
    "open": 2340.10,
    "high": 2348.50,
    "low": 2339.80,
    "close": 2345.67,
    "status": "VALID_BUY",
    "reason": "BullishEngulfing + EMAOK",
    "action": "TRADE_OPENED",
    "buy_signal": true,
    "sell_signal": false
  }'`}
        </pre>
      </div>
    </div>
  );
}
