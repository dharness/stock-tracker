import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CombinedPriceData = {
  date: string;
  [symbol: string]: string | number;
};

interface StockChartProps {
  data: CombinedPriceData[];
  symbols: string[];
}

// Color palette for different stocks
const STOCK_COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#00f2fe"];

const StockChart: React.FC<StockChartProps> = ({ data, symbols }) => {
  // Format date for display (show only month/day)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Calculate Y-axis domain based on all stock prices
  const getYAxisDomain = () => {
    let min = Infinity;
    let max = -Infinity;

    data.forEach((point) => {
      symbols.forEach((symbol) => {
        const price = point[symbol];
        if (typeof price === "number" && price > 0) {
          min = Math.min(min, price);
          max = Math.max(max, price);
        }
      });
    });

    // If no valid data found, return default domain
    if (min === Infinity || max === -Infinity) {
      console.warn("No valid price data found for chart");
      return [0, 100];
    }

    const padding = (max - min) * 0.1; // 10% padding
    return [min - padding, max + padding];
  };

  const [yMin, yMax] = getYAxisDomain();
  
  // Debug logging
  console.log("StockChart received data:", data);
  console.log("StockChart received symbols:", symbols);
  console.log("Y-axis domain:", [yMin, yMax]);

  return (
    <div className="stock-chart-container">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#666"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="#666"
            style={{ fontSize: "12px" }}
            domain={[yMin, yMax]}
          />
          <Tooltip
            formatter={(
              value: number | undefined,
              name: string | undefined
            ) => [`$${value?.toFixed(2) ?? ""}`, name ?? ""]}
            labelFormatter={(label) => `Date: ${label}`}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
          {symbols.map((symbol, index) => (
            <Line
              key={symbol}
              type="monotone"
              dataKey={symbol}
              stroke={STOCK_COLORS[index % STOCK_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              name={symbol}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
