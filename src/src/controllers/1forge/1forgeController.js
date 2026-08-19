const forgePriceStore = require('../../models/1forge.price.model');

const getStatus = (req, res) => {
  res.json({ status: 'WebSocket active', time: new Date() });
};

// Get all prices from 1forge store
const getAllPrices = (req, res) => {
  try {
    const prices = forgePriceStore.getAll();
    res.json(prices);
  } catch (err) {
    console.error('Error fetching prices:', err);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
};

// Get price by symbol
const getPriceBySymbol = (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const price = forgePriceStore.get(symbol);
    
    if (!price) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    
    res.json(price);
  } catch (err) {
    console.error('Error fetching price:', err);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
};

// Get history by symbol
const getHistoryBySymbol = (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const limit = Number(req.query.limit) || 500;
    const history = forgePriceStore.getHistory(symbol, limit);
    
    if (!history || history.length === 0) {
      return res.status(404).json({ error: 'No history available' });
    }
    
    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

module.exports = {
  getStatus,
  getAllPrices,
  getPriceBySymbol,
  getHistoryBySymbol
};
