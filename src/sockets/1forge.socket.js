const ForexClient = require('forex-quotes').default;
const forgePriceStore = require('../models/1forge.price.model');
const { queryDatabase } = require('../config/db');
const { TABLES } = require('../config/tables');
const { autoSquareOffUser } = require('../controllers/orders/orderController');
const { demoAutoSquareOffUser } = require('../controllers/orders/demoOrderController');

const FCSClient = require('./fcs-client-lib');
const { normalizeSymbol } = require('../utils/symbol');
const { getUsdConversionRate } = require('../utils/usdConversion');

let forexClient;
let io;

// Constants
const CONTRACT_SIZE = 100000; // 1 lot = 100k units for forex pairs
const CONTRACT_SIZE_XAUUSD = 100; // Contract size for gold
const CONTRACT_SIZE_DXY = 1000; // Contract size for dxy
const CONTRACT_SIZE_SILVER = 5000; // Contract size for silver
const CONTRACT_SIZE_COPPER = 2300; // Contract size for copper
const B_PAIR  = ["US30USD", "BTCUSD", "ETHUSD"]


// const checkAndAutoSquareOff = async (symbol) => {
//   try {
//     // Step 1: Get all users with active trades in this symbol
//     const [activeUsers] = await queryDatabase(
//       `SELECT DISTINCT user_id FROM ${TABLES.LIVE_USERS_ORDERS} WHERE order_status = 'active' AND symbol = ?`,
//       [symbol]
//     );

//     for (const { user_id } of activeUsers) {
//       // Step 2: Fetch wallet info
//       const [walletRows] = await queryDatabase(
//         `SELECT wallet, used_margin, after_used_margin FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ?`,
//         [user_id]
//       );
//       if (!walletRows || walletRows.length === 0) continue;

//       const { wallet } = walletRows[0];
//       const walletBalance = parseFloat(wallet || 0);

//       // Step 3: Get user’s active orders
//       const [activeOrders] = await queryDatabase(
//         `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
//         [user_id]
//       );
//       if (!activeOrders.length) continue;

//       // Step 4: Compute total unrealized PnL
//       // let totalLoss = 0;
//       // for (const order of activeOrders) {
//       //   const priceObj = forgePriceStore.get(order.symbol);
//       //   if (!priceObj) continue;

//       //   const currentPrice = parseFloat(priceObj.p || priceObj.price);

//       //   let conversionRateUsed = 1;
//       //   try {
//       //     const [base, quote] = order.symbol.split('/').map(s => s.trim().toUpperCase());
          
//       //     let currentPricePair = parseFloat(priceObj.p || priceObj.price);
        
//       //       if (quote !== 'USD') {
//       //         const conversionPair = `USD/${quote}`;
//       //         const conversionObj = forgePriceStore.get(conversionPair);
        
//       //         if (conversionObj && conversionObj.p) {
//       //           const conversionRate = parseFloat(conversionObj.p);
//       //           conversionRateUsed = conversionRate
//       //           currentPricePair = currentPricePair / conversionRate;
//       //           // console.log(`Found conversion pair ${conversionPair} → Rate: ${conversionRate}`);
        
//       //           if (!isNaN(currentPricePair) && !isNaN(conversionRate) && conversionRate > 0) {
//       //             currentPricePair = currentPricePair / conversionRate;
//       //           } else {
//       //             console.warn(`Invalid currentPrice (${currentPricePair}) or conversionRate (${conversionRate}), skipping conversion.`);
//       //           }
//       //         } else {
//       //           // console.warn(`Conversion pair ${conversionPair} not found in forgePriceStore, skipping conversion in real sq.`);
//       //         }
//       //       } else {
//       //         // console.log(`${order.symbol} is already USD-based. No conversion needed in square off.`);
//       //       }
//       //     } catch (err) {
//       //       console.error(`Error while converting ${order.symbol} to USD-based price:`, err);
//       //     }

//       //   const contractSize = (order.symbol.toUpperCase() === 'XAU/USD') ? CONTRACT_SIZE_XAUUSD : B_PAIR.includes(order.symbol.toUpperCase()) ? CONTRACT_SIZE_CRYPTO : CONTRACT_SIZE;
//       //   const units = order.lot_size * contractSize;

