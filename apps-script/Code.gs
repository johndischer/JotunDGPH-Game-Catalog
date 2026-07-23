/**
 * JotunDGPH public catalog endpoint for the Command Glass website.
 * Revision: 2026-07-23 duplicate-row aggregation + initial-rent display support.
 *
 * "Game Details" contains one permanent row per unique game. The four
 * availability tabs contain only public slot status and the live number of
 * days until the slot is expected to return.
 *
 * Do not put renter names, contact details, PSN credentials, passwords, or
 * payment notes in any column read by this script.
 */
const JOTUN_CATALOG_CONFIG = Object.freeze({
  MASTER_TAB: "Game Details",
  MASTER_FIRST_DATA_ROW: 2,
  MASTER_COLUMNS: Object.freeze({
    GAME_TITLE: 1,
    GAME_ID: 2,
    CATEGORY: 3,
    PLATFORM_SUPPORT: 4,
    NON_TROPHY_SLOT_LIMIT: 5,
    ALIASES: 6,
    COVER_FILE: 7,
    MINIMUM_INITIAL_RENT_DAYS: 8,
  }),

  AVAILABILITY_FIRST_DATA_ROW: 3,
  AVAILABILITY_COLUMNS: Object.freeze({
    GAME_TITLE: 1,
    STATUS: 2,
    DAYS_UNTIL_AVAILABLE: 3,
  }),

  TABS: Object.freeze([
    { name: "PS5 - Trophy", platform: "PS5", slot: "trophy" },
    { name: "PS5 - Non-Trophy", platform: "PS5", slot: "nonTrophy" },
    { name: "PS4 - Trophy", platform: "PS4", slot: "trophy" },
    { name: "PS4 - Non-Trophy", platform: "PS4", slot: "nonTrophy" },
  ]),
});

function doGet() {
  try {
    const payload = buildPublicCatalog_();
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error(error);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "Catalog generation failed." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Run this from Apps Script before deploying a new web-app version. */
function previewCatalog() {
  const payload = buildPublicCatalog_();
  console.log(JSON.stringify({
    count: payload.games.length,
    warnings: payload.warnings,
    firstFive: payload.games.slice(0, 5),
  }, null, 2));
}

/**
 * Optional self-test. Run this once before deployment.
 * It must log: Shared Non-Trophy aggregation test passed.
 */
function testSharedNonTrophyAggregation() {
  const summary = newSlotSummary_();
  addCopy_(summary, "NOT_AVAILABLE", 2, "Jul 25");
  addCopy_(summary, "AVAILABLE", null, "");

  const result = finalizeSlot_(summary);
  result.availableCount = Math.min(1, result.availableCount);
  result.totalCount = Math.min(1, result.totalCount);

  if (
    result.status !== "AVAILABLE"
    || result.availableCount !== 1
    || result.totalCount !== 1
  ) {
    throw new Error(
      "Shared Non-Trophy aggregation failed: " + JSON.stringify(result),
    );
  }

  console.log("Shared Non-Trophy aggregation test passed.");
}

function buildPublicCatalog_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("This Apps Script must be attached to the catalog spreadsheet.");
  }

  const warnings = [];
  const catalog = readGameDetails_(spreadsheet, warnings);
  const spreadsheetTimeZone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone();

  JOTUN_CATALOG_CONFIG.TABS.forEach(function (tabConfig) {
    const sheet = spreadsheet.getSheetByName(tabConfig.name);
    if (!sheet) throw new Error("Missing required tab: " + tabConfig.name);
    readAvailabilityTab_(
      sheet,
      tabConfig,
      catalog.gamesById,
      catalog.gameIdByTitleKey,
      spreadsheetTimeZone,
      warnings,
    );
  });

  const games = Object.keys(catalog.gamesById)
    .map(function (gameId) {
      return finalizeGame_(catalog.gamesById[gameId]);
    })
    .sort(function (a, b) {
      return a.title.localeCompare(b.title);
    });

  return {
    ok: true,
    demo: false,
    lastUpdated: new Date().toISOString(),
    warnings: warnings,
    games: games,
  };
}

