import React from "react";
import { PORTFOLIOS } from "../data/portfoliosData";

interface PortfolioGridProps {
  data: Array<{
    date: string;
    [symbol: string]: string | number | null;
  }>;
  year: number;
}

const PortfolioGrid: React.FC<PortfolioGridProps> = ({ data, year }) => {
  const people = Object.keys(PORTFOLIOS);

  // Get the most recent data point for current prices
  const getLatestPrice = (symbol: string): number | null => {
    if (data.length === 0) return null;
    
    // Find the last data point with a valid price for this symbol
    for (let i = data.length - 1; i >= 0; i--) {
      const price = data[i][symbol];
      if (price !== null && price !== undefined && typeof price === "number" && price > 0) {
        return price;
      }
    }
    return null;
  };

  // Calculate current portfolio value for each person
  const getPortfolioValue = (person: string): number => {
    const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
    let totalValue = 0;

    Object.entries(portfolio).forEach(([symbol, investment]) => {
      // Handle special "cash_amount" key - always use the amount as-is
      if (symbol === "cash_amount") {
        totalValue += investment;
        return;
      }

      const currentPrice = getLatestPrice(symbol);
      if (currentPrice && currentPrice > 0) {
        // Find initial price to calculate shares
        let initialPrice: number | null = null;
        for (const point of data) {
          const price = point[symbol];
          if (price !== null && price !== undefined && typeof price === "number" && price > 0) {
            initialPrice = price;
            break;
          }
        }
        
        if (initialPrice && initialPrice > 0) {
          const shares = investment / initialPrice;
          totalValue += shares * currentPrice;
        }
      }
    });

    return totalValue;
  };

  // Calculate gains for all people and sort by gain (then alphabetically for ties)
  const peopleWithGains = people.map((person) => {
    const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
    const portfolioValue = getPortfolioValue(person);
    const totalInvestment = Object.values(portfolio).reduce((sum, val) => sum + val, 0);
    const gain = portfolioValue - totalInvestment;
    return { person, gain, portfolioValue, totalInvestment };
  }).filter(({ person }) => {
    const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
    return Object.keys(portfolio).length > 0;
  }).sort((a, b) => {
    // First sort by gain (descending)
    if (b.gain !== a.gain) {
      return b.gain - a.gain;
    }
    // If gains are equal, sort alphabetically by name
    return a.person.localeCompare(b.person);
  });

  // Assign ranks, handling ties
  const rankedPeople = peopleWithGains.map((item, index) => {
    let rank = index + 1;
    // If this person has the same gain as the previous person, use the same rank
    if (index > 0 && peopleWithGains[index - 1].gain === item.gain) {
      // Find the first person in this tie group
      for (let i = index - 1; i >= 0; i--) {
        if (peopleWithGains[i].gain === item.gain) {
          rank = i + 1; // Use the rank of the first person in the tie
        } else {
          break;
        }
      }
    }
    return { ...item, rank };
  });

  // Helper to format rank
  const formatRank = (rank: number): string => {
    const lastDigit = rank % 10;
    const lastTwoDigits = rank % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return `${rank}th`;
    }
    if (lastDigit === 1) return `${rank}st`;
    if (lastDigit === 2) return `${rank}nd`;
    if (lastDigit === 3) return `${rank}rd`;
    return `${rank}th`;
  };

  return (
    <div className="portfolio-grid-container">
      <div className="portfolio-grid">
        {rankedPeople.map(({ person, gain, portfolioValue, totalInvestment, rank }) => {
          const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
          const stocks = Object.keys(portfolio).filter((symbol) => symbol !== "cash_amount");
          const gainPercent = totalInvestment > 0 ? (gain / totalInvestment) * 100 : 0;

          return (
            <div key={person} className="portfolio-person-card">
              <div className="portfolio-person-header">
                <h3 className="portfolio-person-name">
                  <span className="portfolio-rank">{formatRank(rank)}</span>
                  {person}
                </h3>
                <div className="portfolio-person-summary">
                  <span className="portfolio-value">
                    ${portfolioValue.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span
                    className={`portfolio-gain ${
                      gain >= 0 ? "positive" : "negative"
                    }`}
                  >
                    {gain >= 0 ? "+" : ""}
                    {gain.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}{" "}
                    ({gainPercent >= 0 ? "+" : ""}
                    {gainPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="portfolio-stocks-table">
                <div className="portfolio-stocks-header">
                  <div className="portfolio-stock-col-symbol">Symbol</div>
                  <div className="portfolio-stock-col-investment">Investment</div>
                  <div className="portfolio-stock-col-value">Current Value</div>
                  <div className="portfolio-stock-col-gain">Gain/Loss</div>
                </div>
                <div className="portfolio-stocks-body">
                  {stocks.map((symbol) => {
                    const investment = (portfolio as { [key: string]: number })[symbol];
                    const currentPrice = getLatestPrice(symbol);
                    
                    // Find initial price to calculate shares and current value
                    let initialPrice: number | null = null;
                    for (const point of data) {
                      const price = point[symbol];
                      if (price !== null && price !== undefined && typeof price === "number" && price > 0) {
                        initialPrice = price;
                        break;
                      }
                    }

                    let currentValue = 0;
                    let stockGain = 0;
                    let stockGainPercent = 0;
                    
                    if (initialPrice && initialPrice > 0 && currentPrice && currentPrice > 0) {
                      const shares = investment / initialPrice;
                      currentValue = shares * currentPrice;
                      stockGain = currentValue - investment;
                      stockGainPercent = (stockGain / investment) * 100;
                    }

                    return (
                      <div key={symbol} className="portfolio-stock-row">
                        <div className="portfolio-stock-col-symbol">
                          <span className="portfolio-stock-symbol">{symbol}</span>
                        </div>
                        <div className="portfolio-stock-col-investment">
                          <span className="portfolio-stock-investment">
                            ${investment.toLocaleString("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                        <div className="portfolio-stock-col-value">
                          {currentPrice ? (
                            <span className="portfolio-stock-value">
                              ${currentValue.toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          ) : (
                            <span className="portfolio-stock-no-data">—</span>
                          )}
                        </div>
                        <div className="portfolio-stock-col-gain">
                          {currentPrice ? (
                            <span
                              className={`portfolio-stock-gain ${
                                stockGain >= 0 ? "positive" : "negative"
                              }`}
                            >
                              {stockGain >= 0 ? "+" : ""}
                              ${stockGain.toLocaleString("en-US", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}{" "}
                              ({stockGainPercent >= 0 ? "+" : ""}
                              {stockGainPercent.toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="portfolio-stock-no-data">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PortfolioGrid;

