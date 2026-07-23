export const SAMPLE_GAMES = [
  {
    id: "JG-0001",
    title: "Ghost of Yōtei",
    aliases: ["Ghost of Yotei", "Yotei"],
    platforms: ["PS5"],
    category: ["Premium"],
    coverFilename: "JG-001.png",
    minimumInitialRentDays: 7,
    trophy: { status: "available" },
    nonTrophy: { status: "available" }
  },
  {
    id: "JG-0002",
    title: "Final Fantasy VII Rebirth",
    aliases: ["FF7", "FFVII", "Final Fantasy 7"],
    platforms: ["PS5"],
    category: ["Premium", "Classic"],
    coverFilename: "JG-002.png",
    trophy: { status: "unavailable", availableDate: "Jul 30" },
    nonTrophy: { status: "unavailable", availableDate: "Jul 30" }
  },
  {
    id: "JG-0003",
    title: "Resident Evil 4",
    aliases: ["RE4", "Resident Evil 4 Remake"],
    platforms: ["PS4", "PS5"],
    category: ["Classic"],
    coverFilename: "JG-003.png",
    trophy: { status: "awaiting deactivation" },
    nonTrophy: { status: "available" }
  },
  {
    id: "JG-0004",
    title: "Astro Bot",
    aliases: ["Astrobot"],
    platforms: ["PS5"],
    category: ["Premium", "Classic"],
    coverFilename: "JG-004.png",
    trophy: { status: "maintenance" },
    nonTrophy: { status: "available" }
  }
];
