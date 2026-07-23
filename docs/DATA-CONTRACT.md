# Live catalog data contract

The website is built for the supplied Google Apps Script endpoint in `apps-script/Code.gs`.

The endpoint returns:

```json
{
  "ok": true,
  "demo": false,
  "lastUpdated": "2026-07-23T10:00:00.000Z",
  "warnings": [],
  "games": []
}
```

Each game contains its permanent details and platform-specific slot summaries:

```json
{
  "id": "JG-0001",
  "title": "007 First Light",
  "category": "Premium",
  "aliases": "007",
  "coverFile": "JG-001.png",
  "minimumInitialRentDays": 7,
  "nonTrophySlotLimit": 1,
  "platforms": {
    "PS5": {
      "trophy": {
        "status": "NOT_AVAILABLE",
        "availableCount": 0,
        "totalCount": 3,
        "expectedReturn": "Jul 30",
        "daysUntilAvailable": 7
      },
      "nonTrophy": {
        "status": "AVAILABLE",
        "availableCount": 1,
        "totalCount": 1,
        "expectedReturn": "",
        "daysUntilAvailable": null
      }
    }
  }
}
```

Recognized API statuses are:

- `AVAILABLE`
- `NOT_AVAILABLE`
- `AWAITING_DEACTIVATION`
- `MAINTENANCE`

For multiple copies, an available copy wins. When every copy is unavailable, the earliest valid return is displayed. Negative or invalid day values are ignored.

## Minimum initial rent

`Game Details` column H is published as `minimumInitialRentDays`. When the value is greater than zero, the game card displays a highlighted requirement such as **7 Days Initial Rent**. Blank or zero values display no initial-rent badge.
