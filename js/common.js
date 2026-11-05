/* Shared nav state, score storage, and small formatters for Scout's Pixel Den. */
(function () {
  "use strict";

  var BEST_PREFIX = "scouts-pixel-den:best:";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function currentFile() {
    var parts = location.pathname.split("/").filter(Boolean);
    var last = parts.length ? parts[parts.length - 1] : "index.html";
    if (!/\.html?$/i.test(last)) return "index.html";
    return last;
  }

  function getBest(id) {
    try {
      var value = Number(localStorage.getItem(BEST_PREFIX + id));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch (err) {
      return 0;
    }
  }

  function setBest(id, score) {
    var next = Math.max(0, Math.floor(Number(score) || 0));
    var best = Math.max(getBest(id), next);
    try {
      localStorage.setItem(BEST_PREFIX + id, String(best));
    } catch (err) {
      /* Private mode or a full disk can refuse localStorage. The run still plays. */
    }
    return best;
  }

  function paintBests() {
    var nodes = document.querySelectorAll("[data-best]");
    Array.prototype.forEach.call(nodes, function (node) {
      node.textContent = String(getBest(node.getAttribute("data-best")));
    });
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var size = bytes;
    var index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    var text = index === 0 ? String(Math.round(size)) : String(Math.round(size * 10) / 10);
    return text + " " + units[index];
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    var total = Math.round(seconds);
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var secs = total % 60;
    var padded = String(secs).padStart(2, "0");
    if (hours > 0) return hours + ":" + String(minutes).padStart(2, "0") + ":" + padded;
    return minutes + ":" + padded;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function markNav() {
    var nav = document.querySelector("[data-nav]");
    if (!nav) return;
    var file = currentFile();
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (link) {
      var href = link.getAttribute("href") || "";
      if (href === file) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  window.ScoutDen = {
    ready: ready,
    getBest: getBest,
    setBest: setBest,
    paintBests: paintBests,
    formatBytes: formatBytes,
    formatDuration: formatDuration,
    roundRect: roundRect
  };

  window.ScoutGames = window.ScoutGames || {};

  ready(function () {
    markNav();
    paintBests();
  });
})();
