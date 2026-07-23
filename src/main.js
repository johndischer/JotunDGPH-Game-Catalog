import { SITE_CONFIG } from "./config.js";
import { SAMPLE_GAMES } from "./sample-data.js";

const state = {
  games: [],
  filteredGames: [],
  loading: true,
  demoMode: false,
  lastSync: null,
  filters: { availability: "all", platform: "all", category: "all", slot: "all" },
  search: "",
  sort: "availability"
};

const FILTER_GROUPS = [
  { key: "availability", label: "Availability", options: [["all", "All Games"], ["available", "Available"]] },
  { key: "platform", label: "Platform", options: [["all", "All Platforms"], ["PS5", "PS5"], ["PS4", "PS4"]] },
  { key: "category", label: "Category", options: [["all", "All Categories"], ["Premium", "Premium"], ["Classic", "Classic"]] },
  { key: "slot", label: "Slot Type", options: [["all", "All Slots"], ["trophy", "Trophy"], ["nonTrophy", "Non-Trophy"]] }
];

const STATUS_LABELS = {
  available: "Available",
  unavailable: "Not Available",
  "awaiting deactivation": "Awaiting Deactivation",
  maintenance: "Maintenance"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  list: $("#game-list"),
  resultCount: $("#result-count"),
  syncStatus: $("#sync-status"),
  empty: $("#empty-state"),
  search: $("#search-input"),
  sort: $("#sort-select"),
  desktopFilters: $("#desktop-filters"),
  mobileFilters: $("#mobile-filters"),
  pills: $("#active-filter-pills"),
  filterCount: $("#active-filter-count"),
  dialog: $("#filter-dialog"),
  toast: $("#toast"),
  banner: $("#mode-banner"),
  subtitle: $("#hero-subtitle")
};

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value === null || value === undefined || value === "") return [];
  return String(value).split(/[,|/]+/).map((item) => item.trim()).filter(Boolean);
}

function firstValue(source, keys, fallback = "") {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
  }
  return fallback;
}

function normalizeStatus(raw) {
  if (raw && typeof raw === "object") {
    return {
      status: normalizeStatusText(firstValue(raw, ["status", "availability", "state"], "unavailable")),
      availableDate: firstValue(raw, ["expectedReturn", "availableDate", "returnDate", "expectedDate", "date"], ""),
      daysUntilAvailable: firstValue(raw, ["daysUntilAvailable", "daysRemaining"], null),
      availableCount: Number(firstValue(raw, ["availableCount"], 0)) || 0,
      totalCount: Number(firstValue(raw, ["totalCount"], 0)) || 0
    };
  }
  return {
    status: normalizeStatusText(raw),
    availableDate: "",
    daysUntilAvailable: null,
    availableCount: 0,
    totalCount: 0
  };
}

function normalizeStatusText(raw) {
  const value = normalizeText(raw || "unavailable");
  if (["available", "yes", "open", "free", "1", "true"].includes(value)) return "available";
  if (value.includes("await") || value.includes("deactiv")) return "awaiting deactivation";
  if (value.includes("maint")) return "maintenance";
  return "unavailable";
}

