import React, { useEffect, useState } from "react";
import "./App.css";
import PortfolioChart from "./components/PortfolioChart";
import PortfolioTable from "./components/PortfolioTable";
import StockChart from "./components/StockChart";
import StockTable from "./components/StockTable";
import { STOCKS } from "./portfolios";
import {
  fetchMultipleStockDataProgressive,
  PriceData,
} from "./stockDataService";
import {
  loadStockDataFromStorage,
  saveStockDataToStorage,
  storedDataToMap,
} from "./storageService";

type CombinedDataPoint = {
  date: string;
  [symbol: string]: string | number | null;
};

function App() {
  const [combinedData, setCombinedData] = useState<CombinedDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: string;
    completed: number;
    total: number;
  } | null>(null);
  const [loadedStocks, setLoadedStocks] = useState<string[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [portfolioView, setPortfolioView] = useState<"chart" | "table">(
    "chart"
  );
  const [stockView, setStockView] = useState<"chart" | "table">("chart");
  const [year, setYear] = useState<2025 | 2026>(2025);

  // Helper to generate empty data points for all expected dates
  const generateEmptyDataPoints = (
    stocks: string[],
    yearToUse: number
  ): CombinedDataPoint[] => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const dataPoints: CombinedDataPoint[] = [];
    const maxMonth = yearToUse === currentYear ? currentMonth : 12;

    // Generate data points for each day of each expected month
    for (let month = 1; month <= maxMonth; month++) {
      const daysInMonth = new Date(yearToUse, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearToUse}-${String(month).padStart(
          2,
          "0"
        )}-${String(day).padStart(2, "0")}`;
        const dataPoint: CombinedDataPoint = { date: dateStr };
        stocks.forEach((symbol) => {
          dataPoint[symbol] = null;
        });
        dataPoints.push(dataPoint);
      }
    }

    return dataPoints;
  };

  const combineStockData = (
    stockDataMap: Map<string, PriceData[]>,
    stocks: string[]
  ): CombinedDataPoint[] => {
    // Get all unique dates from all stocks
    const allDates = new Set<string>();
    stockDataMap.forEach((data) => {
      data.forEach((point) => allDates.add(point.date));
    });

    // Combine data by date
    const combined: CombinedDataPoint[] = [];
    Array.from(allDates)
      .sort()
      .forEach((date) => {
        const dataPoint: CombinedDataPoint = {
          date,
        };
        stocks.forEach((symbol) => {
          const stockData = stockDataMap.get(symbol);
          const point = stockData?.find((p) => p.date === date);
          dataPoint[symbol] = point?.price ?? null; // Use null instead of 0 for missing data
        });
        combined.push(dataPoint);
      });

    return combined;
  };

  // Load data from localStorage on mount and when year changes
  useEffect(() => {
    const loadCachedData = () => {
      const storedData = loadStockDataFromStorage(year);
      if (storedData) {
        const stockDataMap = storedDataToMap(storedData.stockData);
        const combined = combineStockData(
          stockDataMap,
          storedData.loadedStocks
        );
        setCombinedData(combined);
        setLoadedStocks(storedData.loadedStocks);
        console.log(`Loaded cached data from localStorage for year ${year}`);
      } else {
        // Clear data if no cached data for this year
        setCombinedData([]);
        setLoadedStocks([]);
      }
      setIsInitialLoad(false);
    };

    loadCachedData();
  }, [year]);

  // Check if we should fetch data for the given year
  const shouldFetchDataForYear = (yearToCheck: number): boolean => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    // If year is in the future, don't fetch
    if (yearToCheck > currentYear) {
      return false;
    }

    // If year is current year, check if we've completed at least one month
    if (yearToCheck === currentYear) {
      // We need at least one complete month (currentMonth >= 2 means January is complete)
      // Or if we're past the first day of February, January is complete
      return currentMonth >= 2 || (currentMonth === 1 && today.getDate() > 1);
    }

    // For past years, always fetch
    return true;
  };

  const handleFetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we should fetch data for this year
      if (!shouldFetchDataForYear(year)) {
        console.log(
          `Skipping data fetch for year ${year} - no complete months yet`
        );
        // Clear data but keep loadedStocks so charts/tables know which symbols to show
        // This allows charts to display with "-" for missing data
        setCombinedData([]);
        setLoadedStocks(STOCKS); // Set to all stocks so charts display all symbols
        setProgress(null);
        setLoading(false);
        return;
      }

      // Clear existing data when reloading
      setCombinedData([]);
      setLoadedStocks([]);
      setProgress({ current: "", completed: 0, total: STOCKS.length });

      const stockDataMap = new Map<string, PriceData[]>();

      await fetchMultipleStockDataProgressive(
        STOCKS,
        (symbol, data, currentIndex, total) => {
          stockDataMap.set(symbol, data);
          setLoadedStocks((prev) => [...prev, symbol]);
          setProgress({
            current: symbol,
            completed: currentIndex,
            total,
          });

          // Update combined data as each stock loads
          const combined = combineStockData(stockDataMap, STOCKS);
          setCombinedData(combined);
        },
        year
        // Starts with 2 second delay, increases to 12 seconds if rate limited
      );

      // Save to localStorage after all stocks are loaded
      const finalLoadedStocks = Array.from(stockDataMap.keys());
      saveStockDataToStorage(stockDataMap, finalLoadedStocks, year);
      console.log(`Saved stock data to localStorage for year ${year}`);

      setProgress(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch stock data"
      );
      console.error("Error fetching stock data:", err);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="header-bar">
        <div className="header-bar-content">
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <button
              onClick={handleFetchData}
              disabled={loading}
              className="reload-button"
            >
              {combinedData.length > 0 ? "Reload Data" : "Load Stock Data"}
            </button>
            {showTooltip && (
              <div className="tooltip-card">
                <div style={{ marginBottom: "4px", fontWeight: "600" }}>
                  Estimated Time:
                </div>
                <div>{Math.ceil((STOCKS.length * 12) / 60)} minute(s)</div>
                <div
                  style={{
                    fontSize: "12px",
                    marginTop: "4px",
                    opacity: 0.8,
                  }}
                >
                  ({STOCKS.length} stocks × 12 seconds each)
                </div>
              </div>
            )}
          </div>
          <div className="year-toggle">
            <span className="year-label">Year:</span>
            <select
              className="year-dropdown"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) as 2025 | 2026)}
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>
        </div>
        {loading && progress && (
          <div className="loading-progress-container">
            <div className="loading-progress-header">
              <span className="loading-progress-text">
                {progress.current
                  ? `Loading ${progress.current}...`
                  : "Loading stocks..."}
              </span>
              <span className="loading-progress-count">
                {progress.completed}/{progress.total}
              </span>
            </div>
            <div className="loading-progress-bar">
              <div
                className="loading-progress-fill"
                style={{
                  width: `${(progress.completed / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
        {error && (
          <p style={{ color: "#000000", marginTop: "20px", fontWeight: "600" }}>
            Error: {error}
          </p>
        )}
      </div>
      <header className="App-header">
        <h1>Stock Tracker</h1>
      </header>
      <main className="App-main">
        <div className="stocks-container">
          {(combinedData.length > 0 || loadedStocks.length > 0) && (
            <>
              <h2 className="section-header">Portfolios</h2>
              <div className="tabbed-card">
                <div className="tabs-container">
                  <button
                    onClick={() => setPortfolioView("chart")}
                    className={`tab-button ${
                      portfolioView === "chart" ? "active" : ""
                    }`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setPortfolioView("table")}
                    className={`tab-button ${
                      portfolioView === "table" ? "active" : ""
                    }`}
                  >
                    Table (YTD Growth)
                  </button>
                </div>
                <div className="tabbed-card-content">
                  {portfolioView === "chart" ? (
                    <PortfolioChart
                      data={
                        combinedData.length > 0
                          ? combinedData
                          : generateEmptyDataPoints(loadedStocks, year)
                      }
                      year={year}
                    />
                  ) : (
                    <PortfolioTable
                      data={
                        combinedData.length > 0
                          ? combinedData
                          : generateEmptyDataPoints(loadedStocks, year)
                      }
                      year={year}
                    />
                  )}
                </div>
              </div>
            </>
          )}
          <div>
            <h2 className="section-header">All Stocks</h2>
            {combinedData.length === 0 &&
              loadedStocks.length === 0 &&
              !loading &&
              !isInitialLoad && (
                <div className="stock-card">
                  <p
                    style={{
                      textAlign: "center",
                      color: "#666",
                      marginBottom: "20px",
                    }}
                  >
                    Click the button above to load stock data
                  </p>
                </div>
              )}
            {isInitialLoad && (
              <div className="stock-card">
                <p
                  style={{
                    textAlign: "center",
                    color: "#666",
                    marginBottom: "20px",
                  }}
                >
                  Loading cached data...
                </p>
              </div>
            )}
            {(combinedData.length > 0 || loadedStocks.length > 0) && (
              <div className="tabbed-card">
                <div className="tabs-container">
                  <button
                    onClick={() => setStockView("chart")}
                    className={`tab-button ${
                      stockView === "chart" ? "active" : ""
                    }`}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setStockView("table")}
                    className={`tab-button ${
                      stockView === "table" ? "active" : ""
                    }`}
                  >
                    Table (YTD Growth)
                  </button>
                </div>
                <div className="tabbed-card-content">
                  {stockView === "chart" ? (
                    <StockChart
                      data={
                        combinedData.length > 0
                          ? combinedData
                          : generateEmptyDataPoints(loadedStocks, year)
                      }
                      symbols={loadedStocks}
                      year={year}
                    />
                  ) : (
                    <StockTable
                      data={
                        combinedData.length > 0
                          ? combinedData
                          : generateEmptyDataPoints(loadedStocks, year)
                      }
                      symbols={loadedStocks}
                      year={year}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