//       //   let pnl = 0;
//       //   if (order.type === 'BUY') {
//       //     pnl = (currentPrice - order.entry_price) * units;
//       //   } else {
//       //     pnl = (order.entry_price - currentPrice) * units;
//       //   }

//       //   pnl = pnl / conversionRateUsed;

//       //   if (pnl < 0) totalLoss += Math.abs(pnl);
//       // }

//       // const effectiveBalance = Math.max(0, walletBalance - totalLoss);

//       // Step 4: Compute total floating PnL
// let totalFloatingPnL = 0;

// for (const order of activeOrders) {
//   const priceObj = forgePriceStore.get(order.symbol);
//   if (!priceObj) continue;

//   const currentPrice = Number(priceObj.p || priceObj.price);
//   const entryPrice = Number(order.entry_price);

//   const rawSymbol = order.symbol.toUpperCase().replace("/", "");
//   const isCrypto = B_PAIR.includes(rawSymbol);

//   let pnl = 0;

//   // 🟢 CRYPTO
//   if (isCrypto) {
//     pnl =
//       order.type === 'BUY'
//         ? (currentPrice - entryPrice) * order.lot_size
//         : (entryPrice - currentPrice) * order.lot_size;
//   }

//   // 🟡 XAU/USD
//   else if (order.symbol === 'XAU/USD') {
//     const units = order.lot_size * CONTRACT_SIZE_XAUUSD;
//     pnl =
//       order.type === 'BUY'
//         ? (currentPrice - entryPrice) * units
//         : (entryPrice - currentPrice) * units;
//   }

//   // 🔵 FOREX
//   else {
//     const units = order.lot_size * CONTRACT_SIZE;
//     pnl =
//       order.type === 'BUY'
//         ? (currentPrice - entryPrice) * units
//         : (entryPrice - currentPrice) * units;

//     const [, quote] = order.symbol.split('/');
//     const conversionRate = getUsdConversionRate(quote) || 1;
//     pnl = pnl / conversionRate;
//   }

//   totalFloatingPnL += pnl;
// }

// // ✅ THIS IS THE ONLY CORRECT CHECK
// const equity = walletBalance + totalFloatingPnL;

// if (equity <= 2) {
//   console.log(
//     `⚠️ User ${user_id} equity (${equity}) <= 2. Auto square-off triggered.`
//   );
//   await autoSquareOffUser(user_id);
// }


//       if (effectiveBalance <= 2.00) {
//         console.log(
//           `⚠️ User ${user_id} effective balance (${effectiveBalance}) dropped to or below 2. Auto square-off triggered.`
//         );
//         await autoSquareOffUser(user_id);
//         continue;
//       }

//       if (walletBalance <= 0) {
//         await autoSquareOffUser(user_id);
//       }
//     }
//   } catch (err) {
//     console.error("Error in checkAndAutoSquareOff:", err);
//   }
// };


