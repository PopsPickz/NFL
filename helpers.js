/*
=========================================================
POPS PICKZ NFL — GENERAL HELPERS
File: helpers.js
=========================================================
*/

const Helpers = {
  /*
  =======================================================
  NUMBER HELPERS
  =======================================================
  */

  number(value, fallback = 0) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue)
      ? parsedValue
      : fallback;
  },

  round(value, decimalPlaces = 1) {
    const numericValue = this.number(value, 0);
    const multiplier = 10 ** decimalPlaces;

    return (
      Math.round(
        numericValue * multiplier
      ) / multiplier
    );
  },

  clamp(value, minimum = 0, maximum = 100) {
    const numericValue = this.number(value, minimum);

    return Math.min(
      maximum,
      Math.max(minimum, numericValue)
    );
  },

  percentage(value, decimalPlaces = 0) {
    const numericValue = this.number(value, 0);

    return `${this.round(
      numericValue,
      decimalPlaces
    )}%`;
  },

  /*
  =======================================================
  TEXT HELPERS
  =======================================================
  */

  safeText(value, fallback = "N/A") {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    return String(value);
  },

  escapeHTML(value) {
    return this.safeText(value, "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  titleCase(value) {
    return this.safeText(value, "")
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((word) => {
        return (
          word.charAt(0).toUpperCase() +
          word.slice(1)
        );
      })
      .join(" ");
  },

  /*
  =======================================================
  DATE HELPERS
  =======================================================
  */

  formatDate(dateValue) {
    if (!dateValue) {
      return "Date TBD";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date TBD";
    }

    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  },

  formatTime(dateValue) {
    if (!dateValue) {
      return "Time TBD";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Time TBD";
    }

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
  },

  formatDateTime(dateValue) {
    if (!dateValue) {
      return "Date and time TBD";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date and time TBD";
    }

    return date.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  },

  /*
  =======================================================
  NETWORK HELPERS
  =======================================================
  */

  async fetchJSON(url, options = {}) {
    const settings = {
      cache: "no-store",
      ...options
    };

    const response = await fetch(url, settings);

    if (!response.ok) {
      throw new Error(
        `Request failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  },

  async fetchJSONSafe(
    url,
    fallback = null,
    options = {}
  ) {
    try {
      return await this.fetchJSON(url, options);
    } catch (error) {
      console.warn(
        `POPS Pickz could not load ${url}:`,
        error
      );

      return fallback;
    }
  },

  /*
  =======================================================
  TEAM HELPERS
  =======================================================
  */

  getTeamName(team = {}) {
    return (
      team.displayName ||
      team.name ||
      team.shortDisplayName ||
      team.abbreviation ||
      "Unknown Team"
    );
  },

  getTeamAbbreviation(team = {}) {
    return (
      team.abbreviation ||
      team.shortName ||
      team.name ||
      "NFL"
    );
  },

  getTeamLogo(team = {}) {
    if (team.logo) {
      return team.logo;
    }

    if (
      Array.isArray(team.logos) &&
      team.logos.length > 0
    ) {
      return (
        team.logos[0].href ||
        team.logos[0].url ||
        ""
      );
    }

    return "";
  },

  getTeamRecord(team = {}) {
    if (team.record) {
      return team.record;
    }

    if (
      Array.isArray(team.records) &&
      team.records.length > 0
    ) {
      return (
        team.records[0].summary ||
        team.records[0].displayValue ||
        "0-0"
      );
    }

    return "0-0";
  },

  /*
  =======================================================
  GAME HELPERS
  =======================================================
  */

  getGameId(game = {}) {
    return (
      game.id ||
      game.gameId ||
      game.uid ||
      ""
    );
  },

  getGameStatus(game = {}) {
    return (
      game.status?.type?.detail ||
      game.status?.type?.shortDetail ||
      game.status?.displayClock ||
      game.statusText ||
      "Scheduled"
    );
  },

  isGameFinal(game = {}) {
    return Boolean(
      game.status?.type?.completed ||
      game.completed === true
    );
  },

  isGameLive(game = {}) {
    const state =
      game.status?.type?.state ||
      game.state ||
      "";

    return state === "in";
  },

  /*
  =======================================================
  DOM HELPERS
  =======================================================
  */

  byId(id) {
    return document.getElementById(id);
  },

  show(element) {
    if (!element) {
      return;
    }

    element.hidden = false;
    element.style.display = "";
  },

  hide(element) {
    if (!element) {
      return;
    }

    element.hidden = true;
  },

  setText(element, value) {
    if (!element) {
      return;
    }

    element.textContent = this.safeText(
      value,
      ""
    );
  },

  setHTML(element, value) {
    if (!element) {
      return;
    }

    element.innerHTML = this.safeText(
      value,
      ""
    );
  },

  scrollToSection(sectionId) {
    const section = this.byId(sectionId);

    if (!section) {
      return;
    }

    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  },

  /*
  =======================================================
  STORAGE HELPERS
  =======================================================
  */

  saveLocal(key, value) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;
    } catch (error) {
      console.warn(
        "POPS Pickz localStorage save error:",
        error
      );

      return false;
    }
  },

  loadLocal(key, fallback = null) {
    try {
      const savedValue = localStorage.getItem(key);

      if (!savedValue) {
        return fallback;
      }

      return JSON.parse(savedValue);
    } catch (error) {
      console.warn(
        "POPS Pickz localStorage load error:",
        error
      );

      return fallback;
    }
  },

  removeLocal(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(
        "POPS Pickz localStorage remove error:",
        error
      );

      return false;
    }
  }
};

window.Helpers = Helpers;