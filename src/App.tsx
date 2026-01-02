import React, { useEffect, useState } from "react";
import "./App.css";
import PortfolioChart from "./components/PortfolioChart";
import StockChart from "./components/StockChart";
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
  [symbol: string]: string | number;
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
          dataPoint[symbol] = point?.price ?? 0;
        });
        combined.push(dataPoint);
      });

    return combined;
  };

  // Load data from localStorage on mount
  useEffect(() => {
    const loadCachedData = () => {
      const storedData = loadStockDataFromStorage();
      if (storedData) {
        const stockDataMap = storedDataToMap(storedData.stockData);
        const combined = combineStockData(
          stockDataMap,
          storedData.loadedStocks
        );
        setCombinedData(combined);
        setLoadedStocks(storedData.loadedStocks);
        console.log("Loaded cached data from localStorage");
      }
      setIsInitialLoad(false);
    };

    loadCachedData();
  }, []);

  const handleFetchData = async () => {
    try {
      setLoading(true);
      setError(null);
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
        12000 // 12 seconds delay for 5 requests per minute
      );

      // Save to localStorage after all stocks are loaded
      const finalLoadedStocks = Array.from(stockDataMap.keys());
      saveStockDataToStorage(stockDataMap, finalLoadedStocks);
      console.log("Saved stock data to localStorage");

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
      <header className="App-header">
        <h1>Stock Tracker</h1>
      </header>
      <main className="App-main">
        <div className="stocks-container">
          {combinedData.length > 0 && (
            <div className="stock-card">
              <h2 className="stock-symbol">Portfolio Values</h2>
              <PortfolioChart data={combinedData} />
            </div>
          )}
          <div className="stock-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 className="stock-symbol">All Stocks</h2>
              <div
                style={{ position: "relative" }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <button
                  onClick={handleFetchData}
                  disabled={loading}
                  style={{
                    padding: "12px 24px",
                    fontSize: "16px",
                    backgroundColor: "#667eea",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {combinedData.length > 0 ? "Reload Data" : "Load Stock Data"}
                </button>
                {showTooltip && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "8px",
                      padding: "12px",
                      backgroundColor: "#333",
                      color: "white",
                      borderRadius: "8px",
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                      zIndex: 1000,
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    }}
                  >
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
            </div>
            {combinedData.length === 0 && !loading && !isInitialLoad && (
              <p
                style={{
                  textAlign: "center",
                  color: "#666",
                  marginBottom: "20px",
                }}
              >
                Click the button above to load stock data
              </p>
            )}
            {isInitialLoad && (
              <p
                style={{
                  textAlign: "center",
                  color: "#666",
                  marginBottom: "20px",
                }}
              >
                Loading cached data...
              </p>
            )}
            {loading && progress && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ marginBottom: "10px", fontWeight: "600" }}>
                  Loading stocks... ({progress.completed}/{progress.total})
                </p>
                {progress.current && (
                  <p style={{ color: "#666" }}>
                    Currently loading: <strong>{progress.current}</strong>
                  </p>
                )}
                {loadedStocks.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#666",
                        marginBottom: "5px",
                      }}
                    >
                      Loaded: {loadedStocks.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
            {error && <p style={{ color: "red" }}>Error: {error}</p>}
            {combinedData.length > 0 && (
              <StockChart data={combinedData} symbols={loadedStocks} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
