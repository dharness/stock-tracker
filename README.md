# Stock Tracker

A React-based stock portfolio tracker that visualizes stock performance and portfolio values over time. The app displays data for multiple portfolios and individual stocks with interactive charts and year-to-date growth tables.

## Features

- 📊 **Portfolio Charts**: Visualize total portfolio values for each person over time
- 📈 **Stock Charts**: View individual stock performance on a combined chart
- 📋 **YTD Growth Tables**: See month-to-month year-to-date growth for portfolios and stocks
- 📅 **Year Selection**: Switch between different years (2025, 2026)
- 💾 **Local Storage**: Data is cached locally for faster loading
- 🔄 **Auto-Update**: GitHub Actions automatically fetches fresh stock data daily

## Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run the development server**:

   ```bash
   npm start
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## Deployment to GitHub Pages

This app is configured to deploy to GitHub Pages. Follow these steps:

### Initial Setup (One-time)

1. **Install the gh-pages package** (if not already installed):

   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update the homepage URL** in `package.json`:

   - If your repository is `username/stock-tracker`, the homepage should be:
     ```json
     "homepage": "https://username.github.io/stock-tracker"
     ```
   - The homepage field is already configured in this repo.

3. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Under "Source", select "Deploy from a branch"
   - Choose the `gh-pages` branch and `/ (root)` folder
   - Click Save

### Building and Deploying

**To deploy to GitHub Pages, run**:

```bash
npm run deploy
```

This command will:

1. Build the production-ready app (`npm run build`)
2. Deploy the `build` folder to the `gh-pages` branch
3. Make your site available at `https://username.github.io/stock-tracker`

**Note**: The `npm run deploy` command automatically runs `npm run build` first (via the `predeploy` script), so you don't need to build separately.

### Manual Build (if needed)

If you want to build without deploying:

```bash
npm run build
```

The built files will be in the `build/` directory, ready to be served by any static hosting service.

## Data Updates

Stock data is automatically updated daily via GitHub Actions:

- The workflow runs at 00:00 UTC every day
- It fetches data using the Stooq API
- Updates are committed to the `main` branch
- The app loads data from `public/data/stocks.json`

## Project Structure

```
stock-tracker/
├── src/
│   ├── components/       # React components (charts, tables)
│   ├── data/            # Portfolio definitions
│   ├── services/        # Data fetching and storage services
│   └── App.tsx          # Main application component
├── scripts/             # Data update scripts
│   ├── update_stocks_stooq.js
│   └── update_stocks.js
├── public/
│   └── data/
│       └── stocks.json  # Stock data (auto-updated)
└── .github/
    └── workflows/
        └── daily_update.yml  # GitHub Actions workflow
```

## Technologies

- **React** - UI framework
- **TypeScript** - Type safety
- **Recharts** - Chart visualization
- **Stooq API** - Stock data source
- **GitHub Actions** - Automated data updates
- **GitHub Pages** - Hosting

## License

Private project
