/*
=========================================================
POPS PICKZ NFL — MATCHUP VIEW
File: matchup-view.js
=========================================================

Loads matchup-projections.json and renders:

- POPS favorite
- Confidence
- Projected score
- Overall ratings
- Passing advantage
- Rushing advantage
- Receiving advantage
- Defense advantage
- Scoring advantage
- POPS reasons
=========================================================
*/

const MatchupView = {
  projections: [],
  loaded: false,

  /*
  =======================================================
  LOAD PROJECTIONS
  =======================================================
  */

  async load() {
    if (this.loaded) {
      return this.projections;
    }

    const data = await Helpers.fetchJSONSafe(
      "./matchup-projections.json",
      {
        matchups: []
      }
    );

    this.projections = Array.isArray(data)
      ? data
      : data.matchups || [];

    this.loaded = true;

    return this.projections;
  },

  /*
  =======================================================
  FIND MATCHUP
  =======================================================
  */

  findByGameId(gameId) {
    return this.projections.find((matchup) => {
      return String(matchup.gameId) === String(gameId);
    }) || null;
  },

  /*
  =======================================================
  MAIN RENDER
  =======================================================
  */

  async render(game) {
    await this.load();

    const gameId = Helpers.getGameId(game);
    const projection = this.findByGameId(gameId);

    if (!projection) {
      return this.renderUnavailable(game);
    }

    return this.renderProjection(projection);
  },

  renderProjection(projection) {
    const awayTeam = projection.awayTeam || {};
    const homeTeam = projection.homeTeam || {};

    const awayName = Helpers.escapeHTML(
      Helpers.getTeamName(awayTeam)
    );

    const homeName = Helpers.escapeHTML(
      Helpers.getTeamName(homeTeam)
    );

    const awayLogo = Helpers.escapeHTML(
      Helpers.getTeamLogo(awayTeam)
    );

    const homeLogo = Helpers.escapeHTML(
      Helpers.getTeamLogo(homeTeam)
    );

    const pick = projection.popsPick || {};
    const confidence = pick.confidence || {};
    const projectedScore = projection.projectedScore || {};
    const ratings = projection.ratings || {};

    return `
      <section class="pops-matchup">

        ${this.renderMatchupHeader({
          awayName,
          homeName,
          awayLogo,
          homeLogo,
          awayTeam,
          homeTeam
        })}

        ${this.renderPickCard({
          pick,
          confidence,
          projectedScore
        })}

        ${this.renderOverallRatings({
          awayName,
          homeName,
          awayRating: ratings.away?.overall,
          homeRating: ratings.home?.overall,
          homeBonus: ratings.home?.homeFieldBonus
        })}

        ${this.renderCategories(
          projection.categories || [],
          awayName,
          homeName
        )}

        ${this.renderReasons(
          projection.reasons || []
        )}

        ${this.renderDataNotice(
          projection.dataQuality
        )}

        ${this.renderPlayerPlaceholder()}

      </section>
    `;
  },

  /*
  =======================================================
  MATCHUP HEADER
  =======================================================
  */

  renderMatchupHeader({
    awayName,
    homeName,
    awayLogo,
    homeLogo,
    awayTeam,
    homeTeam
  }) {
    return `
      <div class="pops-matchup-header">

        <div class="pops-header-team">

          ${this.renderLogo(
            awayLogo,
            awayName
          )}

          <span>Away Team</span>

          <h3>${awayName}</h3>

          <small>
            ${Helpers.escapeHTML(
              Helpers.getTeamRecord(awayTeam)
            )}
          </small>

        </div>

        <div class="pops-header-versus">
          VS
        </div>

        <div class="pops-header-team">

          ${this.renderLogo(
            homeLogo,
            homeName
          )}

          <span>Home Team</span>

          <h3>${homeName}</h3>

          <small>
            ${Helpers.escapeHTML(
              Helpers.getTeamRecord(homeTeam)
            )}
          </small>

        </div>

      </div>
    `;
  },

  renderLogo(logo, teamName) {
    if (logo) {
      return `
        <img
          class="pops-header-logo"
          src="${logo}"
          alt="${teamName} logo"
        />
      `;
    }

    const abbreviation = teamName
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .slice(0, 3);

    return `
      <div class="pops-header-logo-fallback">
        ${Helpers.escapeHTML(abbreviation)}
      </div>
    `;
  },

  /*
  =======================================================
  POPS PICK
  =======================================================
  */

  renderPickCard({
    pick,
    confidence,
    projectedScore
  }) {
    const stars = this.renderStars(
      confidence.stars || 1
    );

    return `
      <div class="pops-pick-card">

        <p class="pops-card-label">
          🏆 POPS PICK
        </p>

        <h2>
          ${Helpers.escapeHTML(
            pick.team || "Pick unavailable"
          )}
        </h2>

        <div class="pops-pick-summary">

          <div>
            <span>Confidence</span>

            <strong>
              ${Helpers.number(
                confidence.percentage,
                50
              )}%
            </strong>

            <small>
              ${Helpers.escapeHTML(
                confidence.tier ||
                "Toss-Up"
              )}
            </small>
          </div>

          <div>
            <span>POPS Edge</span>

            <strong>
              +${Helpers.round(
                pick.edge,
                1
              )}
            </strong>

            <small>${stars}</small>
          </div>

          <div>
            <span>Projected Score</span>

            <strong>
              ${Helpers.escapeHTML(
                projectedScore.display ||
                "Unavailable"
              )}
            </strong>
          </div>

        </div>

      </div>
    `;
  },

  renderStars(starCount) {
    const count = Math.max(
      1,
      Math.min(5, Number(starCount) || 1)
    );

    return "★".repeat(count) +
      "☆".repeat(5 - count);
  },

  /*
  =======================================================
  OVERALL RATINGS
  =======================================================
  */

  renderOverallRatings({
    awayName,
    homeName,
    awayRating,
    homeRating,
    homeBonus
  }) {
    const awayWins =
      Helpers.number(awayRating) >
      Helpers.number(homeRating);

    const homeWins =
      Helpers.number(homeRating) >
      Helpers.number(awayRating);

    return `
      <div class="overall-rating-grid">

        <div class="overall-rating-card">
          <span>${awayName}</span>

          <strong>
            ${Helpers.round(
              awayRating,
              1
            )}
          </strong>

          <small>
            POPS Overall
            ${awayWins ? " ✅" : ""}
          </small>
        </div>

        <div class="overall-rating-card">
          <span>${homeName}</span>

          <strong>
            ${Helpers.round(
              homeRating,
              1
            )}
          </strong>

          <small>
            POPS Overall
            ${homeWins ? " ✅" : ""}
          </small>

          ${
            Helpers.number(homeBonus) > 0
              ? `
                <em>
                  +${Helpers.round(
                    homeBonus,
                    1
                  )} home field
                </em>
              `
              : ""
          }
        </div>

      </div>
    `;
  },

  /*
  =======================================================
  CATEGORY COMPARISON
  =======================================================
  */

  renderCategories(
    categories,
    awayName,
    homeName
  ) {
    const rows = categories
      .map((category) => {
        return this.renderCategoryRow(
          category,
          awayName,
          homeName
        );
      })
      .join("");

    return `
      <section class="pops-category-section">

        <div class="pops-section-title">
          <div>
            <p>POPS MATCHUP BREAKDOWN</p>
            <h3>Category Advantages</h3>
          </div>
        </div>

        <div class="pops-category-table">
          ${rows}
        </div>

      </section>
    `;
  },

  renderCategoryRow(
    category,
    awayName,
    homeName
  ) {
    const awayWinner =
      category.winner === "away";

    const homeWinner =
      category.winner === "home";

    const tie =
      category.winner === "tie";

    return `
      <div class="pops-category-row">

        <div
          class="pops-category-team
          ${awayWinner ? "category-winner" : ""}"
        >
          <strong>
            ${Helpers.round(
              category.awayRating,
              1
            )}
          </strong>

          <span>
            ${awayName}
            ${awayWinner ? " ✅" : ""}
          </span>
        </div>

        <div class="pops-category-name">

          <strong>
            ${this.getCategoryIcon(
              category.category
            )}
            ${Helpers.escapeHTML(
              category.category
            )}
          </strong>

          <small>
            ${
              tie
                ? "Even matchup"
                : `${Helpers.round(
                    category.difference,
                    1
                  )} point edge`
            }
          </small>

          ${
            category.limitedData
              ? `
                <em>
                  Limited data
                </em>
              `
              : ""
          }

        </div>

        <div
          class="pops-category-team
          ${homeWinner ? "category-winner" : ""}"
        >
          <strong>
            ${Helpers.round(
              category.homeRating,
              1
            )}
          </strong>

          <span>
            ${homeName}
            ${homeWinner ? " ✅" : ""}
          </span>
        </div>

      </div>
    `;
  },

  getCategoryIcon(category) {
    const icons = {
      Passing: "🏈",
      Rushing: "🏃",
      Receiving: "🙌",
      Defense: "🛡️",
      Scoring: "🔥"
    };

    return icons[category] || "📊";
  },

  /*
  =======================================================
  REASONS
  =======================================================
  */

  renderReasons(reasons) {
    if (!reasons.length) {
      return "";
    }

    return `
      <section class="pops-reasons">

        <p class="pops-card-label">
          📝 WHY POPS LIKES THE PICK
        </p>

        <div class="pops-reason-list">

          ${reasons
            .map((reason) => {
              return `
                <div class="pops-reason">
                  <span>✅</span>

                  <p>
                    ${Helpers.escapeHTML(
                      reason
                    )}
                  </p>
                </div>
              `;
            })
            .join("")}

        </div>

      </section>
    `;
  },

  /*
  =======================================================
  DATA QUALITY
  =======================================================
  */

  renderDataNotice(dataQuality = {}) {
    if (!dataQuality?.note) {
      return "";
    }

    return `
      <div class="pops-data-notice">
        <strong>Data note:</strong>

        <span>
          ${Helpers.escapeHTML(
            dataQuality.note
          )}
        </span>
      </div>
    `;
  },

  /*
  =======================================================
  PLAYER PLACEHOLDER
  =======================================================
  */

  renderPlayerPlaceholder() {
    return `
      <section class="player-projection-preview">

        <p class="pops-card-label">
          PLAYER PROJECTIONS
        </p>

        <div class="player-preview-grid">

          <div>
            <span>🏈</span>
            <strong>Passing</strong>
            <small>Coming in Phase 2</small>
          </div>

          <div>
            <span>🏃</span>
            <strong>Rushing</strong>
            <small>Coming in Phase 2</small>
          </div>

          <div>
            <span>🙌</span>
            <strong>Receiving</strong>
            <small>Coming in Phase 2</small>
          </div>

          <div>
            <span>🎯</span>
            <strong>TD Scorers</strong>
            <small>Coming in Phase 2</small>
          </div>

        </div>

      </section>
    `;
  },

  /*
  =======================================================
  UNAVAILABLE
  =======================================================
  */

  renderUnavailable(game) {
    const awayTeam =
      game.awayTeam ||
      game.away ||
      {};

    const homeTeam =
      game.homeTeam ||
      game.home ||
      {};

    return `
      <div class="placeholder-card">

        <span>📊</span>

        <h3>
          POPS projection unavailable
        </h3>

        <p>
          No matchup projection was found for
          ${Helpers.escapeHTML(
            Helpers.getTeamName(awayTeam)
          )}
          at
          ${Helpers.escapeHTML(
            Helpers.getTeamName(homeTeam)
          )}.
        </p>

      </div>
    `;
  }
};

window.MatchupView = MatchupView;