// Script to test if specific stocks can be fetched from Massive API
// Tests stocks that might not be available on US exchanges

const axios = require("axios");

// ============================================================================
// CONFIGURATION SECTION
// ============================================================================

const MASSIVE_API_KEY = "d3WXhBdil6HaNoavpTZyzQXs8qz5a0Iv";
const MASSIVE_BASE_URL = "https://api.massive.com/v2";

// Stocks to test
const TEST_STOCKS = ["KRW", "TCEHY"];

// Also test alternative symbol formats
const ALTERNATIVE_SYMBOLS = {
  KRW: ["KRW", "KRW.US", "KRWUSD"], // Try different formats
};

// ============================================================================
// END CONFIGURATION SECTION
// ============================================================================

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Test fetching stock data from Massive API
 * @param {string} symbol Stock ticker symbol
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
const testStockData = async (symbol, dateRangeYears = 2) => {
  try {
    // Get data for a longer range (default 2 years to catch more data)
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - dateRangeYears);

    const url = `${MASSIVE_BASE_URL}/aggs/ticker/${symbol}/range/1/day/${fromDate.toISOString().split('T')[0]}/${toDate.toISOString().split('T')[0]}?apiKey=${MASSIVE_API_KEY}&adjusted=true&sort=asc&limit=50000`;
    
    console.log(`\nTesting ${symbol}...`);
    console.log(`  URL: ${url.replace(MASSIVE_API_KEY, '***')}`);

    const response = await axios.get(url);

    const data = response.data;

    if (data.status === "OK" || data.status === "DELAYED") {
      const results = data.results || [];
      console.log(`  ✓ Success!`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Results count: ${results.length}`);
      if (results.length > 0) {
        const firstDate = new Date(results[0].t);
        const lastDate = new Date(results[results.length - 1].t);
        console.log(`  Date range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
        console.log(`  First close: $${results[0].c}`);
        console.log(`  Last close: $${results[results.length - 1].c}`);
      }
      return { success: true, data };
    } else {
      console.log(`  ✗ Failed: Status is "${data.status}"`);
      return { success: false, error: `Status: ${data.status}` };
    }
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || String(error);
    const statusCode = error.response?.status;
    console.log(`  ✗ Error: ${errorMessage}`);
    if (statusCode) {
      console.log(`  Status code: ${statusCode}`);
    }
    return { success: false, error: errorMessage };
  }
};

const main = async () => {
  console.log("Testing stocks with Massive API...");
  console.log(`Testing: ${TEST_STOCKS.join(", ")}`);

  const results = {};

  for (let i = 0; i < TEST_STOCKS.length; i++) {
    const symbol = TEST_STOCKS[i];
    
    // Test with longer date range if first attempt returns 0 results
    let result = await testStockData(symbol, 2);
    
    // If KRW returned 0 results, try alternative symbols
    if (symbol === "KRW" && result.success && result.data?.results?.length === 0) {
      console.log(`\n  Trying alternative symbol formats for ${symbol}...`);
      const alternatives = ALTERNATIVE_SYMBOLS[symbol] || [];
      for (const altSymbol of alternatives) {
        if (altSymbol === symbol) continue; // Skip the one we already tried
        console.log(`  Trying ${altSymbol}...`);
        const altResult = await testStockData(altSymbol, 2);
        if (altResult.success && altResult.data?.results?.length > 0) {
          console.log(`  ✓ Found data with symbol: ${altSymbol}`);
          result = { ...altResult, alternativeSymbol: altSymbol };
          break;
        }
        await delay(1000);
      }
    }
    
    results[symbol] = result;

    // Delay between requests to respect rate limits
    if (i < TEST_STOCKS.length - 1) {
      await delay(2000); // 2 second delay
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  Object.entries(results).forEach(([symbol, result]) => {
    console.log(`\n${symbol}:`);
    if (result.success) {
      const dataPoints = result.data.results?.length || 0;
      if (dataPoints > 0) {
        console.log(`  ✓ Available on Massive API`);
        console.log(`  Data points: ${dataPoints}`);
        if (result.alternativeSymbol) {
          console.log(`  Note: Used alternative symbol: ${result.alternativeSymbol}`);
        }
      } else {
        console.log(`  ⚠ API accepts request but returns 0 results`);
        console.log(`  This may indicate the symbol is not available or needs a different format`);
      }
    } else {
      console.log(`  ✗ Not available or error: ${result.error}`);
    }
  });

  const availableStocks = Object.entries(results)
    .filter(([_, result]) => result.success)
    .map(([symbol]) => symbol);

  const unavailableStocks = Object.entries(results)
    .filter(([_, result]) => !result.success)
    .map(([symbol]) => symbol);

  console.log("\n" + "=".repeat(60));
  console.log(`Available: ${availableStocks.join(", ") || "None"}`);
  console.log(`Unavailable: ${unavailableStocks.join(", ") || "None"}`);
  console.log("=".repeat(60));
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

