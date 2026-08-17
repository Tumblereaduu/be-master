const {queryDatabase} = require('../../config/db');
const { TABLES } = require('../../config/tables');
const forgePriceStore = require('../../models/1forge.price.model');
const { onTradeOpen, onTradeClose } = require('../../controllers/demoAccount/demoAccountControllers');
const { getSpread, getSpreadInPrice } = require('./spreadController');
const { toUTC } = require('../../utils/date');
const { normalizeSymbol } = require('../../utils/symbol');
const { getUsdConversionRate } = require('../../utils/usdConversion');

// Constants
const LEVERAGE = 100; // 1:100 leverage
const CONTRACT_SIZE = 100000; // 1 lot = 100k units for forex pairs
const CONTRACT_SIZE_XAUUSD = 100; // Contract size for gold
const CONTRACT_SIZE_SILVER = 5000; // Contract size for silver
const CONTRACT_SIZE_COPPER = 2300; // Contract size for copper
const CONTRACT_SIZE_BINANCE = 1; // Contract size for Binance
const CONTRACT_SIZE_DXY = 1000; // Contract size for DXY
const B_PAIR  = ["US30USD", "BTCUSD", "ETHUSD"];


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
    let { symbol, type, lot_size, take_profit, stop_loss, tp_pnl, sl_pnl, order_type } = req.body;
    symbol = normalizeSymbol(symbol, 'SLASH')

    const [,quoteCurrency] = symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quoteCurrency);

    const rawSymbol = symbol.toUpperCase().replace("/", "");
    const contractSize = (symbol.toUpperCase() === 'XAU/USD' || symbol.toUpperCase() === 'XPD/USD') ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE :
    (symbol.toUpperCase() === 'XAG/USD') ? CONTRACT_SIZE_SILVER : (symbol.toUpperCase() === 'XCU/USD') ? CONTRACT_SIZE_COPPER : (symbol.toUpperCase() ==='DXY' || symbol.toUpperCase() ==='US/OIL' || symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;

    // Validate required fields
    if (!user_id || !symbol || !type || !lot_size) {
      return res.status(400).json({ 
        status: 'error',
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Missing required fields' 
      });
    }

    // Normalize symbol (EURJPY → EUR/JPY)
    if (!symbol.includes('/')) {
      symbol = symbol.slice(0, 3) + '/' + symbol.slice(3);
    }


    // Validate type
    if (!['BUY', 'SELL'].includes(type.toUpperCase())) {
      return res.status(400).json({ 
        status: 'error',
        error: 'INVALID_ORDER_TYPE',
        message: 'Type must be either BUY or SELL' 
      });
    }

    // Validate order_type
    if (!['market', 'limit', 'advanced'].includes(order_type.toLowerCase())) {
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

    if(!isForexMarketOpen(symbol)){
      return res.status(400).json({
        status:"error",
        message: `Market is closed. You can Place Crypto postions anytime`
      })
    }

    // 1forge provides: s (symbol), p (mid price), b (bid), a (ask), t (timestamp)
    const currentPrice = parseFloat(priceObj.p || priceObj.price);
    const spreadPips = getSpread(symbol);
    const spreadInPrice = getSpreadInPrice(symbol, spreadPips);

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
          message: `Stop Loss must be greater than -${spreadCostUsd.toFixed(2)} USD`
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
    console.log("Demo account ", usedMargin)
    
    const spreadPriceValue = spreadInPrice;
    const spreadCost = spreadPriceValue * contractSize * lot_size;
    const spreadCostUsd = quoteCurrency === 'USD' ?  spreadCost : spreadCost / conversionRateUsed;
   console.log('[Demo Spread Info]', { symbol, type, lot_size, spread_pips: spreadPips, spread_price: spreadPriceValue, spread_cost_usd: spreadCostUsd.toFixed(5), conversion_usd: conversionRateUsed
});

    // let usedMargin = (lot_size * contractSize * entryPrice) / conversionRateUsed / LEVERAGE;
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
        0, // is_referral_code_added
        0.00, // swap
        0.00, // commission
        0.00, // user_balance_after_trade
        null, // closed_by
        entryTime // created_at
      ];

      const [result] = await queryDatabase(
        `INSERT INTO ${TABLES.DEMO_USERS_ORDERS} (
          user_id, symbol, type, order_type, lot_size, leverage, entry_price, entry_time,
          exit_price, exit_time, used_margin, pnl, take_profit, stop_loss, tp_pnl, sl_pnl,
          tp_updated_at, sl_updated_at, order_status, fee, is_referral_code_added,
          swap, commission, user_balance_after_trade, closed_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertData
      );

      return res.status(201).json({
        status: 'success',
        message: 'Limit position placed successfully and is pending. Will trigger once price is met.',
        data: {
          trade_id: result.insertId,
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
        0,    // is_referral_code_added
        0.00, // swap
        0.00, // commission
        0.00, // user_balance_after_trade
        null, // closed_by
        entryTime // created_at
      ];

      const [result] = await queryDatabase(
        `INSERT INTO ${TABLES.DEMO_USERS_ORDERS} (
          user_id, symbol, type, order_type, lot_size, leverage, entry_price, entry_time,
          exit_price, exit_time, used_margin, pnl, take_profit, stop_loss, tp_pnl, sl_pnl,
          tp_updated_at, sl_updated_at, order_status, fee, is_referral_code_added,
          swap, commission, user_balance_after_trade, closed_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertData
      );

      return res.status(201).json({
        status: 'success',
        message: 'Pending position placed successfully and is pending. Will trigger once price is met.',
        data: {
          trade_id: result.insertId,
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
      tp_pnl || null,
      sl_pnl || null,
      take_profit ? entryTime : null, // tp_updated_at
      stop_loss ? entryTime : null, // sl_updated_at
      orderStatus,
      0.00, // fee
      0, // is_referral_code_added
      0.00, // swap
      0.00, // commission
      0.00, // user_balance_after_trade
      null, // closed_by
      entryTime // created_at
    ];

    // Insert order into database
    const [result] = await queryDatabase(
      `INSERT INTO ${TABLES.DEMO_USERS_ORDERS} (
        user_id, symbol, type, order_type, lot_size, leverage, entry_price, entry_time,
        exit_price, exit_time, used_margin, pnl, take_profit, stop_loss, tp_pnl, sl_pnl,
        tp_updated_at, sl_updated_at, order_status, fee, is_referral_code_added,
        swap, commission, user_balance_after_trade, closed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertData
    );

    // Return success response
    res.status(201).json({
      status: 'success',
      message: 'Position placed successfully',
      data: {
        trade_id: result.insertId,
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
        current_price: currentPrice
      }
    });

    await onTradeOpen(user_id, usedMargin);

  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'ORDER_PLACEMENT_FAILED',
      message: 'Failed to place position. Please try again.' 
    });
  }
};

/**
 * Get all orders
 */
const getOrders = async (req, res) => {
  try {
    const { user_id } = req.query;

    let query = `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE 1=1`;
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
      `SELECT trade_id, user_id, symbol, type, lot_size, entry_price, exit_price, entry_time, exit_time, pnl, take_profit, stop_loss, tp_pnl, sl_pnl FROM ${TABLES.DEMO_USERS_ORDERS} WHERE trade_id = ?`,
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
    const { user_id } = req.body;

    // Get order details
    const [orderRows] = await queryDatabase(
      `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`,
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

     if(!isForexMarketOpen(order.symbol)){
      return res.status(400).json({
        status:"error",
        message: `Market is closed. You can Place Crypto postions anytime`
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
    // const spreadPips = getSpread(order.symbol);
    // const spreadInPrice = getSpreadInPrice(order.symbol, spreadPips);

    // === Currency conversion to USD if needed ===
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
      `UPDATE ${TABLES.DEMO_USERS_ORDERS} 
       SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'cancelled', closed_by = 'user'
       WHERE trade_id = ?`,
      [exitPrice, exitTime, pnl, id]
    );

    res.json({
      status: 'success',
      message: 'Position closed successfully',
      data: {
        trade_id: id,
        exit_price: exitPrice,
        exit_time: exitTime,
        pnl: pnl,
        order_status: 'cancelled'
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
      `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`,
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
      `UPDATE ${TABLES.DEMO_USERS_ORDERS} SET ${updates.join(', ')} WHERE trade_id = ?`,
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

    const order = await queryDatabase(`SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`, [id, user_id]);

    if (!order.length) {
      return res.status(404).json({ status: 'error', error: 'ORDER_NOT_FOUND',  message: 'Position not found'});}

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
      return res.status(400).json({status: 'error', error: 'ORDER_NOT_ACTIVE', message: 'Only active or pending positions can have TP/SL removed'});
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
      return res.status(400).json({status: 'error', error: 'NO_FIELDS', message: 'Nothing to remove'});
    }

    values.push(id);

    await queryDatabase(`UPDATE ${TABLES.DEMO_USERS_ORDERS} SET ${updates.join(', ')} WHERE trade_id = ?`, values);

    res.json({ status: 'success', message: 'TP/SL removed successfully'});

  } catch (err) {
    res.status(500).json({status: 'error', error: 'REMOVE_TP_SL_FAILED', message: err.message || 'Failed to remove TP/SL'
    });
  }
};

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
      SELECT * FROM ${TABLES.DEMO_USERS_ORDERS}
      WHERE user_id = ?
    `;
    const params = [user_id];

    // query based on status
    if (status === 'active') {
      query += ` AND order_status = 'active' AND exit_time IS NULL AND exit_price IS NULL  ORDER BY created_at DESC`;
    } else if (status === 'pending') {
      query += ` AND order_status = 'pending' AND exit_time IS NULL AND exit_price IS NULL  ORDER BY created_at DESC`;
    } else if (status === 'completed_cancelled') {
      query += ` AND (order_status = 'completed' OR order_status = 'cancelled')  ORDER BY exit_time DESC`;
    } else if (status === 'completed_cancelled_24_hr') {
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

const demoProcessPendingLimitOrders = async () => {
  // Get all pending limit or advanced orders
  const [pendingOrders] = await queryDatabase(
    `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE order_status = 'pending' AND order_type IN ('limit','advanced')`
  );
  if (!pendingOrders.length) return;
  
  for (const order of pendingOrders) {
    const priceObj = forgePriceStore.get(order.symbol);
    if (!priceObj) continue;
    // 1forge: .p is mid
    const currentMarket = parseFloat(priceObj.p || priceObj.price);
    // console.log(`Processing pending order ${order.trade_id} | Current Market: ${currentMarket} | Entry Price: ${order.entry_price}`);
    const type = order.type.toUpperCase();
    const isLimit = order.order_type === 'limit';
    const isAdvanced = order.order_type === 'advanced';
    
    let shouldTrigger = false;
    const entryPrice = Number(order.entry_price);

    if (isLimit) {
      // Limit: Buy when current <= trigger, Sell when current >= trigger
      if (type === 'BUY' && currentMarket <= Number(order.entry_price)) shouldTrigger = true;
      if (type === 'SELL' && currentMarket >= Number(order.entry_price)) shouldTrigger = true;
    } else if (isAdvanced) {
      // Advanced (Stop): Buy when current >= trigger, Sell when current <= trigger
      if (type === 'BUY' && currentMarket >= Number(order.entry_price)) shouldTrigger = true;
      if (type === 'SELL' && currentMarket <= Number(order.entry_price)) shouldTrigger = true;
    }
    if (!shouldTrigger) continue;

    // Spread logic
    const spreadPips = getSpread(order.symbol);
    const spreadInPrice = getSpreadInPrice(order.symbol, spreadPips);

    // Apply spread on activation
    let realEntryPrice;
    if (type === 'BUY') {
      realEntryPrice = parseFloat(order.entry_price) + parseFloat(spreadInPrice);
      realEntryPrice = parseFloat(realEntryPrice.toFixed(order.symbol === 'XAU/USD' ? 2 : 5));
    } else {
      realEntryPrice = parseFloat(order.entry_price) - parseFloat(spreadInPrice);
      realEntryPrice = parseFloat(realEntryPrice.toFixed(order.symbol === 'XAU/USD' ? 2 : 5));
    }

    const [, quote] = order.symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quote);
    console.log("Conversion Rate",conversionRateUsed);
    const rawSymbol = order.symbol.toUpperCase().replace("/", "")
    const contractSize = (order.symbol.toUpperCase() === 'XAU/USD' || order.symbol.toUpperCase() === 'XPD/USD' || order.symbol.toUpperCase() === 'XPT/USD') ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE :
    order.symbol.toUpperCase() === 'XAG/USD' ? CONTRACT_SIZE_SILVER: order.symbol.toUpperCase() === 'XCU/USD'  ? CONTRACT_SIZE_COPPER : (order.symbol.toUpperCase() ==='DXY' || order.symbol.toUpperCase() ==='US/OIL' || order.symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;
    const usedMargin = (order.lot_size * contractSize * realEntryPrice) / conversionRateUsed / LEVERAGE;

    // entry_time stays as originally set (request time)
    await queryDatabase(
      `UPDATE ${TABLES.DEMO_USERS_ORDERS}
       SET order_status = 'active',
           entry_price = ?,
           used_margin = ?
       WHERE trade_id = ?`,
      [realEntryPrice, usedMargin, order.trade_id]
    );

    console.log(`Pending position triggered: ${order.trade_id} (${order.order_type})`);
  }
};

const demoProcessTpSlForActiveOrders = async () => {
  // Fetch active orders that have TP or SL configured
  const [activeOrders] = await queryDatabase(`
    SELECT * FROM ${TABLES.DEMO_USERS_ORDERS}
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

    const [, quote] = order.symbol.split('/');
    const conversionRateUsed = getUsdConversionRate(quote);
    console.log("Conversion Rate",conversionRateUsed);
    const rawSymbol = order.symbol.toUpperCase().replace("/", "")

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
      `UPDATE ${TABLES.DEMO_USERS_ORDERS}
       SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'completed', closed_by = ?
       WHERE trade_id = ?`,
      [exitPriceNum, exitTime, pnl, closedBy, order.trade_id]
    );

    console.log(`Position closed by ${closedBy}: ${order.trade_id} at ${exitPriceNum}`);
  }
};

const demoProcessPnLTpSlForActiveOrders = async () => {
  const [activeOrders] = await queryDatabase(`
    SELECT * FROM ${TABLES.DEMO_USERS_ORDERS}
    WHERE order_status = 'active'
    AND (
      (tp_pnl IS NOT NULL AND tp_pnl NOT IN ('', 'null', '0'))
      OR
      (sl_pnl IS NOT NULL AND sl_pnl NOT IN ('', 'null', '0'))
    )
  `);

  if (!activeOrders.length) return;

  for (const order of activeOrders) {
    const priceObj = forgePriceStore.get(order.symbol);
    if (!priceObj) continue;

    const currentMarket = parseFloat(priceObj.p || priceObj.price);
    const type = (order.type || '').toUpperCase();

    const parseValue = (val) => {
      if (val === null || val === undefined || val === '') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    };

    const tp = parseValue(order.tp_pnl);
    const sl = parseValue(order.sl_pnl);

    const entryPrice = parseFloat(order.entry_price);
    const lot = parseFloat(order.lot_size);


    //  CONTRACT SIZE LOGIC
    const symbol = order.symbol.toUpperCase();
    const rawSymbol = order.symbol.toUpperCase().replace("/", "")

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

    // 🔥 VALIDATE CONVERSION RATE
if (!conversionRateUsed || !isFinite(conversionRateUsed)) {
  console.log("Invalid conversion rate", order.symbol, conversionRateUsed);
  continue;
}

// ✅ VALIDATE pnl
if (!isFinite(pnl)) {
  console.log("Invalid PnL", pnl);
  continue;
}


    // CHECK TP / SL IN USD
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
      `UPDATE ${TABLES.DEMO_USERS_ORDERS}
       SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'completed', closed_by = ?
       WHERE trade_id = ?`,
      [exitPrice, exitTime, pnl, closedBy, order.trade_id]
    );

    console.log(`PnL TP/SL hit: ${order.trade_id} → ${closedBy} at PnL ${pnl}`);
  }
};

const demoAutoSquareOffUser = async (user_id) => {
  const [activeOrders] = await queryDatabase(
    `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
    [user_id]
  );
  if (!activeOrders.length) return false;

  for (const order of activeOrders) {
    const priceObj = forgePriceStore.get(order.symbol);
    if (!priceObj) continue;

    const normalizedSymbol = order.symbol.includes('/') ? order.symbol : `${order.symbol.slice(0, 3)}/${order.symbol.slice(3)}`;

    const currentPrice = parseFloat(priceObj.p || priceObj.price);
    const rawSymbol = normalizedSymbol.toUpperCase().replace("/", "");

    const [, quote] = normalizedSymbol.split('/');
    let conversionRateUsed = getUsdConversionRate(quote);

       if (B_PAIR.includes(rawSymbol)){
        conversionRateUsed = 1;
      }

      if (!isFinite(conversionRateUsed) || conversionRateUsed <= 0) {
        conversionRateUsed = 1;
      }

    const decimals = order.symbol === 'XAU/USD' ? 2 : 5;
    const exitPrice = parseFloat(currentPrice.toFixed(decimals));

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

    const units = parseFloat(order.lot_size) * contractSize;
    const entryPriceNum = parseFloat(order.entry_price);

    let pnl = 0;
    if ((order.type || '').toUpperCase() === 'BUY') {
      pnl = (exitPrice - entryPriceNum) * units;
    } else {
      pnl = (entryPriceNum - exitPrice) * units;
    }

    pnl = pnl / conversionRateUsed;

    await onTradeClose(order.user_id, order.used_margin, pnl);

    const exitTime = toUTC();
    await queryDatabase(
      `UPDATE ${TABLES.DEMO_USERS_ORDERS}
       SET exit_price = ?, exit_time = ?, pnl = ?, order_status = 'cancelled', closed_by = 'square_off'
       WHERE trade_id = ?`,
      [exitPrice, exitTime, pnl, order.trade_id]
    );

    console.log(`Order ${order.trade_id} squared off automatically at ${exitPrice}`);
  }

  return true;
};

const closeAllTrades = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: "error",
        error: "MISSING_USER_ID",
        message: "User ID is required.",
      });
    }

    // Get all active trades for this user
    const [activeTrades] = await queryDatabase(
      `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
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
        message: `Market is closed. You can Place Crypto postions anytime`
      })
    }

    const closedTrades = [];
    const now = toUTC();

    // Loop through all active trades
    for (const trade of activeTrades) {
      try {
        // Get current live price
        const priceObj = forgePriceStore.get(trade.symbol);
        if (!priceObj) {
          console.warn(`No price found for symbol: ${trade.symbol}`);
          continue; // skip trade if no price
        }

        const currentPrice = parseFloat(priceObj.p || priceObj.price);

        // Currency conversion to USD
        const normalizedSymbol = trade.symbol.includes('/') ? trade.symbol : `${trade.symbol.slice(0, 3)}/${trade.symbol.slice(3)}`;
        const [, quote] = normalizedSymbol.split('/');

        // USD conversion
        const conversionRateUsed = getUsdConversionRate(quote);

        let exitPrice = currentPrice;

        // Exit price logic (similar to single trade)
        if (trade.type === "BUY") {
          exitPrice = currentPrice; // could adjust for spread
        } else {
          exitPrice = currentPrice; // could adjust for spread
        }

        const decimals = trade.symbol === "XAU/USD" ? 2 : 5;
        exitPrice = parseFloat(exitPrice.toFixed(decimals));

        const rawSymbol = trade.symbol.toUpperCase().replace('/', '');

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

        // Release margin and update wallet
        await onTradeClose(user_id, trade.used_margin, pnl);

        // Update trade in DB
        await queryDatabase(
          `UPDATE ${TABLES.DEMO_USERS_ORDERS}
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
      message: `${closedTrades.length} active Position closed successfully.`,
      data: closedTrades,
    });
  } catch (err) {
    console.error("Error closing all Position:", err);
    return res.status(500).json({
      status: "error",
      error: "CLOSE_ALL_FAILED",
      message: "Failed to close all active Position.",
    });
  }
};

