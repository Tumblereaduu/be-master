const {queryDatabase} = require('../../config/db');
const { TABLES } = require('../../config/tables');
const forgePriceStore = require('../../models/1forge.price.model');
const { toUTC } = require('../../utils/date');
const { normalizeSymbol } = require('../../utils/symbol');
const { getUsdConversionRate } = require('../../utils/usdConversion');
const { onTradeOpen, onTradeClose } = require('../wallet/walletController');
const { getSpread, getSpreadInPrice } = require('./spreadController');

// Constants
const LEVERAGE = 100; // 1:100 leverage
const CONTRACT_SIZE = 100000; // 1 lot = 100k units for forex pairs
const CONTRACT_SIZE_XAUUSD = 100; // Contract size for gold
const CONTRACT_SIZE_BINANCE = 1  // Contract size for BINANCE pairs
const CONTRACT_SIZE_SILVER = 5000; // Contract size for Silver
const CONTRACT_SIZE_COPPER = 2300; // Contract size for Copper
const CONTRACT_SIZE_DXY = 1000; // Contract size for DXY
const B_PAIR  = ["US30USD", "BTCUSD", "ETHUSD"]; // Crypto pairs

const toMySQLDateTime = (dt) => {
  if (!dt || typeof dt !== 'string') return dt;
  if (dt.includes('T')) {
    return dt.replace('T', ' ').replace('.000Z', '').replace('Z', '');
  }
  return dt;
};

const ALWAYS_OPEN = ["BTCUSD","ETHUSD"];

function isForexMarketOpen(symbol) {

  if(!symbol) return false;

  const cleanSymbol = symbol.split(":").pop().replace("/", "").toUpperCase();

  if (ALWAYS_OPEN.includes(cleanSymbol)){
    return true;
  }

  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  // Market closes Friday 22:00 UTC → Sunday 22:00 UTC
  if (day === 6) return false;
  if (day === 5 && hour >= 22) return false; // Friday after 22:00 UTC closed
  if (day === 0 && hour < 22) return false; // Sunday before 22:00 UTC closed

  return true;
}

/**
 * Place a new order
 * Body: user_id, symbol, type (BUY/SELL), lot_size, take_profit, stop_loss, order_type (market/limit/advanced)
 */
