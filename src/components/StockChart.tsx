import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PriceData {
  date: string;
  price: number;
}

interface StockChartProps {
  data: PriceData[];
  symbol: string;
}

const StockChart: React.FC<StockChartProps> = ({ data, symbol }) => {
  const currentPrice = data[data.length - 1].price;
  const previousPrice = data[data.length - 2].price;
  const change = currentPrice - previousPrice;
  const changePercent = ((change / previousPrice) * 100).toFixed(2);
  const isPositive = change >= 0;

  // Format date for display (show only month/day)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="stock-chart-container">
      <div className="stock-price-info">
        <span className="stock-price">${currentPrice.toFixed(2)}</span>
        <span
          className={`stock-change ${isPositive ? "positive" : "negative"}`}
        >
          {isPositive ? "+" : ""}
          {change.toFixed(2)} ({isPositive ? "+" : ""}
          {changePercent}%)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
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
            domain={[
              (dataMin: number) => dataMin - 5,
              (dataMax: number) => dataMax + 5,
            ]}
          />
          <Tooltip
            formatter={(value: number) => `$${value.toFixed(2)}`}
            labelFormatter={(label) => `Date: ${label}`}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={isPositive ? "#4caf50" : "#f44336"}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
