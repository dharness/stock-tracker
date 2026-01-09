// Portfolio groupings for different people with dollar amounts invested
// Each person has invested $100,000 total across their stocks
// This file imports from portfoliosData.json as the single source of truth
// The JSON structure supports normalized portfolios and portfolio groups that reference them
import portfoliosData from "./portfoliosData.json";
// Import shared helper logic (TypeScript can import .js files)
const portfoliosHelper = require("../shared/portfoliosHelper");

// Flatten the normalized structure to maintain backward compatibility with UI
// Accepts a group name parameter (defaults to "default")
export const getFlattenedPortfolios = (
  groupName: string = "default"
): {
  [person: string]: {
    [symbol: string]: number;
  };
} => {
  // Use the shared helper function
  return portfoliosHelper.getFlattenedPortfolios(portfoliosData, groupName) as {
    [person: string]: {
      [symbol: string]: number;
    };
  };
};

// Export a function to get PORTFOLIOS for a specific group
export const getPortfolios = (groupName: string = "default") => {
  return getFlattenedPortfolios(groupName);
};

// Default export for backward compatibility (uses "default" group)
export const PORTFOLIOS = getFlattenedPortfolios("default");
