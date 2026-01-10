// Service to fetch cryptocurrency data from CryptoCompare API
// CryptoCompare provides free historical price data for cryptocurrencies
// Falls back to CoinGecko if CryptoCompare fails

const axios = require("axios");

// ============================================================================
// CONFIGURATION SECTION
// ============================================================================

// API Configuration
const CRYPTOCOMPARE_BASE_URL = "https://min-api.cryptocompare.com/data";
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || null;

// ============================================================================
// END CONFIGURATION SECTION
// ============================================================================

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Maps crypto ticker symbols to CoinGecko IDs
 * CoinGecko uses IDs like "bitcoin", "solana", etc. instead of tickers
 */
const CRYPTO_ID_MAP = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  // Add more mappings as needed
};

/**
 * Fetches all historical crypto data from CryptoCompare for a given ticker
 * Falls back to CoinGecko if CryptoCompare fails
 * @param {string} ticker Crypto ticker symbol (e.g., "BTC", "SOL")
 * @param {number} retries Number of retry attempts (default: 3)
 * @returns {Promise<Array<{date: string, price: number}>>} Array of price data points
 */
const fetchCryptoData = async (ticker, retries = 3) => {
  const tickerUpper = ticker.toUpperCase();

  // Try CryptoCompare first (more permissive free tier)
  try {
    const data = await fetchFromCryptoCompare(tickerUpper, retries);
    if (data && data.length > 0) {
      return data;
    }
  } catch (error) {
    console.warn(`CryptoCompare failed for ${ticker}, trying CoinGecko...`);
  }

  // Fallback to CoinGecko
  try {
    const data = await fetchFromCoinGecko(tickerUpper, retries);
    if (data && data.length > 0) {
      return data;
    }
  } catch (error) {
    console.warn(`CoinGecko also failed for ${ticker}`);
  }

  return [];
};

/**
 * Fetches crypto data from CryptoCompare API
 */
const fetchFromCryptoCompare = async (ticker, retries = 3) => {
  // CryptoCompare uses different symbols - map common ones
  const symbolMap = {
    BTC: "BTC",
    ETH: "ETH",
    SOL: "SOL",
    ADA: "ADA",
    DOT: "DOT",
    MATIC: "MATIC",
    AVAX: "AVAX",
    LINK: "LINK",
    UNI: "UNI",
    ATOM: "ATOM",
  };

  const symbol = symbolMap[ticker] || ticker;

  // Get data for the last 5 years (limit parameter)
  // CryptoCompare returns daily data, limit of 2000 days (~5.5 years)
  const url = `${CRYPTOCOMPARE_BASE_URL}/v2/histoday?fsym=${symbol}&tsym=USD&limit=2000`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
        },
        timeout: 30000,
      });

      const data = response.data;

      if (data.Response === "Error" || !data.Data || !data.Data.Data) {
        throw new Error(data.Message || "No data returned");
      }

      const priceData = data.Data.Data.map((point) => {
        const date = new Date(point.time * 1000);
        return {
          date: date.toISOString().split("T")[0], // YYYY-MM-DD format
          price: parseFloat(point.close), // Close price
        };
      })
        .filter((point) => !isNaN(point.price) && point.price > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      return priceData;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await delay(Math.pow(2, attempt) * 1000);
    }
  }

  return [];
};

/**
 * Fetches crypto data from CoinGecko API (fallback)
 */
const fetchFromCoinGecko = async (ticker, retries = 3) => {
  const coinId = CRYPTO_ID_MAP[ticker];

  if (!coinId) {
    throw new Error(`No CoinGecko ID mapping found for ${ticker}`);
  }

  // Get data for the last 5 years
  const toDate = Math.floor(Date.now() / 1000);
  const fromDate = toDate - 5 * 365 * 24 * 60 * 60;

  let url = `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${fromDate}&to=${toDate}`;
  if (COINGECKO_API_KEY) {
    url += `&x_cg_demo_api_key=${COINGECKO_API_KEY}`;
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const headers = {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; StockTracker/1.0)",
      };

      if (COINGECKO_API_KEY) {
        headers["x-cg-demo-api-key"] = COINGECKO_API_KEY;
      }

      const response = await axios.get(url, {
        headers,
        timeout: 30000,
      });

      const data = response.data;

      if (!data.prices || data.prices.length === 0) {
        throw new Error("No price data returned");
      }

      const priceData = data.prices
        .map(([timestamp, price]) => {
          const date = new Date(timestamp);
          return {
            date: date.toISOString().split("T")[0],
            price: parseFloat(price),
          };
        })
        .filter((point) => !isNaN(point.price) && point.price > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      // Deduplicate by date
      const dailyData = {};
      priceData.forEach((point) => {
        dailyData[point.date] = point.price;
      });

      return Object.entries(dailyData)
        .map(([date, price]) => ({ date, price }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      await delay(Math.pow(2, attempt) * 1000);
    }
  }

  return [];
};

module.exports = {
  fetchCryptoData,
  CRYPTO_ID_MAP,
};
