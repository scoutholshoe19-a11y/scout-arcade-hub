/* Lobby, scoreboard, and lifecycle for the four canvas games. */
(function () {
  "use strict";

  var Scout = window.ScoutDen;

  function isControl(node) {
    return Boolean(node && node.closest && node.closest("button, a, input, textarea, select, label"));
  }

  Scout.ready(function () {
    var lobby = document.getElementById("lobby");
    var stage = document.getElementById("stage");
    if (!lobby || !stage) return;

    var canvas = document.getElementById("board");
    var titleEl = document.getElementById("stage-title");
    var controlsEl = document.getElementById("stage-controls");
    var scoreEl = document.getElementById("hud-score");
    var bestEl = document.getElementById("hud-best");
    var extraEl = document.getElementById("hud-extra");
    var noteEl = document.getElementById("hud-note");
    var overlay = document.getElementById("board-overlay");
    var live = document.getElementById("live-region");
    var restart = document.getElementById("restart");
    var back = document.getElementById("back-to-lobby");
    var current = "";
    var session = null;

    function clearNote() {
      noteEl.textContent = "";
      noteEl.hidden = true;
    }

    function apiFor(id) {
      var ended = false;
      var openingBest = Scout.getBest(id);
      return {
        score: function (value) {
          var next = Math.max(0, Math.floor(Number(value) || 0));
          scoreEl.textContent = String(next);
          if (next > Scout.getBest(id)) {
            bestEl.textContent = String(Scout.setBest(id, next));
            Scout.paintBests();
          }
          if (live) live.textContent = titleEl.textContent + " score " + next;
        },
        meta: function (text) {
          var value = text ? String(text) : "";
          extraEl.textContent = value;
          extraEl.hidden = value.length === 0;
        },
        note: function (text) {
          if (ended) return;
          var value = text ? String(text) : "";
          noteEl.textContent = value;
          noteEl.hidden = value.length === 0;
        },
        overlay: function (text) {
          if (ended) return;
          if (!text) {
            overlay.hidden = true;
            overlay.textContent = "";
            return;
          }
          overlay.hidden = false;
          overlay.textContent = String(text);
        },
        finish: function (value, message) {
          if (ended) return;
          ended = true;
          var score = Math.max(0, Math.floor(Number(value) || 0));
          var best = Scout.setBest(id, score);
          scoreEl.textContent = String(score);
          bestEl.textContent = String(best);
          Scout.paintBests();
          clearNote();
          var bits = [];
          if (message) bits.push(String(message));
          bits.push("Score " + score + ".");
          bits.push(score > openingBest && score > 0 ? "New best." : "Best " + best + ".");
          var line = bits.join(" ");
          overlay.hidden = false;
          overlay.textContent = line;
          if (live) live.textContent = line;
        }
      };
    }

    function destroySession() {
      if (session && typeof session.destroy === "function") session.destroy();
      session = null;
    }

    function showLobby() {
      destroySession();
      current = "";
      stage.hidden = true;
      lobby.hidden = false;
      Scout.paintBests();
    }

    function showGame(id) {
      var mount = window.ScoutGames && window.ScoutGames[id];
      var card = lobby.querySelector('[data-game="' + id + '"]');
      if (typeof mount !== "function" || !card) {
        showLobby();
        if (location.hash) location.hash = "";
        return;
      }
      destroySession();
      current = id;
      lobby.hidden = true;
      stage.hidden = false;
      titleEl.textContent = card.querySelector("h2").textContent;
      controlsEl.textContent = card.querySelector(".controls").textContent;
      scoreEl.textContent = "0";
      bestEl.textContent = String(Scout.getBest(id));
      extraEl.hidden = true;
      extraEl.textContent = "";
      clearNote();
      overlay.hidden = true;
      overlay.textContent = "";
      canvas.setAttribute("aria-label", titleEl.textContent + " board");
      session = mount(canvas, apiFor(id), { isControl: isControl }) || null;
      try {
        canvas.focus({ preventScroll: true });
      } catch (err) {
        canvas.focus();
      }
    }

    function sync() {
      var id = (location.hash || "").replace(/^#/, "");
      if (!id) showLobby();
      else showGame(id);
    }

    restart.addEventListener("click", function () {
      if (current) showGame(current);
    });

    back.addEventListener("click", function () {
      showLobby();
      if (location.hash) location.hash = "";
    });

    window.addEventListener("hashchange", sync);
    sync();
  });
})();
