// Script to fetch stock data and save to JSON file
// This runs in GitHub Actions daily to update stock data

const fs = require("fs");
const path = require("path");

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
const MASSIVE_API_KEY = "d3WXhBdil6HaNoavpTZyzQXs8qz5a0Iv";

const BASE_URL = "https://api.massive.com/v2/aggs/ticker";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchStockData = async (symbol, year = 2025, retries = 3) => {
  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;
  const url = `${BASE_URL}/${symbol}/range/1/day/${fromDate}/${toDate}?apiKey=${MASSIVE_API_KEY}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000;
        console.log(`Rate limited for ${symbol}. Waiting ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch ${symbol}: ${response.status}`);
      }

      const data = await response.json();

      if (
        (data.status !== "OK" && data.status !== "DELAYED") ||
        !data.results
      ) {
        throw new Error(`API error for ${symbol}: ${data.status}`);
      }

      const priceData = data.results.map((result) => {
        const date = new Date(result.t);
        return {
          date: date.toISOString().split("T")[0],
          price: result.c,
        };
      });

      return priceData.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      if (attempt === retries - 1) {
        console.error(
          `Error fetching ${symbol} after ${retries} attempts:`,
          error
        );
        throw error;
      }
      await delay(Math.pow(2, attempt) * 1000);
    }
  }
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
        console.log(`Fetching ${symbol} (${i + 1}/${STOCKS.length})...`);
        const data = await fetchStockData(symbol, year);
        if (data.length > 0) {
          const key = `${symbol}_${year}`;
          dataMap[key] = data;
          console.log(
            `✓ Fetched ${data.length} data points for ${symbol} (${year})`
          );
        }
      } catch (error) {
        console.error(
          `✗ Failed to fetch ${symbol} for ${year}:`,
          error.message
        );
      }

      // Delay between requests (12 seconds = 5 requests per minute)
      if (i < STOCKS.length - 1) {
        await delay(12000);
      }
    }
  }

  return dataMap;
};

const main = async () => {
  console.log("Starting stock data update...");
  console.log(`Fetching ${STOCKS.length} stocks: ${STOCKS.join(", ")}`);

  try {
    const stockData = await fetchAllStocks();

    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, "public", "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save to JSON file
    const outputPath = path.join(dataDir, "stocks.json");
    const output = {
      lastUpdated: new Date().toISOString(),
      stocks: stockData,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✓ Successfully saved stock data to ${outputPath}`);
    console.log(`  Total symbols: ${Object.keys(stockData).length}`);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
};

main();
