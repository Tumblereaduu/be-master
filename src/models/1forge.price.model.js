class ForgePriceStore {
    constructor() {
      this.data = {}; // { symbol: latestPriceObject }
      this.history = {}; // { symbol: [ { time, bid, ask, price } ] }
      this.maxHistoryLength = 2000;
    }
  
    update(priceObj) {
      const symbol = priceObj.s || priceObj.symbol;
      if (!symbol) return;

      // Cache latest raw object
      this.data[symbol] = priceObj;

      // Normalize bar format for history
      const bar = {
        time: Number(priceObj.t || priceObj.timestamp),
        bid: Number(priceObj.b),
        ask: Number(priceObj.a),
        price: Number(priceObj.p || priceObj.price)
      };

      if (!this.history[symbol]) {
        this.history[symbol] = [];
      }

      const bars = this.history[symbol];
      const last = bars.length > 0 ? bars[bars.length - 1] : null;
      if (last && last.time === bar.time) {
        // replace/update the current interval bar
        bars[bars.length - 1] = bar;
      } else {
        bars.push(bar);
        if (bars.length > this.maxHistoryLength) {
          bars.splice(0, bars.length - this.maxHistoryLength);
        }
      }
    }
  
    getAll() {
      return Object.values(this.data);
    }
  
    get(symbol) {
      // Try exact match first
      let price = this.data[symbol];
      if (price) return price;

      // Try various formats
      const normalizedSymbol = symbol.replace('/', '_').replace('_', '/');
      price = this.data[normalizedSymbol];
      if (price) return price;

      // Try uppercase
      const upperSymbol = symbol.toUpperCase();
      price = this.data[upperSymbol];
      if (price) return price;

      return null;
    }

    getHistory(symbol, limit = 500) {
      const list = this.history[symbol] || [];
      const n = Math.max(0, Math.min(Number(limit) || 0, list.length));
      if (n === 0) return list.slice();
      return list.slice(-n);
    }
  }
  
  module.exports = new ForgePriceStore();

