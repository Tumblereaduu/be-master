function normalizeSymbol(symbol, format = 'SLASH') {
  if (!symbol) return null;

  let s = symbol.toUpperCase().replace('ONA:', '').replace('BINANCE:', '').replace('CRYPTO:', '').replace('GMC:', '');

  // BTC special
  if (s === 'US30USD') {
    return format === 'SLASH' ? 'US30/USD' : 'US30USD';
  } ;
  if (s === 'USOIL'){
    return format === 'SLASH' ? 'US/OIL' : 'USOIL';
  };
  if (s === 'UKOIL'){
    return format === 'SLASH' ? 'UK/OIL' : 'UKOIL';
  };
  // If already has slash
  if (s.includes('/')) {
    if (format === 'NOSLASH') return s.replace('/', '');
    return s;
  }

  // Convert XAUUSD → XAU/USD
  if (s.length === 6) {
    const withSlash = s.slice(0, 3) + '/' + s.slice(3);
    return format === 'NOSLASH' ? s : withSlash;
  }

  return s;
}

module.exports = { normalizeSymbol };
