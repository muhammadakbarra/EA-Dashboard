

//+------------------------------------------------------------------+
//|                              engulfing-broken.mq5                |
//|      Engulfing marker + EMA filter + auto trade + API push        |
//+------------------------------------------------------------------+
#property strict
#property version "1.01"

#include <Trade/Trade.mqh>
CTrade trade;

//+------------------------------------------------------------------+
//| Strategy input                                                    |
//+------------------------------------------------------------------+
input int      EMA_1_Period             = 9;
input int      EMA_2_Period             = 21;
input int      EMA_3_Period             = 50;

input int      BarsToScan               = 0;       // 0 = scan semua candle history yang tersedia
input int      ArrowOffsetPoints        = 100;
input bool     DeleteOldMarks           = true;
input bool     DetectGapEngulfing       = true;

input int      MaxEngulfingCandlePoints = 3001;

input bool     EnableAutoTrade          = true;
input double   RiskMoneyPerTrade        = 200.0;   // default risk uang per trade
input double   TakeProfitRR             = 3.0;     // TP = 3R
input ulong    MagicNumber              = 260509;
input bool     OnePositionAtATime       = true;
input int      MaxSlippagePoints        = 30;
input int      MaxSpreadPoints          = 0;       // 0 = tidak pakai filter spread

input bool     AddSpreadToSL            = true;    // BUY SL dikurangi spread, SELL SL ditambah spread
input bool     AutoReduceLotIfNoMoney   = true;    // kecilkan lot otomatis jika margin tidak cukup
input double   MarginSafetyPercent      = 95.0;    // gunakan max 95% free margin saat hitung penyesuaian lot

input color    BullishArrowColor        = clrLime;
input color    BearishArrowColor        = clrRed;

input int      BullishArrowCode         = 233;
input int      BearishArrowCode         = 234;

input string   ObjectPrefix             = "ENGULF_AUTO_";

//+------------------------------------------------------------------+
//| API input                                                         |
//+------------------------------------------------------------------+
input bool     EnableApiPush            = true;
input string   ApiUrl                   = "https://ea.bangunwebsite.id/api/engulfing-broken";
input string   ApiBearerToken           = "d7c9afbd79a2cdd857fbed875097a6a8c66727bd52a960a291f4852b8842bd97";
input int      ApiTimeoutMs             = 1000;
input string   EaName                   = "engulfing-broken";
input string   EaVersion                = "1.01";
input bool     PrintApiResult           = true;

//+------------------------------------------------------------------+
//| Global                                                           |
//+------------------------------------------------------------------+
int emaHandle1 = INVALID_HANDLE;
int emaHandle2 = INVALID_HANDLE;
int emaHandle3 = INVALID_HANDLE;

datetime lastBarTime = 0;
datetime lastTradedSignalTime = 0;

//+------------------------------------------------------------------+
//| JSON helpers                                                      |
//+------------------------------------------------------------------+
string JsonBool(bool value)
{
   return value ? "true" : "false";
}

string JsonEscape(string value)
{
   string result = value;

   StringReplace(result, "\\", "\\\\");
   StringReplace(result, "\"", "\\\"");
   StringReplace(result, "\r", "\\r");
   StringReplace(result, "\n", "\\n");
   StringReplace(result, "\t", "\\t");

   return result;
}

string TimeToJson(datetime value)
{
   return TimeToString(value, TIME_DATE | TIME_SECONDS);
}

string TimeframeLabel()
{
   string tf = EnumToString(_Period);
   StringReplace(tf, "PERIOD_", "");
   return tf;
}

//+------------------------------------------------------------------+
//| API POST                                                          |
//+------------------------------------------------------------------+
bool PushJsonToApi(string payload)
{
   if(!EnableApiPush)
      return false;

   char post[];
   char result[];
   string resultHeaders;

   int len = StringToCharArray(payload, post, 0, WHOLE_ARRAY, CP_UTF8);

   if(len > 0)
      ArrayResize(post, len - 1);

   string headers =
      "Content-Type: application/json\r\n"
      "User-Agent: MT5-EA\r\n";

   if(StringLen(ApiBearerToken) > 0)
      headers += "Authorization: Bearer " + ApiBearerToken + "\r\n";

   ResetLastError();

   int httpCode = WebRequest(
      "POST",
      ApiUrl,
      headers,
      ApiTimeoutMs,
      post,
      result,
      resultHeaders
   );

   if(httpCode == -1)
   {
      int err = GetLastError();

      if(PrintApiResult)
      {
         Print("API push failed. Error:", err,
               " | Pastikan URL sudah whitelist di MT5: https://ea.bangunwebsite.id");
      }

      return false;
   }

   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

   if(PrintApiResult)
   {
      Print("API push done. HTTP:", httpCode,
            " | Response:", response);
   }

   return (httpCode >= 200 && httpCode < 300);
}