const placeOrder = async (req, res) => {

  // symbol -> EUR/USD,
  // type -> BUY or SELL
  // lot_size -> 0.01
  // take_profit -> 1.5253 optional
  // stop_loss -> 1.4500 optional
  // order_type -> market, limit, advanced 

  try {
    const user_id = req.user.user_id || req.user.id;
    let { symbol, type, lot_size, take_profit, stop_loss, tp_pnl, sl_pnl, order_type, trade_source } = req.body;
    symbol = normalizeSymbol(symbol, 'SLASH');
    console.log(tp_pnl, sl_pnl);

    // Normalize trade_source — must be either 'website' or 'mobile_app'
    const ALLOWED_TRADE_SOURCES = ["website", "mobile_app"];
    const normalizedTradeSource = trade_source?.trim().toLowerCase().replace(/\s+/g, "_") || "website";
    const validTradeSource = ALLOWED_TRADE_SOURCES.includes(normalizedTradeSource) ? normalizedTradeSource : "website";

    const [,quoteCurrency] = symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quoteCurrency);

    const rawSymbol = symbol.toUpperCase().replace("/", "");
    const contractSize = (symbol.toUpperCase() === 'XAU/USD' || symbol.toUpperCase() === 'XPD/USD' || symbol.toUpperCase() === 'XPT/USD') ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE :
    (symbol.toUpperCase() === 'XAG/USD') ? CONTRACT_SIZE_SILVER : (symbol.toUpperCase() === 'XCU/USD') ? CONTRACT_SIZE_COPPER : (symbol.toUpperCase() ==='DXY' || symbol.toUpperCase() ==='US/OIL' || symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;

    // Validate required fields
    if (!user_id || !symbol || !type || !lot_size) {
      return res.status(400).json({ 
        status: 'error',
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Missing required fields' 
      });
    }

    if(!isForexMarketOpen(symbol)){
      return res.status(400).json({
        status:"error",
        message:"Market is closed. You can Place Crypto postions anytime"
      })
    }

    // Normalize symbol (EURJPY → EUR/JPY)
    // if (!symbol.includes('/')) {
    //   symbol = symbol.slice(0, 3) + '/' + symbol.slice(3);
    // }


    // Validate type
    if (!['BUY', 'SELL'].includes(type.toUpperCase())) {
      return res.status(400).json({ 
        status: 'error',
        error: 'INVALID_ORDER_TYPE',
        message: 'Type must be either BUY or SELL' 
      });
    }

    // Validate order_type
    if (!order_type || !['market', 'limit', 'advanced'].includes(order_type.toLowerCase())) {
      return res.status(400).json({ 
        status: 'error',
        error: 'INVALID_ORDER_TYPE',
        message: 'order_type must be market, limit, or advanced' 
      });
    }

    // Get current price from 1forge socket store
    const priceObj = forgePriceStore.get(symbol);
    if (!priceObj) {
      return res.status(404).json({ 
        status: 'error',
        error: 'SYMBOL_NOT_FOUND',
        message: `Price data not available for ${symbol}` 
      });
    }

    // 1forge provides: s (symbol), p (mid price), b (bid), a (ask), t (timestamp)
    const currentPrice = parseFloat(priceObj.p || priceObj.price);
    // const spreadPips = getSpread(symbol);
    // const spreadInPrice = getSpreadInPrice(symbol, spreadPips);
    // Check user-specific spread first, then fall back to global spread
let spreadPips = getSpread(symbol);

// Check if this user has individual spread override for this symbol
const [userSpreadRows] = await queryDatabase(
  `SELECT spread FROM user_spreads WHERE user_id = ? AND symbol = ?`,
  [user_id, symbol]
);
if (userSpreadRows && userSpreadRows.length > 0) {
  spreadPips = parseFloat(userSpreadRows[0].spread);
  console.log(`[User Spread] User ${user_id} has custom spread ${spreadPips} pips for ${symbol}`);
} else {
  console.log(`[Global Spread] Using global spread ${spreadPips} pips for ${symbol}`);
}

const spreadInPrice = getSpreadInPrice(symbol, spreadPips);
console.log(`[Spread Applied] symbol=${symbol}, type=${type}, mid=${currentPrice}, spread_pips=${spreadPips}, spread_in_price=${spreadInPrice}, entry=${type.toUpperCase() === 'BUY' ? currentPrice + spreadInPrice : currentPrice - spreadInPrice}`);

    // Validate TP/SL against current market price
    if (take_profit !== undefined && take_profit !== null && take_profit !== '') {
      const tpNum = parseFloat(take_profit);
      if (type.toUpperCase() === 'BUY') {
        if (!(tpNum > currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TAKE_PROFIT',
            message: `Take Profit must be ABOVE than the current market price (${currentPrice}).`
          });
        }
      } else {
        if (!(tpNum < currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TAKE_PROFIT',
            message: `Take Profit must be BELOW than the current market price (${currentPrice}).`
          });
        }
      }
    }

    if (stop_loss !== undefined && stop_loss !== null && stop_loss !== '') {
      const slNum = parseFloat(stop_loss);
      if (type.toUpperCase() === 'BUY') {
        if (!(slNum < currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_STOP_LOSS',
            message: `Stop Loss must be BELOW current market price (${currentPrice}).`
          });
        }
      } else {
        if (!(slNum > currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_STOP_LOSS',
            message: `Stop Loss must be ABOVE current market price (${currentPrice}).`
          });
        }
      }
    }

    // ✅ Validate TP/SL based on PnL
    if (tp_pnl !== undefined && tp_pnl !== null && tp_pnl !== '') {
      const tpPnlNum = parseFloat(tp_pnl);

      if (!isFinite(tpPnlNum)) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_TP_PNL',
          message: 'Take Profit must be a valid number'
        });
      }

      // TP should always be positive (profit)
      if (tpPnlNum <= 0) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_TP_PNL',
          message: 'Take Profit must be greater than 0'
        });
      }
    }

    if (sl_pnl !== undefined && sl_pnl !== null && sl_pnl !== '') {
      const slPnlNum = parseFloat(sl_pnl);

      if (!isFinite(slPnlNum)) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_SL_PNL',
          message: 'Stop Loss must be a valid number'
        });
      }

      // SL should always be negative (loss)
      if (slPnlNum >= 0) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_SL_PNL',
          message: 'Stop Loss must be less than 0'
        });
      }

      // 🔥 CRITICAL VALIDATION (Your Requirement)
      // SL PnL must be less than spread cost
      // (i.e., loss must exceed spread cost)
      // Use spreadPips from above — already includes user-specific override if exists
      if (!spreadPips || spreadPips <= 0) {
        return res.status(400).json({
          status: 'error',
          error: 'SPREAD_NOT_FOUND',
          message: `Spread not configured for ${symbol}`
        });
      }

        // const rawSymbol = symbol.toUpperCase().replace("/", ""); // ! ADD '/' To the B_PAIR
        const jpyPairs = ['USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'CHF/JPY']; // !JPY pairs
        const B_PAIR = ['US30USD', "BTCUSD", "ETHUSD"]; // !BINANCE PAIRS
        const isJpy = jpyPairs.includes(symbol) || symbol === 'XAU/USD' || symbol === 'XPD/USD' || symbol === 'XPT/USD' || symbol === 'XAG/USD' || symbol === 'XCU/USD' || symbol === 'DXY' || symbol === 'US/OIL' || symbol === 'UK/OIL'  // !Gold, Silver, Copper and paladium
        
        const pipValue = isJpy ? 0.01 : B_PAIR.includes(rawSymbol) ? 1 : 0.0001;

      const spreadCostUsd = (spreadPips * pipValue * lot_size * contractSize) / conversionRateUsed;

      if (Math.abs(slPnlNum) <= spreadCostUsd) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_SL_PNL',
          message: `Stop Loss must be greater than -${spreadCostUsd.toFixed(2)} USD`,
          data: { spreadCostUsd: spreadCostUsd.toFixed(2) }
        });
      }
    }

    // Apply spread to entry price
    // For BUY: add spread (you buy at Ask price)
    // For SELL: subtract spread (you sell at Bid price)
    let entryPrice;
    if (type.toUpperCase() === 'BUY') {
      entryPrice = currentPrice + spreadInPrice;
    } else {
      entryPrice = currentPrice - spreadInPrice;
    }

    // Round entry price based on symbol
    const decimals = symbol === 'XAU/USD' ? 2 : 5;
    entryPrice = parseFloat(entryPrice.toFixed(decimals));


    // Calculate used margin
    // const contractValue = lot_size * contractSize * entryPrice;
    // const usedMargin = contractValue / LEVERAGE;


    // ! Calculate Used Margin
    let usedMargin = (lot_size * contractSize * entryPrice) / conversionRateUsed / LEVERAGE;

    // let commission = 0;
    // let referred_by_id = null;
    // const [usdResult] = await queryDatabase(`SELECT lot_usd FROM ${TABLES.ADMIN_COMMISSION} WHERE id = 1`);

    // let perLotCommission = 20;
    // if(usdResult.length && usdResult[0].lot_usd){
    //   perLotCommission = parseFloat(usdResult[0].lot_usd);
    //   // console.log("Per lot commission",perLotCommission);
    // }

    // check if this user was referred
    const [refData] = await queryDatabase(`SELECT referred_by_id FROM ${TABLES.REGISTER} WHERE id = ?`, [user_id]);
    // console.log("Referral id is", refData)

    // if (refData.length && refData[0].referred_by_id) {
    //   referred_by_id = refData[0].referred_by_id;
    //   commission = lot_size * perLotCommission;
    // }

    const [commissionPercent] = await queryDatabase(`SELECT ib_commission_percentage FROM ${TABLES.ADMIN_SPREAD} WHERE symbol = ?`, [symbol]);
    
    const spreadPriceValue = spreadInPrice;
    const spreadCost = spreadPriceValue * contractSize * lot_size;
    const spreadCostUsd = quoteCurrency === 'USD' ?  spreadCost : spreadCost / conversionRateUsed;
    const ib_commission_usd = spreadCostUsd / 100 * (commissionPercent.length ? parseFloat(commissionPercent[0].ib_commission_percentage).toFixed(2) : 20);
   console.log('[Spread Info]', { symbol, type, lot_size, spread_pips: spreadPips, spread_price: spreadPriceValue, spread_cost_usd: spreadCostUsd.toFixed(5), conversion_usd: conversionRateUsed, ibCommission: ib_commission_usd
});

    // console.log("Referral commission calculation", { user_id, referred_by_id, lot_size, commission })
    // console.log('---Used Margin Calculation---');
    // console.log('Lot Size:', lot_size);
    // console.log('Contract Size:', contractSize);
    // console.log('Entry Price:', entryPrice);
    // console.log('Conversion Rate Used:', conversionRateUsed);
    // console.log('Leverage:', LEVERAGE);
    // console.log('Calculated Used Margin:', usedMargin);
    // console.log('----------------------------');

    // Determine order status based on order_type
    const orderStatus = order_type.toLowerCase() === 'market' ? 'active' : 'pending';
    // console.log("Order flow check", {order_type, orderStatus, willTriggerCommission : orderStatus=== 'active'})

    // Get current timestamp
    // const entryTime = new Date();
    const entryTime = toUTC();

    // Pending ----------------------------------------------
    
    // limit orders: require trigger_price!
    if (order_type.toLowerCase() === 'limit') {
      if (!req.body.trigger_price) {
        return res.status(400).json({
          status: 'error',
          error: 'MISSING_TRIGGER_PRICE',
          message: 'Limit orders require a trigger_price.'
        });
      }
      const trigger_price = parseFloat(req.body.trigger_price);

      // Validate trigger price
      if (!isFinite(trigger_price) || trigger_price <= 0) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_TRIGGER_PRICE',
          message: 'Trigger price must be greater than 0.'
        });
      }

      // 1forge price
      if (type.toUpperCase() === 'BUY') {
        if (!(trigger_price < currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TRIGGER_PRICE',
            message: 'Trigger price must be BELOW than the current market price.'
          });
        }
      } else {
        if (!(trigger_price > currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TRIGGER_PRICE',
            message: 'Trigger price must be ABOVE than the current market price.'
          });
        }
      }

      // For limit order, store as pending, entry_time is request time, entry_price = user trigger_price (spread applied on activation)
      const insertData = [
        user_id,
        symbol,
        type.toUpperCase(),
        order_type,
        lot_size,
        LEVERAGE,
        trigger_price, // entry_price (placeholder for trigger)
        entryTime,     // entry_time is request time
        null,          // exit_price
        null,          // exit_time
        0.00,          // usedMargin: no margin until active
        0.00,          // pnl (initial)
        take_profit || null,
        stop_loss || null,
        tp_pnl || null,
        sl_pnl || null,
        null, // tp_updated_at
        null, // sl_updated_at
        'pending',
        0.00, // fee
        refData.length && refData[0].referred_by_id ? 1 : 0,
        0.00, // swap
        0.00, // commission
        0.00, // user_balance_after_trade
        null, // closed_by
        validTradeSource, // trade_source: website or mobile_app
        entryTime // created_at
      ];

      const [result] = await queryDatabase(
        `INSERT INTO ${TABLES.LIVE_USERS_ORDERS} (
          user_id, symbol, type, order_type, lot_size, leverage, entry_price, entry_time,
          exit_price, exit_time, used_margin, pnl, take_profit, stop_loss, tp_pnl, sl_pnl,
          tp_updated_at, sl_updated_at, order_status, fee, is_referral_code_added,
          swap, commission, user_balance_after_trade, closed_by, trade_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertData
      );

      // Referral/IB logic AFTER trade_id exists
        const trade_id = result.insertId;
        if (orderStatus === 'active' && referred_by_id && commission > 0) {
          const [ibRows] = await queryDatabase(`SELECT id, ib_status FROM ${TABLES.REGISTER} WHERE id = ? `,[referred_by_id]);
          if(ibRows.length) {
            const { ib_status } = ibRows[0];
            if(ib_status  === "active"){
              await queryDatabase(`INSERT INTO ${TABLES.ADMIN_IB_AMOUNT} (ib_id, trade_id, user_id, commission_amount, created_at) VALUES (?, ?, ?, ?, NOW())`,
              [referred_by_id, trade_id, user_id, commission, ib_status]
            );
            await queryDatabase(`UPDATE ${TABLES.ADMIN_BONUS} SET total_earnings= total_earnings + ? WHERE user_id = ?`,[commission,referred_by_id])
            console.log("IB commission saved", { ib_id: referred_by_id, trade_id, user_id, commission, ib_status });
            }else{
              console.log("IB Inactive - commission not inserted", {ib_id: referred_by_id, trade_id, commission, ib_status});
              }
          }
        }

      return res.status(201).json({
        status: 'success',
        message: 'Limit position placed successfully and is pending. Will trigger once price is met.',
        data: {
          trade_id,
          user_id,
          symbol,
          type: type.toUpperCase(),
          order_type,
          lot_size,
          leverage: LEVERAGE,
          trigger_price,
          order_status: 'pending',
          current_market_price: currentPrice
        }
      });
    }

    // Advanced ------------------------------------------------------

    // advanced orders: require trigger price
    if (order_type.toLowerCase() === 'advanced') {
      if (!req.body.trigger_price) {
        return res.status(400).json({
          status: 'error',
          error: 'MISSING_TRIGGER_PRICE',
          message: 'Pending orders require a trigger price.'
        });
      }
      const trigger_price = parseFloat(req.body.trigger_price);
      // Validation for stop orders
      if (type.toUpperCase() === 'BUY') {
        if (!(trigger_price > currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TRIGGER_PRICE',
            message: 'Trigger price must be ABOVE current than the market price.'
          });
        }
      } else {
        if (!(trigger_price < currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TRIGGER_PRICE',
            message: 'Trigger price must be BELOW current than the market price.'
          });
        }
      }

      // For advanced order, store as pending, entry_time is request time, entry_price = trigger price
      const insertData = [
        user_id,
        symbol,
        type.toUpperCase(),
        order_type,
        lot_size,
        LEVERAGE,
        trigger_price, // entry_price (placeholder)
        entryTime,     // entry_time is request time
        null,          // exit_price
        null,          // exit_time
        0.00,          // usedMargin until active
        0.00,          // pnl
        take_profit || null,
        stop_loss || null,
        tp_pnl || null,
        sl_pnl || null,
        null, // tp_updated_at
        null, // sl_updated_at
        'pending',
        0.00, // fee
        refData.length && refData[0].referred_by_id ? 1 : 0,
        0.00, // swap
        0.00, // commission
        0.00, // user_balance_after_trade
        null, // closed_by
        validTradeSource, // trade_source: website or mobile_app
        entryTime // created_at
      ];

      const [result] = await queryDatabase(
        `INSERT INTO ${TABLES.LIVE_USERS_ORDERS} (
          user_id, symbol, type, order_type, lot_size, leverage, entry_price, entry_time,
          exit_price, exit_time, used_margin, pnl, take_profit, stop_loss, tp_pnl, sl_pnl,
          tp_updated_at, sl_updated_at, order_status, fee, is_referral_code_added,
          swap, commission, user_balance_after_trade, closed_by, trade_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertData
      );

      const trade_id = result.insertId;

      return res.status(201).json({
        status: 'success',
        message: 'Pending position placed successfully and is pending. Will trigger once price is met.',
        data: {
          trade_id,
          user_id,
          symbol,
          type: type.toUpperCase(),
          order_type,
          lot_size,
          leverage: LEVERAGE,
          trigger_price,
          order_status: 'pending',
          current_market_price: currentPrice
        }
      });
    }

    // ---------------------------------------------------------

    // Prepare data for insertion
    const insertData = [
      user_id,
      symbol,
      type.toUpperCase(),
      order_type,
      lot_size,
      LEVERAGE,
      entryPrice,
      entryTime,
      null, // exit_price
      null, // exit_time
      usedMargin,
      0.00, // pnl (initial)
      take_profit || null,
      stop_loss || null,
      tp_pnl || null, // tp_pnl
      sl_pnl || null, // sl_pnl
      take_profit ? entryTime : null, // tp_updated_at
      stop_loss ? entryTime : null, // sl_updated_at
      orderStatus,
      0.00, // fee
      refData.length && refData[0].referred_by_id ? 1 : 0,
      0.00, // swap
      0.00, // commission
      0.00, // user_balance_after_trade
      null, // closed_by
      validTradeSource, // trade_source: website or mobile_app
      entryTime // created_at
    ];

    // Insert order into database
    const [result] = await queryDatabase(
      `INSERT INTO ${TABLES.LIVE_USERS_ORDERS} (
        user_id, symbol, type, order_type, lot_size, leverage, entry_price, entry_time,
        exit_price, exit_time, used_margin, pnl, take_profit, stop_loss, tp_pnl, sl_pnl,
        tp_updated_at, sl_updated_at, order_status, fee, is_referral_code_added,
        swap, commission, user_balance_after_trade, closed_by, trade_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertData
    );

    const trade_id = result.insertId;

    res.status(201).json({
      status: 'success',
      message: 'Position placed successfully',
      data: {
        trade_id,
        user_id,
        symbol,
        type: type.toUpperCase(),
        order_type,
        lot_size,
        // leverage: LEVERAGE,
        entry_price: entryPrice,
        entry_time: entryTime,
        used_margin: usedMargin,
        take_profit: take_profit || null,
        stop_loss: stop_loss || null,
        tp_pnl: tp_pnl || null,
        sl_pnl: sl_pnl || null,
        order_status: orderStatus,
        // spread_applied: spreadInPrice,
        current_price: currentPrice,
        spreadCostUsd: parseFloat(spreadCostUsd).toFixed(5),
        spread_pips: spreadPips,
        spread_in_price: spreadInPrice
      }
    });

    if(orderStatus === "active"){
      console.log("Market order Trigger commission Now",{user_id, usedMargin, order_type})
    await onTradeOpen(user_id, usedMargin);
    await triggerCommission(trade_id, ib_commission_usd);
    }else{
      console.log("Pending order commission will trigger later",{user_id , order_type})
    }

  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'ORDER_PLACEMENT_FAILED',
      message: 'Failed to place position. Please try again.' 
    });
  }
};

const triggerCommission = async (trade_id, ib_commission_usd) => {
  try {
    const [orderRows] = await queryDatabase(`SELECT user_id, lot_size, order_status, symbol FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ?`, [trade_id]);

    if (!orderRows.length) return;

    const order = orderRows[0];

    if (order.order_status !== "active") return;

    const [refData] = await queryDatabase(`SELECT referred_by_id FROM ${TABLES.REGISTER} WHERE id = ?`, [order.user_id]);
    if (!refData.length || !refData[0].referred_by_id) return;

    const referred_by_id = refData[0].referred_by_id;

    const [existing] = await queryDatabase(`SELECT id FROM ${TABLES.ADMIN_IB_AMOUNT} WHERE trade_id = ?`, [trade_id]); // Prevent duplicate commission for same trade
    if (existing.length) return;

    const [ibRows] = await queryDatabase(`SELECT ib_status FROM ${TABLES.REGISTER} WHERE id = ?`, [referred_by_id]); // Check if IB is active or not
    if (!ibRows.length || ibRows[0].ib_status !== "active") return;

    const commission = Number(ib_commission_usd);

    if (!Number.isFinite(commission)) {
      console.error("Invalid commission amount", {
        trade_id,
        ib_commission_usd,
      });
      return;
    }

    console.log("Triggering IB Commission", { trade_id, user_id: order.user_id, referred_by_id, lot_size: order.lot_size, commission: commission.toFixed(2) });

    await queryDatabase(`INSERT INTO ${TABLES.ADMIN_IB_AMOUNT} (ib_id, trade_id, user_id, commission_amount, created_at) VALUES (?, ?, ?, ?, NOW())`, [referred_by_id, trade_id, order.user_id, commission]);

    await queryDatabase(`UPDATE ${TABLES.ADMIN_BONUS} SET total_earnings = total_earnings + ? WHERE user_id = ?`, [commission, referred_by_id]);

    // console.log("IB Commission triggered", { trade_id, ib_id: referred_by_id, commission});

  } catch (error) {
    console.error("Error while triggering IB commission", error);
  }
};

/**
 * Get all orders
 */
const getOrders = async (req, res) => {
  try {
    const { user_id } = req.query;

    let query = `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE 1=1`;
    const params = [];

    // Filter by user_id if provided
    if (user_id) {
      query += " AND user_id = ?";
      params.push(user_id);
    }

    query += " ORDER BY created_at DESC";

    const [rows] = await queryDatabase(query, params);
    
    res.json({
      status: 'success',
      data: rows
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'FETCH_ORDERS_FAILED',
      message: 'Failed to fetch orders' 
    });
  }
};

/**
 * Get order by ID
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

     const [rows] = await queryDatabase(
      `SELECT trade_id, user_id, symbol, type, lot_size, entry_price, entry_time, exit_time, exit_price, used_margin, pnl, take_profit, stop_loss, tp_pnl, sl_pnl, order_status, trade_source FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found' 
      });
    }

    res.json({
      status: 'success',
      data: rows[0]
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'FETCH_ORDER_FAILED',
      message: 'Failed to fetch order' 
    });
  }
};

