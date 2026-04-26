# Stock Tracker — Notes for Claude

## Running locally
```
npm start        # dev server at localhost:3000
npm run update-stocks  # refresh stock data (or: bash scripts/run.sh)
```

## How stock data works
- `scripts/update_stocks.js` fetches all stocks and writes `public/data/stocks.json`
- GitHub Actions runs this daily (`.github/workflows/daily_update.yml`), commits the JSON, then builds and deploys to GitHub Pages
- The JSON must be committed to the repo — it's served as a static file from GitHub Pages

## Data sources (in priority order)
1. **Massive API** (`scripts/massiveStockFetcher.js`) — primary source for all regular stocks. API key is hardcoded in the file.
2. **Stooq** (`update_stocks.js`) — fallback only if `STOOQ_API_KEY` is set in `.env`. Stooq now requires an API key (get one at `https://stooq.com/q/d/?s=NVDA.US&get_apikey` via captcha). Key expires after a few days with no programmatic way to check expiry.
3. **CoinGecko / CryptoCompare** (`scripts/cryptoFetcher.js`) — used for `CRYPTO:BTC`, `CRYPTO:SOL` and any `CRYPTO:` prefixed tickers

## Gotchas
- Massive API rate-limits at ~1 req/5s — `DELAY_BETWEEN_REQUESTS_MS = 5000` handles this
- Stooq returning "Get your apikey" text instead of CSV causes a CSV parse error, not an empty result — fallback must catch errors, not just check `data.length === 0`
- GitHub Actions has no `STOOQ_API_KEY` secret set, so Stooq will always be skipped in CI

## Adding new stocks
Edit `src/data/portfoliosData.json` — the update script reads all tickers from all portfolio groups automatically.

## Iterating on the update script
Use `scripts/run.sh` as a scratch runner — edit it, run `bash scripts/run.sh`, repeat.
