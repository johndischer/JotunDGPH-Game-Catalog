# Start Here — Cloudflare Worker

## 1. Prepare the Google Apps Script endpoint

The final compatible script is included at:

```text
apps-script/Code.gs
```

Follow `docs/GOOGLE-SHEETS-SETUP.md`, deploy it as a Web app, and copy the URL ending in `/exec`.

## 2. Connect the website to the endpoint

Open `src/config.js` and paste the `/exec` URL into `apiUrl`.

## 3. Upload to GitHub

Upload the **contents of this folder** to the root of a new GitHub repository.

## 4. Create the Cloudflare Worker

Go to **Workers & Pages → Create application → Continue with GitHub** and select the repository.

Use:

- Project/Worker name: `jotundgph-command-glass-catalog`
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: leave blank

The Worker name must match the `name` in `wrangler.jsonc`.

## 5. Test

Confirm that:

- Games load from `Game Details`.
- PS4 and PS5 filters use their corresponding availability tabs.
- Trophy and Non-Trophy remain separate.
- Any available copy makes the slot available.
- Unavailable slots show `Available MMM/DD`, such as `Available Jul 30`.
- Mixed cover extensions (`.png`, `.jpg`, `.jpeg`, `.webp`) load from `public/covers`.
