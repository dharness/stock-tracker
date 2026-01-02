import { fetchMultipleStockData } from "./stockDataService";

// Portfolio groupings for different people with dollar amounts invested
// Each person has invested $100,000 total across their stocks
export const PORTFOLIOS = {
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