//+------------------------------------------------------------------+
//| Build request id                                                  |
//+------------------------------------------------------------------+
string BuildRequestId(string eventName, string symbol, datetime eventTime, string extra = "")
{
   string requestId =
      EaName + "-"
      + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + "-"
      + IntegerToString((long)MagicNumber) + "-"
      + symbol + "-"
      + TimeframeLabel() + "-"
      + TimeToString(eventTime, TIME_DATE | TIME_SECONDS) + "-"
      + eventName;

   if(StringLen(extra) > 0)
      requestId += "-" + extra;

   return requestId;
}

//+------------------------------------------------------------------+
//| Build common JSON fields                                          |
//+------------------------------------------------------------------+
string BuildCommonJson(string eventName, string symbol, datetime brokerTime, string extraRequestId = "")
{
   string json = "";

   json += "\"request_id\":\"" + JsonEscape(BuildRequestId(eventName, symbol, brokerTime, extraRequestId)) + "\",";
   json += "\"source\":\"mt5\",";
   json += "\"event\":\"" + JsonEscape(eventName) + "\",";
   json += "\"ea_name\":\"" + JsonEscape(EaName) + "\",";
   json += "\"ea_version\":\"" + JsonEscape(EaVersion) + "\",";
   json += "\"account\":" + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + ",";
   json += "\"server\":\"" + JsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   json += "\"magic_number\":" + IntegerToString((long)MagicNumber) + ",";
   json += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
   json += "\"timeframe\":\"" + JsonEscape(TimeframeLabel()) + "\",";
   json += "\"broker_time\":\"" + JsonEscape(TimeToJson(brokerTime)) + "\",";
   json += "\"sent_at\":\"" + JsonEscape(TimeToJson(TimeCurrent())) + "\"";

   return json;
}

//+------------------------------------------------------------------+
//| Push candle_result                                                |
//+------------------------------------------------------------------+
void PushCandleResult(
   datetime candleTime,
   double openPrice,
   double highPrice,
   double lowPrice,
   double closePrice,
   string statusText,
   string reasonText,
   string actionText,
   bool buySignal,
   bool sellSignal,
   string sideText,
   double lot,
   double entry,
   double sl,
   double tp,
   double riskTarget,
   double riskActual,
   int retcode,
   string retcodeDescription,
   string skipReason
)
{
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   double spreadPoints = 0.0;

   if(ask > 0.0 && bid > 0.0 && point > 0.0)
      spreadPoints = (ask - bid) / point;

   string json = "{";

   json += BuildCommonJson("candle_result", _Symbol, candleTime) + ",";

   json += "\"open\":" + DoubleToString(openPrice, digits) + ",";
   json += "\"high\":" + DoubleToString(highPrice, digits) + ",";
   json += "\"low\":" + DoubleToString(lowPrice, digits) + ",";
   json += "\"close\":" + DoubleToString(closePrice, digits) + ",";

   json += "\"status\":\"" + JsonEscape(statusText) + "\",";
   json += "\"reason\":\"" + JsonEscape(reasonText) + "\",";
   json += "\"action\":\"" + JsonEscape(actionText) + "\",";
   json += "\"buy_signal\":" + JsonBool(buySignal) + ",";
   json += "\"sell_signal\":" + JsonBool(sellSignal);

   json += ",\"side\":\"" + JsonEscape(sideText) + "\"";
   json += ",\"lot\":" + DoubleToString(lot, 2);
   json += ",\"entry\":" + DoubleToString(entry, digits);
   json += ",\"sl\":" + DoubleToString(sl, digits);
   json += ",\"tp\":" + DoubleToString(tp, digits);
   json += ",\"risk_target\":" + DoubleToString(riskTarget, 2);
   json += ",\"risk_actual\":" + DoubleToString(riskActual, 2);
   json += ",\"rr\":" + DoubleToString(TakeProfitRR, 2);
   json += ",\"spread_points\":" + DoubleToString(spreadPoints, 2);
   json += ",\"add_spread_to_sl\":" + JsonBool(AddSpreadToSL);
   json += ",\"auto_reduce_lot_if_no_money\":" + JsonBool(AutoReduceLotIfNoMoney);
   json += ",\"retcode\":" + IntegerToString(retcode);
   json += ",\"retcode_description\":\"" + JsonEscape(retcodeDescription) + "\"";
   json += ",\"skip_reason\":\"" + JsonEscape(skipReason) + "\"";

   json += "}";

   PushJsonToApi(json);
}

