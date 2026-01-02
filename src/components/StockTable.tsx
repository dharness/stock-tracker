import React from "react";

type CombinedPriceData = {
  date: string;
  [symbol: string]: string | number | null;
};

interface StockTableProps {
  data: CombinedPriceData[];
  symbols: string[];
  year: number;
}

const StockTable: React.FC<StockTableProps> = ({ data, symbols, year }) => {
  // Find January 1 baseline prices for the selected year (use first data point if Jan 1 not found)
  const jan1Baseline: { [symbol: string]: number } = {};
  const jan1Date = new Date(`${year}-01-01`);
  let jan1DataPoint = data.find((point) => {
    const pointDate = new Date(point.date);
    return (
      pointDate.getFullYear() === jan1Date.getFullYear() &&
      pointDate.getMonth() === jan1Date.getMonth() &&
      pointDate.getDate() === jan1Date.getDate()
    );
  });
  
  // If Jan 1 not found, use the first available data point as baseline
  if (!jan1DataPoint && data.length > 0) {
    jan1DataPoint = data[0];
  }
  
  if (jan1DataPoint) {
    symbols.forEach((symbol) => {
      const price = jan1DataPoint![symbol];
      if (typeof price === "number" && price > 0) {
        jan1Baseline[symbol] = price;
      }
    });
  }

  // Helper to get expected months based on today's date
  const getExpectedMonths = (): string[] => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    const months: string[] = [];
    const maxMonth = year === currentYear ? currentMonth : 12;
    
    for (let month = 1; month <= maxMonth; month++) {
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      months.push(monthKey);
    }
    
    return months;
  };

  // Group data by month
  type MonthlyDataPoint = {
    monthLabel: string;
    [key: string]: string | number | null;
  };
  
  const monthlyData: { [month: string]: MonthlyDataPoint } = {};
  const expectedMonths = getExpectedMonths();
  
  // Initialize all expected months
  expectedMonths.forEach((monthKey) => {
    const monthNum = parseInt(monthKey.split("-")[1]);
    const monthLabel = new Date(year, monthNum - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const initialData: MonthlyDataPoint = { monthLabel };
    symbols.forEach((symbol) => {
      initialData[symbol] = null;
    });
    monthlyData[monthKey] = initialData;
  });
  
  data.forEach((point) => {
    const date = new Date(point.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    
    if (monthlyData[monthKey]) {
      // Use the last value of the month
      symbols.forEach((symbol) => {
        const price = point[symbol];
        if (price !== null && price !== undefined && typeof price === "number" && price > 0) {
          monthlyData[monthKey][symbol] = price;
        }
      });
    }
  });

  const monthlyRows: (MonthlyDataPoint & { key: string })[] = expectedMonths
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
            {symbols.map((symbol) => (
              <th key={symbol} style={{ padding: "12px", textAlign: "right", fontWeight: "600" }}>
                {symbol}
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
              {symbols.map((symbol) => {
                const currentPrice = row[symbol];
                const baseline = jan1Baseline[symbol];
                
                // Show "-" if no data for this month
                if (currentPrice === null || currentPrice === undefined) {
                  return (
                    <td key={symbol} style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>
                      -
                    </td>
                  );
                }
                
                // Only calculate change if we have a valid baseline
                if (baseline === undefined || baseline === 0) {
                  return (
                    <td key={symbol} style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>
                      -
                    </td>
                  );
                }
                
                const price = typeof currentPrice === "number" ? currentPrice : 0;
                const { change, color, arrow } = formatYTDGrowth(price, baseline);
                
                return (
                  <td
                    key={symbol}
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

export default StockTable;