/**
 * Close an order manually
 */
const closeOrder = async (req, res) => {
  // let conversionRateUsed = 1;
  try {
    const { id } = req.params;
    const { user_id, close_source } = req.body;

    // Normalize close_source — must be either 'website' or 'mobile_app'
    const ALLOWED_CLOSE_SOURCES = ["website", "mobile_app"];
    const normalizedCloseSource = close_source?.trim().toLowerCase().replace(/\s+/g, "_") || "website";
    const validCloseSource = ALLOWED_CLOSE_SOURCES.includes(normalizedCloseSource) ? normalizedCloseSource : "website";

    // Get order details
    const [orderRows] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`,
      [id, user_id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        error: 'ORDER_NOT_FOUND',
        message: 'Position not found or you do not have permission' 
      });
    }

    const order = orderRows[0];

    // =====================
    // Close Pending Order
    // =====================
    if (order.order_status === "pending") {

      if (!isForexMarketOpen(order.symbol)) {
        return res.status(400).json({
          status: "error",
          message: "Market is closed. You can close pending position when market opens"
        });
      }

      const exitTime = toUTC();

      await queryDatabase(
        `UPDATE ${TABLES.LIVE_USERS_ORDERS}
        SET order_status = ?, exit_time = ?, closed_by = ?, close_source = ?
        WHERE trade_id = ? AND user_id = ?`,
        ["pending_close", exitTime, "user", validCloseSource, id, user_id]
      );

      return res.json({
        status: "success",
        message: "Pending Position closed successfully",
        data: {
          trade_id: id,
          order_status: "pending_close",
          exit_time: exitTime,
          trade_source: order.trade_source || "website",
          close_source: validCloseSource
        }
      });
    }

    if(!isForexMarketOpen(order.symbol)){
      return res.status(400).json({
        status:"error",
        message:"Market is closed. You can close this postion when market opens"
      })
    }

    // Check if order is already closed
    if (order.order_status === 'completed' || order.order_status === 'cancelled') {
      return res.status(400).json({ 
        status: 'error',
        error: 'ORDER_ALREADY_CLOSED',
        message: 'Position is already closed' 
      });
    }

    // Get current price from 1forge socket store
    const priceObj = forgePriceStore.get(order.symbol);
    if (!priceObj) {
      return res.status(404).json({ 
        status: 'error',
        error: 'SYMBOL_NOT_FOUND',
        message: 'Price data not available' 
      });
    }

    //geting used margin
    const usedMargin = order.used_margin;

    // 1forge provides: s (symbol), p (mid price), b (bid), a (ask), t (timestamp)
    const currentPrice = parseFloat(priceObj.p || priceObj.price);


    const [, quote] = order.symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quote);
    console.log("Conversion Rate",conversionRateUsed);


    // Get exit price
    let exitPrice;
    if (order.type === 'BUY') {
      // When closing a BUY, you sell - so use bid (current - spread)
      exitPrice = currentPrice ; // - spreadInPrice;
    } else {
      // When closing a SELL, you buy - so use ask (current + spread)
      exitPrice = currentPrice ; // + spreadInPrice;
    }

    const decimals = order.symbol === 'XAU/USD' ? 2 : 5;
    exitPrice = parseFloat(exitPrice.toFixed(decimals));

    const rawSymbol = order.symbol.toUpperCase().replace("/", "");
    // Calculate PnL
    const contractSize = (order.symbol.toUpperCase() === 'XAU/USD' || order.symbol.toUpperCase() === 'XPD/USD' || order.symbol.toUpperCase() === 'XPT/USD') ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE :
    (order.symbol.toUpperCase() === 'XCU/USD') ? CONTRACT_SIZE_COPPER : (order.symbol.toUpperCase() === 'XAG/USD') ? CONTRACT_SIZE_SILVER : (order.symbol.toUpperCase() ==='DXY' || order.symbol.toUpperCase() ==='US/OIL' || order.symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;
    const units = order.lot_size * contractSize;
    
    let pnl = 0;
    if (order.type === 'BUY') {
      pnl = (exitPrice - order.entry_price) * units;
    } else {
      pnl = (order.entry_price - exitPrice) * units;
    }

    pnl = pnl / conversionRateUsed;

    await onTradeClose(user_id, usedMargin, pnl);

    // Update order
    const exitTime = toUTC();
    const [updateResult] = await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS} 
       SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'cancelled', closed_by = 'user', close_source = ?
       WHERE trade_id = ?`,
      [exitPrice, exitTime, pnl, validCloseSource, id]
    );

    res.json({
      status: 'success',
      message: 'Position closed successfully',
      data: {
        trade_id: id,
        exit_price: exitPrice,
        exit_time: exitTime,
        pnl: pnl,
        order_status: 'cancelled',
        trade_source: order.trade_source || "website",
        close_source: validCloseSource
      }
    });

  } catch (err) {
    console.error('Error closing order:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'CLOSE_ORDER_FAILED',
      message: 'Failed to close position' 
    });
  }
};  


/**
 * Update Take Profit or Stop Loss
 */