//+------------------------------------------------------------------+
//| Deal reason to text                                               |
//+------------------------------------------------------------------+
string DealReasonToText(long reason)
{
   if(reason == DEAL_REASON_SL)
      return "SL";

   if(reason == DEAL_REASON_TP)
      return "TP";

   if(reason == DEAL_REASON_CLIENT)
      return "MANUAL";

   if(reason == DEAL_REASON_EXPERT)
      return "EA";

   if(reason == DEAL_REASON_SO)
      return "STOP_OUT";

   if(reason == DEAL_REASON_MOBILE)
      return "MOBILE";

   if(reason == DEAL_REASON_WEB)
      return "WEB";

   return "OTHER";
}

//+------------------------------------------------------------------+
//| Deal type to closed position side                                 |
//+------------------------------------------------------------------+
string ClosedPositionSide(long dealType)
{
   if(dealType == DEAL_TYPE_SELL)
      return "BUY";

   if(dealType == DEAL_TYPE_BUY)
      return "SELL";

   return "OTHER";
}

//+------------------------------------------------------------------+
//| Push trade_closed                                                 |
//+------------------------------------------------------------------+
void PushTradeClosed(ulong dealTicket)
{
   if(!HistoryDealSelect(dealTicket))
      return;

   long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);

   if((ulong)magic != MagicNumber)
      return;

   long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);

   if(entryType != DEAL_ENTRY_OUT && entryType != DEAL_ENTRY_OUT_BY)
      return;

   string symbol       = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   long dealType       = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   long reason         = HistoryDealGetInteger(dealTicket, DEAL_REASON);
   long positionId     = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   long orderTicket    = HistoryDealGetInteger(dealTicket, DEAL_ORDER);
   datetime dealTime   = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);

   double volume       = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double closePrice   = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   double profit       = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double commission   = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   double swap         = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
   double fee          = HistoryDealGetDouble(dealTicket, DEAL_FEE);
   double netProfit    = profit + commission + swap + fee;

   string comment      = HistoryDealGetString(dealTicket, DEAL_COMMENT);
   string closeReason  = DealReasonToText(reason);
   string side         = ClosedPositionSide(dealType);

   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   string dealTicketText = IntegerToString((long)dealTicket);

   string json = "{";

   json += BuildCommonJson("trade_closed", symbol, dealTime, dealTicketText) + ",";

   json += "\"side\":\"" + JsonEscape(side) + "\",";
   json += "\"status\":\"closed\",";
   json += "\"close_reason\":\"" + JsonEscape(closeReason) + "\",";

   json += "\"position_id\":" + IntegerToString(positionId) + ",";
   json += "\"deal_ticket\":" + dealTicketText + ",";
   json += "\"order_ticket\":" + IntegerToString(orderTicket) + ",";

   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"close_price\":" + DoubleToString(closePrice, digits) + ",";

   json += "\"profit\":" + DoubleToString(profit, 2) + ",";
   json += "\"commission\":" + DoubleToString(commission, 2) + ",";
   json += "\"swap\":" + DoubleToString(swap, 2) + ",";
   json += "\"fee\":" + DoubleToString(fee, 2) + ",";
   json += "\"net_profit\":" + DoubleToString(netProfit, 2) + ",";

   json += "\"comment\":\"" + JsonEscape(comment) + "\"";

   json += "}";

   Print("Trade closed detected. Symbol:", symbol,
         " | Side:", side,
         " | Reason:", closeReason,
         " | Profit:", DoubleToString(profit, 2),
         " | Net:", DoubleToString(netProfit, 2),
         " | Deal:", dealTicket,
         " | Position:", positionId);

   PushJsonToApi(json);
}

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   emaHandle1 = iMA(_Symbol, _Period, EMA_1_Period, 0, MODE_EMA, PRICE_CLOSE);
   emaHandle2 = iMA(_Symbol, _Period, EMA_2_Period, 0, MODE_EMA, PRICE_CLOSE);
   emaHandle3 = iMA(_Symbol, _Period, EMA_3_Period, 0, MODE_EMA, PRICE_CLOSE);

   if(emaHandle1 == INVALID_HANDLE || emaHandle2 == INVALID_HANDLE || emaHandle3 == INVALID_HANDLE)
      return INIT_FAILED;

   trade.SetExpertMagicNumber(MagicNumber);
   trade.SetDeviationInPoints(MaxSlippagePoints);

   Comment("");

   lastBarTime = iTime(_Symbol, _Period, 0);

   ScanAndMarkHistory();

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(emaHandle1 != INVALID_HANDLE)
      IndicatorRelease(emaHandle1);

   if(emaHandle2 != INVALID_HANDLE)
      IndicatorRelease(emaHandle2);

   if(emaHandle3 != INVALID_HANDLE)
      IndicatorRelease(emaHandle3);

   Comment("");
}

