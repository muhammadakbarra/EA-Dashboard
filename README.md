# EA Dashboard

Production-focused dashboard for monitoring MT5 Expert Advisor (EA) signal quality and trade outcomes.

## Overview

EA Dashboard is designed to solve two core questions:

1. Is the EA decision logic producing valid signals consistently?
2. Are executed signals delivering positive trade performance?

This project includes:

- Secure login flow (`/login` -> `/dashboard`)
- MT5 event ingestion API (`POST /api/broker-broken`)
- PostgreSQL data model for raw + analytics-friendly storage
- Dashboard views for summary metrics and EA-level analysis

## Core Features

- `MT5 Event Ingestion`
    - Supports `candle_result` and `trade_closed`
    - Payload validation by event type
    - Duplicate-safe inserts (`request_id`, `deal_ticket`, and unique constraints)
    - Optional bearer token authentication

- `EA Analytics Dashboard`
    - Overview cards for daily performance snapshot
    - EA page with:
        - EA selector (button-style)
        - Filter by account, magic number, symbol, timeframe, and date range
        - Summary cards
        - Signal and action distributions
        - Candle result table
        - Trade close table
        - Profit curve (cumulative net profit)

- `Structured Data Pipeline`
    - Raw data persisted as `payload JSONB`
    - Processed/summary metrics computed through SQL aggregations
    - Dashboard-ready views rendered server-side in Next.js App Router

## Tech Stack

- Next.js `16.2.5` (App Router)
- React `19.2.4`
- TypeScript
- Tailwind CSS `v4`
- PostgreSQL
- `pg` Node driver

## Project Structure

```text
app/
  api/
    broker-broken/route.ts   # MT5 ingestion endpoint
    login/route.ts           # login handler
    logout/route.ts          # logout handler
  dashboard/
    layout.tsx               # authenticated dashboard shell
    page.tsx                 # overview
    ea/page.tsx              # EA analytics
    docs/page.tsx            # internal docs page (not shown in sidebar)
  login/page.tsx             # login UI
  page.tsx                   # redirect to /login
db/
  broker-broken.sql          # schema + indexes
lib/
  db.ts                      # PostgreSQL pool/query helper
```

## Getting Started

### 1. Prerequisites

- Node.js 20+ (recommended 22+)
- PostgreSQL 14+

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create `.env` in project root:

```env
DB_URL=postgresql://<user>:<password>@<host>:5432/<database>
BROKER_BROKEN_API_TOKEN=<your_secret_token>
```

Notes:

- `BROKER_BROKEN_API_TOKEN` is optional.
- If token is set, `Authorization: Bearer <token>` becomes required for `/api/broker-broken`.

### 4. Initialize Database Schema

```bash
psql "$DB_URL" -f db/broker-broken.sql
```

### 5. Run the App

```bash
npm run dev
```

Open: `http://localhost:3000`

## API Quickstart

### Endpoint

`POST /api/broker-broken`

### Headers

```http
Content-Type: application/json
Authorization: Bearer <token>   # optional unless token env is set
```

### Example Payload (`candle_result`)

```json
{
    "request_id": "req-1",
    "source": "mt5",
    "event": "candle_result",
    "ea_name": "broker-broke",
    "account": 12345678,
    "magic_number": 20260505,
    "symbol": "XAUUSD",
    "timeframe": "M5",
    "broker_time": "2026.05.07 01:00:00",
    "open": 2340.1,
    "high": 2348.5,
    "low": 2339.8,
    "close": 2345.67,
    "status": "INVALID",
    "reason": "BuyEMAInvalid",
    "action": "NO_ENTRY",
    "buy_signal": false,
    "sell_signal": false
}
```

### Success Response

```json
{
    "ok": true,
    "message": "event_saved",
    "event": "candle_result"
}
```

### Duplicate Response

```json
{
    "ok": true,
    "message": "duplicate_ignored",
    "event": "trade_closed"
}
```

## Database Model

The project ships with a dedicated schema for EA monitoring:

- `ea_instances`
- `mt5_candle_results`
- `mt5_trade_closes`

Schema and indexes are defined in:

- [db/broker-broken.sql](/Users/akbarra/Project/bisnis/ea-dashboard/db/broker-broken.sql)

## Available Scripts

- `npm run dev` — run development server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — run ESLint

## Engineering Notes

- All writes are optimized for fast ingestion and idempotent behavior.
- Analytics are computed with SQL aggregations (not heavy processing in POST handler).
- Dashboard pages are server-rendered and query directly from PostgreSQL.

## Roadmap (V1 -> V2)

- Add dedicated read APIs for dashboard (`/api/dashboard/*`)
- Add chart components (profit curve, reason/action distribution)
- Add pagination and export for raw event tables
- Add role-based multi-user access
