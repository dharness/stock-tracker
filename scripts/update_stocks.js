// Script to fetch stock data from Stooq and save to JSON file
// This runs in GitHub Actions daily to update stock data

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { parse } = require("csv-parse/sync");
const { fetchStockDataFromMassive } = require("./massiveStockFetcher");
const { fetchCryptoData } = require("./cryptoFetcher");

// ============================================================================
// CONFIGURATION SECTION
// ============================================================================

// API Configuration
const STOOQ_BASE_URL = "https://stooq.com/q/d/l/";
const DELAY_BETWEEN_REQUESTS_MS = 5000;

// Output configuration
const OUTPUT_FILE = "stocks.json";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILE);

// ============================================================================
// END CONFIGURATION SECTION
// ============================================================================

// Import portfolios from the single source of truth
const portfoliosData = require("../src/data/portfoliosData.json");
const {
  getFlattenedPortfolios,
  getAllStocks,
} = require("../src/shared/portfoliosHelper");

// Get all unique stocks from ALL portfolio groups (not just default)
// This ensures we fetch data for stocks in any group
const getAllStocksFromAllGroups = () => {
  if (portfoliosData.portfolios && portfoliosData.portfolioGroups) {
    // Get all portfolio groups
    const allGroupNames = Object.keys(portfoliosData.portfolioGroups);

    // Collect all unique portfolio names from all groups
    const allPortfolioNames = new Set();
    allGroupNames.forEach((groupName) => {
      const group = portfoliosData.portfolioGroups[groupName];
      if (Array.isArray(group)) {
        group.forEach((portfolioName) => allPortfolioNames.add(portfolioName));
      }
    });

    // Build flattened object from all portfolios across all groups
    const allPortfolios = {};
    allPortfolioNames.forEach((portfolioName) => {
      if (portfoliosData.portfolios[portfolioName]) {
        allPortfolios[portfolioName] = portfoliosData.portfolios[portfolioName];
      }
    });

    // Extract all stocks and deduplicate (getAllStocks already uses Set internally)
    const stocks = getAllStocks(allPortfolios);

    // Explicit deduplication: convert to Set and back to array to ensure uniqueness
    // This handles any edge cases where the same ticker might appear multiple times
    const uniqueStocks = Array.from(new Set(stocks)).sort();

    return uniqueStocks;
  }

  // Fallback: if no groups structure, use all portfolios directly
  const stocks = getAllStocks(portfoliosData.portfolios || portfoliosData);
  // Explicit deduplication
  return Array.from(new Set(stocks)).sort();
};

const STOCKS = getAllStocksFromAllGroups();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches all historical stock data from Stooq for a given ticker
 * @param ticker Stock ticker symbol (without .US suffix)
 * @returns Array of price data points (all available historical data)
 */
const fetchStockData = async (ticker, retries = 3) => {
  // Stooq uses .US suffix for American exchanges
  const url = `${STOOQ_BASE_URL}?s=${ticker}.US&i=d`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url);

      // Stooq returns a raw CSV string
      const records = parse(response.data, {
        columns: true,
        skip_empty_lines: true,
      });

      if (!records || records.length === 0) {
        console.warn(`No data returned for ${ticker}`);
        return [];
      }

      // Convert all records to our format (no year filtering)
      const priceData = records
        .map((record) => {
          // Stooq CSV format: Date,Open,High,Low,Close,Volume
          // We use Close price
          const date = new Date(record.Date);
          return {
            date: date.toISOString().split("T")[0], // YYYY-MM-DD format
            price: parseFloat(record.Close),
          };
        })
        .filter((point) => !isNaN(point.price)) // Filter out invalid prices
        .sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

      return priceData;
    } catch (error) {
      const errorMessage = error.message || String(error);
      console.error(
        `Error fetching ${ticker} after ${attempt + 1} attempts:`,
        errorMessage
      );

      if (attempt === retries - 1) {
        throw error;
      }

      // Exponential backoff
      await delay(Math.pow(2, attempt) * 1000);
    }
  }

  return [];
};

/**
 * Checks if a symbol is a crypto ticker (starts with CRYPTO:)
 * @param {string} symbol The symbol to check
 * @returns {boolean} True if it's a crypto ticker
 */
