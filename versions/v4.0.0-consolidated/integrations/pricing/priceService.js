// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/Assets-in-control-
// Original path  : Assets-in-control-/server/priceService.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

const axios = require('axios');

/**
 * Price Tracking Service
 * Fetches real-time cryptocurrency prices from CoinGecko API
 */

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 60000; // 60 seconds cache
const priceCache = new Map();

// Map common cryptocurrency symbols to CoinGecko IDs
const CRYPTO_ID_MAP = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'BNB': 'binancecoin',
  'MATIC': 'matic-network',
  'SOL': 'solana',
  'ADA': 'cardano',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'DAI': 'dai',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'COMP': 'compound-governance-token',
  'MKR': 'maker',
  'SNX': 'synthetix-network-token'
};

/**
 * Get CoinGecko ID from cryptocurrency symbol
 */
function getCoinGeckoId(symbol) {
  const upperSymbol = symbol.toUpperCase();
  return CRYPTO_ID_MAP[upperSymbol] || symbol.toLowerCase();
}

/**
 * Get current price for a cryptocurrency
 * @param {string} symbol - Cryptocurrency symbol (e.g., 'ETH', 'BTC')
 * @param {string} currency - Fiat currency (default: 'usd')
 * @returns {Promise<Object>} Price data
 */
async function getCurrentPrice(symbol, currency = 'usd') {
  const cacheKey = `${symbol}-${currency}`;
  const cached = priceCache.get(cacheKey);

  // Return cached data if valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const coinId = getCoinGeckoId(symbol);
    const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
      params: {
        ids: coinId,
        vs_currencies: currency,
        include_24hr_change: true,
        include_market_cap: true,
        include_24hr_vol: true
      }
    });

    const data = response.data[coinId];
    
    if (!data) {
      throw new Error(`Price data not found for ${symbol}`);
    }

    const priceData = {
      symbol: symbol.toUpperCase(),
      price: data[currency],
      change24h: data[`${currency}_24h_change`] || 0,
      marketCap: data[`${currency}_market_cap`] || 0,
      volume24h: data[`${currency}_24h_vol`] || 0,
      currency: currency.toUpperCase(),
      timestamp: Date.now()
    };

    // Cache the result
    priceCache.set(cacheKey, {
      data: priceData,
      timestamp: Date.now()
    });

    return priceData;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error.message);
    
    // Return cached data if available, even if expired
    if (cached) {
      console.log(`Returning stale cache for ${symbol}`);
      return cached.data;
    }
    
    throw error;
  }
}

/**
 * Get prices for multiple cryptocurrencies
 * @param {Array<string>} symbols - Array of cryptocurrency symbols
 * @param {string} currency - Fiat currency (default: 'usd')
 * @returns {Promise<Object>} Object with symbol as key and price data as value
 */
async function getMultiplePrices(symbols, currency = 'usd') {
  try {
    const coinIds = symbols.map(getCoinGeckoId);
    const response = await axios.get(`${COINGECKO_API_URL}/simple/price`, {
      params: {
        ids: coinIds.join(','),
        vs_currencies: currency,
        include_24hr_change: true,
        include_market_cap: true,
        include_24hr_vol: true
      }
    });

    const result = {};
    symbols.forEach((symbol, index) => {
      const coinId = coinIds[index];
      const data = response.data[coinId];
      
      if (data) {
        result[symbol.toUpperCase()] = {
          symbol: symbol.toUpperCase(),
          price: data[currency],
          change24h: data[`${currency}_24h_change`] || 0,
          marketCap: data[`${currency}_market_cap`] || 0,
          volume24h: data[`${currency}_24h_vol`] || 0,
          currency: currency.toUpperCase(),
          timestamp: Date.now()
        };

        // Cache individual prices
        const cacheKey = `${symbol}-${currency}`;
        priceCache.set(cacheKey, {
          data: result[symbol.toUpperCase()],
          timestamp: Date.now()
        });
      }
    });

    return result;
  } catch (error) {
    console.error('Error fetching multiple prices:', error.message);
    throw error;
  }
}

/**
 * Get historical price data
 * @param {string} symbol - Cryptocurrency symbol
 * @param {string} currency - Fiat currency
 * @param {number} days - Number of days of history (1, 7, 14, 30, 90, 180, 365, max)
 * @returns {Promise<Array>} Array of [timestamp, price] pairs
 */
async function getHistoricalPrices(symbol, currency = 'usd', days = 7) {
  try {
    const coinId = getCoinGeckoId(symbol);
    const response = await axios.get(`${COINGECKO_API_URL}/coins/${coinId}/market_chart`, {
      params: {
        vs_currency: currency,
        days: days,
        interval: days === 1 ? 'hourly' : 'daily'
      }
    });

    return response.data.prices.map(([timestamp, price]) => ({
      timestamp,
      date: new Date(timestamp).toISOString(),
      price
    }));
  } catch (error) {
    console.error(`Error fetching historical prices for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get trending cryptocurrencies
 * @returns {Promise<Array>} Array of trending coins
 */
async function getTrendingCoins() {
  try {
    const response = await axios.get(`${COINGECKO_API_URL}/search/trending`);
    return response.data.coins.map(item => ({
      id: item.item.id,
      symbol: item.item.symbol,
      name: item.item.name,
      marketCapRank: item.item.market_cap_rank,
      thumb: item.item.thumb
    }));
  } catch (error) {
    console.error('Error fetching trending coins:', error.message);
    throw error;
  }
}

/**
 * Calculate portfolio value
 * @param {Array} holdings - Array of {symbol, amount} objects
 * @param {string} currency - Fiat currency
 * @returns {Promise<Object>} Portfolio value data
 */
async function calculatePortfolioValue(holdings, currency = 'usd') {
  try {
    const symbols = holdings.map(h => h.symbol);
    const prices = await getMultiplePrices(symbols, currency);
    
    let totalValue = 0;
    const breakdown = holdings.map(holding => {
      const priceData = prices[holding.symbol.toUpperCase()];
      const value = priceData ? priceData.price * holding.amount : 0;
      totalValue += value;
      
      return {
        symbol: holding.symbol.toUpperCase(),
        amount: holding.amount,
        price: priceData ? priceData.price : 0,
        value: value,
        change24h: priceData ? priceData.change24h : 0
      };
    });

    return {
      totalValue,
      currency: currency.toUpperCase(),
      breakdown,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error calculating portfolio value:', error.message);
    throw error;
  }
}

/**
 * Clear price cache
 */
function clearCache() {
  priceCache.clear();
}

module.exports = {
  getCurrentPrice,
  getMultiplePrices,
  getHistoricalPrices,
  getTrendingCoins,
  calculatePortfolioValue,
  clearCache,
  getCoinGeckoId
};