//+------------------------------------------------------------------+
//| Expert tick                                                       |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime currentBarTime = iTime(_Symbol, _Period, 0);

   if(currentBarTime != lastBarTime)
   {
      lastBarTime = currentBarTime;
      CheckLatestClosedCandleAndTrade();
   }
}

//+------------------------------------------------------------------+
//| Scan history untuk marker                                         |
//+------------------------------------------------------------------+
void ScanAndMarkHistory()
{
   Comment("");

   if(DeleteOldMarks)
      DeleteObjectsByPrefix(ObjectPrefix);

   int totalBars = Bars(_Symbol, _Period);

   if(totalBars <= EMA_3_Period + 5)
      return;

   int barsNeeded;

   if(BarsToScan <= 0)
      barsNeeded = totalBars;
   else
      barsNeeded = MathMin(BarsToScan, totalBars);

   MqlRates rates[];
   double ema1[];
   double ema2[];
   double ema3[];

   ArraySetAsSeries(rates, true);
   ArraySetAsSeries(ema1, true);
   ArraySetAsSeries(ema2, true);
   ArraySetAsSeries(ema3, true);

   int copiedRates = CopyRates(_Symbol, _Period, 0, barsNeeded, rates);

   if(copiedRates <= EMA_3_Period + 5)
      return;

   int copiedEma1 = CopyBuffer(emaHandle1, 0, 0, copiedRates, ema1);
   int copiedEma2 = CopyBuffer(emaHandle2, 0, 0, copiedRates, ema2);
   int copiedEma3 = CopyBuffer(emaHandle3, 0, 0, copiedRates, ema3);

   if(copiedEma1 <= 0 || copiedEma2 <= 0 || copiedEma3 <= 0)
      return;

   int maxIndex = MathMin(copiedRates, MathMin(copiedEma1, MathMin(copiedEma2, copiedEma3)));

   for(int i = maxIndex - 2; i >= 1; i--)
   {
      ProcessCandleForMarker(rates, ema1, ema2, ema3, i);
   }

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Check latest candle and trade                                     |
//+------------------------------------------------------------------+
void CheckLatestClosedCandleAndTrade()
{
   Comment("");

   int barsNeeded = MathMax(EMA_3_Period + 10, 100);

   MqlRates rates[];
   double ema1[];
   double ema2[];
   double ema3[];

   ArraySetAsSeries(rates, true);
   ArraySetAsSeries(ema1, true);
   ArraySetAsSeries(ema2, true);
   ArraySetAsSeries(ema3, true);

   int copiedRates = CopyRates(_Symbol, _Period, 0, barsNeeded, rates);

   if(copiedRates <= EMA_3_Period + 5)
      return;

   int copiedEma1 = CopyBuffer(emaHandle1, 0, 0, copiedRates, ema1);
   int copiedEma2 = CopyBuffer(emaHandle2, 0, 0, copiedRates, ema2);
   int copiedEma3 = CopyBuffer(emaHandle3, 0, 0, copiedRates, ema3);

   if(copiedEma1 <= 0 || copiedEma2 <= 0 || copiedEma3 <= 0)
      return;

   int i = 1;

   if(rates[i].time == lastTradedSignalTime)
      return;

   bool bullishValid = IsValidBullishSignal(rates, ema1, ema2, ema3, i);
   bool bearishValid = IsValidBearishSignal(rates, ema1, ema2, ema3, i);

   string statusText = "INVALID";
   string reasonText = "No valid engulfing";
   string actionText = "NO_ENTRY";
   string sideText = "-";
   string skipReason = "";

   bool buySignal = bullishValid;
   bool sellSignal = bearishValid;

   double lot = 0.0;
   double entry = 0.0;
   double sl = 0.0;
   double tp = 0.0;
   double riskActual = 0.0;

   int retcode = 0;
   string retcodeDescription = "";

   if(bullishValid)
   {
      statusText = "VALID_BUY";
      reasonText = "BullishEngulfing + EMAOK";
      sideText = "BUY";
   }
   else if(bearishValid)
   {
      statusText = "VALID_SELL";
      reasonText = "BearishEngulfing + EMAOK";
      sideText = "SELL";
   }

   if(bullishValid || bearishValid)
   {
      ProcessCandleForMarker(rates, ema1, ema2, ema3, i);
      ChartRedraw(0);
   }

   if(!bullishValid && !bearishValid)
   {
      PushCandleResult(
         rates[i].time,
         rates[i].open,
         rates[i].high,
         rates[i].low,
         rates[i].close,
         statusText,
         reasonText,
         actionText,
         false,
         false,
         sideText,
         lot,
         entry,
         sl,
         tp,
         RiskMoneyPerTrade,
         riskActual,
         retcode,
         retcodeDescription,
         skipReason
      );

      lastTradedSignalTime = rates[i].time;
      return;
   }

   if(!EnableAutoTrade)
   {
      actionText = "NO_ENTRY";
      skipReason = "AUTO_TRADE_DISABLED";

      BuildTradePlan(rates, i, bullishValid ? 1 : -1, lot, entry, sl, tp, riskActual);

      PushCandleResult(
         rates[i].time,
         rates[i].open,
         rates[i].high,
         rates[i].low,
         rates[i].close,
         statusText,
         reasonText,
         actionText,
         buySignal,
         sellSignal,
         sideText,
         lot,
         entry,
         sl,
         tp,
         RiskMoneyPerTrade,
         riskActual,
         retcode,
         retcodeDescription,
         skipReason
      );

      lastTradedSignalTime = rates[i].time;
      return;
   }

   if(OnePositionAtATime && HasOpenPositionByMagic(_Symbol, MagicNumber))
   {
      actionText = "TRADE_SKIPPED";
      skipReason = "HAS_OPEN_POSITION";

      BuildTradePlan(rates, i, bullishValid ? 1 : -1, lot, entry, sl, tp, riskActual);

      Print("Sinyal valid, tapi posisi masih aktif. Entry dilewati.");

      PushCandleResult(
         rates[i].time,
         rates[i].open,
         rates[i].high,
         rates[i].low,
         rates[i].close,
         statusText,
         reasonText,
         actionText,
         buySignal,
         sellSignal,
         sideText,
         lot,
         entry,
         sl,
         tp,
         RiskMoneyPerTrade,
         riskActual,
         retcode,
         retcodeDescription,
         skipReason
      );

      lastTradedSignalTime = rates[i].time;
      return;
   }

   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   if(point > 0 && ask > 0 && bid > 0)
   {
      double spreadPoints = (ask - bid) / point;

      if(MaxSpreadPoints > 0 && spreadPoints > MaxSpreadPoints)
      {
         actionText = "TRADE_SKIPPED";
         skipReason = "SPREAD_TOO_HIGH";

         BuildTradePlan(rates, i, bullishValid ? 1 : -1, lot, entry, sl, tp, riskActual);

         PushCandleResult(
            rates[i].time,
            rates[i].open,
            rates[i].high,
            rates[i].low,
            rates[i].close,
            statusText,
            reasonText,
            actionText,
            buySignal,
            sellSignal,
            sideText,
            lot,
            entry,
            sl,
            tp,
            RiskMoneyPerTrade,
            riskActual,
            retcode,
            retcodeDescription,
            skipReason
         );

         lastTradedSignalTime = rates[i].time;
         return;
      }
   }

   bool opened = OpenTradeFromSignal(rates, i, bullishValid ? 1 : -1, lot, entry, sl, tp, riskActual, retcode, retcodeDescription);

   actionText = opened ? "TRADE_OPENED" : "TRADE_FAILED";

   PushCandleResult(
      rates[i].time,
      rates[i].open,
      rates[i].high,
      rates[i].low,
      rates[i].close,
      statusText,
      reasonText,
      actionText,
      buySignal,
      sellSignal,
      sideText,
      lot,
      entry,
      sl,
      tp,
      RiskMoneyPerTrade,
      riskActual,
      retcode,
      retcodeDescription,
      skipReason
   );

   lastTradedSignalTime = rates[i].time;
}

//+------------------------------------------------------------------+
//| Build trade plan                                                  |
//| BUY  => SL = low candle - spread                                  |
//| SELL => SL = high candle + spread                                 |
//+------------------------------------------------------------------+
bool BuildTradePlan(
   const MqlRates &rates[],
   int i,
   int direction,
   double &lot,
   double &entry,
   double &sl,
   double &tp,
   double &riskActual
)
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(ask <= 0.0 || bid <= 0.0 || point <= 0.0)
      return false;

   double spreadPrice = ask - bid;

   if(spreadPrice < 0.0)
      spreadPrice = 0.0;

   if(direction == 1)
   {
      entry = ask;

      if(AddSpreadToSL)
         sl = rates[i].low - spreadPrice;
      else
         sl = rates[i].low;

      if(sl >= entry)
         return false;

      double riskPrice = entry - sl;
      tp = entry + (riskPrice * TakeProfitRR);
   }
   else if(direction == -1)
   {
      entry = bid;

      if(AddSpreadToSL)
         sl = rates[i].high + spreadPrice;
      else
         sl = rates[i].high;

      if(sl <= entry)
         return false;

      double riskPrice = sl - entry;
      tp = entry - (riskPrice * TakeProfitRR);
   }
   else
   {
      return false;
   }

   lot = CalculateDynamicLotByRisk(entry, sl, RiskMoneyPerTrade);

   if(lot <= 0.0)
      return false;

   if(AutoReduceLotIfNoMoney)
      lot = AdjustLotByFreeMargin(direction, lot, entry);

   if(lot <= 0.0)
      return false;

   sl = NormalizePrice(sl);
   tp = NormalizePrice(tp);

   riskActual = CalculateTradeProfitMoney(direction, entry, sl, lot);

   if(riskActual < 0.0)
      riskActual *= -1.0;

   return true;
}