const checkAndAutoSquareOff = async (symbol) => {
  try {
    // Step 1: Get all users with active trades in this symbol
    const [activeUsers] = await queryDatabase(
      `SELECT DISTINCT user_id FROM ${TABLES.LIVE_USERS_ORDERS} WHERE order_status = 'active' AND symbol = ?`,
      [symbol]
    );

    for (const { user_id } of activeUsers) {
      // Step 2: Fetch wallet info
      const [walletRows] = await queryDatabase(
        `SELECT wallet FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ?`,
        [user_id]
      );
      if (!walletRows.length) continue;

      const walletBalance = Number(walletRows[0].wallet || 0);

      // Step 3: Get user’s active orders
      const [activeOrders] = await queryDatabase(
        `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
        [user_id]
      );
      if (!activeOrders.length) continue;

      // Step 4: Compute total unrealized PnL
      let totalFloatingPnL = 0;
      for (const order of activeOrders) {
        const priceObj = forgePriceStore.get(order.symbol);
        if (!priceObj) continue;

        const currentPrice = Number(priceObj.p || priceObj.price);
        const entryPrice = Number(order.entry_price);
        const rawSymbol = order.symbol.toUpperCase().replace("/", "");
        const isCrypto = B_PAIR.includes(rawSymbol);

        let pnl = 0;
        
        if (isCrypto) {
          pnl = order.type === 'BUY' ? (currentPrice - entryPrice) * order.lot_size : (entryPrice - currentPrice) * order.lot_size;
        } else if (order.symbol === 'XAU/USD' || order.symbol === 'XPD/USD' || order.symbol === 'XPT/USD'){
          const units = order.lot_size * CONTRACT_SIZE_XAUUSD;
          pnl = order.type === 'BUY' ? (currentPrice - entryPrice) * units : (entryPrice - currentPrice) * units;
        }
         else if (order.symbol === 'XAG/USD') {
          const units = order.lot_size * CONTRACT_SIZE_SILVER;
          pnl = order.type === 'BUY' ? (currentPrice - entryPrice) * units : (entryPrice - currentPrice) * units;
        } else if (order.symbol === 'XCU/USD'){
          const units = order.lot_size * CONTRACT_SIZE_COPPER;
          pnl = order.type === 'BUY' ? (currentPrice - entryPrice) * units : (entryPrice - currentPrice) * units
        }
         else {
          const units = order.lot_size * CONTRACT_SIZE;
          pnl =  order.type === 'BUY'? (currentPrice - entryPrice) * units : (entryPrice - currentPrice) * units;
          const [, quote] = order.symbol.split('/');
          const conversionRate = getUsdConversionRate(quote) || 1;
          pnl = pnl / conversionRate;
        }

        totalFloatingPnL += pnl;
      }

      //  ONLY correct square-off check
      const equity = walletBalance + totalFloatingPnL;

      if (equity <= 2) {
        console.log(
          `⚠️ User ${user_id} equity (${equity}) <= 2. Auto square-off triggered.`
        );
        await autoSquareOffUser(user_id);
      }
    }
  } catch (err) {
    console.error("Error in checkAndAutoSquareOff:", err);
  }
};

const demoCheckAndAutoSquareOff = async (symbol) =>{
  try {
    const [activeUsers] = await queryDatabase (`SELECT DISTINCT user_id FROM ${TABLES.DEMO_USERS_ORDERS} WHERE order_status = 'active' AND symbol = ? `, [symbol] );

    for (const {user_id} of activeUsers){
      const [walletRows] = await queryDatabase (`SELECT wallet FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ?`,[user_id])

      if(!walletRows.length) continue;

      const walletBalance = Number(walletRows[0].wallet || 0);

      const [activeOrders] = await queryDatabase(`SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,[user_id])

      if(!activeOrders.length) continue;

      let totalFloatingPnl = 0;

      for(const order of activeOrders){
        const priceObj = forgePriceStore.get(order.symbol);
        if(!priceObj) continue;

          const currentPrice = Number(priceObj.p || priceObj.price);
          const entryPrice = Number(order.entry_price);
          const rawSymbol = order.symbol.toUpperCase().replace("/","");
          const isCrypto = B_PAIR.includes(rawSymbol);

          let pnl = 0;

          if (isCrypto){
            pnl = order.type === 'SELL'? (entryPrice-currentPrice) * order.lot_size : (currentPrice - entryPrice) * order.lot_size
          }else if (order.symbol === 'XAU/USD' || order.symbol === 'XPD/USD' || order.symbol === 'XPT/USD'){
            pnl = order.type === 'SELL' ? (entryPrice - currentPrice) * order.lot_size * CONTRACT_SIZE_XAUUSD : (currentPrice - entryPrice) * order.lot_size * CONTRACT_SIZE_XAUUSD
          }
          else if(order.symbol === 'XAG/USD'){
            pnl = order.type === 'SELL' ? (entryPrice - currentPrice) * order.lot_size * CONTRACT_SIZE_SILVER : (currentPrice - entryPrice) * order.lot_size * CONTRACT_SIZE_SILVER
          }
          else if (order.symbol === 'XCU/USD'){
            pnl = order.type === 'SELL' ? (entryPrice - currentPrice) * order.lot_size * CONTRACT_SIZE_COPPER : (currentPrice - entryPrice) * order.lot_size * CONTRACT_SIZE_COPPER
          }
          else if (order.symbol === 'DXY' || order.symbol ==='US/OIL'|| order.symbol ==='UK/OIL'){
            pnl = order.type === 'SELL' ?  (entryPrice - currentPrice) * order.lot_size * CONTRACT_SIZE_DXY : (currentPrice - entryPrice) * order.lot_size * CONTRACT_SIZE_DXY
          }else{
            pnl = order.type === 'SELL' ? (entryPrice - currentPrice) * order.lot_size * CONTRACT_SIZE : (currentPrice - entryPrice) * order.lot_size * CONTRACT_SIZE

            const [,quote] = order.symbol.split('/');
            const conversionRate = getUsdConversionRate(quote) || 1 ;

            pnl = pnl/conversionRate;
          }
          totalFloatingPnl += pnl;
      }

      const equity = walletBalance + totalFloatingPnl;

      if (equity <= 2){
        console.log(`User ${user_id} equity ${equity} <=2. Auto square off triggered in demo`)
        await demoAutoSquareOffUser(user_id)
      }
   
    }

  } catch (error) {
    console.error(`Error in demoCheckAutoSquareoff`, error)
  }
} 