const updateTpSl = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, take_profit, stop_loss, tp_pnl, sl_pnl, symbol} = req.body;

    // Get order details
    const [orderRows] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`,
      [id, user_id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ 
        status: 'error',
        error: 'ORDER_NOT_FOUND',
        message: 'Position not found' 
      });
    }

    const order = orderRows[0];

    if (order.order_status !== 'active' && order.order_status !== 'pending') {
      return res.status(400).json({ 
        status: 'error',
        error: 'ORDER_NOT_ACTIVE',
        message: 'Only active or pending positions can have TP/SL updated' 
      });
    }

    // Current price for validation
    const priceObj = forgePriceStore.get(order.symbol);
    if (!priceObj) {
      return res.status(404).json({ 
        status: 'error',
        error: 'SYMBOL_NOT_FOUND',
        message: 'Price data not available' 
      });
    }

    const [, quote] = order.symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quote);
    console.log("Conversion Rate",conversionRateUsed);

    const currentPrice = parseFloat(priceObj.p || priceObj.price);
    
    const entry = parseFloat(order.entry_price);
    const lot = parseFloat(order.lot_size);

    let contractSize = 100000;
    const cleanSymbol = order.symbol.split(":").pop().replace("/", "").toUpperCase();
    if (cleanSymbol === 'XAUUSD' || cleanSymbol === 'XPDUSD' || cleanSymbol === 'XPTUSD') contractSize = 100;
    if (cleanSymbol === 'XCUUSD') contractSize = 2300;
    if (cleanSymbol === 'XAGUSD') contractSize = 5000;
    if (cleanSymbol === 'DXY' || cleanSymbol ==='USOIL' || cleanSymbol ==='UKOIL' ) contractSize = 1000;
    if (['BTCUSD', 'ETHUSD', 'US30USD'].includes(cleanSymbol)) contractSize = 1;

    let currentPnL = 0;

    if (order.type === 'BUY' && order.order_status === 'active') {
      currentPnL = (currentPrice - entry) * lot * contractSize / conversionRateUsed ;
    } else {
      currentPnL = (entry - currentPrice) * lot * contractSize / conversionRateUsed ;
    }
      console.log('pnl',currentPnL ,"lot" ,lot , "contract",contractSize, "symbol", cleanSymbol);

      
      const existingPriceValues =
        (order.take_profit !== null && order.take_profit !== 0) ||
        (order.stop_loss !== null && order.stop_loss !== 0);

      const existingPnlValues =
        (order.tp_pnl !== null && order.tp_pnl !== 0) ||
        (order.sl_pnl !== null && order.sl_pnl !== 0);

      // ❌ If already using PRICE mode, block PnL updates
      if (existingPriceValues && (tp_pnl !== undefined || sl_pnl !== undefined)) {
        return res.status(400).json({
          status: 'error',
          error: 'MODE_LOCKED_PRICE',
          message: 'TP/SL already set in PRICE mode. Cannot update using PnL.'
        });
      }

      // ❌ If already using PnL mode, block PRICE updates
      if (existingPnlValues && (take_profit !== undefined || stop_loss !== undefined)) {
        return res.status(400).json({
          status: 'error',
          error: 'MODE_LOCKED_PNL',
          message: 'TP/SL already set in PnL mode. Cannot update using PRICE.'
        });
      }

    const hasPriceInput =
    (take_profit !== undefined && take_profit !== null && take_profit !== "-") ||
    (stop_loss !== undefined && stop_loss !== null && stop_loss !== "-");

    const hasPnlInput =
      (tp_pnl !== undefined && tp_pnl !== null) ||
      (sl_pnl !== undefined && sl_pnl !== null);

    // ❌ Both modes used → reject
    if (hasPriceInput && hasPnlInput) {
      return res.status(400).json({
        status: 'error',
        error: 'INVALID_MODE',
        message: 'You can only enter values in either PRICE or PnL mode, not both.'
      });
    }

    // ❌ No input at all → reject
    // if (!hasPriceInput && !hasPnlInput) {
    //   return res.status(400).json({
    //     status: 'error',
    //     error: 'NO_INPUT',
    //     message: 'Please enter either price values or PnL values.'
    //   });
    // }

    

    if (tp_pnl !== undefined && tp_pnl !== null && order.order_status === 'active') {

      if (!(parseFloat(tp_pnl) > currentPnL)) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_TP_PNL',
          message: `Take Profit must be greater than current PnL (${currentPnL.toFixed(2)})`
        });
      }
    }

    if (sl_pnl !== undefined && sl_pnl !== null && order.order_status === 'active') {

      if (!(parseFloat(sl_pnl) < currentPnL)) {
        return res.status(400).json({
          status: 'error',
          error: 'INVALID_SL_PNL',
          message: `Stop Loss must be less than current PnL (${currentPnL.toFixed(2)})`
        });
      }
    }

    // ✅ Run validation ONLY if order is pending
    if (order.order_status === 'pending') {

      // ✅ Validate TP PnL
      if (tp_pnl !== undefined && tp_pnl !== null && tp_pnl !== '') {
        const tpPnlNum = parseFloat(tp_pnl);

        if (!isFinite(tpPnlNum)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TP_PNL',
            message: 'Take Profit must be a valid number'
          });
        }

        // TP should always be positive
        if (tpPnlNum <= 0) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TP_PNL',
            message: 'Take Profit must be greater than 0'
          });
        }
      }

      // ✅ Validate SL PnL
      if (sl_pnl !== undefined && sl_pnl !== null && sl_pnl !== '') {
        const slPnlNum = parseFloat(sl_pnl);

        if (!isFinite(slPnlNum)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_SL_PNL',
            message: 'Stop Loss must be a valid number'
          });
        }

        // SL should always be negative
        if (slPnlNum >= 0) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_SL_PNL',
            message: 'Stop Loss must be less than 0'
          });
        }

        // 🔥 Spread validation
        const [spreadRows] = await queryDatabase(
          `SELECT spread FROM ${TABLES.ADMIN_SPREAD} WHERE symbol = ?`,
          [symbol]
        );

        if (!spreadRows.length) {
          return res.status(400).json({
            status: 'error',
            error: 'SPREAD_NOT_FOUND',
            message: `Spread not configured for ${symbol}`
          });
        }

        const spreadPips = parseFloat(spreadRows[0].spread);

        const jpyPairs = ['USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'CHF/JPY'];
        const B_PAIR = ['US30USD', "BTCUSD", "ETHUSD"];

        const rawSymbol = symbol.toUpperCase().replace("/", "");

        const isJpy =
          jpyPairs.includes(symbol) ||
          ['XAU/USD', 'XPD/USD', 'XAG/USD', 'XCU/USD', 'XPT/USD', 'DXY', 'US/OIL', 'UK/OIL'].includes(symbol);

        const pipValue = isJpy ? 0.01 : B_PAIR.includes(rawSymbol) ? 1 : 0.0001;

        const spreadCostUsd =
          (spreadPips * pipValue * lot * contractSize) / conversionRateUsed;

        if (Math.abs(slPnlNum) <= spreadCostUsd) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_SL_PNL',
            message: `Stop Loss must be greater than -${spreadCostUsd.toFixed(2)} USD`
          });
        }
      }
    }

    // Validate
    if (take_profit && take_profit !== "-") {
      const tpNum = parseFloat(take_profit);
      if (order.type === 'BUY') {
        if (!(tpNum > currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TAKE_PROFIT',
            message: `Take Profit must be ABOVE than the current market price (${currentPrice}).`
          });
        }
      } else {
        if (!(tpNum < currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_TAKE_PROFIT',
            message: `Take Profit must be BELOW than the current market price (${currentPrice}).`
          });
        }
      }
    }

    if (stop_loss && stop_loss !== "-") {
      const slNum = parseFloat(stop_loss);
      if (order.type === 'BUY') {
        if (!(slNum < currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_STOP_LOSS',
            message: `Stop Loss must be BELOW than the current market price (${currentPrice}).`
          });
        }
      } else {
        if (!(slNum > currentPrice)) {
          return res.status(400).json({
            status: 'error',
            error: 'INVALID_STOP_LOSS',
            message: `Stop Loss must be ABOVE than the current market price (${currentPrice}).`
          });
        }
      }
    }

    // Update TP/SL
    const updateTime = toUTC();
    const updates = [];
    const values = [];

    if (take_profit && take_profit !== "-") {
      updates.push('take_profit = ?');
      updates.push('tp_updated_at = ?');
      values.push(take_profit);
      values.push(updateTime);
    }

    if (stop_loss && stop_loss !== "-") {
      updates.push('stop_loss = ?');
      updates.push('sl_updated_at = ?');
      values.push(stop_loss);
      values.push(updateTime);
    }

    if (take_profit !== undefined) {
      if (take_profit === null) {
        updates.push('take_profit = NULL', 'tp_updated_at = ?');
        values.push(updateTime);
      } else if (take_profit !== "-") {
        updates.push('take_profit = ?', 'tp_updated_at = ?');
        values.push(take_profit, updateTime);
      }
    }

    if (stop_loss !== undefined) {
      if (stop_loss === null) {
        updates.push('stop_loss = NULL', 'sl_updated_at = ?');
        values.push(updateTime);
      } else if (stop_loss !== "-") {
        updates.push('stop_loss = ?', 'sl_updated_at = ?');
        values.push(stop_loss, updateTime);
      }
    }
    
    // PnL updates
    if (tp_pnl !== undefined) {
      updates.push('tp_pnl = ?');
      // updates.push('tp_updated_at = ?');
      values.push(tp_pnl);
      // values.push(updateTime);
    }

    if (sl_pnl !== undefined) {
      updates.push('sl_pnl = ?');
      // updates.push('sl_updated_at = ?');
      values.push(sl_pnl);
      // values.push(updateTime);
    }

    if (tp_pnl !== undefined) {
      if (tp_pnl === null) {
        updates.push('tp_pnl = NULL');
      } else {
        updates.push('tp_pnl = ?');
        values.push(tp_pnl);
      }
    }

    if (sl_pnl !== undefined) {
      if (sl_pnl === null) {
        updates.push('sl_pnl = NULL');
      } else {
        updates.push('sl_pnl = ?');
        values.push(sl_pnl);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        status: 'error',
        error: 'NO_UPDATE_PROVIDED',
        message: 'Please provide take_profit or stop_loss' 
      });
    }

    values.push(id);
    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS} SET ${updates.join(', ')} WHERE trade_id = ?`,
      values
    );

    res.json({
      status: 'success',
      message: 'TP/SL updated successfully'
    });

  } catch (err) {
    console.error('Error updating TP/SL:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'UPDATE_TP_SL_FAILED',
      message: 'Failed to update TP/SL' 
    });
  }
};


const removeTpSl = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, take_profit, stop_loss, tp_pnl, sl_pnl } = req.body;

    const order = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`,
      [id, user_id]
    );

    if (!order.length) {
      return res.status(404).json({
        status: 'error',
        error: 'ORDER_NOT_FOUND',
        message: 'Position not found'
      });
    }

    const orderRow = order[0];

    if (
      (orderRow.take_profit === null || orderRow.take_profit === '') &&
      (orderRow.stop_loss === null || orderRow.stop_loss === '') &&
      (orderRow.tp_pnl === null || orderRow.tp_pnl === '') &&
      (orderRow.sl_pnl === null || orderRow.sl_pnl === '')
    ) {
      return res.status(400).json({
        status: 'error',
        error: 'NOTHING_TO_REMOVE',
        message: 'No Take Profit or Stop Loss values to remove'
      });
    }

    // FIXED STATUS CHECK
    if (orderRow.order_status === 'active' && orderRow.order_status === 'pending') {
      return res.status(400).json({
        status: 'error',
        error: 'ORDER_NOT_ACTIVE',
        message: 'Only active or pending positions can have TP/SL removed'
      });
    }

    const updateTime = toUTC();
    const updates = [];
    const values = [];

    if (take_profit == null) {
      updates.push('take_profit = NULL', 'tp_updated_at = ?');
      values.push(updateTime);
    }

    if (stop_loss == null) {
      updates.push('stop_loss = NULL', 'sl_updated_at = ?');
      values.push(updateTime);
    }

    if (tp_pnl == null) {
      updates.push('tp_pnl = NULL');
    }

    if (sl_pnl == null) {
      updates.push('sl_pnl = NULL');
    }

    // PREVENT EMPTY SET
    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'NO_FIELDS',
        message: 'Nothing to remove'
      });
    }

    values.push(id);

    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS} SET ${updates.join(', ')} WHERE trade_id = ?`,
      values
    );

    res.json({
      status: 'success',
      message: 'TP/SL removed successfully'
    });

  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: 'REMOVE_TP_SL_FAILED',
      message: err.message || 'Failed to remove TP/SL'
    });
  }
};

/**
 * get Orders by user ID
 */

// For specific status
// const getActiveOrdersByUserId = async (user_id) => {
//   try {
//     const [rows] = await queryDatabase(
//       `SELECT * FROM ${TABLES.ORDERS_DEMO}
//        WHERE user_id = ?
//          AND order_status = 'active'
//          AND exit_time IS NULL
//          AND exit_price IS NULL
//        ORDER BY created_at DESC`,
//       [user_id]
//     );
//     return rows;
//   } catch (err) {
//     console.error('Error fetching active orders for user:', err);
//     throw err;
//   }
// };

const getOrdersByUserID = async (req, res) => {
  try {
    const { user_id, status } = req.query;

    if (!user_id && !status) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: user id',
      });
    }

    let query = `
      SELECT * FROM ${TABLES.LIVE_USERS_ORDERS}
      WHERE user_id = ?
      AND is_hidden = 0
    `;
    const params = [user_id];

    // query based on status
    if (status === 'active') {
      query += ` AND order_status = 'active' AND exit_time IS NULL AND exit_price IS NULL  ORDER BY created_at DESC`;
    } else if (status === 'pending') {
      query += ` AND order_status = 'pending' AND exit_time IS NULL AND exit_price IS NULL  ORDER BY created_at DESC`;
    } else if (status === 'completed_cancelled') {
      query += `AND (order_status = 'completed' OR order_status = 'cancelled') ORDER BY exit_time DESC`;
    }  else if (status === 'completed_cancelled_24_hr') {
      query += `AND (order_status = 'completed' OR order_status = 'cancelled') AND exit_time >= NOW() - INTERVAL 1 DAY ORDER BY exit_time DESC`;
    } else if (status) {
      query += ` AND order_status = ?`;
      params.push(status);
    }

    const [rows] = await queryDatabase(query, params);

    // console.log(rows);
    

    return res.status(200).json({
      status: 'success',
      message: `Fetched ${status || 'all'} orders successfully`,
      count: rows.length,
      data: rows,
    });

  } catch (err) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch orders based on user ID',
      error: err.message,
    });
  }
};

