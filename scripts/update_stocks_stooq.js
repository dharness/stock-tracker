// Script to fetch stock data from Stooq and save to JSON file
// This runs in GitHub Actions daily to update stock data

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { parse } = require("csv-parse/sync");

// ============================================================================
// CONFIGURATION SECTION
// ============================================================================

// API Configuration
const STOOQ_BASE_URL = "https://stooq.com/q/d/l/";

// Rate limiting: 2 second delay between requests
const DELAY_BETWEEN_REQUESTS_MS = 2000; // 2 seconds delay between requests

// Output configuration
const OUTPUT_FILE = "stocks.json";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILE);

// ============================================================================
// END CONFIGURATION SECTION
// ============================================================================

// Get all unique stocks from portfolios
const PORTFOLIOS = {
  Naila: {
    CRDO: 35000,
    NBIS: 25000,
    VKTX: 20000,
    ASTS: 20000,
  },
  Colby: {
    ONDS: 25000,
    TSM: 25000,
    POET: 25000,
    NBIS: 25000,
  },
  Dylan: {
    ALAB: 25000,
    AVGO: 25000,
    APP: 25000,
    RCAT: 25000,
  },
  Faith: {},
};

const getAllStocks = () => {
  const allStocksSet = new Set();
  Object.values(PORTFOLIOS).forEach((portfolio) => {
    Object.keys(portfolio).forEach((stock) => allStocksSet.add(stock));
  });
  return Array.from(allStocksSet).sort();
};

const STOCKS = getAllStocks();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches stock data from Stooq for a given ticker
 * @param ticker Stock ticker symbol (without .US suffix)
 * @param year Year to filter data for
 * @returns Array of price data points
 */
const fetchStockData = async (ticker, year = 2025, retries = 3) => {
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
        console.warn(`No data returned for ${ticker} in ${year}`);
        return [];
      }

      // Filter records for the specified year and convert to our format
      const yearStart = new Date(`${year}-01-01`);
      const yearEnd = new Date(`${year}-12-31`);

      const priceData = records
        .filter((record) => {
          const recordDate = new Date(record.Date);
          return recordDate >= yearStart && recordDate <= yearEnd;
        })
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

const fetchAllStocks = async () => {
  const dataMap = {};
  const currentYear = new Date().getFullYear();

  // Fetch data for current year and previous year
  const years = [currentYear - 1, currentYear];

  for (const year of years) {
    console.log(`\nFetching data for year ${year}...`);

    for (let i = 0; i < STOCKS.length; i++) {
      const symbol = STOCKS[i];
      try {
        console.log(
          `Fetching ${symbol} (${i + 1}/${STOCKS.length}) for ${year}...`
        );

        const data = await fetchStockData(symbol, year);

        if (data.length > 0) {
          const key = `${symbol}_${year}`;
          dataMap[key] = data;
          console.log(
            `✓ Fetched ${data.length} data points for ${symbol} (${year})`
          );
        } else {
          console.warn(`⚠ No data found for ${symbol} in ${year}`);
        }

        // 2 second delay between requests
        if (i < STOCKS.length - 1) {
          await delay(DELAY_BETWEEN_REQUESTS_MS);
        }
      } catch (error) {
        console.error(
          `✗ Failed to fetch ${symbol} for ${year}:`,
          error.message
        );
        // Continue with next stock even if one fails
        // Still add delay before next request
        if (i < STOCKS.length - 1) {
          await delay(DELAY_BETWEEN_REQUESTS_MS);
        }
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

    // Create data directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save to JSON file
    const output = {
      lastUpdated: new Date().toISOString(),
      stocks: stockData,
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    console.log(`\n✓ Successfully saved stock data to ${OUTPUT_PATH}`);
    console.log(`  Total symbols: ${Object.keys(stockData).length}`);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
};

main();
