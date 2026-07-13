/*
=========================================================
POPS PICKZ NFL — MATCHUP BUILDER
File: matchup-builder.js
=========================================================

Combines:

- schedule.json
- passing-ratings.json
- rushing-ratings.json
- receiving-ratings.json
- defense-ratings.json
- scoring-ratings.json

Creates:

- matchup-projections.json

Run:

node matchup-builder.js
=========================================================
*/

const fs = require("fs");
const path = require("path");

/*
=========================================================
FILES
=========================================================
*/

const FILES = {
  schedule: "schedule.json",
  passing: "passing-ratings.json",
  rushing: "rushing-ratings.json",
  receiving: "receiving-ratings.json",
  defense: "defense-ratings.json",
  scoring: "scoring-ratings.json",
  output: "matchup-projections.json"
};

const filePath = (name) => {
  return path.join(__dirname, name);
};

/*
=========================================================
FORMULA SETTINGS
=========================================================
*/

const WEIGHTS = {
  passing: 22,
  rushing: 16,
  receiving: 16,
  defense: 26,
  scoring: 20
};

const HOME_FIELD_BONUS = 1.5;

/*
Defense currently has limited source data.

The defense rating is multiplied by this reliability value
until points allowed and yards allowed are populated.
*/

const DEFENSE_RELIABILITY = 0.4;

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

function round(value, places = 1) {
  const multiplier = 10 ** places;

  return (
    Math.round(
      number(value) * multiplier
    ) / multiplier
  );
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(
    maximum,
    Math.max(minimum, number(value))
  );
}

function readJSON(filename) {
  const location = filePath(filename);

  if (!fs.existsSync(location)) {
    throw new Error(
      `${filename} was not found`
    );
  }

  return JSON.parse(
    fs.readFileSync(location, "utf8")
  );
}