// ✅ HELPER FUNCTION: Validate and Activate Pending Orders with Margin Revalidation
const validateAndActivatePendingOrder = async (user_id, trade_id, required_margin, entry_price, symbol) => {
  try {
    // START TRANSACTION with row-level lock
    await queryDatabase('START TRANSACTION');

    // Step 1: Lock wallet
    const [walletData] = await queryDatabase(
      `SELECT wallet_balance FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ? FOR UPDATE`,
      [user_id]
    );

    if (!walletData || walletData.length === 0) {
      await queryDatabase('ROLLBACK');
      return { success: false, error: 'WALLET_NOT_FOUND' };
    }

    const wallet_balance = parseFloat(walletData[0].wallet_balance);

    // Step 2: Calculate current free margin (excluding this order since it's still pending)
    const [usedMarginData] = await queryDatabase(
      `SELECT SUM(used_margin) as total_used_margin FROM ${TABLES.LIVE_USERS_ORDERS} 
       WHERE user_id = ? AND order_status = 'active'`,
      [user_id]
    );

    const total_used_margin = (usedMarginData && usedMarginData.length > 0 && usedMarginData[0].total_used_margin)
      ? parseFloat(usedMarginData[0].total_used_margin)
      : 0;

    const free_margin = wallet_balance - total_used_margin;

    // Step 3: Check if we have sufficient margin NOW
    if (free_margin < required_margin) {
      await queryDatabase('ROLLBACK');
      console.log(`[Pending Order Margin Check] Trade ${trade_id} insufficient margin. Free: ${free_margin.toFixed(2)}, Required: ${required_margin.toFixed(2)}`);
      return { success: false, reason: 'INSUFFICIENT_MARGIN' };
    }

    // Step 4: Activate the order (only after validation passes)
    const activationTime = toUTC();
    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS} 
       SET order_status = 'active', 
           entry_price = ?, 
           used_margin = ?,
           entry_time = ?
       WHERE trade_id = ? AND user_id = ? AND order_status = 'pending'`,
      [entry_price, required_margin, activationTime, trade_id, user_id]
    );

    // ✅ Commit transaction after successful activation
    await queryDatabase('COMMIT');

    console.log(`[Pending Order Activated] Trade ${trade_id} - Margin reserved: ${required_margin.toFixed(2)}`);
    
    // Activation succeeded - trigger wallet update
    await onTradeOpen(user_id, required_margin);
    
    return { success: true };
    
  } catch (err) {
    try {
      await queryDatabase('ROLLBACK');
    } catch (rollbackErr) {
      console.error(`[Rollback Error] Trade ${trade_id}:`, rollbackErr);
    }
    console.error(`[Activation Validation Error] Trade ${trade_id}:`, err);
    return { success: false, error: 'DATABASE_ERROR' };
  }
};

const processPendingLimitOrders = async () => {
  // Get all pending limit or advanced orders
  const [pendingOrders] = await queryDatabase(
    `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE order_status = 'pending' AND order_type IN ('limit','advanced')`
  );
  if (!pendingOrders.length) return;
  
  for (const order of pendingOrders) {
    try {
      const priceObj = forgePriceStore.get(order.symbol);
      if (!priceObj) continue;
      
      const currentMarket = parseFloat(priceObj.p || priceObj.price);
      const type = order.type.toUpperCase();
      const isLimit = order.order_type === 'limit';
      const isAdvanced = order.order_type === 'advanced';
      
      // Step 1: Check if trigger condition is met
      let shouldTrigger = false;
      
      if (isLimit) {
        if (type === 'BUY' && currentMarket <= Number(order.entry_price)) shouldTrigger = true;
        if (type === 'SELL' && currentMarket >= Number(order.entry_price)) shouldTrigger = true;
      } else if (isAdvanced) {
        if (type === 'BUY' && currentMarket >= Number(order.entry_price)) shouldTrigger = true;
        if (type === 'SELL' && currentMarket <= Number(order.entry_price)) shouldTrigger = true;
      }
      
      if (!shouldTrigger) continue;

      // ✅ CRITICAL FIX: Revalidate margin before activation
      // Step 2: Recalculate entry price with latest spread
      const spreadPips = await getSpread(order.user_id, order.symbol);
      const spreadInPrice = getSpreadInPrice(order.symbol, spreadPips);
      
      let realEntryPrice;
      if (type === 'BUY') {
        realEntryPrice = parseFloat(order.entry_price) + parseFloat(spreadInPrice);
        realEntryPrice = parseFloat(realEntryPrice.toFixed(order.symbol === 'XAU/USD' ? 2 : 5));
      } else {
        realEntryPrice = parseFloat(order.entry_price) - parseFloat(spreadInPrice);
        realEntryPrice = parseFloat(realEntryPrice.toFixed(order.symbol === 'XAU/USD' ? 2 : 5));
      }

      // Step 3: Recalculate required margin using latest entry price
      const [, quote] = order.symbol.split('/');
      const conversionRateUsed = getUsdConversionRate(quote);
      
      const rawSymbol = order.symbol.toUpperCase().replace("/", "");
      const contractSize = (order.symbol.toUpperCase() === 'XAU/USD' || order.symbol.toUpperCase() === 'XPD/USD' || order.symbol.toUpperCase() === 'XPT/USD') ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE :
      order.symbol.toUpperCase() === 'XAG/USD' ? CONTRACT_SIZE_SILVER: order.symbol.toUpperCase() === 'XCU/USD' ? CONTRACT_SIZE_COPPER : (order.symbol.toUpperCase() === 'DXY' || order.symbol.toUpperCase() === 'US/OIL' || order.symbol.toUpperCase() === 'UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;
      
      const requiredMargin = (order.lot_size * contractSize * realEntryPrice) / conversionRateUsed / LEVERAGE;

      // Step 4-7: Validate margin and activate if sufficient
      const activationResult = await validateAndActivatePendingOrder(
        order.user_id,
        order.trade_id,
        requiredMargin,
        realEntryPrice,
        order.symbol
      );

      if (!activationResult.success) {
        console.log(`[Pending Order] Trade ${order.trade_id} cannot activate yet - insufficient margin. Keeping pending.`);
        // Order stays pending - do not cancel or reject
        continue;
      }

      // Step 8: Only if activation succeeded, proceed with existing logic
      const [commissionPercent] = await queryDatabase(`SELECT ib_commission_percentage FROM ${TABLES.ADMIN_SPREAD} WHERE symbol = ?`, [order.symbol]);
      const spreadPriceValue = spreadInPrice;
      const spreadCost = spreadPriceValue * contractSize * order.lot_size;
      const spreadCostUsd = quote === 'USD' ? spreadCost : spreadCost / conversionRateUsed;
      const ib_commission_usd = spreadCostUsd / 100 * (commissionPercent.length ? parseFloat(commissionPercent[0].ib_commission_percentage).toFixed(2) : 0);

      console.log(`[Pending Order Activated] Trade ${order.trade_id} - Entry: ${realEntryPrice}, Margin: ${requiredMargin.toFixed(2)}`);
      
      await triggerCommission(order.trade_id, ib_commission_usd);

    } catch (err) {
      console.error(`[Pending Order Activation Error] Trade ${order.trade_id}:`, err);
      // Log error but do not modify order - let it retry next cycle
    }
  }
};

const processTpSlForActiveOrders = async () => {
  // Fetch active orders that have TP or SL configured
  const [activeOrders] = await queryDatabase(`
    SELECT * FROM ${TABLES.LIVE_USERS_ORDERS}
    WHERE order_status = 'active' AND (take_profit IS NOT NULL OR stop_loss IS NOT NULL)
  `);
  if (!activeOrders.length) return;

  for (const order of activeOrders) {
    const priceObj = forgePriceStore.get(order.symbol);
    if (!priceObj) continue;

    const currentMarket = parseFloat(priceObj.p || priceObj.price);
    const type = (order.type || '').toUpperCase();

    // Decide if TP/SL is hit
    let closedBy = null;
    let exitPrice = null;

    const tp = order.take_profit !== null && order.take_profit !== undefined ? parseFloat(order.take_profit) : null;
    const sl = order.stop_loss !== null && order.stop_loss !== undefined ? parseFloat(order.stop_loss) : null;

    if (type === 'BUY') {
      if (tp !== null && currentMarket >= tp) {
        closedBy = 'take_profit';
        exitPrice = tp;
      } else if (sl !== null && currentMarket <= sl) {
        closedBy = 'stop_loss';
        exitPrice = sl;
      }
    } else if (type === 'SELL') {
      if (tp !== null && currentMarket <= tp) {
        closedBy = 'take_profit';
        exitPrice = tp;
      } else if (sl !== null && currentMarket >= sl) {
        closedBy = 'stop_loss';
        exitPrice = sl;
      }
    }

    if (!closedBy) continue; // no trigger

 
    // }

    const [, quote] = order.symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quote);
    console.log("Conversion Rate",conversionRateUsed);


    // Compute PnL
    const contractSize = (order.symbol && order.symbol.toUpperCase() === 'XAU/USD' || order.symbol.toUpperCase() === 'XPD/USD' || order.symbol.toUpperCase() === 'XPT/USD') ? CONTRACT_SIZE_XAUUSD : 
    B_PAIR.includes(order.symbol.toUpperCase().replace("/", "")) ? CONTRACT_SIZE_BINANCE : (order.symbol.toUpperCase() === 'XAG/USD') ? CONTRACT_SIZE_SILVER : (order.symbol.toUpperCase() ==='DXY' || order.symbol.toUpperCase() ==='US/OIL' || order.symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY :
    (order.symbol.toUpperCase() === 'XCU/USD') ? CONTRACT_SIZE_COPPER : CONTRACT_SIZE;
    const units = parseFloat(order.lot_size) * contractSize;
    const entryPriceNum = parseFloat(order.entry_price);
    const exitPriceNum = parseFloat(exitPrice);

    let pnl = 0;
    if (type === 'BUY') {
      pnl = (exitPriceNum - entryPriceNum) * units;
    } else {
      pnl = (entryPriceNum - exitPriceNum) * units;
    }

    pnl = pnl / conversionRateUsed;

    const exitTime = toUTC();
    await onTradeClose(order.user_id, order.used_margin, pnl);


    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS}
       SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'completed', closed_by = ?
       WHERE trade_id = ?`,
      [exitPriceNum, exitTime, pnl, closedBy, order.trade_id]
    );

    console.log(`Position closed by ${closedBy}: ${order.trade_id} at ${exitPriceNum}`);
  }
};

