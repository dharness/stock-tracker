// Service to fetch real stock data from Finnhub API
// Documentation: https://finnhub.io/docs/api
// Free tier: 60 requests/minute - perfect for parallel fetching!

// TODO: Replace with your free Finnhub API key from https://finnhub.io/
// Sign up is free and takes 30 seconds - no credit card required!
const FINNHUB_API_KEY = "d5bmeehr01qnaidui0l0d5bmeehr01qnaidui0lg";
const BASE_URL = "https://finnhub.io/api/v1";

export interface PriceData {
  date: string;
  price: number;
}

interface FinnhubCandleResponse {
  s: string; // Status: "ok", "no_data", or "error"
  t: number[]; // Timestamps (Unix seconds)
  c: number[]; // Close prices
  o?: number[]; // Open prices (optional)
  h?: number[]; // High prices (optional)
  l?: number[]; // Low prices (optional)
  v?: number[]; // Volume (optional)
  error?: string; // Error message if status is "error"
}

/**
 * Fetches stock data for multiple symbols in parallel using Promise.all
 * Finnhub allows 60 requests/minute, so we can fire off all requests at once!
 * @param symbols Array of stock ticker symbols
 * @param year Year to fetch data for (default: 2025)
 * @returns Map of symbol to price data array
 */
const fetchStockDataParallel = async (
  symbols: string[],
  year: number = 2025
): Promise<Map<string, PriceData[]>> => {
  if (symbols.length === 0) return new Map();

  const dataMap = new Map<string, PriceData[]>();

  // Convert year to Unix timestamps (seconds)
  const startDate = new Date(`${year}-01-01T00:00:00Z`);
  const endDate = new Date(`${year}-12-31T23:59:59Z`);
  const from = Math.floor(startDate.getTime() / 1000);
  const to = Math.floor(endDate.getTime() / 1000);

  // Fire off ALL requests at the same time using Promise.all
  // Finnhub allows 60/minute, so 24 at once is totally fine!
  const requests = symbols.map(async (symbol) => {
    try {
      // Finnhub 'candle' endpoint gives historical data
      // Resolution 'D' = Daily
      // Note: Symbol should be uppercase for US stocks
      const symbolUpper = symbol.toUpperCase();
      const url = `${BASE_URL}/stock/candle?symbol=${symbolUpper}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Finnhub fetch failed for ${symbol}: ${response.status} - ${errorText}`
        );
      }

      const data: FinnhubCandleResponse = await response.json();

      // Check for API errors in response
      if (data.s === "error") {
        console.warn(`API error for ${symbol}:`, data);
        return;
      }

      if (data.s === "ok" && data.t && data.c && data.t.length > 0) {
        // Convert timestamps to dates and map to PriceData format
        const prices: PriceData[] = data.c.map((close: number, i: number) => ({
          date: new Date(data.t[i] * 1000).toISOString().split("T")[0], // Convert to YYYY-MM-DD
          price: close,
        }));

        // Sort by date (oldest to newest) to ensure chronological order
        prices.sort((a, b) => a.date.localeCompare(b.date));
        dataMap.set(symbol, prices);
      } else {
        console.warn(`No data returned for ${symbol} (status: ${data.s})`);
      }
    } catch (err) {
      console.error(`Failed to fetch data for ${symbol}:`, err);
      // Continue with other symbols even if one fails
    }
  });

  // Wait for all requests to complete
  await Promise.all(requests);
  return dataMap;
};

/**
 * Compatibility wrappers - these stay the same so your UI doesn't break!
 */
export const fetchStockData = async (
  symbol: string,
  year: number = 2025,
  retries: number = 3 // Not used, kept for interface compatibility
): Promise<PriceData[]> => {
  const dataMap = await fetchStockDataParallel([symbol], year);
  return dataMap.get(symbol) || [];
};

export const fetchMultipleStockData = async (
  symbols: string[],
  delayMs: number = 12000 // Not used, kept for interface compatibility
): Promise<Map<string, PriceData[]>> => {
  // Default to 2025 to match interface - year should be passed via fetchMultipleStockDataProgressive
  return await fetchStockDataParallel(symbols, 2025);
};

export const fetchMultipleStockDataProgressive = async (
  symbols: string[],
  onProgress: (
    symbol: string,
    data: PriceData[],
    currentIndex: number,
    total: number
  ) => void,
  year: number = 2025,
  initialDelayMs: number = 2000, // Not used, kept for interface compatibility
  rateLimitedDelayMs: number = 12000 // Not used, kept for interface compatibility
): Promise<void> => {
  try {
    // Fetch all symbols in parallel
    const dataMap = await fetchStockDataParallel(symbols, year);

    // Call onProgress for each symbol that was successfully fetched
    let completed = 0;
    symbols.forEach((symbol) => {
      const data = dataMap.get(symbol);
      if (data && data.length > 0) {
        completed++;
        onProgress(symbol, data, completed, symbols.length);
      } else {
        console.error(`Failed to fetch data for ${symbol}`);
      }
    });
  } catch (error) {
    console.error("Error fetching stock data:", error);
    // Continue even if some requests fail - individual symbols will show as missing
  }
};
