/*
=========================================================
POPS PICKZ NFL — GAME SCHEDULE DISPLAY
File: games.js
=========================================================

Loads the NFL schedule, displays clickable game cards,
and opens the completed POPS matchup projection view.
=========================================================
*/

const Games = {
  games: [],
  selectedGame: null,
  modalRequestId: 0,

  elements: {
    container: null,
    weekLabel: null,
    modal: null,
    modalContent: null,
    modalTitle: null
  },

  /*
  =======================================================
  STARTUP
  =======================================================
  */

  init() {
    this.elements.container =
      Helpers.byId("gamesContainer");

    this.elements.weekLabel =
      Helpers.byId("currentWeekLabel");

    this.elements.modal =
      Helpers.byId("gameModal");

    this.elements.modalContent =
      Helpers.byId("gameModalContent");

    this.elements.modalTitle =
      Helpers.byId("gameModalTitle");
  },

  /*
  =======================================================
  LOAD SCHEDULE
  =======================================================
  */

  async load() {
    if (!this.elements.container) {
      this.init();
    }

    this.showLoading();

    const scheduleData =
      await Helpers.fetchJSONSafe(
        "./schedule.json",
        {
          season: new Date().getFullYear(),
          week: 1,
          games: []
        }
      );

    this.games = Array.isArray(scheduleData)
      ? scheduleData
      : scheduleData.games || [];

    const week =
      scheduleData.week ||
      scheduleData.weekNumber ||
      this.getWeekFromGames() ||
      1;

    this.updateWeekLabel(week);

    if (!this.games.length) {
      this.showEmptyState();
      return;
    }

    this.render();
  },

  getWeekFromGames() {
    const firstGame = this.games[0];

    return (
      firstGame?.week ||
      firstGame?.weekNumber ||
      null
    );
  },

  updateWeekLabel(week) {
    if (!this.elements.weekLabel) {
      return;
    }

    this.elements.weekLabel.textContent =
      `NFL Week ${week}`;
  },

  /*
  =======================================================
  GAME CARDS
  =======================================================
  */

  render() {
    if (!this.elements.container) {
      return;
    }

    const sortedGames = [...this.games].sort(
      (gameA, gameB) => {
        const dateA = new Date(
          gameA.date ||
          gameA.startTime ||
          0
        );

        const dateB = new Date(
          gameB.date ||
          gameB.startTime ||
          0
        );

        return dateA - dateB;
      }
    );

    this.elements.container.innerHTML =
      sortedGames
        .map((game) => {
          return this.createGameCard(game);
        })
        .join("");

    this.attachGameListeners();
  },

  createGameCard(game) {
    const gameId = Helpers.escapeHTML(
      Helpers.getGameId(game)
    );

    const awayTeam =
      game.awayTeam ||
      game.away ||
      {};

    const homeTeam =
      game.homeTeam ||
      game.home ||
      {};

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

    const awayRecord = Helpers.escapeHTML(
      Helpers.getTeamRecord(awayTeam)
    );

    const homeRecord = Helpers.escapeHTML(
      Helpers.getTeamRecord(homeTeam)
    );

    const gameDate =
      game.date ||
      game.startTime ||
      "";

    const gameStatus = Helpers.escapeHTML(
      Helpers.getGameStatus(game)
    );

    const venue = Helpers.escapeHTML(
      game.venue ||
      game.location ||
      "Venue TBD"
    );

    return `
      <article
        class="game-card"
        data-game-id="${gameId}"
        tabindex="0"
        role="button"
        aria-label="Open POPS Pickz for ${awayName} at ${homeName}"
      >
        <div class="game-card-top">

          <div class="game-date">
            <strong>
              ${Helpers.formatDate(gameDate)}
            </strong>

            <span>
              ${Helpers.formatTime(gameDate)}
            </span>
          </div>

          <span class="game-status">
            ${gameStatus}
          </span>

        </div>

        <div class="game-matchup">

          <div class="game-team away-team">

            ${this.createTeamLogo(
              awayLogo,
              awayName
            )}

            <div class="game-team-text">
              <span class="team-label">
                Away
              </span>

              <strong>${awayName}</strong>

              <span class="team-record">
                ${awayRecord}
              </span>
            </div>

          </div>

          <div class="game-versus">
            <span>@</span>
          </div>

          <div class="game-team home-team">

            ${this.createTeamLogo(
              homeLogo,
              homeName
            )}

            <div class="game-team-text">
              <span class="team-label">
                Home
              </span>

              <strong>${homeName}</strong>

              <span class="team-record">
                ${homeRecord}
              </span>
            </div>

          </div>

        </div>

        <div class="game-card-bottom">

          <span class="game-venue">
            📍 ${venue}
          </span>

          <button
            type="button"
            class="view-pickz-button"
            data-game-id="${gameId}"
          >
            View POPS Pickz
          </button>

        </div>
      </article>
    `;
  },

  createTeamLogo(logo, teamName) {
    if (logo) {
      return `
        <img
          class="team-logo"
          src="${logo}"
          alt="${teamName} logo"
          loading="lazy"
        />
      `;
    }

    const abbreviation = teamName
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .slice(0, 3);

    return `
      <div class="team-logo-fallback">
        ${Helpers.escapeHTML(abbreviation)}
      </div>
    `;
  },

  /*
  =======================================================
  GAME EVENTS
  =======================================================
  */

  attachGameListeners() {
    const gameCards =
      this.elements.container.querySelectorAll(
        ".game-card"
      );

    gameCards.forEach((card) => {
      card.addEventListener(
        "click",
        () => {
          this.openGame(
            card.dataset.gameId
          );
        }
      );

      card.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();

            this.openGame(
              card.dataset.gameId
            );
          }
        }
      );
    });
  },

  /*
  =======================================================
  GAME MODAL
  =======================================================
  */

  async openGame(gameId) {
    const game = this.games.find((item) => {
      return String(
        Helpers.getGameId(item)
      ) === String(gameId);
    });

    if (!game) {
      return;
    }

    this.selectedGame = game;

    const requestId =
      ++this.modalRequestId;

    this.setModalTitle(game);
    this.showModalLoading();

    this.elements.modal.classList.add(
      "open"
    );

    this.elements.modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "modal-open"
    );

    try {
      if (
        typeof MatchupView === "undefined" ||
        typeof MatchupView.render !==
          "function"
      ) {
        throw new Error(
          "matchup-view.js is not loaded"
        );
      }

      const matchupHTML =
        await MatchupView.render(game);

      if (
        requestId !== this.modalRequestId ||
        this.selectedGame !== game
      ) {
        return;
      }

      this.elements.modalContent.innerHTML =
        matchupHTML;
    } catch (error) {
      console.error(
        "POPS matchup display error:",
        error
      );

      if (
        requestId !== this.modalRequestId
      ) {
        return;
      }

      this.showModalError(error);
    }
  },

  setModalTitle(game) {
    const awayTeam =
      game.awayTeam ||
      game.away ||
      {};

    const homeTeam =
      game.homeTeam ||
      game.home ||
      {};

    const awayName =
      Helpers.getTeamName(awayTeam);

    const homeName =
      Helpers.getTeamName(homeTeam);

    if (this.elements.modalTitle) {
      this.elements.modalTitle.textContent =
        `${awayName} at ${homeName}`;
    }
  },

  closeGame() {
    if (!this.elements.modal) {
      return;
    }

    this.modalRequestId += 1;

    this.elements.modal.classList.remove(
      "open"
    );

    this.elements.modal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "modal-open"
    );

    this.selectedGame = null;
  },

  showModalLoading() {
    if (!this.elements.modalContent) {
      return;
    }

    this.elements.modalContent.innerHTML = `
      <div class="loading-card">

        <div class="loading-spinner"></div>

        <p>
          Loading POPS Pickz matchup...
        </p>

      </div>
    `;
  },

  showModalError(error) {
    if (!this.elements.modalContent) {
      return;
    }

    const message =
      error?.message ||
      "The matchup projection could not be loaded.";

    this.elements.modalContent.innerHTML = `
      <div class="placeholder-card">

        <span>⚠️</span>

        <h3>
          POPS projection unavailable
        </h3>

        <p>
          ${Helpers.escapeHTML(message)}
        </p>

      </div>
    `;
  },

  /*
  =======================================================
  SCHEDULE STATES
  =======================================================
  */

  showLoading() {
    if (!this.elements.container) {
      return;
    }

    this.elements.container.innerHTML = `
      <div class="loading-card">

        <div class="loading-spinner"></div>

        <p>
          Loading updated NFL schedule...
        </p>

      </div>
    `;
  },

  showEmptyState() {
    if (!this.elements.container) {
      return;
    }

    this.elements.container.innerHTML = `
      <div class="placeholder-card">

        <span>🏈</span>

        <h3>
          No NFL games found
        </h3>

        <p>
          The current NFL schedule file does not contain
          any games.
        </p>

      </div>
    `;
  }
};

window.Games = Games;