const processPnLTpSlForActiveOrders = async () => {
  const [activeOrders] = await queryDatabase(`
    SELECT * FROM ${TABLES.LIVE_USERS_ORDERS}
    WHERE order_status = 'active'
      AND (tp_pnl IS NOT NULL OR sl_pnl IS NOT NULL)
  `);

  if (!activeOrders.length) return;

  for (const order of activeOrders) {
    const priceObj = forgePriceStore.get(order.symbol);
    if (!priceObj) continue;

    const currentMarket = parseFloat(priceObj.p || priceObj.price);
    const type = (order.type || '').toUpperCase();

    const tp = order.tp_pnl !== null ? parseFloat(order.tp_pnl) : null;
    const sl = order.sl_pnl !== null ? parseFloat(order.sl_pnl) : null;

    const entryPrice = parseFloat(order.entry_price);
    const lot = parseFloat(order.lot_size);

    // 🔥 CONTRACT SIZE LOGIC
    const symbol = order.symbol.toUpperCase();

    const contractSize =
      (symbol === 'XAU/USD' || symbol === 'XPD/USD' || order.symbol === 'XPT/USD') ? CONTRACT_SIZE_XAUUSD :
      (symbol === 'XAG/USD') ? CONTRACT_SIZE_SILVER :
      (symbol === 'XCU/USD') ? CONTRACT_SIZE_COPPER :
      (symbol === 'DXY' || symbol ==='US/OIL' || symbol ==='UK/OIL') ? CONTRACT_SIZE_DXY :
      B_PAIR.includes(symbol.replace("/", "")) ? CONTRACT_SIZE_BINANCE :
      CONTRACT_SIZE;

    const units = lot * contractSize;

    // 🔥 USD CONVERSION
    const [, quote] = order.symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quote);

    // 🔥 CALCULATE LIVE PnL
    let pnl = 0;

    if (type === 'BUY') {
      pnl = (currentMarket - entryPrice) * units;
    } else {
      pnl = (entryPrice - currentMarket) * units;
    }

    pnl = pnl / conversionRateUsed;

    // 🔥 CHECK TP / SL IN USD
    let closedBy = null;

    if (tp !== null && pnl >= tp) {
      closedBy = 'take_profit';
    } else if (sl !== null && pnl <= sl) {
      closedBy = 'stop_loss';
    }

    if (!closedBy) continue;

    let exitPrice = currentMarket;

    if (closedBy === 'take_profit' && tp !== null) {
      if (type === 'BUY') {
        exitPrice = entryPrice + (tp * conversionRateUsed) / units;
      } else {
        exitPrice = entryPrice - (tp * conversionRateUsed) / units;
      }
      pnl = tp; // force exact pnl
    }

    if (closedBy === 'stop_loss' && sl !== null) {
      const slValue = sl;

      if (type === 'BUY') {
        exitPrice = entryPrice + (slValue * conversionRateUsed) / units;
      } else {
        exitPrice = entryPrice - (slValue * conversionRateUsed) / units;
      }
      pnl = slValue; // exact pnl
    }
    const exitTime = toUTC();

    await onTradeClose(order.user_id, order.used_margin, pnl);

    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS}
       SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'completed', closed_by = ?
       WHERE trade_id = ?`,
      [exitPrice, exitTime, pnl, closedBy, order.trade_id]
    );

    console.log(`PnL TP/SL hit: ${order.trade_id} → ${closedBy} at PnL ${pnl}`);
  }
};

// 
// const autoSquareOffUser = async (user_id) => {
//   const [activeOrders] = await queryDatabase(
//     `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
//     [user_id]
//   );
//   if (!activeOrders.length) return false;

//   for (const order of activeOrders) {
//     try {
//       if (!order.symbol) continue; // If symbol is missing, skip this trade

//       const normalizedSymbol = order.symbol.includes('/')
//         ? order.symbol
//         : `${order.symbol.slice(0, 3)}/${order.symbol.slice(3)}`;

//       const priceObj = forgePriceStore.get(normalizedSymbol);
//       if (!priceObj) continue;

//       const currentPrice = parseFloat(priceObj.p || priceObj.price);
//       const rawSymbol = normalizedSymbol.toUpperCase().replace("/", "");

//       const [, quote] = normalizedSymbol.split('/');
//       let conversionRateUsed = getUsdConversionRate(quote);

//        if (B_PAIR.includes(rawSymbol)){
//         conversionRateUsed = 1;
//       }

//       if (!isFinite(conversionRateUsed) || conversionRateUsed <= 0) {
//         conversionRateUsed = 1;
//       }
//       const decimals = normalizedSymbol === 'XAU/USD' ? 2 : 5;
//       const exitPrice = parseFloat(currentPrice.toFixed(decimals));

//       const contractSize = normalizedSymbol === 'XAU/USD' || normalizedSymbol === 'XPD/USD' ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE : 
//       normalizedSymbol === 'XAG/USD' ? CONTRACT_SIZE_SILVER : normalizedSymbol === 'XCU/USD' ? CONTRACT_SIZE_COPPER : CONTRACT_SIZE;
//       const units = parseFloat(order.lot_size) * contractSize;
//       const entryPriceNum = parseFloat(order.entry_price);

//       let pnl =
//         order.type.toUpperCase() === 'BUY'
//           ? (exitPrice - entryPriceNum) * units  
//           : (entryPriceNum - exitPrice) * units;

//     pnl = pnl / conversionRateUsed;

//     if (!isFinite(pnl)) continue; // If PNL will be NAN/Infinity skip this trade
//     await onTradeClose(order.user_id, order.used_margin, pnl);

//       await queryDatabase(`UPDATE ${TABLES.LIVE_USERS_ORDERS} SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'cancelled', closed_by = 'square_off' WHERE trade_id = ?`,
//         [exitPrice, toUTC(), pnl, order.trade_id] );

//       console.log(`✅ Order ${order.trade_id} squared off`);
//     } catch (err) {
//       console.error(`❌ Square-off failed for ${order.trade_id}`, err);
//     }
//   }

//   return true;
// };

const autoSquareOffUser = async (user_id) => {
  try {
    // Step 1: Lock active orders first
    const [lockResult] = await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS}
       SET order_status = 'square_off'
       WHERE user_id = ?
       AND order_status = 'active'`,
      [user_id]
    );

    if (!lockResult.affectedRows) {
      console.log(`No active orders found for square-off user: ${user_id}`);
      return false;
    }

    // Step 2: Get only locked orders
    const [activeOrders] = await queryDatabase(
      `SELECT * 
       FROM ${TABLES.LIVE_USERS_ORDERS} 
       WHERE user_id = ? 
       AND order_status = 'square_off'`,
      [user_id]
    );

    if (!activeOrders.length) return false;

    // Step 3: Get wallet only once
    const [walletRows] = await queryDatabase(
      `SELECT wallet, used_margin 
       FROM ${TABLES.LIVE_USERS_WALLET} 
       WHERE user_id = ?`,
      [user_id]
    );

    if (!walletRows.length) {
      console.log(`Wallet not found for user: ${user_id}`);
      return false;
    }

    const oldWallet = Number(walletRows[0].wallet || 0);

    let totalPnL = 0;
    let totalReleasedMargin = 0;

    // Step 4: Calculate PnL for all orders
    for (const order of activeOrders) {
      try {
        if (!order.symbol) continue;

        const normalizedSymbol = order.symbol.includes("/")
          ? order.symbol.toUpperCase()
          : `${order.symbol.slice(0, 3)}/${order.symbol.slice(3)}`.toUpperCase();

        const priceObj =
          forgePriceStore.get(normalizedSymbol) ||
          forgePriceStore.get(normalizedSymbol.replace("/", ""));

        if (!priceObj) {
          console.log(`Price not found for ${normalizedSymbol}`);
          continue;
        }

        const currentPrice = Number(priceObj.p || priceObj.price);

        if (!Number.isFinite(currentPrice)) {
          console.log(`Invalid current price for ${normalizedSymbol}`);
          continue;
        }

        const rawSymbol = normalizedSymbol.replace("/", "");
        const [, quote] = normalizedSymbol.split("/");

        let conversionRateUsed = Number(getUsdConversionRate(quote) || 1);

        if (B_PAIR.includes(rawSymbol)) {
          conversionRateUsed = 1;
        }

        if (!Number.isFinite(conversionRateUsed) || conversionRateUsed <= 0) {
          conversionRateUsed = 1;
        }

        const decimals = normalizedSymbol === "XAU/USD" ? 2 : 5;
        const exitPrice = Number(currentPrice.toFixed(decimals));

        const contractSize =
          normalizedSymbol === "XAU/USD" || normalizedSymbol === "XPD/USD" || normalizedSymbol === "XPT/USD"
            ? CONTRACT_SIZE_XAUUSD
            : B_PAIR.includes(rawSymbol)
            ? CONTRACT_SIZE_BINANCE
            : normalizedSymbol === "XAG/USD"
            ? CONTRACT_SIZE_SILVER
            : normalizedSymbol === "XCU/USD"
            ? CONTRACT_SIZE_COPPER
            : normalizedSymbol === "DXY" || normalizedSymbol ==='US/OIL' ||normalizedSymbol ==='UK/OIL'
            ? CONTRACT_SIZE_DXY
            : CONTRACT_SIZE;

        const lotSize = Number(order.lot_size || 0);
        const units = lotSize * contractSize;
        const entryPriceNum = Number(order.entry_price);
        const orderType = String(order.type || "").toUpperCase();

        if (
          !Number.isFinite(lotSize) ||
          !Number.isFinite(units) ||
          !Number.isFinite(entryPriceNum)
        ) {
          console.log(`Invalid order values for trade ${order.trade_id}`);
          continue;
        }

        let pnl =
          orderType === "BUY"
            ? (exitPrice - entryPriceNum) * units
            : (entryPriceNum - exitPrice) * units;

        pnl = pnl / conversionRateUsed;

        if (!Number.isFinite(pnl)) {
          console.log(`Invalid PnL for trade ${order.trade_id}`);
          continue;
        }

        pnl = Number(pnl.toFixed(2));

        totalPnL += pnl;
        totalReleasedMargin += Number(order.used_margin || 0);

        // Step 5: Update order only, do not update wallet here
        await queryDatabase(
          `UPDATE ${TABLES.LIVE_USERS_ORDERS} 
           SET exit_price = ?, 
               exit_time = ?, 
               pnl = ?, 
               order_status = 'cancelled', 
               closed_by = 'square_off' 
           WHERE trade_id = ? 
           AND user_id = ?
           AND order_status = 'square_off'`,
          [exitPrice, toUTC(), pnl, order.trade_id, user_id]
        );

        console.log(`✅ Order ${order.trade_id} squared off. PnL: ${pnl}`);
      } catch (err) {
        console.error(`❌ Square-off failed for ${order.trade_id}`, err);
      }
    }

    totalPnL = Number(totalPnL.toFixed(2));

    // Step 6: Update wallet only once
    const newWallet = Number((oldWallet + totalPnL).toFixed(2));

    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_WALLET}
       SET wallet = ?,
           used_margin = 0,
           after_used_margin = ?
       WHERE user_id = ?`,
      [newWallet, newWallet, user_id]
    );

    console.log("✅ Square-off wallet updated:", {
      user_id,
      oldWallet,
      totalPnL,
      newWallet,
    });

    return true;
  } catch (err) {
    console.error(`❌ Auto square-off failed for user ${user_id}`, err);

    // Reset locked orders if full function fails
    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS}
       SET order_status = 'active'
       WHERE user_id = ?
       AND order_status = 'square_off'`,
      [user_id]
    );

    return false;
  }
};


// pending trade 

// const getPendingOrders = async (req, res) => {
//   try {
//     const sql = `SELECT * FROM ${TABLES.ORDERS_DEMO} WHERE order_status = 'pending'`;
//     const trades = await queryDatabase(sql);
//     return res.status(200).json({ success: true, trades: trades[0] });
//   } catch (error) {
//     console.error("Error fetching pending trades:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// cancelled 




// update order history 

// Update order by trade_id
// const updateOrder = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { lot_size, type, entry_price, stop_loss, take_profit, tp_pnl, sl_pnl, exit_price, exit_time, pnl, order_status, closed_by } = req.body;

//     const [rows] = await queryDatabase(
//       `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ?`,
//       [id]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({ status: "error", message: "Order not found" });
//     }

//     const existingOrder = rows[0];

//     const [result] = await queryDatabase(
//       `UPDATE ${TABLES.LIVE_USERS_ORDERS} 
//        SET lot_size = ?, type = ?, entry_price = ?, stop_loss = ?, take_profit = ?, tp_pnl = ?, sl_pnl = ?, exit_price = ?, exit_time = ?, pnl = ?, order_status = ?, closed_by = ?
//        WHERE trade_id = ?`,
//       [
//         lot_size || existingOrder.lot_size,
//         type || existingOrder.type,
//         entry_price || existingOrder.entry_price,
//         stop_loss || existingOrder.stop_loss,
//         take_profit || existingOrder.take_profit,
//         tp_pnl || existingOrder.tp_pnl,
//         sl_pnl || existingOrder.sl_pnl,
//         exit_price || null,
//         exit_time || null,
//         pnl || existingOrder.pnl,
//         order_status || existingOrder.order_status,
//         closed_by || existingOrder.closed_by,
//         id
//       ]
//     );