function normalizeGame(raw, index) {
  const id = String(firstValue(raw, ["id", "gameId", "gameID", "Game ID", "GameId"], `JG-${String(index + 1).padStart(4, "0")}`));
  const title = String(firstValue(raw, ["title", "gameTitle", "name", "Game Title", "Game"], `Untitled Game ${index + 1}`));
  const categories = arrayValue(firstValue(raw, ["category", "categories", "plan", "eligibility", "Category", "Plan"], "Classic"));
  const coverFilename = String(firstValue(raw, ["coverFilename", "cover", "image", "coverFile", "Cover Filename"], "")).trim();

  const rawPlatformData = firstValue(raw, ["platforms"], null);
  const availabilityByPlatform = {};
  let platforms = [];

  // Native output from the supplied Google Apps Script:
  // platforms.PS5.trophy / platforms.PS5.nonTrophy, and the same for PS4.
  if (rawPlatformData && typeof rawPlatformData === "object" && !Array.isArray(rawPlatformData)) {
    ["PS5", "PS4"].forEach((platform) => {
      const source = rawPlatformData[platform];
      if (!source || typeof source !== "object") return;
      platforms.push(platform);
      availabilityByPlatform[platform] = {
        trophy: normalizeStatus(source.trophy),
        nonTrophy: normalizeStatus(source.nonTrophy)
      };
    });
  } else {
    // Backward-compatible support for preview/sample data and older flat APIs.
    platforms = arrayValue(firstValue(raw, ["platforms", "platform", "console", "Platform", "Console"], "PS5"))
      .map((item) => item.toUpperCase())
      .filter((item) => item === "PS4" || item === "PS5");

    const trophyRaw = firstValue(raw, ["trophy", "trophySlot", "trophyAvailability", "Trophy Status"], "unavailable");
    const nonTrophyRaw = firstValue(raw, ["nonTrophy", "nonTrophySlot", "secondary", "nonTrophyAvailability", "Non-Trophy Status"], "unavailable");
    const trophy = normalizeStatus(trophyRaw);
    const nonTrophy = normalizeStatus(nonTrophyRaw);

    if (!trophy.availableDate) trophy.availableDate = firstValue(raw, ["trophyAvailableDate", "trophyReturnDate", "Trophy Available Date"], "");
    if (!nonTrophy.availableDate) nonTrophy.availableDate = firstValue(raw, ["nonTrophyAvailableDate", "nonTrophyReturnDate", "Non-Trophy Available Date"], "");

    (platforms.length ? platforms : ["PS5"]).forEach((platform) => {
      availabilityByPlatform[platform] = { trophy: { ...trophy }, nonTrophy: { ...nonTrophy } };
    });
  }

  platforms = [...new Set(platforms.length ? platforms : ["PS5"])];

  return {
    id,
    title,
    aliases: arrayValue(firstValue(raw, ["aliases", "alias", "searchAliases", "Aliases"], "")),
    platforms,
    category: categories.length ? categories : ["Classic"],
    coverFilename,
    minimumInitialRentDays: Number(firstValue(raw, ["minimumInitialRentDays"], 0)) || 0,
    nonTrophySlotLimit: Number(firstValue(raw, ["nonTrophySlotLimit"], 0)) || 0,
    availabilityByPlatform,
    updatedAt: firstValue(raw, ["updatedAt", "lastUpdated", "Updated At"], "")
  };
}

