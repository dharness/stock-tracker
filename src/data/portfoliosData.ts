// Portfolio groupings for different people with dollar amounts invested
// Each person has invested $100,000 total across their stocks
// This file imports from portfoliosData.json as the single source of truth
import portfoliosData from "./portfoliosData.json";

export const PORTFOLIOS = portfoliosData as {
  [person: string]: {
    [symbol: string]: number;
  };
};
