/*
=========================================================
POPS PICKZ NFL — SCORING FORMULA
File: scoring-formula.js
=========================================================

Creates scoring-ratings.json from team-stats.json.

Current reliable inputs:

- Points per game: 40%
- Offensive yards per game: 20%
- Passing touchdowns per game: 15%
- Rushing touchdowns per game: 15%
- Turnover protection: 10%

Third-down percentage and red-zone percentage are not used
yet because they currently return 0 for every team.

Run:

node scoring-formula.js
=========================================================
*/

const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(
  __dirname,
  "team-stats.json"
);

const OUTPUT_FILE = path.join(
  __dirname,
  "scoring-ratings.json"
);

/*
=========================================================
FORMULA SETTINGS
=========================================================
*/

const WEIGHTS = {
  pointsPerGame: 40,
  yardsPerGame: 20,
  passingTouchdownsPerGame: 15,
  rushingTouchdownsPerGame: 15,
  turnoverProtection: 10
};

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

function clamp(
  value,
  minimum = 0,
  maximum = 100
) {
  return Math.min(
    maximum,
    Math.max(minimum, number(value))
  );
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
NORMALIZATION
=========================================================
*/

function getRange(values = []) {
  const validValues = values.filter((value) => {
    return Number.isFinite(
      number(value, NaN)
    );
  });

  if (!validValues.length) {
    return {
      minimum: 0,
      maximum: 0
    };
  }

  return {
    minimum: Math.min(...validValues),
    maximum: Math.max(...validValues)
  };
}

function normalizeHigherIsBetter(
  value,
  minimum,
  maximum
) {
  if (maximum === minimum) {
    return 50;
  }

  return clamp(
    ((number(value) - minimum) /
      (maximum - minimum)) *
      100
  );
}

function normalizeLowerIsBetter(
  value,
  minimum,
  maximum
) {
  if (maximum === minimum) {
    return 50;
  }

  return clamp(
    ((maximum - number(value)) /
      (maximum - minimum)) *
      100
  );
}

/*
=========================================================
TEAM METRICS
=========================================================
*/

function getTeamMetrics(team = {}) {
  const gamesPlayed = Math.max(
    1,
    number(team.gamesPlayed, 1)
  );

  const offense = team.offense || {};
  const passing = team.passing || {};
  const rushing = team.rushing || {};

  return {
    pointsPerGame: number(
      offense.pointsPerGame
    ),

    yardsPerGame: number(
      offense.yardsPerGame
    ),

    passingTouchdownsPerGame: round(
      number(passing.touchdowns) /
        gamesPlayed,
      3
    ),

    rushingTouchdownsPerGame: round(
      number(rushing.touchdowns) /
        gamesPlayed,
      3
    ),

    turnoversPerGame: round(
      number(offense.turnovers) /
        gamesPlayed,
      3
    )
  };
}

/*
=========================================================
TIERS
=========================================================
*/

function getTier(rating) {
  if (rating >= 90) {
    return {
      name: "Elite",
      stars: 5
    };
  }

  if (rating >= 80) {
    return {
      name: "Excellent",
      stars: 4
    };
  }

  if (rating >= 70) {
    return {
      name: "Strong",
      stars: 4
    };
  }

  if (rating >= 60) {
    return {
      name: "Above Average",
      stars: 3
    };
  }

  if (rating >= 50) {
    return {
      name: "Average",
      stars: 3
    };
  }

  if (rating >= 40) {
    return {
      name: "Below Average",
      stars: 2
    };
  }

  return {
    name: "Weak",
    stars: 1
  };
}

/*
=========================================================
REASONS
=========================================================
*/

function buildReasons(normalized) {
  const reasons = [];

  if (normalized.pointsPerGame >= 75) {
    reasons.push(
      "High scoring production"
    );
  }

  if (normalized.yardsPerGame >= 75) {
    reasons.push(
      "Consistently moves the football"
    );
  }

  if (
    normalized.passingTouchdownsPerGame >=
    75
  ) {
    reasons.push(
      "Strong passing touchdown rate"
    );
  }

  if (
    normalized.rushingTouchdownsPerGame >=
    75
  ) {
    reasons.push(
      "Strong rushing touchdown rate"
    );
  }

  if (
    normalized.turnoverProtection >= 75
  ) {
    reasons.push(
      "Protects the football"
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Balanced scoring profile"
    );
  }

  return reasons.slice(0, 3);
}

/*
=========================================================
BUILD SCORING RATINGS
=========================================================
*/

function buildScoringRatings() {
  const input = readJSON(INPUT_FILE);

  const teams = Array.isArray(input.teams)
    ? input.teams
    : [];

  if (!teams.length) {
    throw new Error(
      "No teams were found in team-stats.json"
    );
  }

  const teamMetrics = teams.map((team) => {
    return {
      team,
      metrics: getTeamMetrics(team)
    };
  });

  const ranges = {
    pointsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.pointsPerGame
      )
    ),

    yardsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.yardsPerGame
      )
    ),

    passingTouchdownsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics
            .passingTouchdownsPerGame
      )
    ),

    rushingTouchdownsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics
            .rushingTouchdownsPerGame
      )
    ),

    turnoversPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.turnoversPerGame
      )
    )
  };

  const ratings = teamMetrics.map(
    ({ team, metrics }) => {
      const normalized = {
        pointsPerGame:
          normalizeHigherIsBetter(
            metrics.pointsPerGame,
            ranges.pointsPerGame.minimum,
            ranges.pointsPerGame.maximum
          ),

        yardsPerGame:
          normalizeHigherIsBetter(
            metrics.yardsPerGame,
            ranges.yardsPerGame.minimum,
            ranges.yardsPerGame.maximum
          ),

        passingTouchdownsPerGame:
          normalizeHigherIsBetter(
            metrics.passingTouchdownsPerGame,
            ranges
              .passingTouchdownsPerGame
              .minimum,
            ranges
              .passingTouchdownsPerGame
              .maximum
          ),

        rushingTouchdownsPerGame:
          normalizeHigherIsBetter(
            metrics.rushingTouchdownsPerGame,
            ranges
              .rushingTouchdownsPerGame
              .minimum,
            ranges
              .rushingTouchdownsPerGame
              .maximum
          ),

        turnoverProtection:
          normalizeLowerIsBetter(
            metrics.turnoversPerGame,
            ranges.turnoversPerGame.minimum,
            ranges.turnoversPerGame.maximum
          )
      };

      const breakdown = {
        pointsPerGame: round(
          normalized.pointsPerGame *
            (WEIGHTS.pointsPerGame / 100),
          2
        ),

        yardsPerGame: round(
          normalized.yardsPerGame *
            (WEIGHTS.yardsPerGame / 100),
          2
        ),

        passingTouchdowns: round(
          normalized
            .passingTouchdownsPerGame *
            (
              WEIGHTS
                .passingTouchdownsPerGame /
              100
            ),
          2
        ),

        rushingTouchdowns: round(
          normalized
            .rushingTouchdownsPerGame *
            (
              WEIGHTS
                .rushingTouchdownsPerGame /
              100
            ),
          2
        ),

        turnoverProtection: round(
          normalized.turnoverProtection *
            (
              WEIGHTS.turnoverProtection /
              100
            ),
          2
        )
      };

      const rating = round(
        Object.values(breakdown).reduce(
          (total, value) => {
            return total + number(value);
          },
          0
        ),
        1
      );

      const tier = getTier(rating);

      return {
        teamId: team.teamId,
        team: team.name,
        abbreviation: team.abbreviation,
        logo: team.logo,

        season: team.season,
        gamesPlayed: team.gamesPlayed,

        rating,
        tier: tier.name,
        stars: tier.stars,

        metrics: {
          pointsPerGame: round(
            metrics.pointsPerGame,
            1
          ),

          yardsPerGame: round(
            metrics.yardsPerGame,
            1
          ),

          passingTouchdownsPerGame:
            round(
              metrics
                .passingTouchdownsPerGame,
              2
            ),

          rushingTouchdownsPerGame:
            round(
              metrics
                .rushingTouchdownsPerGame,
              2
            ),

          turnoversPerGame: round(
            metrics.turnoversPerGame,
            2
          )
        },

        breakdown,

        reasons: buildReasons(normalized)
      };
    }
  );

  ratings.sort((teamA, teamB) => {
    return teamB.rating - teamA.rating;
  });

  ratings.forEach((team, index) => {
    team.rank = index + 1;
  });

  const output = {
    updatedAt: new Date().toISOString(),
    statsSeason: input.statsSeason,
    formulaVersion: "1.0",
    weights: WEIGHTS,
    unavailableMetrics: [
      "thirdDownPercentage",
      "redZonePercentage"
    ],
    teamCount: ratings.length,
    teams: ratings
  };

  saveJSON(output);

  console.log(
    `POPS Pickz: saved ${ratings.length} scoring ratings`
  );

  console.log(
    `Created: ${OUTPUT_FILE}`
  );

  if (ratings[0]) {
    console.log(
      `Top scoring team: ${ratings[0].team} — ${ratings[0].rating}`
    );
  }

  return output;
}

/*
=========================================================
RUN
=========================================================
*/

if (require.main === module) {
  try {
    buildScoringRatings();
  } catch (error) {
    console.error(
      "POPS Pickz scoring formula failed:",
      error
    );

    process.exitCode = 1;
  }
}

module.exports = {
  buildScoringRatings
};