/*
=========================================================
POPS PICKZ NFL — TEAM STATISTICS BUILDER
File: build-team-stats.js
=========================================================

Creates team-stats.json with the raw statistics needed for:

- Better passing team
- Better rushing team
- Better receiving team
- Better defense
- Average points per game
- POPS moneyline formula

Run:

node build-team-stats.js
=========================================================
*/

const fs = require("fs");
const path = require("path");

const TEAM_STATS_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";

const SCHEDULE_FILE = path.join(
  __dirname,
  "schedule.json"
);

const OUTPUT_FILE = path.join(
  __dirname,
  "team-stats.json"
);

const REQUEST_DELAY_MS = 125;

/*
=========================================================
GENERAL HELPERS
=========================================================
*/

function number(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const cleaned = String(value)
    .replaceAll(",", "")
    .replace("%", "")
    .trim();

  const parsed = Number(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function round(value, places = 2) {
  const multiplier = 10 ** places;

  return (
    Math.round(
      number(value) * multiplier
    ) / multiplier
  );
}

function cleanText(value, fallback = "") {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  return String(value).trim();
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "POPS-Pickz-NFL/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Team stats request failed: ${response.status}`
    );
  }

  return response.json();
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${path.basename(filePath)} was not found`
    );
  }

  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );
}

function saveJSON(data) {
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

/*
=========================================================
STAT LOOKUP
=========================================================
*/

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function flattenStatistics(payload = {}) {
  const results = {};

  const groups = [
    ...(payload.results?.stats?.categories || []),
    ...(payload.statistics?.splits?.categories || []),
    ...(payload.statistics?.categories || []),
    ...(payload.stats?.categories || [])
  ];

  for (const group of groups) {
    const stats =
      group.stats ||
      group.statistics ||
      [];

    for (const stat of stats) {
      const possibleNames = [
        stat.name,
        stat.abbreviation,
        stat.shortDisplayName,
        stat.displayName,
        stat.label
      ].filter(Boolean);

      const value =
        stat.value ??
        stat.displayValue ??
        stat.rankDisplayValue ??
        0;

      for (const name of possibleNames) {
        results[normalizeKey(name)] = value;
      }
    }
  }

  return results;
}

function findStat(stats, names, fallback = 0) {
  for (const name of names) {
    const key = normalizeKey(name);

    if (
      Object.prototype.hasOwnProperty.call(
        stats,
        key
      )
    ) {
      return number(stats[key], fallback);
    }
  }

  return fallback;
}

/*
=========================================================
TEAM LIST
=========================================================
*/

function collectTeams(scheduleData = {}) {
  const teams = new Map();

  for (const game of scheduleData.games || []) {
    for (const team of [
      game.awayTeam,
      game.homeTeam
    ]) {
      if (!team?.id) {
        continue;
      }

      teams.set(String(team.id), {
        id: String(team.id),
        name: cleanText(team.name),
        abbreviation: cleanText(
          team.abbreviation
        ),
        logo: cleanText(team.logo)
      });
    }
  }

  return Array.from(teams.values());
}

/*
=========================================================
SEASON SELECTION
=========================================================
*/

function chooseStatsSeason(scheduleData = {}) {
  const scheduledSeason = number(
    scheduleData.season,
    new Date().getFullYear()
  );

  const now = new Date();
  const seasonStarted =
    now.getMonth() + 1 >= 9;

  if (
    scheduledSeason === now.getFullYear() &&
    !seasonStarted
  ) {
    return scheduledSeason - 1;
  }

  return scheduledSeason;
}

/*
=========================================================
TEAM STAT NORMALIZATION
=========================================================
*/

function calculateGamesPlayed(stats) {
  return findStat(
    stats,
    [
      "gamesPlayed",
      "games",
      "gp"
    ],
    0
  );
}

function calculatePerGame(
  total,
  gamesPlayed,
  directValue = 0
) {
  if (directValue > 0) {
    return round(directValue, 1);
  }

  if (gamesPlayed <= 0) {
    return 0;
  }

  return round(total / gamesPlayed, 1);
}

function normalizeTeamStats(
  team,
  payload,
  season
) {
  const stats = flattenStatistics(payload);
  const gamesPlayed = calculateGamesPlayed(stats);

  const points = findStat(stats, [
    "totalPoints",
    "points",
    "pointsFor"
  ]);

  const pointsAllowed = findStat(stats, [
    "pointsAllowed",
    "totalPointsAllowed"
  ]);

  const passingYards = findStat(stats, [
    "netPassingYards",
    "passingYards",
    "passYards"
  ]);

  const rushingYards = findStat(stats, [
    "rushingYards",
    "rushYards"
  ]);

  const receivingYards = findStat(stats, [
    "receivingYards"
  ], passingYards);

  return {
    teamId: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    logo: team.logo,
    season,
    gamesPlayed,

    offense: {
      points,
      pointsPerGame: calculatePerGame(
        points,
        gamesPlayed,
        findStat(stats, [
          "pointsPerGame",
          "avgPoints"
        ])
      ),

      totalYards: findStat(stats, [
        "totalOffensiveYards",
        "totalYards"
      ]),

      yardsPerGame: findStat(stats, [
        "yardsPerGame",
        "totalYardsPerGame"
      ]),

      thirdDownPercentage: findStat(stats, [
        "thirdDownPercentage",
        "thirdDownPct"
      ]),

      redZonePercentage: findStat(stats, [
        "redZoneEfficiency",
        "redZonePercentage",
        "redZonePct"
      ]),

      turnovers: findStat(stats, [
        "totalGiveaways",
        "turnovers"
      ])
    },

    passing: {
      yards: passingYards,

      yardsPerGame: calculatePerGame(
        passingYards,
        gamesPlayed,
        findStat(stats, [
          "netPassingYardsPerGame",
          "passingYardsPerGame"
        ])
      ),

      yardsPerAttempt: findStat(stats, [
        "yardsPerPassAttempt",
        "netYardsPerPassAttempt"
      ]),

      completionPercentage: findStat(stats, [
        "completionPercentage",
        "completionPct"
      ]),

      touchdowns: findStat(stats, [
        "passingTouchdowns",
        "passingTDs"
      ]),

      interceptions: findStat(stats, [
        "interceptionsThrown",
        "passingInterceptions"
      ]),

      sacksAllowed: findStat(stats, [
        "sacks",
        "sacksAllowed"
      ]),

      quarterbackRating: findStat(stats, [
        "quarterbackRating",
        "passerRating"
      ])
    },

    rushing: {
      yards: rushingYards,

      yardsPerGame: calculatePerGame(
        rushingYards,
        gamesPlayed,
        findStat(stats, [
          "rushingYardsPerGame"
        ])
      ),

      yardsPerCarry: findStat(stats, [
        "yardsPerRushAttempt",
        "yardsPerCarry"
      ]),

      touchdowns: findStat(stats, [
        "rushingTouchdowns",
        "rushingTDs"
      ]),

      attempts: findStat(stats, [
        "rushingAttempts",
        "rushAttempts"
      ]),

      firstDowns: findStat(stats, [
        "rushingFirstDowns"
      ])
    },

    receiving: {
      yards: receivingYards,

      yardsPerGame: calculatePerGame(
        receivingYards,
        gamesPlayed
      ),

      receptions: findStat(stats, [
        "receptions"
      ]),

      touchdowns: findStat(stats, [
        "receivingTouchdowns",
        "receivingTDs"
      ]),

      yardsPerReception: findStat(stats, [
        "yardsPerReception"
      ])
    },

    defense: {
      pointsAllowed,

      pointsAllowedPerGame:
        calculatePerGame(
          pointsAllowed,
          gamesPlayed,
          findStat(stats, [
            "pointsAllowedPerGame"
          ])
        ),

      totalYardsAllowed: findStat(stats, [
        "totalYardsAllowed"
      ]),

      yardsAllowedPerGame: findStat(stats, [
        "yardsAllowedPerGame"
      ]),

      passingYardsAllowed: findStat(stats, [
        "passingYardsAllowed",
        "netPassingYardsAllowed"
      ]),

      rushingYardsAllowed: findStat(stats, [
        "rushingYardsAllowed"
      ]),

      sacks: findStat(stats, [
        "sacks"
      ]),

      interceptions: findStat(stats, [
        "interceptions",
        "defensiveInterceptions"
      ]),

      takeaways: findStat(stats, [
        "totalTakeaways",
        "takeaways"
      ]),

      thirdDownPercentageAllowed:
        findStat(stats, [
          "opponentThirdDownPercentage"
        ]),

      redZonePercentageAllowed:
        findStat(stats, [
          "opponentRedZonePercentage"
        ])
    }
  };
}

/*
=========================================================
BUILD TEAM STATS
=========================================================
*/

async function buildTeamStats() {
  const schedule = readJSON(SCHEDULE_FILE);
  const teams = collectTeams(schedule);
  const statsSeason = chooseStatsSeason(schedule);

  console.log(
    `POPS Pickz: loading ${statsSeason} team stats...`
  );

  const results = [];

  for (const team of teams) {
    const url =
      `${TEAM_STATS_BASE}/${team.id}` +
      `/statistics?season=${statsSeason}`;

    try {
      const payload = await fetchJSON(url);

      results.push(
        normalizeTeamStats(
          team,
          payload,
          statsSeason
        )
      );

      console.log(
        `Loaded ${team.abbreviation}`
      );
    } catch (error) {
      console.warn(
        `Could not load ${team.abbreviation}:`,
        error.message
      );

      results.push(
        normalizeTeamStats(
          team,
          {},
          statsSeason
        )
      );
    }

    await delay(REQUEST_DELAY_MS);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    scheduleSeason: schedule.season,
    statsSeason,
    teamCount: results.length,
    teams: results
  };

  saveJSON(output);

  console.log(
    `POPS Pickz: saved ${results.length} teams`
  );

  console.log(
    `Created: ${OUTPUT_FILE}`
  );

  return output;
}

/*
=========================================================
RUN
=========================================================
*/

if (require.main === module) {
  buildTeamStats().catch((error) => {
    console.error(
      "POPS Pickz team stats build failed:",
      error
    );

    process.exitCode = 1;
  });
}

module.exports = {
  buildTeamStats
};