// Script to clean up stocks.json to only include stocks from portfoliosData.json
// This removes any stocks that are no longer in the portfolios

const fs = require("fs");
const path = require("path");

// Import portfolios from the single source of truth
const portfoliosData = require("../src/data/portfoliosData.json");

// Helper to get flattened portfolios from the normalized structure
const getFlattenedPortfolios = () => {
  // Check if normalized structure (with portfolios and portfolioGroups)
  if (portfoliosData.portfolios && portfoliosData.portfolioGroups) {
    // Use "default" group, or merge all groups if "default" doesn't exist
    const groupNames = portfoliosData.portfolioGroups.default
      ? ["default"]
      : Object.keys(portfoliosData.portfolioGroups);

    // Collect all unique portfolio names from the groups
    const portfolioNames = new Set();
    groupNames.forEach((groupName) => {
      const group = portfoliosData.portfolioGroups[groupName];
      if (Array.isArray(group)) {
        group.forEach((portfolioName) => portfolioNames.add(portfolioName));
      }
    });

    // Build flattened object from normalized portfolios
    const flattened = {};
    portfolioNames.forEach((portfolioName) => {
      if (portfoliosData.portfolios[portfolioName]) {
        flattened[portfolioName] = portfoliosData.portfolios[portfolioName];
      }
    });

    return flattened;
  }
  // Old structure (no normalization) - return as-is
  return portfoliosData;
};

const PORTFOLIOS = getFlattenedPortfolios();

// Get all unique stocks from portfolios
const getAllStocks = () => {
  const allStocksSet = new Set();
  Object.values(PORTFOLIOS).forEach((portfolio) => {
    Object.keys(portfolio).forEach((stock) => {
      // Skip special "cash_amount" key - it's not a stock ticker
      if (stock !== "cash_amount") {
        allStocksSet.add(stock);
      }
    });
  });
  return Array.from(allStocksSet).sort();
};

const VALID_STOCKS = new Set(getAllStocks());

// Paths
const STOCKS_FILE = path.join(__dirname, "..", "public", "data", "stocks.json");

const main = () => {
  console.log(
    "Cleaning up stocks.json to only include stocks from portfolios..."
  );
  console.log(`Valid stocks: ${Array.from(VALID_STOCKS).sort().join(", ")}`);

  if (!fs.existsSync(STOCKS_FILE)) {
    console.error(`Error: ${STOCKS_FILE} does not exist`);
    process.exit(1);
  }

  // Read existing stocks.json
  const data = JSON.parse(fs.readFileSync(STOCKS_FILE, "utf8"));
  const existingStocks = Object.keys(data.stocks || {});

  console.log(`\nExisting stocks in file: ${existingStocks.sort().join(", ")}`);

  // Filter stocks
  const cleanedStocks = {};
  const removedStocks = [];

  Object.keys(data.stocks || {}).forEach((symbol) => {
    if (VALID_STOCKS.has(symbol)) {
      cleanedStocks[symbol] = data.stocks[symbol];
    } else {
      removedStocks.push(symbol);
    }
  });

  // Save cleaned data
  const output = {
    lastUpdated: data.lastUpdated || new Date().toISOString(),
    stocks: cleanedStocks,
  };

  fs.writeFileSync(STOCKS_FILE, JSON.stringify(output, null, 2));

  console.log(`\n✓ Cleanup complete!`);
  console.log(`  Kept ${Object.keys(cleanedStocks).length} stocks`);
  if (removedStocks.length > 0) {
    console.log(
      `  Removed ${removedStocks.length} stocks: ${removedStocks.join(", ")}`
    );
  }

  // Warn about missing stocks
  const missingStocks = Array.from(VALID_STOCKS).filter(
    (symbol) => !cleanedStocks[symbol]
  );
  if (missingStocks.length > 0) {
    console.log(
      `  ⚠ Missing stocks (need to fetch): ${missingStocks.join(", ")}`
    );
  }
};

main();
