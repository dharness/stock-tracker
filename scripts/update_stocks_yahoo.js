// Script to fetch stock data and save to JSON file using Yahoo Finance API
// This runs in GitHub Actions daily to update stock data

// For v3, the YahooFinance class is exported as the default property
const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"], // Suppress survey notices
});
const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIGURATION SECTION
// ============================================================================

// API Configuration (Yahoo Finance doesn't require an API key)
// Note: Yahoo Finance has no official rate limit, but be respectful
// Using conservative delays to avoid being blocked

// Rate limiting: Not needed - fetching all stocks in parallel with Promise.all

// Output configuration
const OUTPUT_FILE = "stocks.json";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILE);

// ============================================================================
// END CONFIGURATION SECTION
// ============================================================================

// Import portfolios from the single source of truth
const PORTFOLIOS = require("../src/data/portfoliosData.json");

const getAllStocks = () => {
  const allStocksSet = new Set();
  Object.values(PORTFOLIOS).forEach((portfolio) => {
    Object.keys(portfolio).forEach((stock) => allStocksSet.add(stock));
  });
  return Array.from(allStocksSet).sort();
};

const STOCKS = getAllStocks();

// Rate limiting removed - fetching all stocks in parallel with Promise.all
// Yahoo Finance can handle parallel requests efficiently

const fetchStockData = async (symbol, year = 2025) => {
  const fromDate = new Date(`${year}-01-01`);
  const toDate = new Date(`${year}-12-31`);

  // Fetch historical data from Yahoo Finance
  const queryOptions = {
    period1: Math.floor(fromDate.getTime() / 1000), // Unix timestamp in seconds
    period2: Math.floor(toDate.getTime() / 1000), // Unix timestamp in seconds
    interval: "1d", // Daily data
  };

  try {
    const data = await yahooFinance.historical(symbol, queryOptions);

    // Print meaningful parts of the response
    if (data && data.length > 0) {
      const firstDate = new Date(data[0].date).toISOString().split("T")[0];
      const lastDate = new Date(data[data.length - 1].date)
        .toISOString()
        .split("T")[0];
      const firstPrice = data[0].close;
      const lastPrice = data[data.length - 1].close;

      console.log(`  Response for ${symbol}:`);
      console.log(`    - Data points: ${data.length}`);
      console.log(`    - Date range: ${firstDate} to ${lastDate}`);
      console.log(`    - First close: $${firstPrice}`);
      console.log(`    - Last close: $${lastPrice}`);
      if (data.length > 1) {
        console.log(
          `    - Price change: ${(
            ((lastPrice - firstPrice) / firstPrice) *
            100
          ).toFixed(2)}%`
        );
      }
    }

    if (!data || data.length === 0) {
      console.warn(`No data returned for ${symbol} in ${year}`);
      return { symbol, data: [] };
    }

    // Convert Yahoo Finance format to our PriceData format
    const priceData = data.map((item) => {
      const date = new Date(item.date);
      return {
        date: date.toISOString().split("T")[0], // YYYY-MM-DD format
        price: item.close, // Use closing price
      };
    });

    return {
      symbol,
      data: priceData.sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (error) {
    // Check if error is due to rate limiting or invalid symbol
    const errorMessage = error.message || String(error);

    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      const errorMsg = `Rate limited for ${symbol} (429).`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.error(`Error fetching ${symbol}:`, error.message);
    return { symbol, data: [] };
  }
};

const fetchAllStocks = async () => {
  const dataMap = {};
  const currentYear = new Date().getFullYear();

  // Fetch data for current year and previous year
  const years = [currentYear - 1, currentYear];

  for (const year of years) {
    console.log(`\nFetching data for year ${year}...`);
    console.log(`Fetching all ${STOCKS.length} stocks in parallel...`);

    // Fetch all stocks in parallel using Promise.all
    const fetchPromises = STOCKS.map((symbol) => {
      console.log(`  Queuing ${symbol}...`);
      return fetchStockData(symbol, year);
    });

    // Wait for all requests to complete
    const results = await Promise.all(fetchPromises);

    // Process results
    results.forEach((result) => {
      if (result.data && result.data.length > 0) {
        const key = `${result.symbol}_${year}`;
        dataMap[key] = result.data;
        console.log(
          `✓ Fetched ${result.data.length} data points for ${result.symbol} (${year})`
        );
      } else {
        console.warn(`✗ No data for ${result.symbol} (${year})`);
      }
    });
  }

  return dataMap;
};

const main = async () => {
  console.log("Starting stock data update (Yahoo Finance)...");
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
