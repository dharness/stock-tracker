// Service to fetch real stock data from Massive API
// Documentation: https://massive.com/docs/rest/quickstart

const MASSIVE_API_KEY = "d3WXhBdil6HaNoavpTZyzQXs8qz5a0Iv";
const BASE_URL = "https://api.massive.com/v2/aggs/ticker";

export interface PriceData {
  date: string;
  price: number;
}

interface MassiveAggregateResult {
  t: number; // timestamp in milliseconds
  c: number; // closing price
  o?: number; // open
  h?: number; // high
  l?: number; // low
  v?: number; // volume
}

interface MassiveApiResponse {
  results: MassiveAggregateResult[];
  status: string;
  request_id?: string;
  count?: number;
}

/**
 * Helper function to delay execution
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches historical stock data for the last 1 year from Massive API
 * @param symbol Stock ticker symbol (e.g., "AAPL")
 * @param retries Number of retry attempts for rate limit errors (default: 3)
 * @returns Array of price data points with date and price
 */
export const fetchStockData = async (
  symbol: string,
  retries: number = 3
): Promise<PriceData[]> => {
  // Calculate date range for the last 1 year
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  // Format dates as YYYY-MM-DD
  const fromDate = startDate.toISOString().split("T")[0];
  const toDate = endDate.toISOString().split("T")[0];

  // Construct API URL
  // Endpoint: /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
  // multiplier=1, timespan=day for daily data
  const url = `${BASE_URL}/${symbol}/range/1/day/${fromDate}/${toDate}?apiKey=${MASSIVE_API_KEY}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s

        console.log(
          `Rate limited for ${symbol}. Waiting ${waitTime}ms before retry ${
            attempt + 1
          }/${retries}`
        );
        await delay(waitTime);
        continue; // Retry the request
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch data for ${symbol}: ${response.status} ${response.statusText}`
        );
      }

      const data: MassiveApiResponse = await response.json();

      console.log(`API response for ${symbol}:`, data);

      // Accept both "OK" and "DELAYED" statuses as valid (DELAYED means delayed data but still valid)
      if (
        (data.status !== "OK" && data.status !== "DELAYED") ||
        !data.results
      ) {
        console.error(`API error for ${symbol}:`, data);
        throw new Error(
          `API returned error status for ${symbol}: ${data.status}`
        );
      }

      // Convert Massive API response to our PriceData format
      const priceData: PriceData[] = data.results.map((result) => {
        // Convert timestamp (milliseconds) to date string (YYYY-MM-DD)
        const date = new Date(result.t);
        const dateString = date.toISOString().split("T")[0];

        return {
          date: dateString,
          price: result.c, // Use closing price
        };
      });

      // Sort by date to ensure chronological order
      return priceData.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      // If this is the last attempt, throw the error
      if (attempt === retries - 1) {
        console.error(
          `Error fetching stock data for ${symbol} after ${retries} attempts:`,
          error
        );
        throw error;
      }
      // Otherwise, wait and retry
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(
        `Retrying ${symbol} after ${waitTime}ms (attempt ${
          attempt + 1
        }/${retries})`
      );
      await delay(waitTime);
    }
  }

  throw new Error(
    `Failed to fetch data for ${symbol} after ${retries} attempts`
  );
};

/**
 * Fetches stock data for multiple symbols sequentially with delays to avoid rate limits
 * @param symbols Array of stock ticker symbols
 * @param delayMs Delay in milliseconds between requests (default: 12000ms = 12 seconds for 5 req/min limit)
 * @returns Map of symbol to price data array
 */
export const fetchMultipleStockData = async (
  symbols: string[],
  delayMs: number = 12000
): Promise<Map<string, PriceData[]>> => {
  const dataMap = new Map<string, PriceData[]>();

  // Fetch stocks sequentially with delays to avoid rate limiting
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    try {
      console.log(
        `Fetching data for ${symbol} (${i + 1}/${symbols.length})...`
      );
      const data = await fetchStockData(symbol);
      if (data.length > 0) {
        dataMap.set(symbol, data);
        console.log(
          `Successfully fetched ${data.length} data points for ${symbol}`
        );
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      // Continue with next symbol even if one fails
    }

    // Add delay between requests (except after the last one)
    if (i < symbols.length - 1) {
      await delay(delayMs);
    }
  }

  return dataMap;
};

/**
 * Fetches stock data progressively, calling onProgress for each stock as it's loaded
 * @param symbols Array of stock ticker symbols
 * @param onProgress Callback called when each stock is loaded (symbol, data, currentIndex, total)
 * @param delayMs Delay in milliseconds between requests (default: 12000ms = 12 seconds for 5 req/min limit)
 */
export const fetchMultipleStockDataProgressive = async (
  symbols: string[],
  onProgress: (
    symbol: string,
    data: PriceData[],
    currentIndex: number,
    total: number
  ) => void,
  delayMs: number = 12000
): Promise<void> => {
  // Fetch stocks sequentially with delays to avoid rate limiting
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    try {
      const data = await fetchStockData(symbol);
      if (data.length > 0) {
        onProgress(symbol, data, i + 1, symbols.length);
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      // Continue with next symbol even if one fails
    }

    // Add delay between requests (except after the last one)
    if (i < symbols.length - 1) {
      await delay(delayMs);
    }
  }
};