function saveJSON(filename, data) {
  fs.writeFileSync(
    filePath(filename),
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

/*
=========================================================
RATING LOOKUPS
=========================================================
*/

function createRatingMap(data = {}) {
  const map = new Map();

  for (const team of data.teams || []) {
    const keys = [
      team.teamId,
      team.abbreviation,
      team.team
    ];

    for (const key of keys) {
      if (key !== null && key !== undefined) {
        map.set(
          String(key).toUpperCase(),
          team
        );
      }
    }
  }

  return map;
}

function findRating(map, team = {}) {
  const keys = [
    team.id,
    team.abbreviation,
    team.name
  ];

  for (const key of keys) {
    const result = map.get(
      String(key || "").toUpperCase()
    );

    if (result) {
      return result;
    }
  }

  return {
    rating: 50,
    rank: null,
    tier: "Unavailable",
    metrics: {},
    reasons: ["Rating data unavailable"]
  };
}

/*
=========================================================
CATEGORY HELPERS
=========================================================
*/

function categoryResult(
  category,
  away,
  home,
  reliability = 1
) {
  const awayRating = round(away.rating, 1);
  const homeRating = round(home.rating, 1);

  const difference = round(
    Math.abs(homeRating - awayRating),
    1
  );

  let winner = "tie";

  if (awayRating > homeRating) {
    winner = "away";
  }

  if (homeRating > awayRating) {
    winner = "home";
  }

  return {
    category,
    awayRating,
    homeRating,
    difference,
    winner,
    reliability,
    limitedData: reliability < 1
  };
}

function weightedValue(
  rating,
  weight,
  reliability = 1
) {
  return (
    number(rating, 50) *
    weight *
    reliability
  );
}

/*
=========================================================
TEAM SCORE
=========================================================
*/

function calculateTeamScore(
  ratings,
  isHomeTeam
) {
  const effectiveWeights = {
    passing: WEIGHTS.passing,
    rushing: WEIGHTS.rushing,
    receiving: WEIGHTS.receiving,

    defense:
      WEIGHTS.defense *
      DEFENSE_RELIABILITY,

    scoring: WEIGHTS.scoring
  };

  const totalWeight = Object.values(
    effectiveWeights
  ).reduce((total, value) => {
    return total + value;
  }, 0);

  const weightedTotal =
    weightedValue(
      ratings.passing.rating,
      WEIGHTS.passing
    ) +
    weightedValue(
      ratings.rushing.rating,
      WEIGHTS.rushing
    ) +
    weightedValue(
      ratings.receiving.rating,
      WEIGHTS.receiving
    ) +
    weightedValue(
      ratings.defense.rating,
      WEIGHTS.defense,
      DEFENSE_RELIABILITY
    ) +
    weightedValue(
      ratings.scoring.rating,
      WEIGHTS.scoring
    );

  const baseScore =
    totalWeight > 0
      ? weightedTotal / totalWeight
      : 50;

  const homeBonus =
    isHomeTeam
      ? HOME_FIELD_BONUS
      : 0;

  return {
    baseScore: round(baseScore, 1),
    homeFieldBonus: homeBonus,

    finalScore: round(
      clamp(baseScore + homeBonus),
      1
    )
  };
}

/*
=========================================================
CONFIDENCE
=========================================================
*/

function calculateConfidence(edge) {
  const absoluteEdge = Math.abs(
    number(edge)
  );

  const percentage = round(
    clamp(50 + absoluteEdge * 2.4, 50, 88),
    0
  );

  let tier = "Toss-Up";
  let stars = 1;

  if (absoluteEdge >= 15) {
    tier = "Elite Edge";
    stars = 5;
  } else if (absoluteEdge >= 10) {
    tier = "Strong Edge";
    stars = 4;
  } else if (absoluteEdge >= 6) {
    tier = "Moderate Edge";
    stars = 3;
  } else if (absoluteEdge >= 3) {
    tier = "Slight Edge";
    stars = 2;
  }

  return {
    percentage,
    tier,
    stars
  };
}

/*
=========================================================
PROJECTED SCORE
=========================================================
*/

function getPointsPerGame(scoring = {}) {
  return number(
    scoring.metrics?.pointsPerGame,
    21
  );
}

function projectedPoints(
  teamScoring,
  teamOverall,
  opponentOverall
) {
  const pointsPerGame =
    getPointsPerGame(teamScoring);

  const ratingAdjustment =
    (teamOverall - opponentOverall) * 0.12;

  return Math.max(
    10,
    Math.round(
      pointsPerGame + ratingAdjustment
    )
  );
}

/*
=========================================================
MATCHUP REASONS
=========================================================
*/

function buildReasons(categories, teams) {
  return categories
    .filter((category) => {
      return category.winner !== "tie";
    })
    .sort((a, b) => {
      return b.difference - a.difference;
    })
    .slice(0, 3)
    .map((category) => {
      const winningTeam =
        category.winner === "home"
          ? teams.home.name
          : teams.away.name;

      return (
        `${winningTeam} has the ` +
        `${category.category.toLowerCase()} edge ` +
        `by ${category.difference} points`
      );
    });
}

/*
=========================================================
BUILD ONE MATCHUP
=========================================================
*/

function buildMatchup(game, maps) {
  const awayTeam = game.awayTeam || {};
  const homeTeam = game.homeTeam || {};

  const awayRatings = {
    passing: findRating(maps.passing, awayTeam),
    rushing: findRating(maps.rushing, awayTeam),
    receiving: findRating(maps.receiving, awayTeam),
    defense: findRating(maps.defense, awayTeam),
    scoring: findRating(maps.scoring, awayTeam)
  };

  const homeRatings = {
    passing: findRating(maps.passing, homeTeam),
    rushing: findRating(maps.rushing, homeTeam),
    receiving: findRating(maps.receiving, homeTeam),
    defense: findRating(maps.defense, homeTeam),
    scoring: findRating(maps.scoring, homeTeam)
  };

  const categories = [
    categoryResult(
      "Passing",
      awayRatings.passing,
      homeRatings.passing
    ),

    categoryResult(
      "Rushing",
      awayRatings.rushing,
      homeRatings.rushing
    ),

    categoryResult(
      "Receiving",
      awayRatings.receiving,
      homeRatings.receiving
    ),

    categoryResult(
      "Defense",
      awayRatings.defense,
      homeRatings.defense,
      DEFENSE_RELIABILITY
    ),

    categoryResult(
      "Scoring",
      awayRatings.scoring,
      homeRatings.scoring
    )
  ];

  const awayScore = calculateTeamScore(
    awayRatings,
    false
  );

  const homeScore = calculateTeamScore(
    homeRatings,
    true
  );

  const edge = round(
    homeScore.finalScore -
    awayScore.finalScore,
    1
  );

  const winnerSide =
    edge >= 0
      ? "home"
      : "away";

  const winnerTeam =
    winnerSide === "home"
      ? homeTeam
      : awayTeam;

  const confidence =
    calculateConfidence(edge);

  const awayProjectedPoints =
    projectedPoints(
      awayRatings.scoring,
      awayScore.finalScore,
      homeScore.finalScore
    );

  const homeProjectedPoints =
    projectedPoints(
      homeRatings.scoring,
      homeScore.finalScore,
      awayScore.finalScore
    );

  return {
    gameId: game.id,
    date: game.date,
    week: game.week,
    venue: game.venue,
    network: game.network,

    awayTeam,
    homeTeam,

    popsPick: {
      side: winnerSide,
      teamId: winnerTeam.id,
      team: winnerTeam.name,
      abbreviation: winnerTeam.abbreviation,

      edge: round(
        Math.abs(edge),
        1
      ),

      confidence
    },

    projectedScore: {
      away: awayProjectedPoints,
      home: homeProjectedPoints,

      display:
        `${awayTeam.abbreviation} ` +
        `${awayProjectedPoints} - ` +
        `${homeTeam.abbreviation} ` +
        `${homeProjectedPoints}`
    },

    ratings: {
      away: {
        overall: awayScore.finalScore,
        base: awayScore.baseScore,
        homeFieldBonus: 0
      },

      home: {
        overall: homeScore.finalScore,
        base: homeScore.baseScore,
        homeFieldBonus:
          homeScore.homeFieldBonus
      }
    },

    categories,

    reasons: buildReasons(
      categories,
      {
        away: awayTeam,
        home: homeTeam
      }
    ),

    dataQuality: {
      defense: "limited",
      defenseReliability:
        DEFENSE_RELIABILITY,

      note:
        "Defense is partially weighted until points and yards allowed data are available."
    }
  };
}

/*
=========================================================
BUILD ALL MATCHUPS
=========================================================
*/

function buildMatchupProjections() {
  const schedule =
    readJSON(FILES.schedule);

  const maps = {
    passing: createRatingMap(
      readJSON(FILES.passing)
    ),

    rushing: createRatingMap(
      readJSON(FILES.rushing)
    ),

    receiving: createRatingMap(
      readJSON(FILES.receiving)
    ),

    defense: createRatingMap(
      readJSON(FILES.defense)
    ),

    scoring: createRatingMap(
      readJSON(FILES.scoring)
    )
  };

  const matchups = (
    schedule.games || []
  ).map((game) => {
    return buildMatchup(game, maps);
  });

  const output = {
    updatedAt: new Date().toISOString(),
    season: schedule.season,
    statsSeason:
      readJSON(FILES.scoring).statsSeason,

    week: schedule.week,
    formulaVersion: "1.0",

    weights: WEIGHTS,
    homeFieldBonus: HOME_FIELD_BONUS,

    matchupCount: matchups.length,
    matchups
  };

  saveJSON(FILES.output, output);

  console.log(
    `POPS Pickz: saved ${matchups.length} matchup projections`
  );

  console.log(
    `Created: ${filePath(FILES.output)}`
  );

  return output;
}

/*
=========================================================
RUN
=========================================================
*/

if (require.main === module) {
  try {
    buildMatchupProjections();
  } catch (error) {
    console.error(
      "POPS Pickz matchup builder failed:",
      error
    );

    process.exitCode = 1;
  }
}

module.exports = {
  buildMatchupProjections
};