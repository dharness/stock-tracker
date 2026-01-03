import React, { useEffect, useState } from "react";
import "./App.css";
import PortfolioChart from "./components/PortfolioChart";
import PortfolioGrid from "./components/PortfolioGrid";
import PortfolioTable from "./components/PortfolioTable";
import StockChart from "./components/StockChart";
import StockTable from "./components/StockTable";
import { STOCKS } from "./data/portfolios";
import {
  fetchMultipleStockData,
  PriceData,
} from "./services/stockDataServiceStatic";

type CombinedDataPoint = {
  date: string;
  [symbol: string]: string | number | null;
};

function App() {
  const [combinedData, setCombinedData] = useState<CombinedDataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedStocks, setLoadedStocks] = useState<string[]>([]);
  const [portfolioView, setPortfolioView] = useState<
    "chart" | "table" | "portfolios"
  >("chart");
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

  // Load data directly from static JSON file on mount and when year changes
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);

        // Get all data (not filtered by year yet)
        const stockDataMap = await fetchMultipleStockData(STOCKS);

        // Filter by year
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        const filteredMap = new Map<string, PriceData[]>();

        stockDataMap.forEach((allData, symbol) => {
          const filtered = allData.filter(
            (point) => point.date >= yearStart && point.date <= yearEnd
          );
          if (filtered.length > 0) {
            filteredMap.set(symbol, filtered);
          }
        });

        const combined = combineStockData(
          filteredMap,
          Array.from(filteredMap.keys())
        );
        setCombinedData(combined);
        setLoadedStocks(Array.from(filteredMap.keys()));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load stock data"
        );
        console.error("Error loading stock data:", err);
      }
    };

    loadData();
  }, [year]);

  return (
    <div className="App">
      <div className="header-bar">
        <div className="header-bar-content">
          <h1 className="header-title">📈 Fake Stocks</h1>
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
        {error && (
          <p style={{ color: "#000000", marginTop: "20px", fontWeight: "600" }}>
            Error: {error}
          </p>
        )}
      </div>
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
                    Timeseries
                  </button>
                  <button
                    onClick={() => setPortfolioView("table")}
                    className={`tab-button ${
                      portfolioView === "table" ? "active" : ""
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setPortfolioView("portfolios")}
                    className={`tab-button ${
                      portfolioView === "portfolios" ? "active" : ""
                    }`}
                  >
                    Portfolios
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
                  ) : portfolioView === "table" ? (
                    <PortfolioTable
                      data={
                        combinedData.length > 0
                          ? combinedData
                          : generateEmptyDataPoints(loadedStocks, year)
                      }
                      year={year}
                    />
                  ) : (
                    <PortfolioGrid
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
            {(combinedData.length > 0 || loadedStocks.length > 0) && (
              <div className="tabbed-card">
                <div className="tabs-container">
                  <button
                    onClick={() => setStockView("chart")}
                    className={`tab-button ${
                      stockView === "chart" ? "active" : ""
                    }`}
                  >
                    Timeseries
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
