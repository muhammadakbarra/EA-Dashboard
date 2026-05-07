import { NextResponse } from "next/server";

import { query } from "@/lib/db";

type EventName = "candle_result" | "trade_closed";

type JsonRecord = Record<string, unknown>;

type CommonFields = {
  requestId: string | null;
  source: string;
  event: EventName;
  eaName: string;
  eaVersion: string | null;
  account: number;
  serverName: string | null;
  magicNumber: number;
  symbol: string;
  timeframe: string;
  brokerTime: string;
  sentAt: string | null;
};

const DATE_TIME_PATTERN =
  /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function parseDateTime(value: string): string | null {
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second
  ) {
    return null;
  }

  return parsed.toISOString();
}

function getRequiredString(
  payload: JsonRecord,
  key: string,
  errors: string[],
): string | null {
  const value = asString(payload[key]);
  if (!value) {
    errors.push(`${key} is required`);
    return null;
  }

  return value;
}

function getRequiredNumber(
  payload: JsonRecord,
  key: string,
  errors: string[],
): number | null {
  const value = asNumber(payload[key]);
  if (value === null) {
    errors.push(`${key} is required`);
    return null;
  }

  return value;
}

function getRequiredBoolean(
  payload: JsonRecord,
  key: string,
  errors: string[],
): boolean | null {
  const value = asBoolean(payload[key]);
  if (value === null) {
    errors.push(`${key} is required`);
    return null;
  }

  return value;
}

function getOptionalString(payload: JsonRecord, key: string): string | null {
  return asString(payload[key]);
}

function getOptionalNumber(payload: JsonRecord, key: string): number | null {
  return asNumber(payload[key]);
}

function getOptionalBoolean(payload: JsonRecord, key: string): boolean | null {
  return asBoolean(payload[key]);
}

function jsonOk(message: string, event: EventName) {
  return NextResponse.json(
    {
      ok: true,
      message,
      event,
    },
    { status: 200 },
  );
}

function jsonInvalid(errors: string[]) {
  return NextResponse.json(
    {
      ok: false,
      message: "invalid_payload",
      errors,
    },
    { status: 400 },
  );
}