function readGameDetails_(spreadsheet, warnings) {
  const sheet = spreadsheet.getSheetByName(JOTUN_CATALOG_CONFIG.MASTER_TAB);
  if (!sheet) throw new Error("Missing required tab: " + JOTUN_CATALOG_CONFIG.MASTER_TAB);

  const lastRow = sheet.getLastRow();
  const gamesById = {};
  const gameIdByTitleKey = {};
  if (lastRow < JOTUN_CATALOG_CONFIG.MASTER_FIRST_DATA_ROW) {
    return { gamesById: gamesById, gameIdByTitleKey: gameIdByTitleKey };
  }

  const columns = JOTUN_CATALOG_CONFIG.MASTER_COLUMNS;
  const columnCount = Math.max.apply(null, Object.keys(columns).map(function (key) {
    return columns[key];
  }));
  const rowCount = lastRow - JOTUN_CATALOG_CONFIG.MASTER_FIRST_DATA_ROW + 1;
  const values = sheet
    .getRange(JOTUN_CATALOG_CONFIG.MASTER_FIRST_DATA_ROW, 1, rowCount, columnCount)
    .getDisplayValues();

  values.forEach(function (row, index) {
    const rowNumber = JOTUN_CATALOG_CONFIG.MASTER_FIRST_DATA_ROW + index;
    const title = cleanDisplayTitle_(cell_(row, columns.GAME_TITLE));
    const gameId = cleanGameId_(cell_(row, columns.GAME_ID));
    const rawCategory = cell_(row, columns.CATEGORY);
    const rawPlatformSupport = cell_(row, columns.PLATFORM_SUPPORT);
    const rawSlotLimit = cell_(row, columns.NON_TROPHY_SLOT_LIMIT);

    if (!title && !gameId && !rawCategory && !rawPlatformSupport && !rawSlotLimit) return;

    const category = normalizeCategory_(rawCategory);
    const supportedPlatforms = normalizePlatformSupport_(rawPlatformSupport);
    const nonTrophySlotLimit = normalizeSlotLimit_(rawSlotLimit);
    const missingFields = [];
    if (!title) missingFields.push("Game Title");
    if (!gameId) missingFields.push("Game ID");
    if (!category) missingFields.push("Category");
    if (!supportedPlatforms.length) missingFields.push("Platform Support");
    if (!nonTrophySlotLimit) missingFields.push("Non-Trophy Slot Limit");

    // Incomplete rows are intentionally hidden while the master list is being
    // filled in gradually.
    if (missingFields.length) {
      warnings.push(
        "Game Details row " + rowNumber + " is not published yet; complete "
        + missingFields.join(", ") + ".",
      );
      return;
    }

    if (gamesById[gameId]) {
      warnings.push("Duplicate Game ID ignored in Game Details row " + rowNumber + ": " + gameId);
      return;
    }

    const titleKey = normalizeTitleKey_(title);
    if (gameIdByTitleKey[titleKey]) {
      warnings.push(
        "Duplicate Game Title ignored in Game Details row " + rowNumber + ": " + title,
      );
      return;
    }

    const platforms = {};
    supportedPlatforms.forEach(function (platform) {
      platforms[platform] = {
        trophy: newSlotSummary_(),
        nonTrophy: newSlotSummary_(),
      };
    });

    gamesById[gameId] = {
      id: gameId,
      title: title,
      category: category,
      aliases: cell_(row, columns.ALIASES),
      coverFile: safeCoverFile_(cell_(row, columns.COVER_FILE)),
      coverUrl: "",
      minimumInitialRentDays: normalizeNonNegativeInteger_(
        cell_(row, columns.MINIMUM_INITIAL_RENT_DAYS),
      ),
      nonTrophySlotLimit: nonTrophySlotLimit,
      supportedPlatforms: supportedPlatforms,
      platforms: platforms,
      sharedNonTrophy: newSlotSummary_(),
    };

    gameIdByTitleKey[titleKey] = gameId;
  });

  return {
    gamesById: gamesById,
    gameIdByTitleKey: gameIdByTitleKey,
  };
}

