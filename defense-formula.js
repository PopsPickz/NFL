/*
=========================================================
POPS PICKZ NFL — DEFENSE FORMULA
File: defense-formula.js
=========================================================

Creates defense-ratings.json from team-stats.json.

POPS Defense Formula:

- Points allowed per game: 25%
- Yards allowed per game: 15%
- Passing yards allowed per game: 15%
- Rushing yards allowed per game: 15%
- Sacks per game: 10%
- Takeaways per game: 10%
- Red-zone defense: 5%
- Third-down defense: 5%

Lower is better for points and yards allowed.
Higher is better for sacks and takeaways.

Run:

node defense-formula.js
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
  "defense-ratings.json"
);

/*
=========================================================
FORMULA SETTINGS
=========================================================
*/

const WEIGHTS = {
  pointsAllowedPerGame: 25,
  yardsAllowedPerGame: 15,
  passingYardsAllowedPerGame: 15,
  rushingYardsAllowedPerGame: 15,
  sacksPerGame: 10,
  takeawaysPerGame: 10,
  redZoneDefense: 5,
  thirdDownDefense: 5
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

  const defense = team.defense || {};

  const passingYardsAllowed = number(
    defense.passingYardsAllowed
  );

  const rushingYardsAllowed = number(
    defense.rushingYardsAllowed
  );

  return {
    pointsAllowedPerGame: number(
      defense.pointsAllowedPerGame
    ),

    yardsAllowedPerGame: number(
      defense.yardsAllowedPerGame
    ),

    passingYardsAllowedPerGame: round(
      passingYardsAllowed / gamesPlayed,
      3
    ),

    rushingYardsAllowedPerGame: round(
      rushingYardsAllowed / gamesPlayed,
      3
    ),

    sacksPerGame: round(
      number(defense.sacks) / gamesPlayed,
      3
    ),

    takeawaysPerGame: round(
      number(defense.takeaways) / gamesPlayed,
      3
    ),

    redZoneDefense: number(
      defense.redZonePercentageAllowed
    ),

    thirdDownDefense: number(
      defense.thirdDownPercentageAllowed
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

  if (
    normalized.pointsAllowedPerGame >= 75
  ) {
    reasons.push(
      "Limits opponent scoring"
    );
  }

  if (
    normalized.yardsAllowedPerGame >= 75
  ) {
    reasons.push(
      "Strong overall yardage defense"
    );
  }

  if (
    normalized.passingYardsAllowedPerGame >=
    75
  ) {
    reasons.push(
      "Strong pass defense"
    );
  }

  if (
    normalized.rushingYardsAllowedPerGame >=
    75
  ) {
    reasons.push(
      "Strong run defense"
    );
  }

  if (normalized.sacksPerGame >= 75) {
    reasons.push(
      "Creates consistent quarterback pressure"
    );
  }

  if (normalized.takeawaysPerGame >= 75) {
    reasons.push(
      "Forces turnovers at a high rate"
    );
  }

  if (normalized.redZoneDefense >= 75) {
    reasons.push(
      "Strong red-zone defense"
    );
  }

  if (normalized.thirdDownDefense >= 75) {
    reasons.push(
      "Gets off the field on third down"
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Balanced defensive profile"
    );
  }

  return reasons.slice(0, 3);
}

/*
=========================================================
BUILD DEFENSE RATINGS
=========================================================
*/

function buildDefenseRatings() {
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
    pointsAllowedPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.pointsAllowedPerGame
      )
    ),

    yardsAllowedPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.yardsAllowedPerGame
      )
    ),

    passingYardsAllowedPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics
            .passingYardsAllowedPerGame
      )
    ),

    rushingYardsAllowedPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics
            .rushingYardsAllowedPerGame
      )
    ),

    sacksPerGame: getRange(
      teamMetrics.map(
        (item) => item.metrics.sacksPerGame
      )
    ),

    takeawaysPerGame: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.takeawaysPerGame
      )
    ),

    redZoneDefense: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.redZoneDefense
      )
    ),

    thirdDownDefense: getRange(
      teamMetrics.map(
        (item) =>
          item.metrics.thirdDownDefense
      )
    )
  };

  const ratings = teamMetrics.map(
    ({ team, metrics }) => {
      const normalized = {
        pointsAllowedPerGame:
          normalizeLowerIsBetter(
            metrics.pointsAllowedPerGame,
            ranges.pointsAllowedPerGame.minimum,
            ranges.pointsAllowedPerGame.maximum
          ),

        yardsAllowedPerGame:
          normalizeLowerIsBetter(
            metrics.yardsAllowedPerGame,
            ranges.yardsAllowedPerGame.minimum,
            ranges.yardsAllowedPerGame.maximum
          ),

        passingYardsAllowedPerGame:
          normalizeLowerIsBetter(
            metrics.passingYardsAllowedPerGame,
            ranges.passingYardsAllowedPerGame.minimum,
            ranges.passingYardsAllowedPerGame.maximum
          ),

        rushingYardsAllowedPerGame:
          normalizeLowerIsBetter(
            metrics.rushingYardsAllowedPerGame,
            ranges.rushingYardsAllowedPerGame.minimum,
            ranges.rushingYardsAllowedPerGame.maximum
          ),

        sacksPerGame:
          normalizeHigherIsBetter(
            metrics.sacksPerGame,
            ranges.sacksPerGame.minimum,
            ranges.sacksPerGame.maximum
          ),

        takeawaysPerGame:
          normalizeHigherIsBetter(
            metrics.takeawaysPerGame,
            ranges.takeawaysPerGame.minimum,
            ranges.takeawaysPerGame.maximum
          ),

        redZoneDefense:
          normalizeLowerIsBetter(
            metrics.redZoneDefense,
            ranges.redZoneDefense.minimum,
            ranges.redZoneDefense.maximum
          ),

        thirdDownDefense:
          normalizeLowerIsBetter(
            metrics.thirdDownDefense,
            ranges.thirdDownDefense.minimum,
            ranges.thirdDownDefense.maximum
          )
      };

      const breakdown = {
        pointsAllowedPerGame: round(
          normalized.pointsAllowedPerGame *
            (
              WEIGHTS.pointsAllowedPerGame /
              100
            ),
          2
        ),

        yardsAllowedPerGame: round(
          normalized.yardsAllowedPerGame *
            (
              WEIGHTS.yardsAllowedPerGame /
              100
            ),
          2
        ),

        passingDefense: round(
          normalized
            .passingYardsAllowedPerGame *
            (
              WEIGHTS
                .passingYardsAllowedPerGame /
              100
            ),
          2
        ),

        rushingDefense: round(
          normalized
            .rushingYardsAllowedPerGame *
            (
              WEIGHTS
                .rushingYardsAllowedPerGame /
              100
            ),
          2
        ),

        sacks: round(
          normalized.sacksPerGame *
            (WEIGHTS.sacksPerGame / 100),
          2
        ),

        takeaways: round(
          normalized.takeawaysPerGame *
            (
              WEIGHTS.takeawaysPerGame /
              100
            ),
          2
        ),

        redZoneDefense: round(
          normalized.redZoneDefense *
            (
              WEIGHTS.redZoneDefense /
              100
            ),
          2
        ),

        thirdDownDefense: round(
          normalized.thirdDownDefense *
            (
              WEIGHTS.thirdDownDefense /
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
          pointsAllowedPerGame: round(
            metrics.pointsAllowedPerGame,
            1
          ),

          yardsAllowedPerGame: round(
            metrics.yardsAllowedPerGame,
            1
          ),

          passingYardsAllowedPerGame:
            round(
              metrics
                .passingYardsAllowedPerGame,
              1
            ),

          rushingYardsAllowedPerGame:
            round(
              metrics
                .rushingYardsAllowedPerGame,
              1
            ),

          sacksPerGame: round(
            metrics.sacksPerGame,
            2
          ),

          takeawaysPerGame: round(
            metrics.takeawaysPerGame,
            2
          ),

          redZonePercentageAllowed:
            round(
              metrics.redZoneDefense,
              1
            ),

          thirdDownPercentageAllowed:
            round(
              metrics.thirdDownDefense,
              1
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
    `POPS Pickz: saved ${ratings.length} defense ratings`
  );

  console.log(
    `Created: ${OUTPUT_FILE}`
  );

  if (ratings[0]) {
    console.log(
      `Top defense: ${ratings[0].team} — ${ratings[0].rating}`
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
    buildDefenseRatings();
  } catch (error) {
    console.error(
      "POPS Pickz defense formula failed:",
      error
    );

    process.exitCode = 1;
  }
}

module.exports = {
  buildDefenseRatings
};