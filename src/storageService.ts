// Service for managing stock data in localStorage
// Works on both desktop and mobile browsers (iOS Safari, Chrome Mobile, etc.)

import { PriceData } from "./stockDataService";

const STORAGE_KEY = "stock-tracker-data";
const STORAGE_TIMESTAMP_KEY = "stock-tracker-timestamp";

/**
 * Checks if localStorage is available and accessible
 * @returns true if localStorage is available, false otherwise
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    const test = "__localStorage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    // localStorage may be disabled (private mode, storage quota exceeded, etc.)
    return false;
  }
};

export interface StoredStockData {
  [symbol: string]: PriceData[];
}

export interface StoredData {
  stockData: StoredStockData;
  loadedStocks: string[];
  timestamp: number;
}

/**
 * Saves stock data to localStorage
 * @param stockData Map of symbol to price data array
 * @param loadedStocks Array of loaded stock symbols
 */
export const saveStockDataToStorage = (
  stockData: Map<string, PriceData[]>,
  loadedStocks: string[]
): void => {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage is not available. Data will not be saved.");
    return;
  }

  // Convert Map to object outside try block so it's available in catch
  const stockDataObj: StoredStockData = {};
  stockData.forEach((data, symbol) => {
    stockDataObj[symbol] = data;
  });

  try {
    const storedData: StoredData = {
      stockData: stockDataObj,
      loadedStocks,
      timestamp: Date.now(),
    };

    const dataString = JSON.stringify(storedData);
    
    // Check if data size is reasonable (localStorage typically has 5-10MB limit)
    if (dataString.length > 5 * 1024 * 1024) {
      console.warn("Data size exceeds 5MB. May not save on some mobile devices.");
    }

    localStorage.setItem(STORAGE_KEY, dataString);
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    // Handle quota exceeded errors (common on mobile)
    if (error instanceof DOMException && (error.code === 22 || error.name === "QuotaExceededError")) {
      console.warn("localStorage quota exceeded. Clearing old data and retrying...");
      try {
        // Try clearing old data and saving again
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
        const retryData: StoredData = {
          stockData: stockDataObj,
          loadedStocks,
          timestamp: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(retryData));
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString());
      } catch (retryError) {
        console.error("Error saving stock data to localStorage after retry:", retryError);
      }
    } else {
      console.error("Error saving stock data to localStorage:", error);
    }
  }
};

/**
 * Loads stock data from localStorage
 * @returns Stored data or null if not found/invalid
 */
export const loadStockDataFromStorage = (): StoredData | null => {
  if (!isLocalStorageAvailable()) {
    console.warn("localStorage is not available. Cannot load cached data.");
    return null;
  }

  try {
    const storedDataString = localStorage.getItem(STORAGE_KEY);
    if (!storedDataString) {
      return null;
    }

    const storedData: StoredData = JSON.parse(storedDataString);

    // Validate the stored data structure
    if (
      !storedData.stockData ||
      !storedData.loadedStocks ||
      !Array.isArray(storedData.loadedStocks)
    ) {
      console.warn("Invalid stored data structure");
      return null;
    }

    return storedData;
  } catch (error) {
    console.error("Error loading stock data from localStorage:", error);
    return null;
  }
};

/**
 * Converts stored stock data object to a Map
 * @param stockData Stored stock data object
 * @returns Map of symbol to price data array
 */
export const storedDataToMap = (
  stockData: StoredStockData
): Map<string, PriceData[]> => {
  const map = new Map<string, PriceData[]>();
  Object.entries(stockData).forEach(([symbol, data]) => {
    map.set(symbol, data);
  });
  return map;
};

/**
 * Clears stored stock data from localStorage
 */
export const clearStoredStockData = (): void => {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
  } catch (error) {
    console.error("Error clearing stock data from localStorage:", error);
  }
};

/**
 * Gets the timestamp of when data was last saved
 * @returns Timestamp in milliseconds or null
 */
export const getStoredDataTimestamp = (): number | null => {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    console.error("Error getting stored data timestamp:", error);
    return null;
  }
};

