/*
=========================================================
POPS PICKZ NFL — SCHEDULE BUILDER
File: build-schedule.js
=========================================================

Downloads the NFL schedule and saves the nearest upcoming
week into schedule.json.

Run with:

node build-schedule.js

Optional season override:

NFL_SEASON=2026 node build-schedule.js
=========================================================
*/

const fs = require("fs");
const path = require("path");

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const OUTPUT_FILE = path.join(
  __dirname,
  "schedule.json"
);

/*
=========================================================
GENERAL HELPERS
=========================================================
*/

function number(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function currentNFLSeason() {
  const now = new Date();
  const month = now.getMonth() + 1;

  /*
  January through February normally belongs to the
  previous NFL season.
  */
  if (month <= 2) {
    return now.getFullYear() - 1;
  }

  return now.getFullYear();
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

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "POPS-Pickz-NFL/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Schedule request failed: ${response.status}`
    );
  }

  return response.json();
}

/*
=========================================================
TEAM NORMALIZATION
=========================================================
*/

function normalizeTeam(competitor = {}) {
  const team = competitor.team || {};

  const logos = Array.isArray(team.logos)
    ? team.logos
    : [];

  const records = Array.isArray(
    competitor.records
  )
    ? competitor.records
    : [];

  return {
    id: cleanText(team.id),
    uid: cleanText(team.uid),

    name: cleanText(
      team.displayName,
      "Unknown Team"
    ),

    shortDisplayName: cleanText(
      team.shortDisplayName,
      team.displayName
    ),

    abbreviation: cleanText(
      team.abbreviation,
      "NFL"
    ),

    location: cleanText(team.location),
    nickname: cleanText(team.name),

    logo:
      logos[0]?.href ||
      team.logo ||
      "",

    color: cleanText(team.color),
    alternateColor: cleanText(
      team.alternateColor
    ),

    record:
      records[0]?.summary ||
      records[0]?.displayValue ||
      "0-0",

    score: number(competitor.score, 0),
    winner: Boolean(competitor.winner)
  };
}

/*
=========================================================
GAME NORMALIZATION
=========================================================
*/

function findCompetitor(
  competitors = [],
  homeAway
) {
  return competitors.find((competitor) => {
    return competitor.homeAway === homeAway;
  }) || {};
}

function getBroadcast(competition = {}) {
  const broadcasts = Array.isArray(
    competition.broadcasts
  )
    ? competition.broadcasts
    : [];

  const names =
    broadcasts[0]?.names ||
    broadcasts[0]?.media?.shortName;

  if (Array.isArray(names)) {
    return names.join(", ");
  }

  return cleanText(names, "TV TBD");
}

function normalizeGame(event = {}) {
  const competition =
    event.competitions?.[0] || {};

  const competitors =
    competition.competitors || [];

  const awayCompetitor = findCompetitor(
    competitors,
    "away"
  );

  const homeCompetitor = findCompetitor(
    competitors,
    "home"
  );

  const venue = competition.venue || {};
  const address = venue.address || {};

  const status =
    competition.status ||
    event.status ||
    {};

  return {
    id: cleanText(event.id),
    uid: cleanText(event.uid),

    name: cleanText(event.name),
    shortName: cleanText(event.shortName),

    date:
      event.date ||
      competition.date ||
      "",

    week:
      number(event.week?.number, 0),

    season:
      number(event.season?.year, 0),

    seasonType:
      number(event.season?.type, 0),

    seasonSlug: cleanText(
      event.season?.slug
    ),

    awayTeam: normalizeTeam(
      awayCompetitor
    ),

    homeTeam: normalizeTeam(
      homeCompetitor
    ),

    venue: cleanText(
      venue.fullName,
      "Venue TBD"
    ),

    city: cleanText(address.city),
    state: cleanText(address.state),

    network: getBroadcast(competition),

    status: {
      state: cleanText(
        status.type?.state,
        "pre"
      ),

      completed: Boolean(
        status.type?.completed
      ),

      detail: cleanText(
        status.type?.detail,
        "Scheduled"
      ),

      shortDetail: cleanText(
        status.type?.shortDetail,
        "Scheduled"
      )
    }
  };
}

/*
=========================================================
SELECT ACTIVE OR UPCOMING WEEK
=========================================================
*/

function getSeasonTypePriority(type) {
  /*
  Regular season first, then preseason, then postseason.
  */
  if (type === 2) return 1;
  if (type === 1) return 2;
  if (type === 3) return 3;

  return 4;
}

function selectScheduleWeek(games = []) {
  if (!games.length) {
    return [];
  }

  const now = Date.now();

  const unfinished = games.filter((game) => {
    return !game.status.completed;
  });

  const futureGames = unfinished.filter((game) => {
    const kickoff = new Date(game.date).getTime();

    return (
      Number.isFinite(kickoff) &&
      kickoff >= now - 12 * 60 * 60 * 1000
    );
  });

  const available =
    futureGames.length > 0
      ? futureGames
      : unfinished.length > 0
        ? unfinished
        : games;

  const sorted = [...available].sort(
    (gameA, gameB) => {
      const typeDifference =
        getSeasonTypePriority(
          gameA.seasonType
        ) -
        getSeasonTypePriority(
          gameB.seasonType
        );

      if (typeDifference !== 0) {
        return typeDifference;
      }

      return (
        new Date(gameA.date) -
        new Date(gameB.date)
      );
    }
  );

  const target = sorted[0];

  return games
    .filter((game) => {
      return (
        game.seasonType ===
          target.seasonType &&
        game.week === target.week
      );
    })
    .sort((gameA, gameB) => {
      return (
        new Date(gameA.date) -
        new Date(gameB.date)
      );
    });
}

/*
=========================================================
SAVE FILE
=========================================================
*/

function saveJSON(data) {
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

/*
=========================================================
BUILD SCHEDULE
=========================================================
*/

async function buildSchedule() {
  const season = number(
    process.env.NFL_SEASON,
    currentNFLSeason()
  );

  const url =
    `${ESPN_SCOREBOARD}` +
    `?limit=1000` +
    `&dates=${season}`;

  console.log(
    `POPS Pickz: loading ${season} NFL schedule...`
  );

  const response = await fetchJSON(url);

  const events = Array.isArray(response.events)
    ? response.events
    : [];

  const allGames = events
    .map(normalizeGame)
    .filter((game) => {
      return (
        game.id &&
        game.awayTeam.id &&
        game.homeTeam.id
      );
    });

  const selectedGames =
    selectScheduleWeek(allGames);

  const firstGame = selectedGames[0] || {};

  const output = {
    updatedAt: new Date().toISOString(),

    season:
      firstGame.season ||
      season,

    seasonType:
      firstGame.seasonType ||
      2,

    seasonSlug:
      firstGame.seasonSlug ||
      "regular-season",

    week:
      firstGame.week ||
      1,

    gameCount: selectedGames.length,

    games: selectedGames
  };

  saveJSON(output);

  console.log(
    `POPS Pickz: saved ${output.gameCount} games`
  );

  console.log(
    `Season ${output.season} — Week ${output.week}`
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

buildSchedule().catch((error) => {
  console.error(
    "POPS Pickz schedule build failed:",
    error
  );

  process.exitCode = 1;
});

module.exports = {
  buildSchedule
};