// const demoCheckAndAutoSquareOff = async (symbol) => {
//   try {
//     // Step 1: Get all users with active trades in this symbol
//     const [activeUsers] = await queryDatabase(
//       `SELECT DISTINCT user_id FROM ${TABLES.DEMO_USERS_ORDERS} WHERE order_status = 'active' AND symbol = ?`,
//       [symbol]
//     );

//     for (const { user_id } of activeUsers) {
//       // Step 2: Fetch wallet info
//       const [walletRows] = await queryDatabase(
//         `SELECT wallet, used_margin, after_used_margin FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ?`,
//         [user_id]
//       );
//       if (!walletRows || walletRows.length === 0) continue;

//       const { wallet } = walletRows[0];
//       const walletBalance = parseFloat(wallet || 0);

//       // Step 3: Get user’s active orders
//       const [activeOrders] = await queryDatabase(
//         `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
//         [user_id]
//       );
//       if (!activeOrders.length) continue;

//       // Step 4: Compute total unrealized PnL
//       let totalLoss = 0;
//       for (const order of activeOrders) {
//         const priceObj = forgePriceStore.get(order.symbol);
//         if (!priceObj) continue;

//         const currentPrice = parseFloat(priceObj.p || priceObj.price);

//         let conversionRateUsed = 1;
//         try {
//           const [base, quote] = order.symbol.split('/').map(s => s.trim().toUpperCase());
        
//           let currentPricePair = parseFloat(priceObj.p || priceObj.price);

//           if (quote !== 'USD') {
//             const conversionPair = `USD/${quote}`;
//             const conversionObj = forgePriceStore.get(conversionPair);
        
//             if (conversionObj && conversionObj.p) {
//                 const conversionRate = parseFloat(conversionObj.p);
//                 conversionRateUsed = conversionRate
//                 currentPricePair = currentPricePair / conversionRate;
//                 // console.log(`Found conversion pair ${conversionPair} → Rate: ${conversionRate}`);
        
//                 if (!isNaN(currentPricePair) && !isNaN(conversionRate) && conversionRate > 0) {
//                   currentPricePair = currentPricePair / conversionRate;
//                 } else {
//                   console.warn(`Invalid currentPrice (${currentPricePair}) or conversionRate (${conversionRate}), skipping conversion.`);
//                 }
//               } else {
//                 console.warn(`Conversion pair ${conversionPair} not found in forgePriceStore, skipping conversion in demo sq.`);
//               }
//             } else {
//               // console.log(`${order.symbol} is already USD-based. No conversion needed in square off.`);
//             }
//           } catch (err) {
//             console.error(`Error while converting ${order.symbol} to USD-based price:`, err);
//           }

//         const contractSize = (order.symbol.toUpperCase() === 'XAU/USD') ? CONTRACT_SIZE_XAUUSD : CONTRACT_SIZE;
//         const units = order.lot_size * contractSize;

//         let pnl = 0;
//         if (order.type === 'BUY') {
//           pnl = (currentPrice - order.entry_price) * units;
//         } else {
//           pnl = (order.entry_price - currentPrice) * units;
//         }

//         pnl = pnl / conversionRateUsed;

//         if (pnl < 0) totalLoss += Math.abs(pnl);
//       }