const isCrypto = (symbol) => {
  return symbol.startsWith("CRYPTO:");
};

/**
 * Extracts the crypto ticker from CRYPTO: prefix
 * @param {string} symbol The symbol (e.g., "CRYPTO:SOL")
 * @returns {string} The ticker without prefix (e.g., "SOL")
 */
const extractCryptoTicker = (symbol) => {
  return symbol.replace("CRYPTO:", "");
};

const fetchAllStocks = async () => {
  const dataMap = {};

  console.log(`\nFetching all historical data for ${STOCKS.length} assets...`);

  for (let i = 0; i < STOCKS.length; i++) {
    const symbol = STOCKS[i];
    try {
      console.log(`Fetching ${symbol} (${i + 1}/${STOCKS.length})...`);

      let data = [];

      // Check if this is a crypto ticker
      if (isCrypto(symbol)) {
        const cryptoTicker = extractCryptoTicker(symbol);
        console.log(`  Detected crypto: ${cryptoTicker}`);
        try {
          data = await fetchCryptoData(cryptoTicker);
          if (data.length > 0) {
            console.log(`  ✓ Got crypto data from CoinGecko`);
          }
        } catch (cryptoError) {
          console.warn(`  Crypto fetch failed: ${cryptoError.message}`);
        }
      } else {
        // Regular stock - try Stooq first
        data = await fetchStockData(symbol);

        // If Stooq didn't return data, try Massive API as fallback
        if (data.length === 0) {
          console.log(`  No data from Stooq, trying Massive API...`);
          try {
            data = await fetchStockDataFromMassive(symbol);
            if (data.length > 0) {
              console.log(`  ✓ Got data from Massive API fallback`);
            }
          } catch (massiveError) {
            console.warn(`  Massive API also failed: ${massiveError.message}`);
          }
        }
      }

      if (data.length > 0) {
        // Store all data under symbol key (not year-specific)
        // Keep the CRYPTO: prefix in the key for identification
        dataMap[symbol] = data;
        const dateRange =
          data.length > 0
            ? `${data[0].date} to ${data[data.length - 1].date}`
            : "N/A";
        console.log(
          `✓ Fetched ${data.length} data points for ${symbol} (${dateRange})`
        );
      } else {
        console.warn(`⚠ No data found for ${symbol} from any source`);
      }

      // 2 second delay between requests
      if (i < STOCKS.length - 1) {
        await delay(DELAY_BETWEEN_REQUESTS_MS);
      }
    } catch (error) {
      console.error(`✗ Failed to fetch ${symbol}:`, error.message);
      // Continue with next stock even if one fails
      // Still add delay before next request
      if (i < STOCKS.length - 1) {
        await delay(DELAY_BETWEEN_REQUESTS_MS);
      }
    }
  }

  return dataMap;
};

const main = async () => {
  console.log("Starting stock data update using Stooq...");
  console.log(`Fetching ${STOCKS.length} stocks: ${STOCKS.join(", ")}`);

  try {
    const stockData = await fetchAllStocks();

    // Filter to only include stocks that are in the portfolios
    const validStocks = new Set(STOCKS);
    const filteredStockData = {};
    Object.keys(stockData).forEach((symbol) => {
      if (validStocks.has(symbol)) {
        filteredStockData[symbol] = stockData[symbol];
      } else {
        console.warn(`⚠ Filtered out ${symbol} (not in portfolios)`);
      }
    });

    // Create data directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save to JSON file - only stocks from portfolios
    const output = {
      lastUpdated: new Date().toISOString(),
      stocks: filteredStockData,
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log(`\n✓ Successfully saved stock data to ${OUTPUT_PATH}`);
    console.log(`  Total symbols: ${Object.keys(filteredStockData).length}`);
    console.log(`  Expected symbols: ${STOCKS.length}`);

    // Warn if any expected stocks are missing
    const missingStocks = STOCKS.filter((symbol) => !filteredStockData[symbol]);
    if (missingStocks.length > 0) {
      console.warn(`  ⚠ Missing stocks: ${missingStocks.join(", ")}`);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
};

main();