function extractGames(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : firstValue(payload, ["games", "data", "items", "catalog", "results"], []);
  if (!Array.isArray(candidates)) throw new Error("The API response does not contain a games array.");
  return candidates.map(normalizeGame).filter((game) => game.title);
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITE_CONFIG.requestTimeoutMs);
  try {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`API request failed (${response.status}).`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadGames({ manual = false } = {}) {
  setLoading(true, manual ? "Refreshing…" : "Loading live availability…");
  try {
    if (!SITE_CONFIG.apiUrl.trim()) {
      if (!SITE_CONFIG.useSampleDataWhenApiMissing) throw new Error("No API URL is configured.");
      state.games = SAMPLE_GAMES.map(normalizeGame);
      state.demoMode = true;
      state.lastSync = new Date();
      showModeBanner("Design preview: these are your completed Game Details rows. Availability and return dates are sample data until the four availability tabs are connected.", "demo");
    } else {
      const payload = await fetchJsonWithTimeout(SITE_CONFIG.apiUrl.trim());
      state.games = extractGames(payload);
      state.demoMode = false;
      state.lastSync = new Date();
      showModeBanner("", "live");
    }
    applyFilters();
    if (manual) showToast("Availability refreshed.");
  } catch (error) {
    console.error(error);
    if (!state.games.length && SITE_CONFIG.useSampleDataWhenApiMissing) {
      state.games = SAMPLE_GAMES.map(normalizeGame);
      state.demoMode = true;
      showModeBanner(`Live sync failed. Preview data is shown instead: ${error.message}`, "error");
      applyFilters();
    } else {
      showModeBanner(`Live sync failed. Previously loaded data remains visible: ${error.message}`, "error");
    }
  } finally {
    setLoading(false);
    updateSyncStatus();
  }
}

function setLoading(isLoading, message = "") {
  state.loading = isLoading;
  const refresh = $("#refresh-button");
  refresh.disabled = isLoading;
  refresh.classList.toggle("spinning", isLoading);
  if (message) elements.syncStatus.textContent = message;
}

function showModeBanner(message, mode) {
  elements.banner.hidden = !message;
  elements.banner.textContent = message;
  elements.banner.dataset.mode = mode;
}

function dateRank(value) {
  const days = Number(value?.daysUntilAvailable);
  if (Number.isFinite(days) && days >= 0) return days;

  const label = String(value?.availableDate || "").trim();
  const shortMatch = label.match(/^([A-Za-z]{3})[\s/]+(\d{1,2})$/);
  if (shortMatch) {
    const monthIndex = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(shortMatch[1].toLowerCase());
    if (monthIndex >= 0) {
      const now = new Date();
      const candidate = new Date(now.getFullYear(), monthIndex, Number(shortMatch[2]));
      if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate.getTime();
    }
  }

  const parsed = new Date(label);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function mergeSlots(slots) {
  const valid = slots.filter(Boolean);
  if (!valid.length) return normalizeStatus("unavailable");

  const available = valid.find((slot) => slot.status === "available");
  if (available) {
    return {
      ...available,
      status: "available",
      availableDate: "",
      daysUntilAvailable: null,
      availableCount: valid.reduce((sum, slot) => sum + (Number(slot.availableCount) || (slot.status === "available" ? 1 : 0)), 0),
      totalCount: valid.reduce((sum, slot) => sum + (Number(slot.totalCount) || 0), 0)
    };
  }

  const unavailable = valid
    .filter((slot) => slot.status === "unavailable")
    .sort((a, b) => dateRank(a) - dateRank(b))[0];
  if (unavailable) return { ...unavailable, status: "unavailable" };

  const awaiting = valid.find((slot) => slot.status === "awaiting deactivation");
  if (awaiting) return { ...awaiting, status: "awaiting deactivation" };

  const maintenance = valid.find((slot) => slot.status === "maintenance");
  return maintenance ? { ...maintenance, status: "maintenance" } : normalizeStatus("unavailable");
}

function selectedPlatformsForGame(game) {
  const preferredOrder = ["PS5", "PS4"];
  const availablePlatforms = preferredOrder.filter((platform) => game.platforms.includes(platform));

  if (state.filters.platform === "all") return availablePlatforms;
  return availablePlatforms.includes(state.filters.platform) ? [state.filters.platform] : [];
}

function effectiveSlots(game) {
  const selectedPlatforms = selectedPlatformsForGame(game);

  // Used only for filtering and sorting. The game card itself displays each
  // platform independently so PS4 can never visually overwrite PS5.
  return {
    trophy: mergeSlots(selectedPlatforms.map((platform) => game.availabilityByPlatform[platform]?.trophy)),
    nonTrophy: mergeSlots(selectedPlatforms.map((platform) => game.availabilityByPlatform[platform]?.nonTrophy))
  };
}

function applyFilters() {
  const query = normalizeText(state.search);
  const slotFilter = state.filters.slot;

  state.filteredGames = state.games.filter((game) => {
    const haystack = normalizeText([game.title, game.id, ...game.aliases].join(" "));
    if (query && !haystack.includes(query)) return false;
    if (state.filters.platform !== "all" && !game.platforms.includes(state.filters.platform)) return false;
    if (state.filters.category !== "all" && !game.category.some((item) => normalizeText(item) === normalizeText(state.filters.category))) return false;

    if (state.filters.availability === "available") {
      const slots = effectiveSlots(game);
      if (slotFilter === "trophy" && slots.trophy.status !== "available") return false;
      if (slotFilter === "nonTrophy" && slots.nonTrophy.status !== "available") return false;
      if (slotFilter === "all" && slots.trophy.status !== "available" && slots.nonTrophy.status !== "available") return false;
    }
    return true;
  });

  const availabilityScore = (game) => {
    const effective = effectiveSlots(game);
    const slots = slotFilter === "trophy" ? [effective.trophy] : slotFilter === "nonTrophy" ? [effective.nonTrophy] : [effective.trophy, effective.nonTrophy];
    if (slots.some((slot) => slot.status === "available")) return 0;
    if (slots.some((slot) => slot.status === "awaiting deactivation")) return 1;
    if (slots.some((slot) => slot.status === "unavailable")) return 2;
    return 3;
  };

  state.filteredGames.sort((a, b) => {
    if (state.sort === "title-asc") return a.title.localeCompare(b.title);
    if (state.sort === "title-desc") return b.title.localeCompare(a.title);
    return availabilityScore(a) - availabilityScore(b) || a.title.localeCompare(b.title);
  });

  render();
}

function platformLabel(platforms) {
  const ps4 = platforms.includes("PS4");
  const ps5 = platforms.includes("PS5");
  if (ps4 && ps5) return "PS4 & PS5";
  if (ps4) return "PS4 Only";
  return "PS5 Only";
}

function formatDate(value) {
  if (!value) return "";
  const text = String(value).trim();

  // The Apps Script intentionally sends compact public labels such as Jul 30.
  if (/^[A-Za-z]{3}\s+\d{1,2}$/.test(text)) return text.replace(/\s+/, " ");

  // Backward compatibility for the briefly used Jul/30 format.
  const slashLabel = text.match(/^([A-Za-z]{3})\/(\d{1,2})$/);
  if (slashLabel) return `${slashLabel[1]} ${Number(slashLabel[2])}`;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "Asia/Manila" }).format(date);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "Asia/Manila" }).format(date);
  return `${month} ${day}`;
}