//+------------------------------------------------------------------+
//| Open trade from signal                                            |
//| Jika not enough money, lot otomatis dikurangi dan retry            |
//+------------------------------------------------------------------+
bool OpenTradeFromSignal(
   const MqlRates &rates[],
   int i,
   int direction,
   double &lot,
   double &entry,
   double &sl,
   double &tp,
   double &riskActual,
   int &retcode,
   string &retcodeDescription
)
{
   bool planOk = BuildTradePlan(rates, i, direction, lot, entry, sl, tp, riskActual);

   if(!planOk)
   {
      retcode = 0;
      retcodeDescription = "INVALID_TRADE_PLAN_OR_NOT_ENOUGH_MARGIN";
      return false;
   }

   bool result = false;

   if(direction == 1)
      result = trade.Buy(lot, _Symbol, 0.0, sl, tp, "Bullish Engulfing");
   else
      result = trade.Sell(lot, _Symbol, 0.0, sl, tp, "Bearish Engulfing");

   retcode = (int)trade.ResultRetcode();
   retcodeDescription = trade.ResultRetcodeDescription();

   if(!result && AutoReduceLotIfNoMoney && retcode == TRADE_RETCODE_NO_MONEY)
   {
      double retryLot = ReduceLotStep(lot);

      while(retryLot > 0.0)
      {
         lot = retryLot;

         riskActual = CalculateTradeProfitMoney(direction, entry, sl, lot);

         if(riskActual < 0.0)
            riskActual *= -1.0;

         if(direction == 1)
            result = trade.Buy(lot, _Symbol, 0.0, sl, tp, "Bullish Engulfing");
         else
            result = trade.Sell(lot, _Symbol, 0.0, sl, tp, "Bearish Engulfing");

         retcode = (int)trade.ResultRetcode();
         retcodeDescription = trade.ResultRetcodeDescription();

         if(result)
            break;

         if(retcode != TRADE_RETCODE_NO_MONEY)
            break;

         retryLot = ReduceLotStep(lot);
      }
   }

   string orderText = direction == 1 ? "BUY" : "SELL";
   string signalText = direction == 1 ? "Bullish engulfing valid" : "Bearish engulfing valid";

   if(result)
   {
      PrintFormat("%s | Open posisi: %s | Lot final: %.2f | Entry estimasi: %s | SL: %s | TP: %s | RR: 1:%.2f | Risk target: %.2f | Risk aktual estimasi: %.2f | Retcode: %d | %s",
                  signalText,
                  orderText,
                  lot,
                  DoubleToString(entry, _Digits),
                  DoubleToString(sl, _Digits),
                  DoubleToString(tp, _Digits),
                  TakeProfitRR,
                  RiskMoneyPerTrade,
                  riskActual,
                  retcode,
                  retcodeDescription);
   }
   else
   {
      PrintFormat("%s | Gagal open posisi: %s | Lot terakhir: %.2f | Entry estimasi: %s | SL: %s | TP: %s | Retcode: %d | %s",
                  signalText,
                  orderText,
                  lot,
                  DoubleToString(entry, _Digits),
                  DoubleToString(sl, _Digits),
                  DoubleToString(tp, _Digits),
                  retcode,
                  retcodeDescription);
   }

   return result;
}

