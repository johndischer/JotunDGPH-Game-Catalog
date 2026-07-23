# Deployment checklist

- [ ] Extract the repository ZIP.
- [ ] Paste `apps-script/Code.gs` into the spreadsheet-bound Apps Script project.
- [ ] Run `previewCatalog`.
- [ ] Run `testSharedNonTrophyAggregation`.
- [ ] Deploy Apps Script as a Web app accessible to anyone.
- [ ] Paste the `/exec` URL into `src/config.js`.
- [ ] Upload covers to `public/covers` using the exact filenames in Game Details Column G.
- [ ] Upload the repository contents to GitHub.
- [ ] Create a Cloudflare Worker connected to GitHub.
- [ ] Build command: `npm run build`.
- [ ] Deploy command: `npx wrangler deploy`.
- [ ] Test `/` and `/catalog/`.
- [ ] Test PS5 and PS4 filters separately.
- [ ] Test Trophy and Non-Trophy filters separately.
- [ ] Confirm unavailable slots show the earliest return date as `MMM/DD`.
- [ ] Confirm negative day values do not show a false return date.