//     return res.status(200).json({ status: "success", message: "Order updated successfully" });
//   } catch (error) {
//     console.error("Error updating order:", error);
//     return res.status(500).json({ status: "error", message: "Failed to update order" });
//   }
// };

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    let { lot_size, type, entry_price, entry_time, stop_loss, take_profit, tp_pnl, sl_pnl, exit_price, exit_time, pnl, order_status, closed_by } = req.body;

    const [rows] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Order not found" });
    }

    const existingOrder = rows[0];

    // FIX: Convert both datetimes to MySQL format before query
    entry_time = toMySQLDateTime(entry_time);
    exit_time = toMySQLDateTime(exit_time);

    const [result] = await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS} 
       SET lot_size = ?, type = ?, entry_price = ?, entry_time = ?, stop_loss = ?, take_profit = ?, tp_pnl = ?, sl_pnl = ?, exit_price = ?, exit_time = ?, pnl = ?, order_status = ?, closed_by = ?
       WHERE trade_id = ?`,
      [
        lot_size || existingOrder.lot_size,
        type || existingOrder.type,
        entry_price || existingOrder.entry_price,
        entry_time || existingOrder.entry_time,
        stop_loss || existingOrder.stop_loss,
        take_profit || existingOrder.take_profit,
        tp_pnl || existingOrder.tp_pnl,
        sl_pnl || existingOrder.sl_pnl,
        exit_price || null,
        exit_time || null,
        pnl || existingOrder.pnl,
        order_status || existingOrder.order_status,
        closed_by || existingOrder.closed_by,
        id
      ]
    );

    return res.status(200).json({ status: "success", message: "Order updated successfully" });
  } catch (error) {
    console.error("Error updating order:", error);
    return res.status(500).json({ status: "error", message: "Failed to update order" });
  }
};


const closeAllTrades = async (req, res) => {
  try {
    const { user_id, close_source, close_type } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: "error",
        error: "MISSING_USER_ID",
        message: "User ID is required.",
      });
    }

    // Normalize close_source — must be either 'website' or 'mobile_app'
    const ALLOWED_CLOSE_SOURCES = ["website", "mobile_app"];
    const normalizedCloseSource = close_source?.trim().toLowerCase().replace(/\s+/g, "_") || "website";
    const validCloseSource = ALLOWED_CLOSE_SOURCES.includes(normalizedCloseSource) ? normalizedCloseSource : "website";

    // Validate close_type (default to 'all' if not provided)
    const VALID_CLOSE_TYPES = ["all", "profitable", "losing", "buy", "sell"];
    const validCloseType = VALID_CLOSE_TYPES.includes(close_type) ? close_type : "all";

    // Get all active trades for this user
    const [activeTrades] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
      [user_id]
    );

    if (activeTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "NO_ACTIVE_TRADES",
        message: "No active positions found for this user.",
      });
    }

    if(!isForexMarketOpen(activeTrades[0].symbol)){
      return res.status(400).json({
        status:"error",
        message:"Market is closed. You can close your postions when market opens"
      })
    }

    const tradesToClose = [];

    // ==========================================
    // LOOP 1: Calculate Live PnL & Filter Trades
    // ==========================================
    for (const trade of activeTrades) {
      try {
        const priceObj = forgePriceStore.get(trade.symbol);
        if (!priceObj) {
          console.warn(`No price found for symbol: ${trade.symbol}`);
          continue;
        }

        const currentPrice = parseFloat(priceObj.p || priceObj.price);

        // Normalize symbol safely
        if (!trade.symbol) {
          console.warn(`⚠️ Trade ${trade.trade_id} has no symbol`);
          continue;
        }

        const normalizedSymbol = trade.symbol.includes('/')
          ? trade.symbol
          : `${trade.symbol.slice(0, 3)}/${trade.symbol.slice(3)}`;

        const [, quote] = normalizedSymbol.split('/');
        const conversionRateUsed = getUsdConversionRate(quote);

        let exitPrice = currentPrice;
        if (trade.type === "BUY") {
          exitPrice = currentPrice; 
        } else {
          exitPrice = currentPrice; 
        }

        const decimals = trade.symbol === "XAU/USD" ? 2 : 5;
        exitPrice = parseFloat(exitPrice.toFixed(decimals));

        const rawSymbol = trade.symbol.toUpperCase().replace("/", "");
        
        // PnL Calculation
        const contractSize =
          (trade.symbol.toUpperCase() === "XAU/USD" || trade.symbol.toUpperCase() === "XPD/USD") ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE
          : (trade.symbol.toUpperCase() === 'XAG/USD') ? CONTRACT_SIZE_SILVER : (trade.symbol.toUpperCase() === 'XCU/USD') ? CONTRACT_SIZE_COPPER : (trade.symbol.toUpperCase() ==='DXY' || trade.symbol.toUpperCase() ==='US/OIL' || trade.symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;
          
        const units = trade.lot_size * contractSize;

        let pnl = 0;
        if (trade.type === "BUY") {
          pnl = (exitPrice - trade.entry_price) * units;
        } else {
          pnl = (trade.entry_price - exitPrice) * units;
        }
        pnl = pnl / conversionRateUsed;

        // Store calculated values temporarily on trade object
        trade._calcPnl = pnl;
        trade._calcExitPrice = exitPrice;

        // Filter based on close_type
        let shouldClose = false;

        if (validCloseType === "all") {
          shouldClose = true;
        } else if (validCloseType === "profitable") {
          shouldClose = pnl > 0;
        } else if (validCloseType === "losing") {
          shouldClose = pnl < 0;
        } else if (validCloseType === "buy") {
          shouldClose = trade.type === "BUY";
        } else if (validCloseType === "sell") {
          shouldClose = trade.type === "SELL";
        }

        if (shouldClose) {
          tradesToClose.push(trade);
        }

      } catch (innerErr) {
        console.error(`Error calculating PnL for trade ${trade.trade_id}:`, innerErr);
      }
    }

    if (tradesToClose.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "NO_MATCHING_TRADES",
        message: `No positions found to close for type: ${validCloseType}.`,
      });
    }

    // ==========================================
    // LOOP 2: Actually Close & Update DB
    // ==========================================
    const closedTrades = [];
    const now = toUTC();

    for (const trade of tradesToClose) {
      try {
        const exitPrice = trade._calcExitPrice;
        const pnl = trade._calcPnl;

        // Release margin and update wallet
        await onTradeClose(user_id, trade.used_margin, pnl);

        // Update trade in DB
        await queryDatabase(
          `UPDATE ${TABLES.LIVE_USERS_ORDERS}
           SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'cancelled', closed_by = 'user', close_source = ?
           WHERE trade_id = ?`,
          [exitPrice, now, pnl, validCloseSource, trade.trade_id]
        );

        closedTrades.push({
          trade_id: trade.trade_id,
          symbol: trade.symbol,
          type: trade.type,
          exit_price: exitPrice,
          pnl: pnl,
          trade_source: trade.trade_source || "website",
          close_source: validCloseSource
        });
      } catch (innerErr) {
        console.error(`Error closing trade ${trade.trade_id}:`, innerErr);
      }
    }

    if (closedTrades.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No Position were closed. Possibly no price data available.",
      });
    }

    // Return response
    return res.status(200).json({
      status: "success",
      message: `${closedTrades.length} Position(s) closed successfully.`,
      close_type_used: validCloseType,
      data: closedTrades,
    });
  } catch (err) {
    console.error("Error closing all Position:", err);
    return res.status(500).json({
      status: "error",
      error: "CLOSE_ALL_FAILED",
      message: "Failed to close active Position.",
    });
  }
};

async function closeTradesByCondition(user_id, condition) {
  const [activeTrades] = await queryDatabase(
    `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
    [user_id]
  );

  if (activeTrades.length === 0) return [];

  const now = toUTC();
  const closedTrades = [];

  for (const trade of activeTrades) {
    try {
      const priceObj = forgePriceStore.get(trade.symbol);
      if (!priceObj) continue;

      const currentPrice = parseFloat(priceObj.p || priceObj.price);

     // Normalize symbol safely

        if (!trade.symbol) {
      console.warn(`⚠️ Trade ${trade.trade_id} has no symbol`);
      continue;
    }

    const normalizedSymbol = trade.symbol.includes('/')
      ? trade.symbol
      : `${trade.symbol.slice(0, 3)}/${trade.symbol.slice(3)}`;

    const [, quote] = normalizedSymbol.split('/');

    // USD conversion
    const conversionRateUsed = getUsdConversionRate(quote);

    console.log(
      `Trade ${trade.trade_id} | ${normalizedSymbol} | ${quote} → USD rate = ${conversionRateUsed}`
    );


      let exitPrice = parseFloat(
        currentPrice.toFixed(trade.symbol === "XAU/USD" ? 2 : 5)
      );
      const rawSymbol = trade.symbol.toUpperCase().replace("/", "");

      const contractSize =
        (trade.symbol.toUpperCase() === "XAU/USD" || trade.symbol.toUpperCase() === "XPD/USD") ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE : 
        trade.symbol.toUpperCase() === "XAG/USD" ? CONTRACT_SIZE_SILVER : (trade.symbol.toUpperCase() === 'XCU/USD') ? CONTRACT_SIZE_COPPER : (trade.symbol.toUpperCase() ==='DXY' || trade.symbol.toUpperCase() ==='US/OIL' || trade.symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;
      const units = trade.lot_size * contractSize;

      // let pnl = trade.type === "BUY"
      //   ? (exitPrice - trade.entry_price) * units
      //   : (trade.entry_price - exitPrice) * units;

      let pnl = 0;
      if (trade.type === 'BUY') {
        pnl = (exitPrice - trade.entry_price) * units;
      } else {
        pnl = (trade.entry_price - exitPrice) * units;
      }

      pnl = pnl / conversionRateUsed; 

      // Check condition (profit/loss/all)
      if (condition === "profit" && pnl <= 0) continue;
      if (condition === "loss" && pnl >= 0) continue;

      await onTradeClose(user_id, trade.used_margin, pnl);

      await queryDatabase(
        `UPDATE ${TABLES.LIVE_USERS_ORDERS}
         SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'cancelled', closed_by = 'user'
         WHERE trade_id = ?`,
        [exitPrice, now, pnl, trade.trade_id]
      );

      closedTrades.push({
        trade_id: trade.trade_id,
        symbol: trade.symbol,
        exit_price: exitPrice,
        pnl: pnl,
      });
    } catch (err) {
      console.error(`Error closing Position ${trade.trade_id}:`, err);
    }
  }

  return closedTrades;
}

