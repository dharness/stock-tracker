import React, { useEffect, useState } from "react";
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
import { PORTFOLIOS } from "../portfoliosData";

type CombinedPriceData = {
  date: string;
  [symbol: string]: string | number | null;
};

interface PortfolioChartProps {
  data: CombinedPriceData[];
  year: number;
}

// Color palette for different people
const PORTFOLIO_COLORS = ["#667eea", "#764ba2", "#f093fb"];

const PortfolioChart: React.FC<PortfolioChartProps> = ({ data, year }) => {
  // Format date for display (show only month/day)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Calculate portfolio values for each person
  const calculatePortfolioData = () => {
    const people = Object.keys(PORTFOLIOS);

    // First, find the initial prices (first date) to calculate shares
    const initialPrices: { [symbol: string]: number } = {};
    if (data.length > 0) {
      const firstPoint = data[0];
      // Get all unique symbols from all portfolios
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

    // Calculate shares for each person based on initial investment
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
      const portfolioPoint: {
        date: string;
        [person: string]: string | number;
      } = {
        date: point.date,
      };

      // Calculate total portfolio value for each person
      people.forEach((person) => {
        const portfolio = PORTFOLIOS[person as keyof typeof PORTFOLIOS];
        let totalValue = 0;

        Object.keys(portfolio).forEach((symbol) => {
          const currentPrice = point[symbol];
          const numShares = shares[person][symbol];
          if (
            currentPrice !== null &&
            currentPrice !== undefined &&
            typeof currentPrice === "number" &&
            currentPrice > 0 &&
            numShares > 0
          ) {
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

  // Format large numbers for display (e.g., 100000 -> "100K")
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Calculate nice round numbers for Y-axis domain with even increments
  const getNiceDomain = (min: number, max: number): [number, number] => {
    const range = max - min;
    if (range === 0) return [min - 10000, max + 10000];

    // Calculate appropriate step size
    const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
    let step = magnitude;

    // Choose a nice step (1, 2, 5, 10, 20, 50, 100, etc. times the magnitude)
    const normalizedRange = range / magnitude;
    if (normalizedRange <= 1.5) {
      step = magnitude * 0.5;
    } else if (normalizedRange <= 3) {
      step = magnitude;
    } else if (normalizedRange <= 7) {
      step = magnitude * 2;
    } else {
      step = magnitude * 5;
    }

    // Round min down and max up to nice numbers
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;

    return [niceMin, niceMax];
  };

  // Calculate Y-axis domain based on all portfolio values
  const getYAxisDomain = () => {
    let min = Infinity;
    let max = -Infinity;

    portfolioData.forEach((point) => {
      people.forEach((person) => {
        const value = point[person];
        if (
          value !== null &&
          value !== undefined &&
          typeof value === "number" &&
          value > 0
        ) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    // If no valid data found, return default domain
    if (min === Infinity || max === -Infinity) {
      console.warn("No valid portfolio data found for chart");
      return [0, 100000];
    }

    // Add 5% padding and round to nice numbers
    const padding = (max - min) * 0.05;
    return getNiceDomain(min - padding, max + padding);
  };

  const [yMin, yMax] = getYAxisDomain();

  // Detect mobile screen size with responsive hook
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Adjust margins and height for mobile
  const chartMargin = isMobile
    ? { top: 10, right: 5, left: 0, bottom: 10 }
    : { top: 20, right: 30, left: 20, bottom: 20 };
  const chartHeight = isMobile ? 300 : 400;

  return (
    <div className="stock-chart-container">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={portfolioData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#666"
            style={{ fontSize: isMobile ? "10px" : "12px" }}
            interval={isMobile ? "preserveStartEnd" : undefined}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? "end" : "middle"}
            height={isMobile ? 60 : undefined}
          />
          <YAxis
            stroke="#666"
            style={{ fontSize: isMobile ? "10px" : "12px" }}
            domain={[yMin, yMax]}
            tickFormatter={formatCurrency}
            width={isMobile ? 50 : undefined}
          />
          <Tooltip
            formatter={(
              value: number | undefined,
              name: string | undefined
            ) => {
              if (value === null || value === undefined) {
                return ["-", name ?? ""];
              }
              return [
                `$${value.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
                name ?? "",
              ];
            }}
            labelFormatter={(label) => `Date: ${label}`}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
          {people.map((person, index) => (
            <Line
              key={person}
              type="monotone"
              dataKey={person}
              stroke={PORTFOLIO_COLORS[index % PORTFOLIO_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              name={person}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PortfolioChart;