// Update Trade form Admin 
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { lot_size, type, entry_price, stop_loss, take_profit, exit_price, exit_time, pnl, order_status, closed_by } = req.body;

    const [rows] = await queryDatabase(
      `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE trade_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Order not found" });
    }

    const existingOrder = rows[0];

    const [result] = await queryDatabase(
      `UPDATE ${TABLES.DEMO_USERS_ORDERS} 
       SET lot_size = ?, type = ?, entry_price = ?, stop_loss = ?, take_profit = ?, exit_price = ?, exit_time = ?, pnl = ?, order_status = ?, closed_by = ?
       WHERE trade_id = ?`,
      [
        lot_size || existingOrder.lot_size,
        type || existingOrder.type,
        entry_price || existingOrder.entry_price,
        stop_loss || existingOrder.stop_loss,
        take_profit || existingOrder.take_profit,
        exit_price || existingOrder.exit_price,
        exit_time || existingOrder.exit_time,
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

async function closeTradesByCondition(user_id, condition) {
  const [activeTrades] = await queryDatabase(
    `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
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

      // Currency conversion to USD
      const normalizedSymbol = trade.symbol.includes('/') ? trade.symbol : `${trade.symbol.slice(0, 3)}/${trade.symbol.slice(3)}`;
      const [, quote] = normalizedSymbol.split('/');
      // USD conversion
      const conversionRateUsed = getUsdConversionRate(quote);
      console.log(`Trade ${trade.trade_id} | ${normalizedSymbol} | ${quote} → USD rate = ${conversionRateUsed}`);

      let exitPrice = parseFloat(
        currentPrice.toFixed(trade.symbol === "XAU/USD" ? 2 : 5)
      );

      const rawSymbol = trade.symbol.toUpperCase().replace('/', '');

      const contractSize =
        (trade.symbol.toUpperCase() === "XAU/USD" || trade.symbol.toUpperCase() === "XPD/USD") ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(rawSymbol) ? CONTRACT_SIZE_BINANCE : 
        trade.symbol.toUpperCase() === "XAG/USD" ? CONTRACT_SIZE_SILVER : (trade.symbol.toUpperCase() === 'XCU/USD') ? CONTRACT_SIZE_COPPER : (trade.symbol.toUpperCase() ==='DXY' || trade.symbol.toUpperCase() ==='US/OIL' || trade.symbol.toUpperCase() ==='UK/OIL') ? CONTRACT_SIZE_DXY : CONTRACT_SIZE;
      const units = trade.lot_size * contractSize;

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

      await onTradeClose(user_id, trade.used_margin, trade.pnl);

      await queryDatabase(
        `UPDATE ${TABLES.DEMO_USERS_ORDERS}
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
    `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} 
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
        `UPDATE ${TABLES.DEMO_USERS_ORDERS}
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

    const [activeTrades] = await queryDatabase(`SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`, [user_id]);

    if(activeTrades.length === 0){
      return res.status(404).json({
        status: "error",
        message: "No Profitable Position available to close"
      });
    }

    if(!isForexMarketOpen(activeTrades[0].symbol)){
      return res.status(400).json({
        status:"error",
        message: "Market is closed. You can close profit trades only when the market opens."
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

  const [activeTrades] = await queryDatabase(`SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`, [user_id]);

  if(!isForexMarketOpen(activeTrades[0].symbol)){
    return res.status(400).json({
    status:"error",
    message:"Market is closed. You can close loss trades only when the market opens."
  })
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
      `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} 
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
      `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} 
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
    const { user_id } = req.body;

    // Get trade
    const [rows] = await queryDatabase(
      `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE trade_id = ? AND user_id = ?`,
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
        message: `Market is closed. You can Place Crypto postions anytime`
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
      `UPDATE ${TABLES.DEMO_USERS_ORDERS}
       SET order_status = ?, exit_time = ?
       WHERE trade_id = ? AND user_id = ?`,
      ["cancelled", exitTime, id, user_id]
    );

    // Return success
    return res.json({
      status: "success",
      message: "Pending Position closed successfully",
    });

  } catch (error) {
    console.error("Close pending Position error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error closing trade",
    });
  }
};

module.exports = {
  // User
  placeOrder,
  getOrders,
  getOrderById,
  closeOrder,
  updateTpSl,
  removeTpSl,
  getOrdersByUserID,
  closeAllTrades,
  updateOrder,
  closeAllProfitTrades,
  closeAllLossTrades,
  closeAllBuyTrades,
  closeAllSellTrades,
  closePendingOrder
}

// Expose for scheduler or test
module.exports.demoProcessPendingLimitOrders = demoProcessPendingLimitOrders;
module.exports.demoProcessTpSlForActiveOrders = demoProcessTpSlForActiveOrders;
module.exports.demoProcessPnLTpSlForActiveOrders = demoProcessPnLTpSlForActiveOrders;
module.exports.demoAutoSquareOffUser = demoAutoSquareOffUser;
