// Script to fetch stock data and save to JSON file
// This runs in GitHub Actions daily to update stock data

const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION SECTION
// ============================================================================

// API Configuration
const MASSIVE_API_KEY = "d3WXhBdil6HaNoavpTZyzQXs8qz5a0Iv";
const BASE_URL =
  "https://api.massive.com/v2/aggs/grouped/locale/us/market/stocks";

// Rate limiting: Not needed with grouped endpoint - one request per trading day
// Using a small delay between requests to be respectful
const DELAY_BETWEEN_REQUESTS_MS = 1000; // 1 second delay between daily requests

// Output configuration
const OUTPUT_FILE = "stocks.json";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILE);

// ============================================================================
// END CONFIGURATION SECTION
// ============================================================================

// Helper to get all trading days in a year (weekdays only, excluding holidays)
const getTradingDays = (year) => {
  const tradingDays = [];
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      tradingDays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return tradingDays;
};

// Import portfolios from the single source of truth
const PORTFOLIOS = require("../src/data/portfoliosData.json");

const getAllStocks = () => {
  const allStocksSet = new Set();
  Object.values(PORTFOLIOS).forEach((portfolio) => {
    Object.keys(portfolio).forEach((stock) => {
      // Skip special "cash_amount" key - it's not a stock ticker
      if (stock !== "cash_amount") {
        allStocksSet.add(stock);
      }
    });
  });
  return Array.from(allStocksSet).sort();
};

const STOCKS = getAllStocks();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches daily market data for a specific date using the grouped endpoint
 * Returns data for all stocks, we'll filter for the ones we need
 * @param date Date object for the trading day
 * @returns Array of stock data with symbol and price info
 */
const fetchDailyMarketData = async (date, retries = 3) => {
  // Format date as YYYY-MM-DD
  const dateStr = date.toISOString().split("T")[0];
  const url = `${BASE_URL}/${dateStr}?apiKey=${MASSIVE_API_KEY}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);

      // If we get rate limited, raise an exception
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const errorMsg = `Rate limited for ${dateStr} (429).${
          retryAfter ? ` Retry-After: ${retryAfter}s` : ""
        }`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch market data for ${dateStr}: ${response.status}`
        );
      }

      const data = await response.json();

      if (
        (data.status !== "OK" && data.status !== "DELAYED") ||
        !data.results
      ) {
        throw new Error(`API error for ${dateStr}: ${data.status}`);
      }

      // Return the results array with all stocks
      return data.results || [];
    } catch (error) {
      if (attempt === retries - 1) {
        console.error(
          `Error fetching market data for ${dateStr} after ${retries} attempts:`,
          error
        );
        throw error;
      }
      await delay(Math.pow(2, attempt) * 1000);
    }
  }

  return [];
};

const fetchAllStocks = async () => {
  const dataMap = {};
  const currentYear = new Date().getFullYear();

  // Fetch data for current year and previous year
  const years = [currentYear - 1, currentYear];

  // Create a Set for fast lookup of stocks we care about
  const stocksSet = new Set(STOCKS);

  for (const year of years) {
    console.log(`\nFetching data for year ${year}...`);

    // Get all trading days for this year
    const tradingDays = getTradingDays(year);
    console.log(`  Found ${tradingDays.length} trading days in ${year}`);

    // Initialize data structures for each stock
    const stockDataMap = {};
    STOCKS.forEach((symbol) => {
      stockDataMap[symbol] = [];
    });

    // Fetch data for each trading day
    for (let i = 0; i < tradingDays.length; i++) {
      const date = tradingDays[i];
      const dateStr = date.toISOString().split("T")[0];

      try {
        console.log(
          `  Fetching market data for ${dateStr} (${i + 1}/${
            tradingDays.length
          })...`
        );

        const marketData = await fetchDailyMarketData(date);

        // Filter for stocks we care about and extract their prices
        marketData.forEach((stock) => {
          const symbol = stock.T; // T is the ticker symbol
          if (stocksSet.has(symbol)) {
            if (!stockDataMap[symbol]) {
              stockDataMap[symbol] = [];
            }
            stockDataMap[symbol].push({
              date: dateStr,
              price: stock.c, // c is the close price
            });
          }
        });

        // Small delay between requests to be respectful
        if (i < tradingDays.length - 1) {
          await delay(DELAY_BETWEEN_REQUESTS_MS);
        }
      } catch (error) {
        console.error(
          `  ✗ Failed to fetch data for ${dateStr}:`,
          error.message
        );
        // Continue with next day even if one fails
      }
    }

    // Sort and store data for each stock
    STOCKS.forEach((symbol) => {
      const data = stockDataMap[symbol];
      if (data && data.length > 0) {
        // Sort by date
        data.sort((a, b) => a.date.localeCompare(b.date));
        const key = `${symbol}_${year}`;
        dataMap[key] = data;
        console.log(
          `  ✓ Collected ${data.length} data points for ${symbol} (${year})`
        );
      } else {
        console.warn(`  ⚠ No data found for ${symbol} in ${year}`);
      }
    });
  }

  return dataMap;
};

const main = async () => {
  console.log("Starting stock data update...");
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
