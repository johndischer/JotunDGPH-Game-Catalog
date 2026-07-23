# Google Sheets and Apps Script setup

## Required tabs

- `Game Details`
- `Game Library`
- `PS5 - Trophy`
- `PS5 - Non-Trophy`
- `PS4 - Trophy`
- `PS4 - Non-Trophy`

## Game Details

Data starts on row 2.

| Column | Value |
|---|---|
| A | Game Title |
| B | Game ID |
| C | Category |
| D | Platform Support |
| E | Non-Trophy slot limit |
| F | Aliases |
| G | Cover Filename |
| H | Minimum Initial Rent (Days) |

## Availability tabs

Data starts on row 3 and all four tabs use the same columns.

| Column | Value |
|---|---|
| A | Game Title, with optional category or Initial Rent suffix |
| B | Availability status |
| C | Current renter's number of days remaining |

The script converts Column C into a public return date using the spreadsheet time zone:

- `0` means today
- `1` means tomorrow
- `7` means seven calendar days from today
- Output format: `MMM/DD`, for example `Jul 30`

Column C is ignored whenever the slot is `AVAILABLE`. Negative values caused by invalid formulas are also ignored.

## Deploying Apps Script

1. Open Extensions → Apps Script from the catalog spreadsheet.
2. Replace `Code.gs` with the repository file at `apps-script/Code.gs`.
3. Run `previewCatalog` and authorize the script.
4. Review the execution log for warnings.
5. Run `testSharedNonTrophyAggregation`.
6. Deploy → Manage deployments → edit the existing Web app deployment, or create a new Web app deployment.
7. Execute as: Me.
8. Who has access: Anyone.
9. Copy the `/exec` URL into `src/config.js`.