async function upsertEaInstance(common: CommonFields): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO ea_instances (
      ea_name,
      ea_version,
      account,
      server_name,
      magic_number,
      symbol,
      timeframe,
      is_active,
      first_seen_at,
      last_seen_at,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      true, NOW(), NOW(), NOW(), NOW()
    )
    ON CONFLICT (account, magic_number, symbol, timeframe)
    DO UPDATE SET
      ea_name = EXCLUDED.ea_name,
      ea_version = EXCLUDED.ea_version,
      server_name = EXCLUDED.server_name,
      is_active = true,
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING id`,
    [
      common.eaName,
      common.eaVersion,
      common.account,
      common.serverName,
      common.magicNumber,
      common.symbol,
      common.timeframe,
    ],
  );

  return result.rows[0].id;
}

async function insertCandleResult(
  payload: JsonRecord,
  common: CommonFields,
  eaInstanceId: number,
) {
  const result = await query(
    `INSERT INTO mt5_candle_results (
      request_id,
      ea_instance_id,
      source,
      event,
      ea_name,
      ea_version,
      account,
      server_name,
      magic_number,
      symbol,
      timeframe,
      broker_time,
      sent_at,
      open,
      high,
      low,
      close,
      candle_type,
      upper_wick_points,
      lower_wick_points,
      buy_checked_wick_points,
      sell_checked_wick_points,
      wick_tolerance_points,
      use_ema_filter,
      fast_ema_period,
      slow_ema_period,
      fast_ema_value,
      slow_ema_value,
      candle_buy_valid,
      candle_sell_valid,
      ema_buy_valid,
      ema_sell_valid,
      buy_signal,
      sell_signal,
      status,
      reason,
      spread_points,
      max_spread_points,
      has_position,
      action,
      side,
      lot,
      entry,
      sl,
      tp,
      retcode,
      retcode_description,
      skip_reason,
      payload
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12::timestamptz, $13::timestamptz,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
      $24, $25, $26, $27, $28, $29, $30, $31, $32, $33,
      $34, $35, $36, $37, $38, $39, $40, $41, $42, $43,
      $44, $45, $46, $47, $48, $49::jsonb
    )
    ON CONFLICT DO NOTHING`,
    [
      common.requestId,
      eaInstanceId,
      common.source,
      common.event,
      common.eaName,
      common.eaVersion,
      common.account,
      common.serverName,
      common.magicNumber,
      common.symbol,
      common.timeframe,
      common.brokerTime,
      common.sentAt,
      getOptionalNumber(payload, "open"),
      getOptionalNumber(payload, "high"),
      getOptionalNumber(payload, "low"),
      getOptionalNumber(payload, "close"),
      getOptionalString(payload, "candle_type"),
      getOptionalNumber(payload, "upper_wick_points"),
      getOptionalNumber(payload, "lower_wick_points"),
      getOptionalNumber(payload, "buy_checked_wick_points"),
      getOptionalNumber(payload, "sell_checked_wick_points"),
      getOptionalNumber(payload, "wick_tolerance_points"),
      getOptionalBoolean(payload, "use_ema_filter"),
      getOptionalNumber(payload, "fast_ema_period"),
      getOptionalNumber(payload, "slow_ema_period"),
      getOptionalNumber(payload, "fast_ema_value"),
      getOptionalNumber(payload, "slow_ema_value"),
      getOptionalBoolean(payload, "candle_buy_valid"),
      getOptionalBoolean(payload, "candle_sell_valid"),
      getOptionalBoolean(payload, "ema_buy_valid"),
      getOptionalBoolean(payload, "ema_sell_valid"),
      getOptionalBoolean(payload, "buy_signal"),
      getOptionalBoolean(payload, "sell_signal"),
      getOptionalString(payload, "status"),
      getOptionalString(payload, "reason"),
      getOptionalNumber(payload, "spread_points"),
      getOptionalNumber(payload, "max_spread_points"),
      getOptionalBoolean(payload, "has_position"),
      getOptionalString(payload, "action"),
      getOptionalString(payload, "side"),
      getOptionalNumber(payload, "lot"),
      getOptionalNumber(payload, "entry"),
      getOptionalNumber(payload, "sl"),
      getOptionalNumber(payload, "tp"),
      getOptionalNumber(payload, "retcode"),
      getOptionalString(payload, "retcode_description"),
      getOptionalString(payload, "skip_reason"),
      JSON.stringify(payload),
    ],
  );

  return (result.rowCount ?? 0) > 0;
}

async function insertTradeClosed(
  payload: JsonRecord,
  common: CommonFields,
  eaInstanceId: number,
) {
  const result = await query(
    `INSERT INTO mt5_trade_closes (
      request_id,
      ea_instance_id,
      source,
      event,
      ea_name,
      ea_version,
      account,
      server_name,
      magic_number,
      symbol,
      timeframe,
      broker_time,
      sent_at,
      side,
      status,
      close_reason,
      position_id,
      deal_ticket,
      order_ticket,
      volume,
      close_price,
      profit,
      commission,
      swap,
      fee,
      net_profit,
      comment,
      payload
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12::timestamptz, $13::timestamptz,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
      $24, $25, $26, $27, $28::jsonb
    )
    ON CONFLICT DO NOTHING`,
    [
      common.requestId,
      eaInstanceId,
      common.source,
      common.event,
      common.eaName,
      common.eaVersion,
      common.account,
      common.serverName,
      common.magicNumber,
      common.symbol,
      common.timeframe,
      common.brokerTime,
      common.sentAt,
      getOptionalString(payload, "side"),
      getOptionalString(payload, "status") ?? "closed",
      getOptionalString(payload, "close_reason"),
      getOptionalNumber(payload, "position_id"),
      getOptionalNumber(payload, "deal_ticket"),
      getOptionalNumber(payload, "order_ticket"),
      getOptionalNumber(payload, "volume"),
      getOptionalNumber(payload, "close_price"),
      getOptionalNumber(payload, "profit"),
      getOptionalNumber(payload, "commission"),
      getOptionalNumber(payload, "swap"),
      getOptionalNumber(payload, "fee"),
      getOptionalNumber(payload, "net_profit"),
      getOptionalString(payload, "comment"),
      JSON.stringify(payload),
    ],
  );

  return (result.rowCount ?? 0) > 0;
}

function validateCommon(payload: JsonRecord, errors: string[]): CommonFields | null {
  const eventRaw = getRequiredString(payload, "event", errors);
  const eaName = getRequiredString(payload, "ea_name", errors);
  const account = getRequiredNumber(payload, "account", errors);
  const magicNumber = getRequiredNumber(payload, "magic_number", errors);
  const symbol = getRequiredString(payload, "symbol", errors);
  const timeframe = getRequiredString(payload, "timeframe", errors);
  const brokerTimeRaw = getRequiredString(payload, "broker_time", errors);

  if (!eventRaw || !eaName || account === null || magicNumber === null || !symbol || !timeframe || !brokerTimeRaw) {
    return null;
  }

  if (eventRaw !== "candle_result" && eventRaw !== "trade_closed") {
    return null;
  }

  const brokerTime = parseDateTime(brokerTimeRaw);
  if (!brokerTime) {
    errors.push("broker_time has invalid format (expected YYYY.MM.DD HH:MM:SS)");
    return null;
  }

  const sentAtRaw = getOptionalString(payload, "sent_at");
  let sentAt: string | null = null;
  if (sentAtRaw) {
    sentAt = parseDateTime(sentAtRaw);
    if (!sentAt) {
      errors.push("sent_at has invalid format (expected YYYY.MM.DD HH:MM:SS)");
      return null;
    }
  }

  return {
    requestId: getOptionalString(payload, "request_id"),
    source: getOptionalString(payload, "source") ?? "mt5",
    event: eventRaw,
    eaName,
    eaVersion: getOptionalString(payload, "ea_version"),
    account,
    serverName: getOptionalString(payload, "server"),
    magicNumber,
    symbol,
    timeframe,
    brokerTime,
    sentAt,
  };
}

function validateCandlePayload(payload: JsonRecord, errors: string[]) {
  getRequiredNumber(payload, "open", errors);
  getRequiredNumber(payload, "high", errors);
  getRequiredNumber(payload, "low", errors);
  getRequiredNumber(payload, "close", errors);
  getRequiredString(payload, "status", errors);
  getRequiredString(payload, "reason", errors);
  getRequiredString(payload, "action", errors);
  getRequiredBoolean(payload, "buy_signal", errors);
  getRequiredBoolean(payload, "sell_signal", errors);
}

function validateTradeClosedPayload(payload: JsonRecord, errors: string[]) {
  getRequiredString(payload, "close_reason", errors);
  getRequiredNumber(payload, "deal_ticket", errors);
  getRequiredNumber(payload, "position_id", errors);
  getRequiredNumber(payload, "close_price", errors);
  getRequiredNumber(payload, "profit", errors);
  getRequiredNumber(payload, "net_profit", errors);
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      message: "unauthorized",
    },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  try {
    const configuredToken = asString(process.env.BROKER_BROKEN_API_TOKEN);
    if (configuredToken) {
      const authorizationHeader = request.headers.get("authorization");
      const receivedToken =
        authorizationHeader && authorizationHeader.startsWith("Bearer ")
          ? authorizationHeader.slice(7).trim()
          : null;

      if (!receivedToken || receivedToken !== configuredToken) {
        return unauthorizedResponse();
      }
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonInvalid(["body must be a valid JSON object"]);
    }

    if (!isRecord(payload)) {
      return jsonInvalid(["body must be a valid JSON object"]);
    }

    const errors: string[] = [];
    const common = validateCommon(payload, errors);

    if (errors.length > 0) {
      return jsonInvalid(errors);
    }

    if (!common) {
      const event = asString(payload.event) ?? "unknown";
      return NextResponse.json(
        {
          ok: false,
          message: "unknown_event",
          event,
        },
        { status: 400 },
      );
    }

    if (common.event === "candle_result") {
      validateCandlePayload(payload, errors);
      if (errors.length > 0) {
        return jsonInvalid(errors);
      }

      const eaInstanceId = await upsertEaInstance(common);
      const inserted = await insertCandleResult(payload, common, eaInstanceId);

      return inserted
        ? jsonOk("event_saved", common.event)
        : jsonOk("duplicate_ignored", common.event);
    }

    validateTradeClosedPayload(payload, errors);
    if (errors.length > 0) {
      return jsonInvalid(errors);
    }

    const eaInstanceId = await upsertEaInstance(common);
    const inserted = await insertTradeClosed(payload, common, eaInstanceId);

    return inserted
      ? jsonOk("event_saved", common.event)
      : jsonOk("duplicate_ignored", common.event);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "internal_server_error",
      },
      { status: 500 },
    );
  }
}