//       const effectiveBalance = Math.max(0, walletBalance - totalLoss);

//       if (effectiveBalance <= 2.00) {
//         console.log(
//           `⚠️ User ${user_id} effective balance (${effectiveBalance}) dropped to or below 2. Auto square-off triggered in demo account.`
//         );
//         await demoAutoSquareOffUser(user_id);
//         continue;
//       }

//       if (walletBalance <= 0) {
//         console.log(`⚠️ User ${user_id} wallet is 0. Square-off triggered.`);
//         await demoAutoSquareOffUser(user_id);
//       }
//     }
//   } catch (err) {
//     console.error("Error in demoCheckAndAutoSquareOff:", err);
//   }
// };

// 1 Forge function 

// function init1ForgeSocketConn(serverIO, apiKey) {
//   io = serverIO;
//   forexClient = new ForexClient(apiKey);

//   forexClient.onConnect(() => {
//     console.log('✅ Connected to 1Forge WebSocket');
//     // Subscribe to pairs want to track
//     forexClient.subscribeTo([
//       'XAU/USD',
//       'AUD/USD',
//       'AUD/JPY',
//       'AUD/CAD',
//       'AUD/NZD',
//       'AUD/CHF',
//       'CAD/CHF',
//       'CAD/JPY',
//       'CHF/JPY',
//       'EUR/USD',
//       'EUR/JPY',
//       'EUR/GBP',
//       'EUR/AUD',
//       'EUR/NZD',
//       'EUR/CAD',
//       'EUR/CHF',
//       'GBP/USD',
//       'GBP/JPY',
//       'GBP/AUD',
//       'GBP/CAD',
//       'GBP/CHF',
//       'GBP/NZD',
//       'NZD/USD',
//       'NZD/CAD',
//       'NZD/CHF',
//       'NZD/JPY',
//       'USD/JPY',
//       'USD/CHF',
//       'USD/CAD',
//       'USD/NZD',
//       'USD/GBP',
//       'USD/AUD',
//     ]);
//     // 'ETH/USD', 'BTC/DSH', 'BTC/USD'
//   });

//   forexClient.onUpdate(async (symbol, data) => {
//     // Store price data
//     const priceObj = {
//       s: symbol,
//       p: data.p || data.price,
//       b: data.b || data.bid,
//       a: data.a || data.ask,
//       t: data.t || data.timestamp
//     };
    
//     forgePriceStore.update(priceObj);

//     // Send data to all connected frontend clients
//     io.emit('forex_update', { symbol, ...data });

//     //
//     await checkAndAutoSquareOff(symbol);
//     await demoCheckAndAutoSquareOff(symbol);
//   });

//   forexClient.onDisconnect(() => {
//     console.log('❌ Disconnected from 1Forge WebSocket');
//   });

//   forexClient.connect();
// }


// FCS API 