function slotLabel(slot) {
  const date = slot.status === "unavailable" ? formatDate(slot.availableDate) : "";
  if (date) return `Available ${date}`;
  return STATUS_LABELS[slot.status] || "Not Available";
}

function coverUrl(filename) {
  const clean = String(filename || "").replace(/^\/+/, "");
  return clean.startsWith("http://") || clean.startsWith("https://") ? clean : `/covers/${encodeURIComponent(clean)}`;
}

function initialRentLabel(days) {
  const count = Number(days) || 0;
  if (count <= 0) return "";
  return `${count} ${count === 1 ? "Day" : "Days"} Initial Rent`;
}

function inquiryPlatformLabel(game, platform = "") {
  if (platform && game.platforms.includes(platform)) return platform;
  if (state.filters.platform !== "all" && game.platforms.includes(state.filters.platform)) {
    return state.filters.platform;
  }
  return game.platforms.length === 1 ? game.platforms[0] : platformLabel(game.platforms).replace(" Only", "");
}

function createInquiry(game, slotName, platform = "") {
  const lines = [
    "Hi JotunDGPH! I would like to inquire about this game:",
    `Game: ${game.title}`,
    `Game ID: ${game.id}`,
    `Platform: ${inquiryPlatformLabel(game, platform)}`,
    `Category: ${game.category.join(" / ")}`,
    `Slot: ${slotName}`
  ];
  if (game.minimumInitialRentDays > 0) {
    lines.push(`Initial Rent Requirement: ${game.minimumInitialRentDays} ${game.minimumInitialRentDays === 1 ? "Day" : "Days"}`);
  }
  return lines.join("\n");
}

async function openMessenger(game, slotName, platform = "") {
  if (game && slotName) {
    const inquiry = createInquiry(game, slotName, platform);
    try {
      await navigator.clipboard.writeText(inquiry);
      showToast("Inquiry copied. Paste it in Messenger.");
    } catch {
      showToast("Messenger is opening. Mention the game and slot in your message.");
    }
  }
  window.open(SITE_CONFIG.messengerUrl, "_blank", "noopener,noreferrer");
}

