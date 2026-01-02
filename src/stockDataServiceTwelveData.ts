// Service to fetch real stock data from Twelve Data API using batch requests
// Documentation: https://twelvedata.com/docs#overview

const TWELVE_DATA_API_KEY = "b9d9822313f0424dabe4b7b3659885a3";
const BASE_URL = "https://api.twelvedata.com";

export interface PriceData {
  date: string;
  price: number;
}

interface TwelveDataTimeSeriesValue {
  datetime: string; // Format: "YYYY-MM-DD HH:MM:SS"
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TwelveDataBatchResponse {
  [symbol: string]: {
    meta: {
      symbol: string;
      interval: string;
      currency: string;
      exchange_timezone: string;
      exchange: string;
      mic_code: string;
      type: string;
    };
    values: TwelveDataTimeSeriesValue[];
    status: string;
    message?: string;
  };
}

/**
 * Fetches stock data for multiple symbols using batch API
 * @param symbols Array of stock ticker symbols
 * @param year Year to fetch data for (default: 2025)
 * @returns Map of symbol to price data array
 */
const fetchStockDataBatch = async (
  symbols: string[],
  year: number = 2025
): Promise<Map<string, PriceData[]>> => {
  if (symbols.length === 0) {
    return new Map();
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const symbolsString = symbols.join(",");

  // Construct batch API URL
  // Endpoint: /time_series?symbol={symbol1,symbol2,...}&interval=1day&start_date={start}&end_date={end}&apikey={key}
  const url = `${BASE_URL}/time_series?symbol=${symbolsString}&interval=1day&start_date=${startDate}&end_date=${endDate}&apikey=${TWELVE_DATA_API_KEY}&format=JSON`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch batch data: ${response.status} ${response.statusText}`
      );
    }

    const data: TwelveDataBatchResponse = await response.json();

    console.log(`Batch API response:`, data);

    const dataMap = new Map<string, PriceData[]>();

    // Process each symbol's data from the batch response
    symbols.forEach((symbol) => {
      const symbolData = data[symbol];
      if (symbolData && symbolData.status !== "error" && symbolData.values) {
        const priceData: PriceData[] = symbolData.values.map((value) => {
          const dateString = value.datetime.split(" ")[0];
          return {
            date: dateString,
            price: parseFloat(value.close),
          };
        });
        dataMap.set(
          symbol,
          priceData.sort((a, b) => a.date.localeCompare(b.date))
        );
      } else {
        console.warn(`No data or error for ${symbol} in batch response`);
      }
    });

    return dataMap;
  } catch (error) {
    console.error("Error fetching batch data:", error);
    throw error;
  }
};

/**
 * Fetches stock data for a single symbol (for compatibility, but uses batch internally)
 * @param symbol Stock ticker symbol (e.g., "AAPL")
 * @param year Year to fetch data for (default: 2025)
 * @param retries Not used, kept for interface compatibility
 * @returns Array of price data points with date and price
 */
export const fetchStockData = async (
  symbol: string,
  year: number = 2025,
  retries: number = 3
): Promise<PriceData[]> => {
  // Use batch API even for single symbol
  const dataMap = await fetchStockDataBatch([symbol], year);
  return dataMap.get(symbol) || [];
};

/**
 * Fetches stock data for multiple symbols using batch API
 * @param symbols Array of stock ticker symbols
 * @param delayMs Not used, kept for interface compatibility
 * @returns Map of symbol to price data array
 */
export const fetchMultipleStockData = async (
  symbols: string[],
  delayMs: number = 12000
): Promise<Map<string, PriceData[]>> => {
  return await fetchStockDataBatch(symbols);
};

/**
 * Fetches stock data progressively, calling onProgress for each stock as it's loaded
 * Uses batch API to fetch all symbols in a single request
 * @param symbols Array of stock ticker symbols
 * @param onProgress Callback called when each stock is loaded (symbol, data, currentIndex, total)
 * @param year Year to fetch data for (default: 2025)
 * @param initialDelayMs Not used, kept for interface compatibility
 * @param rateLimitedDelayMs Not used, kept for interface compatibility
 */
export const fetchMultipleStockDataProgressive = async (
  symbols: string[],
  onProgress: (
    symbol: string,
    data: PriceData[],
    currentIndex: number,
    total: number
  ) => void,
  year: number = 2025,
  initialDelayMs: number = 2000,
  rateLimitedDelayMs: number = 12000
): Promise<void> => {
  try {
    // Fetch all symbols in a single batch request
    const dataMap = await fetchStockDataBatch(symbols, year);

    // Call onProgress for each symbol that was successfully fetched
    let completed = 0;
    symbols.forEach((symbol) => {
      const data = dataMap.get(symbol);
      if (data && data.length > 0) {
        completed++;
        onProgress(symbol, data, completed, symbols.length);
      } else {
        console.error(`Failed to fetch data for ${symbol} in batch`);
      }
    });
  } catch (error) {
    console.error("Error fetching batch data:", error);
    // Continue even if batch fails - individual symbols will show as missing
  }
};