//+------------------------------------------------------------------+
//| Sesuaikan lot berdasarkan free margin                             |
//+------------------------------------------------------------------+
double AdjustLotByFreeMargin(int direction, double requestedLot, double entryPrice)
{
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);

   if(freeMargin <= 0.0)
      return 0.0;

   ENUM_ORDER_TYPE orderType;

   if(direction == 1)
      orderType = ORDER_TYPE_BUY;
   else if(direction == -1)
      orderType = ORDER_TYPE_SELL;
   else
      return 0.0;

   double marginRequired = 0.0;

   bool ok = OrderCalcMargin(orderType, _Symbol, requestedLot, entryPrice, marginRequired);

   if(!ok || marginRequired <= 0.0)
      return requestedLot;

   double allowedMargin = freeMargin * (MarginSafetyPercent / 100.0);

   if(marginRequired <= allowedMargin)
      return requestedLot;

   double adjustedLot = requestedLot * (allowedMargin / marginRequired);
   adjustedLot = NormalizeLot(adjustedLot);

   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   if(adjustedLot < minLot)
      return 0.0;

   return adjustedLot;
}

//+------------------------------------------------------------------+
//| Kurangi lot 1 step                                                |
//+------------------------------------------------------------------+
double ReduceLotStep(double lot)
{
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(minLot <= 0.0 || lotStep <= 0.0)
      return 0.0;

   double newLot = lot - lotStep;

   if(newLot < minLot)
      return 0.0;

   return NormalizeLot(newLot);
}

