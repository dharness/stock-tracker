// Massive API stock data fetcher
// Used as a fallback when other data sources don't have the stock

const axios = require("axios");

// ============================================================================
// CONFIGURATION SECTION
// ============================================================================

const MASSIVE_API_KEY = "d3WXhBdil6HaNoavpTZyzQXs8qz5a0Iv";
const MASSIVE_BASE_URL = "https://api.massive.com/v2";

// ============================================================================
// END CONFIGURATION SECTION
// ============================================================================

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches all historical stock data from Massive API for a given ticker
 * @param {string} ticker Stock ticker symbol
 * @param {number} retries Number of retry attempts (default: 3)
 * @returns {Promise<Array<{date: string, price: number}>>} Array of price data points
 */
const fetchStockDataFromMassive = async (ticker, retries = 3) => {
  // Get data for the last 5 years to ensure we have enough historical data
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 5);

  const url = `${MASSIVE_BASE_URL}/aggs/ticker/${ticker}/range/1/day/${
    fromDate.toISOString().split("T")[0]
  }/${
    toDate.toISOString().split("T")[0]
  }?apiKey=${MASSIVE_API_KEY}&adjusted=true&sort=asc&limit=50000`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url);

      const data = response.data;

      // Check if request was successful
      if (data.status === "OK" || data.status === "DELAYED") {
        const results = data.results || [];

        if (results.length === 0) {
          // No data available for this ticker
          return [];
        }

        // Convert to our format
        const priceData = results
          .map((result) => {
            // Massive API format: { t: timestamp, c: close price, ... }
            const date = new Date(result.t);
            return {
              date: date.toISOString().split("T")[0], // YYYY-MM-DD format
              price: parseFloat(result.c), // Close price
            };
          })
          .filter((point) => !isNaN(point.price) && point.price > 0) // Filter out invalid prices
          .sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

        return priceData;
      } else {
        // API returned an error status
        throw new Error(`API returned status: ${data.status}`);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.message || String(error);
      const statusCode = error.response?.status;

      // If it's a 401 or 404, don't retry - the stock likely doesn't exist
      if (statusCode === 401 || statusCode === 404) {
        console.warn(`  Massive API: ${ticker} not available (${statusCode})`);
        return [];
      }

      // If it's the last attempt, throw the error
      if (attempt === retries - 1) {
        throw new Error(
          `Failed to fetch ${ticker} from Massive API: ${errorMessage}`
        );
      }

      // Exponential backoff for retries
      await delay(Math.pow(2, attempt) * 1000);
    }
  }

  return [];
};

module.exports = {
  fetchStockDataFromMassive,
};