async function closeTradesByType(user_id, type) {
  const [activeTrades] = await queryDatabase(
    `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} 
     WHERE user_id = ? AND order_status = 'active'`,
    [user_id]
  );

  if (activeTrades.length === 0) return [];

  const now = toUTC();
  const closedTrades = [];

  for (const trade of activeTrades) {
    try {
      // ✅ Filter by type (BUY / SELL)
      if (trade.type.toUpperCase() !== type.toUpperCase()) continue;

      const priceObj = forgePriceStore.get(trade.symbol);
      if (!priceObj) continue;

      const currentPrice = parseFloat(priceObj.p || priceObj.price);

      // ⚠️ Safety check
      if (!trade.symbol) {
        console.warn(`⚠️ Trade ${trade.trade_id} has no symbol`);
        continue;
      }

      // Normalize symbol
      const normalizedSymbol = trade.symbol.includes('/')
        ? trade.symbol
        : `${trade.symbol.slice(0, 3)}/${trade.symbol.slice(3)}`;

      const [, quote] = normalizedSymbol.split('/');

      // USD conversion
      const conversionRateUsed = getUsdConversionRate(quote);

      console.log(
        `Trade ${trade.trade_id} | ${normalizedSymbol} | ${quote} → USD rate = ${conversionRateUsed}`
      );

      // Exit price formatting
      let exitPrice = parseFloat(
        currentPrice.toFixed(trade.symbol === "XAU/USD" ? 2 : 5)
      );

      const rawSymbol = trade.symbol.toUpperCase().replace("/", "");

      // Contract size
      const contractSize =
        (trade.symbol.toUpperCase() === "XAU/USD" || trade.symbol.toUpperCase() === "XPD/USD" || trade.symbol.toUpperCase === 'XPT/USD')
          ? CONTRACT_SIZE_XAUUSD
          : B_PAIR.includes(rawSymbol)
          ? CONTRACT_SIZE_BINANCE
          : trade.symbol.toUpperCase() === "XAG/USD"
          ? CONTRACT_SIZE_SILVER
          : trade.symbol.toUpperCase() === "XCU/USD"
          ? CONTRACT_SIZE_COPPER
          : trade.symbol.toUpperCase() === "DXY" || trade.symbol.toUpperCase() ==='US/OIL'|| trade.symbol.toUpperCase() ==='UK/OIL'
          ? CONTRACT_SIZE_DXY
          : CONTRACT_SIZE;

      const units = trade.lot_size * contractSize;

      // PnL Calculation
      let pnl = 0;
      if (trade.type === 'BUY') {
        pnl = (exitPrice - trade.entry_price) * units;
      } else {
        pnl = (trade.entry_price - exitPrice) * units;
      }

      pnl = pnl / conversionRateUsed;

      // 💰 Close trade
      await onTradeClose(user_id, trade.used_margin, pnl);

      await queryDatabase(
        `UPDATE ${TABLES.LIVE_USERS_ORDERS}
         SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'cancelled', closed_by = 'user'
         WHERE trade_id = ?`,
        [exitPrice, now, pnl, trade.trade_id]
      );

      closedTrades.push({
        trade_id: trade.trade_id,
        symbol: trade.symbol,
        order_type: trade.type,
        exit_price: exitPrice,
        pnl: pnl,
      });

    } catch (err) {
      console.error(`Error closing Position ${trade.trade_id}:`, err);
    }
  }

  return closedTrades;
}

const closeAllProfitTrades = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: "error",
        error: "MISSING_USER_ID",
        message: "User ID is required.",
      });
    }



    const [activeTrades] = await queryDatabase(`SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`, [user_id]);

    if(activeTrades.length === 0 ){
      return res.status(404).json({
        status:"error",
        message:"No active found"
      })
    }

    if (!isForexMarketOpen(activeTrades[0]?.symbol)) {
      return res.status(400).json({
        status:"error",
        message:"Market is closed Your can not close Profit position When market is closed"
      })
    }

    const closedTrades = await closeTradesByCondition(user_id, "profit");

    if (closedTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No profitable Position available to close.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: `${closedTrades.length} profitable trades closed successfully.`,
      data: closedTrades,
    });
  } catch (err) {
    console.error("Error closing profit Position:", err);
    res.status(500).json({
      status: "error",
      error: "CLOSE_PROFIT_FAILED",
      message: "Failed to close profitable Position.",
    });
  }
};

const closeAllLossTrades = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: "error",
        error: "MISSING_USER_ID",
        message: "User ID is required.",
      });
    }

    // get active trades
    const [activeTrades] = await queryDatabase( `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS}  WHERE user_id = ? AND order_status='active'`, [user_id]);

    if (activeTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No active trades found",
      });
    }

    const symbol = activeTrades[0]?.symbol?.split(":").pop().replace("/", "").toUpperCase();

    const isCrypto = symbol.startsWith("BTC") || symbol.startsWith("ETH")

    // market check first
    if (!isCrypto  && !isForexMarketOpen(symbol)) {
      return res.status(400).json({
        status: "error",
        message: "Market is closed Your can not close Loss position When market is closed",
      });
    }

    const closedTrades = await closeTradesByCondition(user_id, "loss");

    if (closedTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No losing Position available to close.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: `${closedTrades.length} losing trades Position successfully.`,
      data: closedTrades,
    });
  } catch (err) {
    console.error("Error closing loss Position:", err);
    res.status(500).json({
      status: "error",
      error: "CLOSE_LOSS_FAILED",
      message: "Failed to close losing Position.",
    });
  }
};

const closeAllBuyTrades = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: "error",
        error: "MISSING_USER_ID",
        message: "User ID is required.",
      });
    }

    const [activeTrades] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} 
       WHERE user_id = ? AND order_status='active' AND type='BUY'`,
      [user_id]
    );

    if (activeTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No active BUY trades found",
      });
    }

    // Optional: Market check (based on first trade)
    const symbol = activeTrades[0]?.symbol?.split(":").pop().replace("/", "").toUpperCase();
    const isCrypto = symbol.startsWith("BTC") || symbol.startsWith("ETH");

    if (!isCrypto && !isForexMarketOpen(symbol)) {
      return res.status(400).json({
        status: "error",
        message: "Market is closed. Cannot close BUY trades.",
      });
    }

    const closedTrades = await closeTradesByType(user_id, "BUY");

    if (closedTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No BUY trades available to close.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: `${closedTrades.length} BUY trades closed successfully.`,
      data: closedTrades,
    });

  } catch (err) {
    console.error("Error closing BUY trades:", err);
    res.status(500).json({
      status: "error",
      error: "CLOSE_BUY_FAILED",
      message: "Failed to close BUY trades.",
    });
  }
};

const closeAllSellTrades = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: "error",
        error: "MISSING_USER_ID",
        message: "User ID is required.",
      });
    }

    const [activeTrades] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} 
       WHERE user_id = ? AND order_status='active' AND type='SELL'`,
      [user_id]
    );

    if (activeTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No active SELL trades found",
      });
    }

    const symbol = activeTrades[0]?.symbol?.split(":").pop().replace("/", "").toUpperCase();
    const isCrypto = symbol.startsWith("BTC") || symbol.startsWith("ETH");

    if (!isCrypto && !isForexMarketOpen(symbol)) {
      return res.status(400).json({
        status: "error",
        message: "Market is closed. Cannot close SELL trades.",
      });
    }

    const closedTrades = await closeTradesByType(user_id, "SELL");

    if (closedTrades.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No SELL trades available to close.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: `${closedTrades.length} SELL trades closed successfully.`,
      data: closedTrades,
    });

  } catch (err) {
    console.error("Error closing SELL trades:", err);
    res.status(500).json({
      status: "error",
      error: "CLOSE_SELL_FAILED",
      message: "Failed to close SELL trades.",
    });
  }
};

const closePendingOrder = async (req, res) => {
  try {
    const { id } = req.params;   // trade_id
    const { user_id, close_source } = req.body;

    // Normalize close_source
    const ALLOWED_CLOSE_SOURCES = ["website", "mobile_app"];
    const normalizedCloseSource = close_source?.trim().toLowerCase().replace(/\s+/g, "_") || "website";
    const validCloseSource = ALLOWED_CLOSE_SOURCES.includes(normalizedCloseSource) ? normalizedCloseSource : "website";

    // Get trade
    const [rows] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`,
      [id, user_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        status: "error",
        message: "Position not found",
      });
    }

    const trade = rows[0];

    if(!isForexMarketOpen(trade.symbol)){
      return res.status(400).json({
        status:"error",
        message:"Market is closet You can close pending position when market opens"
      })
    }

    // Only pending trades may be closed
    if (trade.order_status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: "Only pending Position can be closed",
      });
    }

    // Close pending trade
    const exitTime = toUTC();

    await queryDatabase(
      `UPDATE ${TABLES.LIVE_USERS_ORDERS}
       SET order_status = ?, exit_time = ?, close_source = ?
       WHERE trade_id = ? AND user_id = ?`,
      ["pending_close", exitTime, validCloseSource, id, user_id]
    );

    // Return success
    return res.json({
      status: "success",
      message: "Pending Position closed successfully",
      data: {
        trade_id: id,
        order_status: "pending_close",
        exit_time: exitTime,
        trade_source: trade.trade_source || "website",
        close_source: validCloseSource
      }
    });

  } catch (error) {
    console.error("Close pending Position error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error closing trade",
    });
  }
};

const hideOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin_name;

        await queryDatabase(
            `UPDATE ${TABLES.LIVE_USERS_ORDERS}
             SET is_hidden = 1,
                 hidden_by = ?,
                 hidden_at = NOW()
             WHERE trade_id = ?`,
            [adminId, id]
        );

        return res.json({
            success: true,
            message: "Trade hidden successfully."
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const restoreOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin_name;

        await queryDatabase(
            `UPDATE ${TABLES.LIVE_USERS_ORDERS}
             SET is_hidden = 0,
                 hidden_by = ?,
                 hidden_at = NOW()
             WHERE trade_id = ?`,
            [adminId, id]
        );

        return res.json({
            success: true,
            message: "Trade restored successfully."
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
  // User
  placeOrder,
  triggerCommission,
  getOrders,
  getOrderById,
  closeOrder,
  updateTpSl,
  removeTpSl,
  getOrdersByUserID,
  updateOrder,
  closeAllTrades,
  closeAllProfitTrades,
  closeAllLossTrades,
  closeAllBuyTrades,
  closeAllSellTrades,
  closePendingOrder,
  hideOrder,
  restoreOrder
}

// Expose for scheduler or test
module.exports.processPendingLimitOrders = processPendingLimitOrders;
module.exports.processTpSlForActiveOrders = processTpSlForActiveOrders;
module.exports.processPnLTpSlForActiveOrders = processPnLTpSlForActiveOrders;
module.exports.autoSquareOffUser = autoSquareOffUser;

