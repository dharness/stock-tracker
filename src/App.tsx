import React from "react";
import "./App.css";
import StockChart from "./components/StockChart";

// Hard-coded list of stocks to track
const STOCKS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"];

// Generate fake daily price data for the last 30 days
const generateFakeData = (symbol: string) => {
  const days = 30;
  const basePrice = 100 + Math.random() * 200; // Random base price between 100-300
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const price = basePrice + (Math.random() - 0.5) * 20; // Random variation
    data.push({
      date: date.toISOString().split("T")[0],
      price: Math.round(price * 100) / 100,
    });
  }

  return data;
};

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Stock Tracker</h1>
      </header>
      <main className="App-main">
        <div className="stocks-container">
          {STOCKS.map((symbol) => (
            <div key={symbol} className="stock-card">
              <h2 className="stock-symbol">{symbol}</h2>
              <StockChart data={generateFakeData(symbol)} symbol={symbol} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
