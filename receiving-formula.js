/*
=========================================================
POPS PICKZ NFL — RECEIVING FORMULA
File: receiving-formula.js
=========================================================

Creates receiving-ratings.json from team-stats.json.

POPS Receiving Formula:

- Receiving yards per game: 30%
- Yards per reception: 25%
- Receiving touchdowns per game: 20%
- Receptions per game: 15%
- Receiving efficiency balance: 10%

Run:

node receiving-formula.js
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
  "receiving-ratings.json"
);

/*
=========================================================
FORMULA SETTINGS
=========================================================
*/

const WEIGHTS = {
  yardsPerGame: 30,
  yardsPerReception: 25,
  touchdownsPerGame: 20,
  receptionsPerGame: 15,
  efficiencyBalance: 10
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

  const receiving = team.receiving || {};

  const yardsPerGame = number(
    receiving.yardsPerGame
  );

  const yardsPerReception = number(
    receiving.yardsPerReception
  );

  const touchdownsPerGame = round(
    number(receiving.touchdowns) /
      gamesPlayed,
    3
  );

  const receptionsPerGame = round(
    number(receiving.receptions) /
      gamesPlayed,
    3
  );

  const efficiencyBalance = round(
    yardsPerReception *
      Math.max(touchdownsPerGame, 0.1),
    3
  );

  return {
    yardsPerGame,
    yardsPerReception,
    touchdownsPerGame,
    receptionsPerGame,
    efficiencyBalance
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
      "High receiving yard production"
    );
  }

  if (
    normalized.yardsPerReception >= 75
  ) {
    reasons.push(
      "Strong big-play receiving efficiency"
    );
  }

  if (
    normalized.touchdownsPerGame >= 75
  ) {
    reasons.push(
      "Strong receiving touchdown rate"
    );
  }

  if (
    normalized.receptionsPerGame >= 75
  ) {
    reasons.push(
      "High-volume receiving attack"
    );
  }

  if (
    normalized.efficiencyBalance >= 75
  ) {
    reasons.push(
      "Balanced production and efficiency"
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Balanced receiving profile"
    );
  }

  return reasons.slice(0, 3);
}

/*
=========================================================
BUILD RECEIVING RATINGS
=========================================================
*/

function buildReceivingRatings() {
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

    yardsPerReception: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.yardsPerReception
      )
    ),

    touchdownsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.touchdownsPerGame
      )
    ),

    receptionsPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.receptionsPerGame
      )
    ),

    efficiencyBalance: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.efficiencyBalance
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

        yardsPerReception:
          normalizeHigherIsBetter(
            metrics.yardsPerReception,
            ranges.yardsPerReception.minimum,
            ranges.yardsPerReception.maximum
          ),

        touchdownsPerGame:
          normalizeHigherIsBetter(
            metrics.touchdownsPerGame,
            ranges.touchdownsPerGame.minimum,
            ranges.touchdownsPerGame.maximum
          ),

        receptionsPerGame:
          normalizeHigherIsBetter(
            metrics.receptionsPerGame,
            ranges.receptionsPerGame.minimum,
            ranges.receptionsPerGame.maximum
          ),

        efficiencyBalance:
          normalizeHigherIsBetter(
            metrics.efficiencyBalance,
            ranges.efficiencyBalance.minimum,
            ranges.efficiencyBalance.maximum
          )
      };

      const breakdown = {
        yardsPerGame: round(
          normalized.yardsPerGame *
            (WEIGHTS.yardsPerGame / 100),
          2
        ),

        yardsPerReception: round(
          normalized.yardsPerReception *
            (
              WEIGHTS.yardsPerReception /
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

        receptionsPerGame: round(
          normalized.receptionsPerGame *
            (
              WEIGHTS.receptionsPerGame /
              100
            ),
          2
        ),

        efficiencyBalance: round(
          normalized.efficiencyBalance *
            (
              WEIGHTS.efficiencyBalance /
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
          receivingYardsPerGame:
            round(metrics.yardsPerGame, 1),

          yardsPerReception:
            round(
              metrics.yardsPerReception,
              2
            ),

          receivingTouchdownsPerGame:
            round(
              metrics.touchdownsPerGame,
              2
            ),

          receptionsPerGame:
            round(
              metrics.receptionsPerGame,
              2
            ),

          efficiencyBalance:
            round(
              metrics.efficiencyBalance,
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
    `POPS Pickz: saved ${ratings.length} receiving ratings`
  );

  console.log(
    `Created: ${OUTPUT_FILE}`
  );

  if (ratings[0]) {
    console.log(
      `Top receiving team: ${ratings[0].team} — ${ratings[0].rating}`
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
    buildReceivingRatings();
  } catch (error) {
    console.error(
      "POPS Pickz receiving formula failed:",
      error
    );

    process.exitCode = 1;
  }
}

module.exports = {
  buildReceivingRatings
};