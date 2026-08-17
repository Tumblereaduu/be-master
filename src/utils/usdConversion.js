const forgePriceStore = require('../models/1forge.price.model');

function getUsdConversionRate(quoteCurrency) {
  if (!quoteCurrency || quoteCurrency === 'USD') return 1;

  // Try USD/QUOTE (1Forge style)
  const directPair = `USD/${quoteCurrency}`;
  const direct = forgePriceStore.get(directPair);
  if (direct && direct.p) {
    return parseFloat(direct.p);
  }

  // Try QUOTE/USD (FCS style) → INVERT
  const inversePair = `${quoteCurrency}/USD`;
  const inverse = forgePriceStore.get(inversePair);
  if (inverse && inverse.p) {
    return 1 / parseFloat(inverse.p);
  }

  console.warn(`⚠️ USD conversion not found for ${quoteCurrency}, using 1`);
  return 1;
}


module.exports = { getUsdConversionRate };