function readAvailabilityTab_(
  sheet,
  tabConfig,
  gamesById,
  gameIdByTitleKey,
  spreadsheetTimeZone,
  warnings,
) {
  const lastRow = sheet.getLastRow();
  if (lastRow < JOTUN_CATALOG_CONFIG.AVAILABILITY_FIRST_DATA_ROW) return;

  const columns = JOTUN_CATALOG_CONFIG.AVAILABILITY_COLUMNS;
  const columnCount = Math.max.apply(null, Object.keys(columns).map(function (key) {
    return columns[key];
  }));
  const rowCount = lastRow - JOTUN_CATALOG_CONFIG.AVAILABILITY_FIRST_DATA_ROW + 1;
  const values = sheet
    .getRange(JOTUN_CATALOG_CONFIG.AVAILABILITY_FIRST_DATA_ROW, 1, rowCount, columnCount)
    .getDisplayValues();

  values.forEach(function (row, index) {
    const rowNumber = JOTUN_CATALOG_CONFIG.AVAILABILITY_FIRST_DATA_ROW + index;
    const sourceTitle = cell_(row, columns.GAME_TITLE);
    if (!sourceTitle) return;

    const gameId = gameIdByTitleKey[normalizeTitleKey_(sourceTitle)];
    const game = gameId ? gamesById[gameId] : null;
    if (!game) {
      warnings.push(
        tabConfig.name + " row " + rowNumber
        + " does not match a completed Game Details title: " + sourceTitle,
      );
      return;
    }
    if (game.supportedPlatforms.indexOf(tabConfig.platform) === -1) {
      warnings.push(
        tabConfig.name + " row " + rowNumber
        + " conflicts with Platform Support for " + game.id + ".",
      );
      return;
    }

    const status = normalizeStatus_(cell_(row, columns.STATUS));
    const daysUntilAvailable = status === "NOT_AVAILABLE"
      ? normalizeDaysUntilAvailable_(cell_(row, columns.DAYS_UNTIL_AVAILABLE))
      : null;
    const expectedReturn = status === "NOT_AVAILABLE"
      ? formatExpectedReturn_(daysUntilAvailable, spreadsheetTimeZone)
      : "";

    if (tabConfig.slot === "nonTrophy" && game.nonTrophySlotLimit === 1) {
      // Read every matching row before resolving the shared slot. This lets an
      // AVAILABLE copy win even when an earlier duplicate row is unavailable.
      addCopy_(game.sharedNonTrophy, status, daysUntilAvailable, expectedReturn);
      return;
    }

    addCopy_(
      game.platforms[tabConfig.platform][tabConfig.slot],
      status,
      daysUntilAvailable,
      expectedReturn,
    );
  });
}

function finalizeGame_(game) {
  const sharedSlot = finalizeSlot_(game.sharedNonTrophy);
  if (game.nonTrophySlotLimit === 1) {
    // Multiple source rows contribute to the status calculation, but this game
    // still exposes only one shared Non-Trophy slot to the catalog.
    sharedSlot.availableCount = Math.min(1, sharedSlot.availableCount);
    sharedSlot.totalCount = Math.min(1, sharedSlot.totalCount);
  }
  Object.keys(game.platforms).forEach(function (platform) {
    game.platforms[platform].trophy = finalizeSlot_(game.platforms[platform].trophy);
    game.platforms[platform].nonTrophy = game.nonTrophySlotLimit === 1
      ? cloneObject_(sharedSlot)
      : finalizeSlot_(game.platforms[platform].nonTrophy);
  });

  return {
    id: game.id,
    title: game.title,
    category: game.category,
    aliases: game.aliases,
    coverFile: game.coverFile,
    coverUrl: game.coverUrl,
    minimumInitialRentDays: game.minimumInitialRentDays,
    nonTrophySlotLimit: game.nonTrophySlotLimit,
    platforms: game.platforms,
  };
}

function newSlotSummary_() {
  return {
    availableCount: 0,
    totalCount: 0,
    statusCounts: {},
    expectedReturns: [],
  };
}

function addCopy_(summary, status, daysUntilAvailable, expectedReturn) {
  summary.totalCount += 1;
  summary.statusCounts[status] = (summary.statusCounts[status] || 0) + 1;
  if (status === "AVAILABLE") summary.availableCount += 1;
  if (status === "NOT_AVAILABLE" && daysUntilAvailable !== null) {
    summary.expectedReturns.push({
      days: daysUntilAvailable,
      label: expectedReturn,
    });
  }
}

