/*
=========================================================
POPS PICKZ NFL — PASSING FORMULA
File: passing-formula.js
=========================================================

Creates passing-ratings.json from team-stats.json.

POPS Passing Formula:

- Passing yards per game: 25%
- Quarterback rating: 25%
- Completion percentage: 15%
- Passing touchdowns per game: 15%
- Yards per attempt: 10%
- Sacks allowed: 10% — lower is better

Run:

node passing-formula.js
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
  "passing-ratings.json"
);

/*
=========================================================
FORMULA SETTINGS
=========================================================
*/

const WEIGHTS = {
  yardsPerGame: 25,
  quarterbackRating: 25,
  completionPercentage: 15,
  touchdownsPerGame: 15,
  yardsPerAttempt: 10,
  sacksAllowedPerGame: 10
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

function clamp(value, minimum = 0, maximum = 100) {
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
NORMALIZATION HELPERS
=========================================================
*/

function getRange(values = []) {
  const validValues = values.filter((value) => {
    return Number.isFinite(number(value, NaN));
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

  const passing = team.passing || {};

  return {
    yardsPerGame: number(
      passing.yardsPerGame
    ),

    quarterbackRating: number(
      passing.quarterbackRating
    ),

    completionPercentage: number(
      passing.completionPercentage
    ),

    touchdownsPerGame: round(
      number(passing.touchdowns) /
        gamesPlayed,
      3
    ),

    yardsPerAttempt: number(
      passing.yardsPerAttempt
    ),

    sacksAllowedPerGame: round(
      number(passing.sacksAllowed) /
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
REASON BUILDER
=========================================================
*/

function buildReasons(
  metrics,
  normalized
) {
  const reasons = [];

  if (normalized.yardsPerGame >= 75) {
    reasons.push(
      "Top-level passing yard production"
    );
  }

  if (normalized.quarterbackRating >= 75) {
    reasons.push(
      "Strong quarterback efficiency"
    );
  }

  if (
    normalized.completionPercentage >= 75
  ) {
    reasons.push(
      "High completion percentage"
    );
  }

  if (
    normalized.touchdownsPerGame >= 75
  ) {
    reasons.push(
      "Strong passing touchdown rate"
    );
  }

  if (normalized.yardsPerAttempt >= 75) {
    reasons.push(
      "Creates explosive passing plays"
    );
  }

  if (
    normalized.sacksAllowedPerGame >= 75
  ) {
    reasons.push(
      "Good quarterback protection"
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Balanced passing profile"
    );
  }

  return reasons.slice(0, 3);
}

/*
=========================================================
BUILD PASSING RATINGS
=========================================================
*/

function buildPassingRatings() {
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

    quarterbackRating: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.quarterbackRating
      )
    ),

    completionPercentage: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.completionPercentage
      )
    ),

    touchdownsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.touchdownsPerGame
      )
    ),

    yardsPerAttempt: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.yardsPerAttempt
      )
    ),

    sacksAllowedPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.sacksAllowedPerGame
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

        quarterbackRating:
          normalizeHigherIsBetter(
            metrics.quarterbackRating,
            ranges.quarterbackRating.minimum,
            ranges.quarterbackRating.maximum
          ),

        completionPercentage:
          normalizeHigherIsBetter(
            metrics.completionPercentage,
            ranges.completionPercentage.minimum,
            ranges.completionPercentage.maximum
          ),

        touchdownsPerGame:
          normalizeHigherIsBetter(
            metrics.touchdownsPerGame,
            ranges.touchdownsPerGame.minimum,
            ranges.touchdownsPerGame.maximum
          ),

        yardsPerAttempt:
          normalizeHigherIsBetter(
            metrics.yardsPerAttempt,
            ranges.yardsPerAttempt.minimum,
            ranges.yardsPerAttempt.maximum
          ),

        sacksAllowedPerGame:
          normalizeLowerIsBetter(
            metrics.sacksAllowedPerGame,
            ranges.sacksAllowedPerGame.minimum,
            ranges.sacksAllowedPerGame.maximum
          )
      };

      const breakdown = {
        yardsPerGame: round(
          normalized.yardsPerGame *
            (WEIGHTS.yardsPerGame / 100),
          2
        ),

        quarterbackRating: round(
          normalized.quarterbackRating *
            (
              WEIGHTS.quarterbackRating /
              100
            ),
          2
        ),

        completionPercentage: round(
          normalized.completionPercentage *
            (
              WEIGHTS.completionPercentage /
              100
            ),
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

        yardsPerAttempt: round(
          normalized.yardsPerAttempt *
            (
              WEIGHTS.yardsPerAttempt /
              100
            ),
          2
        ),

        protection: round(
          normalized.sacksAllowedPerGame *
            (
              WEIGHTS.sacksAllowedPerGame /
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
          passingYardsPerGame:
            round(metrics.yardsPerGame, 1),

          quarterbackRating:
            round(
              metrics.quarterbackRating,
              1
            ),

          completionPercentage:
            round(
              metrics.completionPercentage,
              1
            ),

          passingTouchdownsPerGame:
            round(
              metrics.touchdownsPerGame,
              2
            ),

          yardsPerAttempt:
            round(
              metrics.yardsPerAttempt,
              2
            ),

          sacksAllowedPerGame:
            round(
              metrics.sacksAllowedPerGame,
              2
            )
        },

        breakdown,

        reasons: buildReasons(
          metrics,
          normalized
        )
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
    `POPS Pickz: saved ${ratings.length} passing ratings`
  );

  console.log(
    `Created: ${OUTPUT_FILE}`
  );

  if (ratings[0]) {
    console.log(
      `Top passing team: ${ratings[0].team} — ${ratings[0].rating}`
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
    buildPassingRatings();
  } catch (error) {
    console.error(
      "POPS Pickz passing formula failed:",
      error
    );

    process.exitCode = 1;
  }
}

module.exports = {
  buildPassingRatings
};