function init1ForgeSocketConn(serverIO, apiKey) {
  io = serverIO;
  fcsClient = new FCSClient(apiKey);

  // ✅ CONNECT
  fcsClient.connect()
    .then(() => console.log('✅ Connected to FCS WebSocket'))
    .catch(err => {
      console.error('❌ FCS Connection failed:', err.message);
      process.exit(1);
    });

  // ✅ ON CONNECTED
  fcsClient.onconnected = () => {
    console.log('📡 Subscribing to FCS symbols');

    const symbols = [
      'CRYPTO:BTCUSD',
      'CRYPTO:BTCUSDT',
      'CRYPTO:ETHUSD',
      'GMC:XAGUSD',
      'GMC:XPDUSD',
      'GMC:XPTUSD',
      'GMC:DXY',
      'GMC:XNG',
      'GMC:USOIL',
      'GMC:UKOIL',
      'ONA:NATGASUSD',
      'ONA:US30USD',
      'ONA:XCUUSD',
      'ONA:XAUUSD',
      'ONA:AUDUSD',
      'ONA:AUDJPY',
      'ONA:AUDCAD',
      'ONA:AUDNZD',
      'ONA:AUDCHF',
      'ONA:CADCHF',
      'ONA:CADJPY',
      'ONA:CHFJPY',
      'ONA:EURUSD',
      'ONA:EURJPY',
      'ONA:EURGBP',
      'ONA:EURAUD',
      'ONA:EURNZD',
      'ONA:EURCAD',
      'ONA:EURCHF',
      'ONA:GBPUSD',
      'ONA:GBPJPY',
      'ONA:GBPAUD',
      'ONA:GBPCAD',
      'ONA:GBPCHF',
      'ONA:GBPNZD',
      'ONA:NZDUSD',
      'ONA:NZDCAD',
      'ONA:NZDCHF',
      'ONA:NZDJPY',
      'ONA:USDJPY',
      'ONA:USDCHF',
      'ONA:USDCAD',
      'ONA:USDNZD',
      'ONA:USDGBP',
      'ONA:USDAUD'
    ];

    symbols.forEach(symbol => {
      fcsClient.join(symbol, '1'); // 1 minute
    });
  };

  // ✅ PRICE UPDATE
  fcsClient.onmessage = async (data) => {
    if (data.type !== 'price') return;

    const { symbol, prices } = data;

    const priceObj = {
      symbol: normalizeSymbol(symbol, 'SLASH'), // ! Add slash to send to Frontend
      // symbol: symbol.replace('CRYPTO:', '').slice(0, 3) + '/' + symbol.slice(-4),
      p: prices.c,
      b: prices.b || prices.h,
      a: prices.a || prices.l,
      t: Date.now()
    };
    // console.log(priceObj);
    
 
    // Store price

    forgePriceStore.update(priceObj);

    // Emit to frontend
    io.emit('forex_update', priceObj);

    // Auto square-off logic
    // await checkAndAutoSquareOff(priceObj.symbol);
    // await demoCheckAndAutoSquareOff(priceObj.symbol);
    // ✅ WRAP DB CALLS IN TRY-CATCH - Don't let DB errors kill the socket
    try {
        await checkAndAutoSquareOff(priceObj.symbol);
        await demoCheckAndAutoSquareOff(priceObj.symbol);
    } catch (err) {
        console.error('❌ Auto square-off check failed (price still updating):', err.message);
        // DON'T throw - let price updates continue!
    }
  };

  // ❌ DISCONNECT
  fcsClient.onclose = () => {
    console.warn('❌ FCS WebSocket disconnected');
  };

  // ⚠️ ERROR
  fcsClient.onerror = (err) => {
    console.error('❌ FCS Socket Error:', err.message);
  };

  // 🔁 RECONNECT
  fcsClient.onreconnect = () => {
    console.log('🔄 FCS Reconnected');
    
     const symbols = [
      'CRYPTO:BTCUSD',
      'CRYPTO:BTCUSDT',
      'CRYPTO:ETHUSD',
      'GMC:XAGUSD',
      'GMC:XPDUSD',
      'GMC:XPTUSD',
      'GMC:DXY',
      'GMC:XNG',
      'GMC:USOIL',
      'GMC:UKOIL',
      'ONA:NATGASUSD',
      'ONA:US30USD',
      'ONA:XCUUSD',
      'ONA:XAUUSD',
      'ONA:AUDUSD',
      'ONA:AUDJPY',
      'ONA:AUDCAD',
      'ONA:AUDNZD',
      'ONA:AUDCHF',
      'ONA:CADCHF',
      'ONA:CADJPY',
      'ONA:CHFJPY',
      'ONA:EURUSD',
      'ONA:EURJPY',
      'ONA:EURGBP',
      'ONA:EURAUD',
      'ONA:EURNZD',
      'ONA:EURCAD',
      'ONA:EURCHF',
      'ONA:GBPUSD',
      'ONA:GBPJPY',
      'ONA:GBPAUD',
      'ONA:GBPCAD',
      'ONA:GBPCHF',
      'ONA:GBPNZD',
      'ONA:NZDUSD',
      'ONA:NZDCAD',
      'ONA:NZDCHF',
      'ONA:NZDJPY',
      'ONA:USDJPY',
      'ONA:USDCHF',
      'ONA:USDCAD',
      'ONA:USDNZD',
      'ONA:USDGBP',
      'ONA:USDAUD'
    ];
    symbols.forEach(symbol => {
      fcsClient.join(symbol, '1');
    });

  };
}

module.exports = init1ForgeSocketConn;