//+------------------------------------------------------------------+
//| Marker                                                            |
//+------------------------------------------------------------------+
void ProcessCandleForMarker(
   const MqlRates &rates[],
   const double &ema1[],
   const double &ema2[],
   const double &ema3[],
   int i
)
{
   bool bullishValid = IsValidBullishSignal(rates, ema1, ema2, ema3, i);
   bool bearishValid = IsValidBearishSignal(rates, ema1, ema2, ema3, i);

   double offset = ArrowOffsetPoints * _Point;

   if(bullishValid)
   {
      string name = ObjectPrefix + "BUY_" + IntegerToString((long)rates[i].time);
      double price = rates[i].low - offset;

      DrawArrow(name, rates[i].time, price, BullishArrowCode, BullishArrowColor);
   }

   if(bearishValid)
   {
      string name = ObjectPrefix + "SELL_" + IntegerToString((long)rates[i].time);
      double price = rates[i].high + offset;

      DrawArrow(name, rates[i].time, price, BearishArrowCode, BearishArrowColor);
   }
}

//+------------------------------------------------------------------+
//| Signal validation                                                 |
//+------------------------------------------------------------------+
bool IsValidBullishSignal(
   const MqlRates &rates[],
   const double &ema1[],
   const double &ema2[],
   const double &ema3[],
   int i
)
{
   if(!IsBullishEngulfing(rates, i))
      return false;

   if(GetCandleRangePoints(rates, i) > MaxEngulfingCandlePoints)
      return false;

   return rates[i].close > ema1[i] &&
          rates[i].close > ema2[i] &&
          rates[i].close > ema3[i];
}

bool IsValidBearishSignal(
   const MqlRates &rates[],
   const double &ema1[],
   const double &ema2[],
   const double &ema3[],
   int i
)
{
   if(!IsBearishEngulfing(rates, i))
      return false;

   if(GetCandleRangePoints(rates, i) > MaxEngulfingCandlePoints)
      return false;

   return rates[i].close < ema1[i] &&
          rates[i].close < ema2[i] &&
          rates[i].close < ema3[i];
}

double GetCandleRangePoints(const MqlRates &rates[], int i)
{
   return (rates[i].high - rates[i].low) / _Point;
}

bool IsBullishEngulfing(const MqlRates &rates[], int i)
{
   int previous = i + 1;

   bool previousBearish = rates[previous].close < rates[previous].open;
   bool currentBullish  = rates[i].close > rates[i].open;

   if(!previousBearish || !currentBullish)
      return false;

   double previousBodyHigh = MathMax(rates[previous].open, rates[previous].close);
   double previousBodyLow  = MathMin(rates[previous].open, rates[previous].close);

   double currentBodyHigh = MathMax(rates[i].open, rates[i].close);
   double currentBodyLow  = MathMin(rates[i].open, rates[i].close);

   bool classicBodyEngulfed = currentBodyLow <= previousBodyLow &&
                              currentBodyHigh >= previousBodyHigh;

   bool bullishGapEngulfing = false;

   if(DetectGapEngulfing)
   {
      bullishGapEngulfing = rates[i].open > rates[previous].close &&
                            rates[i].close > previousBodyHigh;
   }

   return classicBodyEngulfed || bullishGapEngulfing;
}

