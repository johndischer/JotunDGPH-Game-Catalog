# JotunDGPH Command Glass Catalog — Worker + Live Google Sheets

This repository recreates the Command Glass rental catalog for Cloudflare Workers Static Assets and is now wired to the exact Google Sheets/API structure supplied for JotunDGPH.

The compatible spreadsheet-bound Apps Script is included in `apps-script/Code.gs`. Unavailable slots convert the renter's remaining days into the earliest public return date in `MMM/DD` format.

## Why Workers

Cloudflare Workers can serve the compiled HTML, CSS, JavaScript, and covers as static assets. The same project can later be expanded with Worker-side API routes, caching, CORS handling, authentication, or other server logic without moving to a different Cloudflare product.

## Configure live data

Edit `src/config.js`:

```js
apiUrl: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
```

Keep private credentials out of browser-side source. The URL used here must be a public, read-only catalog endpoint.

## Local commands

```bash
npm install
npm run build
npm run preview
```

To test through the Workers runtime:

```bash
npm run worker:dev
```

To deploy from a logged-in local machine:

```bash
npm run deploy
```

## Cloudflare Git deployment

Use these settings:

```text
Worker name: jotundgph-command-glass-catalog
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: leave blank
```

The Worker name in Cloudflare must match `name` in `wrangler.jsonc`.

## Covers

Place cover files in:

```text
public/covers/
```

The filename must exactly match the catalog data, for example:

```text
JG-0001.webp
```

Every GitHub commit to the production branch triggers a new Cloudflare build and deployment.

### Initial-rent requirement

The website reads **Game Details column H**. A value such as `7` is displayed on that game's card as **7 Days Initial Rent**. Blank cells do not show a requirement.
