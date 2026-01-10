import { fetchMultipleStockData } from "../services/stockDataServiceStatic";
import { getPortfolios } from "./portfoliosData";

// Get all unique stocks from all portfolios in the specified portfolio group
export const getAllStocks = (groupName: string = "default") => {
  const portfolios = getPortfolios(groupName);
  const allStocksSet = new Set<string>();
  Object.values(portfolios).forEach((portfolio) => {
    Object.keys(portfolio).forEach((stock) => {
      // Skip special "cash_amount" key - it's not a stock ticker
      if (stock !== "cash_amount") {
        allStocksSet.add(stock);
      }
    });
  });
  return Array.from(allStocksSet).sort();
};

// Helper function to get stocks for a specific group
export const getStocks = (groupName: string = "default") => {
  return getAllStocks(groupName);
};

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
