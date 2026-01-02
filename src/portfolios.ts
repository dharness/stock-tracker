import { fetchMultipleStockData } from "./stockDataService";

// Portfolio groupings for different people with dollar amounts invested
// Each person has invested $100,000 total across their stocks
export const PORTFOLIOS = {
  Ryan: {
    AAPL: 30000, // $30,000
    GOOGL: 40000, // $40,000
    MSFT: 30000, // $30,000
    // Total: $100,000
  },
  Brian: {
    AMZN: 50000, // $50,000
    TSLA: 50000, // $50,000
    // Total: $100,000
  },
  Katie: {
    AAPL: 33333, // $33,333
    MSFT: 33333, // $33,333
    TSLA: 33334, // $33,334
    // Total: $100,000
  },
};

// Get all unique stocks from all portfolios
export const getAllStocks = () => {
  const allStocksSet = new Set<string>();
  Object.values(PORTFOLIOS).forEach((portfolio) => {
    Object.keys(portfolio).forEach((stock) => allStocksSet.add(stock));
  });
  return Array.from(allStocksSet).sort();
};

// All unique stocks across all portfolios
export const STOCKS = getAllStocks();

// Combine all stocks' data into a single dataset using real API data
export const combineStockData = async (
  stocks: string[]
): Promise<
  Array<{
    date: string;
    [symbol: string]: string | number;
  }>
> => {
  // Fetch real data for all stocks from Massive API
  const stockDataMap = await fetchMultipleStockData(stocks);

  console.log("Stock data map:", stockDataMap);
  console.log("Stock data map size:", stockDataMap.size);

  // Get all unique dates from all stocks
  const allDates = new Set<string>();
  stockDataMap.forEach((data) => {
    data.forEach((point) => allDates.add(point.date));
  });

  console.log("All dates:", allDates);
  console.log("All dates count:", allDates.size);

  // Combine data by date
  type CombinedDataPoint = {
    date: string;
  } & {
    [symbol: string]: string | number; // date is string, stock prices are numbers
  };

  const combinedData: CombinedDataPoint[] = [];
  Array.from(allDates)
    .sort()
    .forEach((date) => {
      const dataPoint: CombinedDataPoint = {
        date,
      };
      stocks.forEach((symbol) => {
        const stockData = stockDataMap.get(symbol);
        const point = stockData?.find((p) => p.date === date);
        dataPoint[symbol] = point?.price ?? 0;
      });
      combinedData.push(dataPoint);
    });

  return combinedData;
};
