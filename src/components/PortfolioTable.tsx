import React from "react";
import { PORTFOLIOS } from "../portfolios";

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
    
    // First, find the initial prices (first date) to calculate shares
    const initialPrices: { [symbol: string]: number } = {};
    if (data.length > 0) {
      const firstPoint = data[0];
      const allSymbols = new Set<string>();
      people.forEach((person) => {
        const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
        Object.keys(portfolio).forEach((symbol) => allSymbols.add(symbol));
      });
      
      allSymbols.forEach((symbol) => {
        const price = firstPoint[symbol];
        if (typeof price === "number" && price > 0) {
          initialPrices[symbol] = price;
        }
      });
    }

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
    return data.map((point) => {
      const portfolioPoint: { date: string } & { [person: string]: number } = {
        date: point.date,
      } as { date: string } & { [person: string]: number };

      people.forEach((person) => {
        const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
        let totalValue = 0;

        Object.keys(portfolio).forEach((symbol) => {
          const currentPrice = point[symbol];
          const numShares = shares[person][symbol];
          if (typeof currentPrice === "number" && currentPrice > 0 && numShares > 0) {
            totalValue += numShares * currentPrice;
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
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    
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

  const monthlyRows: (MonthlyDataPoint & { key: string })[] = Object.keys(monthlyData)
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
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Month</th>
            {people.map((person) => (
              <th key={person} style={{ padding: "12px", textAlign: "right", fontWeight: "600" }}>
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
              <td style={{ padding: "12px", fontWeight: "500" }}>{row.monthLabel}</td>
              {people.map((person) => {
                const currentValue = row[person];
                const baseline = jan1Baseline[person];
                
                // Show "-" if no data for this month
                if (currentValue === null || currentValue === undefined) {
                  return (
                    <td key={person} style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>
                      -
                    </td>
                  );
                }
                
                // Only calculate change if we have a valid baseline
                if (baseline === undefined || baseline === 0) {
                  return (
                    <td key={person} style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>
                      -
                    </td>
                  );
                }
                
                const value = typeof currentValue === "number" ? currentValue : 0;
                const { change, color, arrow } = formatYTDGrowth(value, baseline);
                
                return (
                  <td
                    key={person}
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