function finalizeSlot_(summary) {
  if (!summary || summary.totalCount === 0) {
    return {
      status: "NOT_AVAILABLE",
      availableCount: 0,
      totalCount: 0,
      expectedReturn: "",
      daysUntilAvailable: null,
    };
  }

  let status = "NOT_AVAILABLE";
  if (summary.availableCount > 0) {
    status = "AVAILABLE";
  } else if (summary.statusCounts.NOT_AVAILABLE) {
    status = "NOT_AVAILABLE";
  } else if (summary.statusCounts.AWAITING_DEACTIVATION) {
    status = "AWAITING_DEACTIVATION";
  } else if (summary.statusCounts.MAINTENANCE) {
    status = "MAINTENANCE";
  }

  summary.expectedReturns.sort(function (a, b) {
    return a.days - b.days;
  });
  const earliestReturn = summary.expectedReturns[0] || null;

  return {
    status: status,
    availableCount: summary.availableCount,
    totalCount: summary.totalCount,
    expectedReturn: status === "NOT_AVAILABLE" && earliestReturn ? earliestReturn.label : "",
    daysUntilAvailable: status === "NOT_AVAILABLE" && earliestReturn ? earliestReturn.days : null,
  };
}

function normalizeStatus_(value) {
  const status = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (status === "AVAILABLE" || status === "AVAILABLE_NOW") return "AVAILABLE";
  if (status.indexOf("AWAIT") !== -1 || status.indexOf("DEACTIV") !== -1) {
    return "AWAITING_DEACTIVATION";
  }
  if (
    status.indexOf("MAINT") !== -1
    || status.indexOf("REPAIR") !== -1
    || status.indexOf("DISABLED") !== -1
  ) {
    return "MAINTENANCE";
  }
  return "NOT_AVAILABLE";
}

function normalizePlatformSupport_(value) {
  const platform = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (platform === "PS5 ONLY" || platform === "PS5") return ["PS5"];
  if (platform === "PS4 ONLY" || platform === "PS4") return ["PS4"];
  if (platform === "PS4 & PS5" || platform === "PS5 & PS4" || platform === "BOTH") {
    return ["PS5", "PS4"];
  }
  return [];
}

function normalizeSlotLimit_(value) {
  const slotLimit = Number(String(value || "").trim());
  return slotLimit === 1 || slotLimit === 2 ? slotLimit : 0;
}

function normalizeCategory_(value) {
  const category = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (category === "premium") return "Premium";
  if (category === "classic") return "Classic";
  if (category === "premium / classic" || category === "premium/classic") {
    return "Premium / Classic";
  }
  return "";
}

function normalizeNonNegativeInteger_(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function normalizeDaysUntilAvailable_(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const number = Number(raw.replace(/,/g, ""));

  // Ignore invalid negative values from blank or broken date formulas rather
  // than publishing a misleading return date.
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.ceil(number);
}

function formatExpectedReturn_(daysUntilAvailable, spreadsheetTimeZone) {
  if (daysUntilAvailable === null) return "";

  // Anchor to the spreadsheet's local calendar date so the public date does
  // not move a day because of Apps Script server time-zone differences.
  const todayLocal = Utilities.formatDate(new Date(), spreadsheetTimeZone, "yyyy-MM-dd");
  const parts = todayLocal.split("-").map(Number);
  const expectedDateUtc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  expectedDateUtc.setUTCDate(expectedDateUtc.getUTCDate() + daysUntilAvailable);

  // Example: Jul 30. A value of 0 means today; 1 means tomorrow.
  return Utilities.formatDate(expectedDateUtc, "UTC", "MMM d");
}

function cleanDisplayTitle_(value) {
  return String(value || "")
    .replace(/\s*\*+\s*Initial Rent\s*-\s*Wait List\s*\*+\s*/ig, " ")
    .replace(/\s*-\s*(Premium\s*\/\s*Classic|Premium|Classic)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitleKey_(value) {
  let normalized = cleanDisplayTitle_(value).toLowerCase();
  if (typeof normalized.normalize === "function") {
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return normalized
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGameId_(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "-");
}

function safeCoverFile_(value) {
  const file = String(value || "").trim();
  return /^[a-z0-9][a-z0-9._() -]*\.(webp|jpg|jpeg|png)$/i.test(file) ? file : "";
}

function cell_(row, oneBasedColumn) {
  return String(row[oneBasedColumn - 1] || "").trim();
}

function cloneObject_(value) {
  return JSON.parse(JSON.stringify(value));
}
