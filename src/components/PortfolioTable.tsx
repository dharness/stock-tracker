import React from "react";
import { PORTFOLIOS } from "../data/portfoliosData";

type CombinedPriceData = {
  date: string;
  [symbol: string]: string | number | null;
};

interface PortfolioTableProps {
  data: CombinedPriceData[];
  year: number;
}

const PortfolioTable: React.FC<PortfolioTableProps> = ({ data, year }) => {
  // Calculate portfolio values for each person (same logic as chart)
  const calculatePortfolioData = () => {
    const people = Object.keys(PORTFOLIOS);

    // Get all unique symbols from all portfolios (excluding cash_amount)
    const allSymbols = new Set<string>();
    people.forEach((person) => {
      const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
      Object.keys(portfolio).forEach((symbol) => {
        // Skip special "cash_amount" key - it's handled separately
        if (symbol !== "cash_amount") {
          allSymbols.add(symbol);
        }
      });
    });

    // Find the first valid price for each symbol (not null, not undefined, > 0)
    // This ensures we get initial prices even if some stocks start later
    const initialPrices: { [symbol: string]: number } = {};
    allSymbols.forEach((symbol) => {
      // Look for the first data point with a valid price for this symbol
      for (const point of data) {
        const price = point[symbol];
        if (typeof price === "number" && price > 0) {
          initialPrices[symbol] = price;
          break; // Found first valid price, move to next symbol
        }
      }
    });

    // Calculate shares for each person
    const shares: { [person: string]: { [symbol: string]: number } } = {};
    people.forEach((person) => {
      const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
      shares[person] = {};
      Object.entries(portfolio).forEach(([symbol, investment]) => {
        const initialPrice = initialPrices[symbol];
        if (initialPrice && initialPrice > 0) {
          shares[person][symbol] = investment / initialPrice;
        } else {
          shares[person][symbol] = 0;
        }
      });
    });

    // Calculate portfolio value for each date
    return data.map((point, pointIndex) => {
      const portfolioPoint: { date: string } & { [person: string]: number } = {
        date: point.date,
      } as { date: string } & { [person: string]: number };

      people.forEach((person) => {
        const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
        let totalValue = 0;

        Object.keys(portfolio).forEach((symbol) => {
          // Handle special "cash_amount" key - always use the amount as-is
          if (symbol === "cash_amount") {
            totalValue += portfolio[symbol];
            return;
          }

          const numShares = shares[person][symbol];
          if (numShares === 0) {
            // No shares calculated (no initial price found), skip
            return;
          }

          let priceToUse: number | null = null;

          // Rule 1: Check if current date has valid price
          const currentPrice = point[symbol];
          if (
            currentPrice !== null &&
            currentPrice !== undefined &&
            typeof currentPrice === "number" &&
            currentPrice > 0
          ) {
            priceToUse = currentPrice;
          } else {
            // Rule 2: Look backwards for the most recent valid price
            for (let i = pointIndex - 1; i >= 0; i--) {
              const prevPrice = data[i][symbol];
              if (
                prevPrice !== null &&
                prevPrice !== undefined &&
                typeof prevPrice === "number" &&
                prevPrice > 0
              ) {
                priceToUse = prevPrice;
                break;
              }
            }
          }

          // Rule 3: If no previous valid date found, use initial investment amount
          if (priceToUse === null) {
            const investment = portfolio[symbol];
            totalValue += investment; // Use investment amount directly
          } else {
            totalValue += numShares * priceToUse;
          }
        });

        portfolioPoint[person] = totalValue;
      });

      return portfolioPoint;
    });
  };

  const portfolioData = calculatePortfolioData();
  const people = Object.keys(PORTFOLIOS);

  // Find January 1 baseline values for the selected year (use first data point if Jan 1 not found)
  const jan1Baseline: { [person: string]: number } = {};
  const jan1Date = new Date(`${year}-01-01`);
  let jan1DataPoint = portfolioData.find((point) => {
    const pointDate = new Date(point.date);
    return (
      pointDate.getFullYear() === jan1Date.getFullYear() &&
      pointDate.getMonth() === jan1Date.getMonth() &&
      pointDate.getDate() === jan1Date.getDate()
    );
  });

  // If Jan 1 not found, use the first available data point as baseline
  if (!jan1DataPoint && portfolioData.length > 0) {
    jan1DataPoint = portfolioData[0];
  }

  if (jan1DataPoint) {
    people.forEach((person) => {
      jan1Baseline[person] = (jan1DataPoint![person] as number) || 0;
    });
  }

  // Group data by month and calculate YTD growth
  type MonthlyDataPoint = {
    monthLabel: string;
    [key: string]: string | number;
  };

  const monthlyData: { [month: string]: MonthlyDataPoint } = {};

  portfolioData.forEach((point) => {
    const date = new Date(point.date);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;
    const monthLabel = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    if (!monthlyData[monthKey]) {
      const initialData: MonthlyDataPoint = { monthLabel };
      people.forEach((person) => {
        initialData[person] = 0;
      });
      monthlyData[monthKey] = initialData;
    }

    // Use the last value of the month
    people.forEach((person) => {
      monthlyData[monthKey][person] = point[person] as number;
    });
  });

  const monthlyRows: (MonthlyDataPoint & { key: string })[] = Object.keys(
    monthlyData
  )
    .sort()
    .map((key) => ({ key, ...monthlyData[key] }));

  // Helper function to format YTD growth with color and arrow
  const formatYTDGrowth = (value: number, baseline: number) => {
    const change = value - baseline;
    const isPositive = change > 0;
    const isNegative = change < 0;
    const isZero = change === 0;

    const color = isPositive ? "#10b981" : isNegative ? "#ef4444" : "#6b7280";
    const arrow = isPositive ? "↑" : isNegative ? "↓" : "";

    return { change, color, arrow };
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: "#f5f5f5",
              borderBottom: "2px solid #ddd",
            }}
          >
            <th
              style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}
            >
              Month
            </th>
            {people.map((person) => (
              <th
                key={person}
                style={{
                  padding: "12px",
                  textAlign: "right",
                  fontWeight: "600",
                }}
              >
                {person}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthlyRows.map((row, index) => (
            <tr
              key={row.key}
              style={{
                borderBottom: "1px solid #eee",
                backgroundColor: index % 2 === 0 ? "#fff" : "#fafafa",
              }}
            >
              <td style={{ padding: "12px", fontWeight: "500" }}>
                {row.monthLabel}
              </td>
              {people.map((person) => {
                const currentValue = row[person];
                const baseline = jan1Baseline[person];

                // Show "-" if no data for this month
                if (currentValue === null || currentValue === undefined) {
                  return (
                    <td
                      key={`${row.key}-${person}`}
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "#6b7280",
                      }}
                    >
                      -
                    </td>
                  );
                }

                // Only calculate change if we have a valid baseline
                if (baseline === undefined || baseline === 0) {
                  return (
                    <td
                      key={`${row.key}-${person}`}
                      style={{
                        padding: "12px",
                        textAlign: "right",
                        color: "#6b7280",
                      }}
                    >
                      -
                    </td>
                  );
                }

                const value =
                  typeof currentValue === "number" ? currentValue : 0;
                const { change, color, arrow } = formatYTDGrowth(
                  value,
                  baseline
                );

                return (
                  <td
                    key={`${row.key}-${person}`}
                    style={{
                      padding: "12px",
                      textAlign: "right",
                      color: color,
                      fontWeight: "500",
                    }}
                  >
                    ${change >= 0 ? "+" : ""}
                    {Math.round(change).toLocaleString("en-US")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PortfolioTable;
