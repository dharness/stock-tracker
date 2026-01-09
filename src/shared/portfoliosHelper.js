// Shared helper for flattening portfolios from normalized structure
// Can be used by both Node.js scripts and TypeScript/React app

/**
 * Flattens portfolios from normalized structure for a specific group
 * @param {Object} portfoliosData - The portfoliosData.json object
 * @param {string} groupName - The group name to use (defaults to "default")
 * @returns {Object} Flattened portfolios object
 */
const getFlattenedPortfolios = (portfoliosData, groupName = "default") => {
  // Check if normalized structure (with portfolios and portfolioGroups)
  if (portfoliosData.portfolios && portfoliosData.portfolioGroups) {
    // Use the specified group, or "default" if it doesn't exist
    const targetGroup = portfoliosData.portfolioGroups[groupName]
      ? [groupName]
      : portfoliosData.portfolioGroups.default
      ? ["default"]
      : Object.keys(portfoliosData.portfolioGroups);

    // Collect all unique portfolio names from the groups
    const portfolioNames = new Set();
    targetGroup.forEach((gName) => {
      const group = portfoliosData.portfolioGroups[gName];
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

/**
 * Gets all unique stock symbols from portfolios (excluding cash_amount)
 * @param {Object} portfolios - Flattened portfolios object
 * @returns {Array<string>} Sorted array of stock symbols
 */
const getAllStocks = (portfolios) => {
  const allStocksSet = new Set();
  Object.values(portfolios).forEach((portfolio) => {
    Object.keys(portfolio).forEach((stock) => {
      // Skip special "cash_amount" key - it's not a stock ticker
      if (stock !== "cash_amount") {
        allStocksSet.add(stock);
      }
    });
  });
  return Array.from(allStocksSet).sort();
};

module.exports = {
  getFlattenedPortfolios,
  getAllStocks,
};

