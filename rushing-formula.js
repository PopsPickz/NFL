/*
=========================================================
POPS PICKZ NFL — RUSHING FORMULA
File: rushing-formula.js
=========================================================

Creates rushing-ratings.json from team-stats.json.

POPS Rushing Formula:

- Rushing yards per game: 30%
- Yards per carry: 25%
- Rushing touchdowns per game: 20%
- Rushing first downs per game: 15%
- Rushing volume: 10%

Run:

node rushing-formula.js
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
  "rushing-ratings.json"
);

/*
=========================================================
FORMULA SETTINGS
=========================================================
*/

const WEIGHTS = {
  yardsPerGame: 30,
  yardsPerCarry: 25,
  touchdownsPerGame: 20,
  firstDownsPerGame: 15,
  attemptsPerGame: 10
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

  const rushing = team.rushing || {};

  return {
    yardsPerGame: number(
      rushing.yardsPerGame
    ),

    yardsPerCarry: number(
      rushing.yardsPerCarry
    ),

    touchdownsPerGame: round(
      number(rushing.touchdowns) /
        gamesPlayed,
      3
    ),

    firstDownsPerGame: round(
      number(rushing.firstDowns) /
        gamesPlayed,
      3
    ),

    attemptsPerGame: round(
      number(rushing.attempts) /
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

  if (normalized.yardsPerGame >= 75) {
    reasons.push(
      "High rushing yard production"
    );
  }

  if (normalized.yardsPerCarry >= 75) {
    reasons.push(
      "Strong rushing efficiency"
    );
  }

  if (
    normalized.touchdownsPerGame >= 75
  ) {
    reasons.push(
      "Strong rushing touchdown rate"
    );
  }

  if (
    normalized.firstDownsPerGame >= 75
  ) {
    reasons.push(
      "Consistently moves the chains"
    );
  }

  if (normalized.attemptsPerGame >= 75) {
    reasons.push(
      "High rushing volume"
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Balanced rushing profile"
    );
  }

  return reasons.slice(0, 3);
}

/*
=========================================================
BUILD RUSHING RATINGS
=========================================================
*/

function buildRushingRatings() {
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
    yardsPerGame: getRange(
      teamMetrics.map(
        (item) => item.metrics.yardsPerGame
      )
    ),

    yardsPerCarry: getRange(
      teamMetrics.map(
        (item) => item.metrics.yardsPerCarry
      )
    ),

    touchdownsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.touchdownsPerGame
      )
    ),

    firstDownsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.firstDownsPerGame
      )
    ),

    attemptsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.attemptsPerGame
      )
    )
  };

  const ratings = teamMetrics.map(
    ({ team, metrics }) => {
      const normalized = {
        yardsPerGame:
          normalizeHigherIsBetter(
            metrics.yardsPerGame,
            ranges.yardsPerGame.minimum,
            ranges.yardsPerGame.maximum
          ),

        yardsPerCarry:
          normalizeHigherIsBetter(
            metrics.yardsPerCarry,
            ranges.yardsPerCarry.minimum,
            ranges.yardsPerCarry.maximum
          ),

        touchdownsPerGame:
          normalizeHigherIsBetter(
            metrics.touchdownsPerGame,
            ranges.touchdownsPerGame.minimum,
            ranges.touchdownsPerGame.maximum
          ),

        firstDownsPerGame:
          normalizeHigherIsBetter(
            metrics.firstDownsPerGame,
            ranges.firstDownsPerGame.minimum,
            ranges.firstDownsPerGame.maximum
          ),

        attemptsPerGame:
          normalizeHigherIsBetter(
            metrics.attemptsPerGame,
            ranges.attemptsPerGame.minimum,
            ranges.attemptsPerGame.maximum
          )
      };

      const breakdown = {
        yardsPerGame: round(
          normalized.yardsPerGame *
            (WEIGHTS.yardsPerGame / 100),
          2
        ),

        yardsPerCarry: round(
          normalized.yardsPerCarry *
            (WEIGHTS.yardsPerCarry / 100),
          2
        ),

        touchdownsPerGame: round(
          normalized.touchdownsPerGame *
            (
              WEIGHTS.touchdownsPerGame /
              100
            ),
          2
        ),

        firstDownsPerGame: round(
          normalized.firstDownsPerGame *
            (
              WEIGHTS.firstDownsPerGame /
              100
            ),
          2
        ),

        rushingVolume: round(
          normalized.attemptsPerGame *
            (WEIGHTS.attemptsPerGame / 100),
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
          rushingYardsPerGame:
            round(metrics.yardsPerGame, 1),

          yardsPerCarry:
            round(metrics.yardsPerCarry, 2),

          rushingTouchdownsPerGame:
            round(
              metrics.touchdownsPerGame,
              2
            ),

          rushingFirstDownsPerGame:
            round(
              metrics.firstDownsPerGame,
              2
            ),

          rushingAttemptsPerGame:
            round(
              metrics.attemptsPerGame,
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
    teamCount: ratings.length,
    teams: ratings
  };

  saveJSON(output);

  console.log(
    `POPS Pickz: saved ${ratings.length} rushing ratings`
  );

  console.log(
    `Created: ${OUTPUT_FILE}`
  );

  if (ratings[0]) {
    console.log(
      `Top rushing team: ${ratings[0].team} — ${ratings[0].rating}`
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
    buildRushingRatings();
  } catch (error) {
    console.error(
      "POPS Pickz rushing formula failed:",
      error
    );

    process.exitCode = 1;
  }
}

module.exports = {
  buildRushingRatings
};