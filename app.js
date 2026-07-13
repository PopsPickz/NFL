/*
=========================================================
POPS PICKZ NFL — APP CONTROLLER
File: app.js
=========================================================
*/

const App = {
  elements: {
    menuButton: null,
    navigation: null,
    navigationButtons: [],
    viewGamesButton: null,
    closeGameModalButton: null,
    gameModalBackdrop: null,
    scheduleStatus: null,
    injuryStatus: null
  },

  /*
  =======================================================
  STARTUP
  =======================================================
  */

  async init() {
    this.cacheElements();
    this.attachNavigationEvents();
    this.attachModalEvents();
    this.attachPageEvents();
    this.attachKeyboardEvents();

    Games.init();

    await this.loadSchedule();
    await this.checkInjuryFile();
  },

  cacheElements() {
    this.elements.menuButton =
      Helpers.byId("menuButton");

    this.elements.navigation =
      Helpers.byId("mainNavigation");

    this.elements.navigationButtons =
      Array.from(
        document.querySelectorAll(
          ".navigation-button"
        )
      );

    this.elements.viewGamesButton =
      Helpers.byId("viewGamesButton");

    this.elements.closeGameModalButton =
      Helpers.byId("closeGameModalButton");

    this.elements.gameModalBackdrop =
      Helpers.byId("gameModalBackdrop");

    this.elements.scheduleStatus =
      Helpers.byId("scheduleStatus");

    this.elements.injuryStatus =
      Helpers.byId("injuryStatus");
  },

  /*
  =======================================================
  SCHEDULE
  =======================================================
  */

  async loadSchedule() {
    this.setScheduleStatus("Loading...");

    try {
      await Games.load();

      const gameCount = Games.games.length;

      if (gameCount > 0) {
        this.setScheduleStatus(
          `${gameCount} games loaded`
        );
      } else {
        this.setScheduleStatus(
          "No games available"
        );
      }
    } catch (error) {
      console.error(
        "POPS Pickz schedule load error:",
        error
      );

      this.setScheduleStatus(
        "Schedule unavailable"
      );
    }
  },

  setScheduleStatus(text) {
    Helpers.setText(
      this.elements.scheduleStatus,
      text
    );
  },

  /*
  =======================================================
  INJURY FILE CHECK
  =======================================================
  */

  async checkInjuryFile() {
    Helpers.setText(
      this.elements.injuryStatus,
      "Checking..."
    );

    const injuryData =
      await Helpers.fetchJSONSafe(
        "injuries.json",
        null
      );

    if (!injuryData) {
      Helpers.setText(
        this.elements.injuryStatus,
        "Not connected"
      );

      return;
    }

    const injuries = Array.isArray(injuryData)
      ? injuryData
      : injuryData.injuries || [];

    Helpers.setText(
      this.elements.injuryStatus,
      injuries.length > 0
        ? `${injuries.length} reports loaded`
        : "No active reports"
    );
  },

  /*
  =======================================================
  NAVIGATION
  =======================================================
  */

  attachNavigationEvents() {
    if (this.elements.menuButton) {
      this.elements.menuButton.addEventListener(
        "click",
        () => {
          this.toggleMenu();
        }
      );
    }

    this.elements.navigationButtons.forEach(
      (button) => {
        button.addEventListener("click", () => {
          const sectionId =
            button.dataset.section;

          this.showSection(sectionId);
          this.closeMenu();
        });
      }
    );
  },

  showSection(sectionId) {
    const sections = [
      "home",
      "games",
      "leaders",
      "defense",
      "tracking"
    ];

    sections.forEach((id) => {
      const section = Helpers.byId(id);

      if (!section) {
        return;
      }

      if (
        id === "home" ||
        id === "games"
      ) {
        section.classList.remove(
          "hidden-section"
        );

        return;
      }

      section.classList.toggle(
        "hidden-section",
        id !== sectionId
      );
    });

    if (
      sectionId === "home" ||
      sectionId === "games"
    ) {
      ["leaders", "defense", "tracking"]
        .forEach((id) => {
          const section = Helpers.byId(id);

          if (section) {
            section.classList.add(
              "hidden-section"
            );
          }
        });
    }

    this.setActiveNavigation(sectionId);

    Helpers.scrollToSection(sectionId);
  },

  setActiveNavigation(sectionId) {
    this.elements.navigationButtons.forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset.section === sectionId
        );
      }
    );
  },

  toggleMenu() {
    if (!this.elements.navigation) {
      return;
    }

    const isOpen =
      this.elements.navigation.classList.toggle(
        "open"
      );

    this.elements.menuButton.setAttribute(
      "aria-expanded",
      String(isOpen)
    );
  },

  closeMenu() {
    if (!this.elements.navigation) {
      return;
    }

    this.elements.navigation.classList.remove(
      "open"
    );

    if (this.elements.menuButton) {
      this.elements.menuButton.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  },

  /*
  =======================================================
  MODAL
  =======================================================
  */

  attachModalEvents() {
    if (this.elements.closeGameModalButton) {
      this.elements.closeGameModalButton
        .addEventListener(
          "click",
          () => {
            Games.closeGame();
          }
        );
    }

    if (this.elements.gameModalBackdrop) {
      this.elements.gameModalBackdrop
        .addEventListener(
          "click",
          () => {
            Games.closeGame();
          }
        );
    }
  },

  /*
  =======================================================
  PAGE EVENTS
  =======================================================
  */

  attachPageEvents() {
    if (this.elements.viewGamesButton) {
      this.elements.viewGamesButton
        .addEventListener(
          "click",
          () => {
            this.showSection("games");
          }
        );
    }

    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth > 900) {
          this.closeMenu();
        }
      }
    );
  },

  /*
  =======================================================
  KEYBOARD
  =======================================================
  */

  attachKeyboardEvents() {
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          Games.closeGame();
          this.closeMenu();
        }
      }
    );
  }
};

/*
=========================================================
START APP
=========================================================
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {
    App.init();
  }
);

window.App = App;