bool IsBearishEngulfing(const MqlRates &rates[], int i)
{
   int previous = i + 1;

   bool previousBullish = rates[previous].close > rates[previous].open;
   bool currentBearish  = rates[i].close < rates[i].open;

   if(!previousBullish || !currentBearish)
      return false;

   double previousBodyHigh = MathMax(rates[previous].open, rates[previous].close);
   double previousBodyLow  = MathMin(rates[previous].open, rates[previous].close);

   double currentBodyHigh = MathMax(rates[i].open, rates[i].close);
   double currentBodyLow  = MathMin(rates[i].open, rates[i].close);

   bool classicBodyEngulfed = currentBodyLow <= previousBodyLow &&
                              currentBodyHigh >= previousBodyHigh;

   bool bearishGapEngulfing = false;

   if(DetectGapEngulfing)
   {
      bearishGapEngulfing = rates[i].open < rates[previous].close &&
                            rates[i].close < previousBodyLow;
   }

   return classicBodyEngulfed || bearishGapEngulfing;
}

//+------------------------------------------------------------------+
//| Lot and money helpers                                             |
//+------------------------------------------------------------------+
double CalculateDynamicLotByRisk(double entry, double sl, double riskMoney)
{
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);

   if(tickSize <= 0.0 || tickValue <= 0.0)
      return 0.0;

   double stopDistance = MathAbs(entry - sl);

   if(stopDistance <= 0.0)
      return 0.0;

   double lossPerOneLot = (stopDistance / tickSize) * tickValue;

   if(lossPerOneLot <= 0.0)
      return 0.0;

   double rawLot = riskMoney / lossPerOneLot;

   return NormalizeLot(rawLot);
}

double NormalizeLot(double lot)
{
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(minLot <= 0.0 || maxLot <= 0.0 || lotStep <= 0.0)
      return 0.0;

   if(lot < minLot)
      lot = minLot;

   if(lot > maxLot)
      lot = maxLot;

   lot = MathFloor(lot / lotStep) * lotStep;

   int digits = 2;

   if(lotStep == 0.1)
      digits = 1;
   else if(lotStep == 0.01)
      digits = 2;
   else if(lotStep == 0.001)
      digits = 3;
   else if(lotStep == 0.0001)
      digits = 4;

   return NormalizeDouble(lot, digits);
}

double CalculateTradeProfitMoney(int direction, double entry, double exitPrice, double lotSize)
{
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);

   if(tickSize <= 0.0 || tickValue <= 0.0)
      return 0.0;

   double priceDiff = 0.0;

   if(direction == 1)
      priceDiff = exitPrice - entry;
   else if(direction == -1)
      priceDiff = entry - exitPrice;
   else
      return 0.0;

   return (priceDiff / tickSize) * tickValue * lotSize;
}

//+------------------------------------------------------------------+
//| Position helper                                                   |
//+------------------------------------------------------------------+
bool HasOpenPositionByMagic(string symbol, ulong magic)
{
   int total = PositionsTotal();

   for(int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket == 0)
         continue;

      if(!PositionSelectByTicket(ticket))
         continue;

      string positionSymbol = PositionGetString(POSITION_SYMBOL);
      ulong positionMagic = (ulong)PositionGetInteger(POSITION_MAGIC);

      if(positionSymbol == symbol && positionMagic == magic)
         return true;
   }

   return false;
}

//+------------------------------------------------------------------+
//| Price and object helpers                                          |
//+------------------------------------------------------------------+
double NormalizePrice(double price)
{
   return NormalizeDouble(price, _Digits);
}

void DrawArrow(string name, datetime time, double price, int arrowCode, color arrowColor)
{
   if(ObjectFind(0, name) >= 0)
      ObjectDelete(0, name);

   bool created = ObjectCreate(0, name, OBJ_ARROW, 0, time, price);

   if(!created)
      return;

   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, arrowCode);
   ObjectSetInteger(0, name, OBJPROP_COLOR, arrowColor);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, false);
}

void DeleteObjectsByPrefix(string prefix)
{
   int total = ObjectsTotal(0, 0, -1);

   for(int i = total - 1; i >= 0; i--)
   {
      string objectName = ObjectName(0, i, 0, -1);

      if(StringFind(objectName, prefix) == 0)
         ObjectDelete(0, objectName);
   }
}

//+------------------------------------------------------------------+
//| Trade transaction event                                           |
//+------------------------------------------------------------------+
void OnTradeTransaction(
   const MqlTradeTransaction &trans,
   const MqlTradeRequest &request,
   const MqlTradeResult &result
)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   if(trans.deal == 0)
      return;

   PushTradeClosed(trans.deal);
}
//+------------------------------------------------------------------+
