// Portfolio groupings for different people with dollar amounts invested
// Each person has invested $100,000 total across their stocks
// This file imports from portfoliosData.json as the single source of truth
// The JSON structure supports normalized portfolios and portfolio groups that reference them
import portfoliosData from "./portfoliosData.json";

interface NormalizedPortfolioData {
  portfolios: {
    [person: string]: {
      [symbol: string]: number;
    };
  };
  portfolioGroups: {
    [groupName: string]: string[]; // Array of portfolio/user names
  };
}

// Flatten the normalized structure to maintain backward compatibility with UI
// Accepts a group name parameter (defaults to "default")
export const getFlattenedPortfolios = (
  groupName: string = "default"
): {
  [person: string]: {
    [symbol: string]: number;
  };
} => {
  const data = portfoliosData as
    | NormalizedPortfolioData
    | {
        [person: string]: {
          [symbol: string]: number;
        };
      };

  // Check if new normalized structure (with portfolios and portfolioGroups)
  if ("portfolios" in data && "portfolioGroups" in data) {
    const normalized = data as NormalizedPortfolioData;

    // Use the specified group, or "default" if it doesn't exist
    const targetGroup = normalized.portfolioGroups[groupName]
      ? [groupName]
      : normalized.portfolioGroups.default
      ? ["default"]
      : Object.keys(normalized.portfolioGroups);

    // Collect all unique portfolio names from the groups
    const portfolioNames = new Set<string>();
    targetGroup.forEach((gName) => {
      const group = normalized.portfolioGroups[gName];
      if (Array.isArray(group)) {
        group.forEach((portfolioName) => portfolioNames.add(portfolioName));
      }
    });

    // Build flattened object from normalized portfolios
    const flattened: { [person: string]: { [symbol: string]: number } } = {};
    portfolioNames.forEach((portfolioName) => {
      if (normalized.portfolios[portfolioName]) {
        flattened[portfolioName] = normalized.portfolios[portfolioName];
      }
    });

    return flattened;
  }

  // Old structure (no normalization) - return as-is
  return data as {
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