function waitlistLink(game, slotName, platform = "") {
  const url = new URL(SITE_CONFIG.waitlistUrl);
  url.searchParams.set("gameId", game.id);
  url.searchParams.set("game", game.title);
  url.searchParams.set("platform", inquiryPlatformLabel(game, platform));
  url.searchParams.set("slot", slotName);
  return url.toString();
}

function actionForSlot(game, slot, slotName, platform) {
  if (slot.status === "available") {
    return `<button class="slot-action button button-gold" data-action="message" data-game-id="${escapeHtml(game.id)}" data-slot="${escapeHtml(slotName)}" data-platform="${escapeHtml(platform)}">Message Now</button>`;
  }
  if (slot.status === "unavailable") {
    return `<a class="slot-action button button-outline" href="${escapeHtml(waitlistLink(game, slotName, platform))}" target="_blank" rel="noopener noreferrer">Add to Waitlist</a>`;
  }
  const text = slot.status === "maintenance" ? "Maintenance" : "Checking Slot";
  return `<button class="slot-action button button-disabled" type="button" disabled>${text}</button>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function slotEntriesForPlatform(game, platform) {
  const platformAvailability = game.availabilityByPlatform[platform] || {};
  const trophy = platformAvailability.trophy || normalizeStatus("unavailable");
  const nonTrophy = platformAvailability.nonTrophy || normalizeStatus("unavailable");

  if (state.filters.slot === "trophy") return [["Trophy Slot", trophy]];
  if (state.filters.slot === "nonTrophy") return [["Non-Trophy Slot", nonTrophy]];
  return [["Trophy Slot", trophy], ["Non-Trophy Slot", nonTrophy]];
}

function gameCard(game) {
  const platforms = selectedPlatformsForGame(game);
  const platformGroups = platforms.map((platform) => {
    const rows = slotEntriesForPlatform(game, platform);
    return `
      <section class="platform-card" aria-label="${escapeHtml(platform)} availability">
        <header class="platform-card-header">
          <span class="platform-name">${escapeHtml(platform)}</span>
        </header>
        <div class="platform-slot-grid ${rows.length === 1 ? "single-slot" : ""}">
          ${rows.map(([name, slot]) => `
            <div class="slot-card">
              <div class="slot-card-topline">
                <strong class="slot-name">${escapeHtml(name)}</strong>
                <span class="status status-${slot.status.replace(/\s+/g, "-")}"><i></i>${escapeHtml(slotLabel(slot))}</span>
              </div>
              <div class="slot-card-action">
                ${actionForSlot(game, slot, name, platform)}
              </div>
            </div>
          `).join("")}
        </div>
      </section>`;
  }).join("");

  return `
    <article class="game-card glass-panel">
      <div class="cover-wrap${game.coverFilename ? "" : " cover-error"}">
        ${game.coverFilename ? `<img src="${escapeHtml(coverUrl(game.coverFilename))}" alt="${escapeHtml(game.title)} cover" loading="lazy" decoding="async" data-cover />` : ""}
        <div class="cover-placeholder" aria-hidden="true"><span>${escapeHtml(game.coverFilename || game.id)}</span></div>
      </div>
      <div class="game-info">
        <div class="title-row">
          <div class="title-copy">
            <h2>${escapeHtml(game.title)}</h2>
            <p class="game-id">${escapeHtml(game.id)}</p>
          </div>
          <div class="badges">
            <span>${escapeHtml(platformLabel(game.platforms))}</span>
            <span>${escapeHtml(game.category.join(" / "))}</span>
            ${game.minimumInitialRentDays > 0
              ? `<span class="initial-rent-badge">${escapeHtml(initialRentLabel(game.minimumInitialRentDays))}</span>`
              : ""}
          </div>
        </div>
        <div class="availability-grid availability-grid-${platforms.length}">
          ${platformGroups}
        </div>
      </div>
    </article>`;
}

function renderFilters(container) {
  container.innerHTML = FILTER_GROUPS.map((group) => `
    <fieldset class="filter-group">
      <legend>${group.label}</legend>
      ${group.options.map(([value, label]) => `
        <label class="filter-option ${state.filters[group.key] === value ? "selected" : ""}">
          <input type="radio" name="${container.id}-${group.key}" value="${value}" data-filter-key="${group.key}" ${state.filters[group.key] === value ? "checked" : ""} />
          <span>${label}</span>
        </label>`).join("")}
    </fieldset>`).join("");
}

function renderPills() {
  const pills = Object.entries(state.filters)
    .filter(([, value]) => value !== "all")
    .map(([key, value]) => {
      const group = FILTER_GROUPS.find((item) => item.key === key);
      const label = group?.options.find(([option]) => option === value)?.[1] || value;
      return `<button type="button" data-remove-filter="${key}">${escapeHtml(label)} <span aria-hidden="true">×</span></button>`;
    });
  elements.pills.innerHTML = pills.join("");
  if (elements.filterCount) elements.filterCount.textContent = String(pills.length);
}

function render() {
  renderFilters(elements.desktopFilters);
  renderFilters(elements.mobileFilters);
  renderPills();

  elements.subtitle.textContent = "Browse games, your next adventure awaits!";
  elements.resultCount.textContent = `${state.filteredGames.length} game${state.filteredGames.length === 1 ? "" : "s"} found`;
  elements.empty.hidden = state.filteredGames.length > 0;
  elements.list.innerHTML = state.filteredGames.map(gameCard).join("");

  $$('[data-cover]').forEach((image) => {
    image.addEventListener("error", () => image.closest(".cover-wrap")?.classList.add("cover-error"), { once: true });
  });
}

function updateSyncStatus() {
  if (!state.lastSync) return;
  const time = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(state.lastSync);
  elements.syncStatus.textContent = `${state.demoMode ? "Preview loaded" : "Last updated"} ${time}`;
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function clearFilters() {
  state.filters = { availability: "all", platform: "all", category: "all", slot: "all" };
  state.search = "";
  elements.search.value = "";
  applyFilters();
}

function bindNavigation() {
  const navLinks = [...document.querySelectorAll(".desktop-nav a")];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      const active = link.getAttribute("href") === `#${visible.target.id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-30% 0px -55%", threshold: [0.05, 0.2, 0.5] });

  sections.forEach((section) => observer.observe(section));
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.search = event.target.value;
    applyFilters();
  });
  elements.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    applyFilters();
  });
  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-filter-key]");
    if (!input) return;
    state.filters[input.dataset.filterKey] = input.value;
    applyFilters();
  });
  document.addEventListener("click", (event) => {
    const messageButton = event.target.closest('[data-action="message"]');
    if (messageButton) {
      const game = state.games.find((item) => item.id === messageButton.dataset.gameId);
      if (game) openMessenger(game, messageButton.dataset.slot, messageButton.dataset.platform || "");
      return;
    }
    const mainMessage = event.target.closest("[data-main-message]");
    if (mainMessage) {
      event.preventDefault();
      openMessenger();
      return;
    }
    const remove = event.target.closest("[data-remove-filter]");
    if (remove) {
      state.filters[remove.dataset.removeFilter] = "all";
      applyFilters();
      return;
    }
    if (event.target.closest("[data-clear-all]")) clearFilters();
  });
  $("#clear-filters").addEventListener("click", clearFilters);
  $("#mobile-clear").addEventListener("click", clearFilters);
  $("#refresh-button").addEventListener("click", () => loadGames({ manual: true }));
  $("#open-filters").addEventListener("click", () => elements.dialog.showModal());
}

bindEvents();
bindNavigation();
const year = document.querySelector("#copyright-year");
if (year) year.textContent = new Date().getFullYear();
loadGames();
setInterval(() => loadGames(), SITE_CONFIG.refreshIntervalMs);
