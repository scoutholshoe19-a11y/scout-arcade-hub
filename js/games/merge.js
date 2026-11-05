/* Original Merge Tiles for Scout's Pixel Den. A 4×4 sliding number board. */
(function () {
  "use strict";

  var PAD = 18;
  var GAP = 12;
  var CELL = (480 - PAD * 2 - GAP * 3) / 4;

  function mount(canvas, api) {
    var ctx = canvas.getContext("2d");
    var roundRect = window.ScoutDen.roundRect;
    var running = true;
    var grid = [];
    var score = 0;
    var alive = true;
    var announced = false;
    var born = null;
    var swipe = null;

    function colors(value) {
      var map = {
        2: ["#2a2140", "#f6f1ff"],
        4: ["#3c2b58", "#f6f1ff"],
        8: ["#ff4d8d", "#2a0616"],
        16: ["#ff7a59", "#2a100c"],
        32: ["#ffc857", "#2a1c08"],
        64: ["#ffe08a", "#2a1c08"],
        128: ["#62f6d6", "#102117"],
        256: ["#35d7be", "#06221c"],
        512: ["#9b87ff", "#f6f1ff"],
        1024: ["#d7ccff", "#1a1030"],
        2048: ["#fff4d2", "#2a1c08"],
        4096: ["#fff6ea", "#2a1c08"]
      };
      return map[value] || ["#f6f1ff", "#140c1e"];
    }

    function highest() {
      var best = 0;
      grid.forEach(function (row) {
        row.forEach(function (value) {
          if (value > best) best = value;
        });
      });
      return best;
    }

    function emptyCells() {
      var cells = [];
      var y;
      var x;
      for (y = 0; y < 4; y += 1) {
        for (x = 0; x < 4; x += 1) {
          if (grid[y][x] === 0) cells.push({ x: x, y: y });
        }
      }
      return cells;
    }

    function spawn() {
      var cells = emptyCells();
      if (!cells.length) return false;
      var cell = cells[Math.floor(Math.random() * cells.length)];
      grid[cell.y][cell.x] = Math.random() < 0.9 ? 2 : 4;
      born = cell;
      return true;
    }

    function canMove(board) {
      var y;
      var x;
      for (y = 0; y < 4; y += 1) {
        for (x = 0; x < 4; x += 1) {
          var value = board[y][x];
          if (value === 0) return true;
          if (x < 3 && value === board[y][x + 1]) return true;
          if (y < 3 && value === board[y + 1][x]) return true;
        }
      }
      return false;
    }

    function reset() {
      canvas.width = 480;
      canvas.height = 480;
      grid = [0, 1, 2, 3].map(function () { return [0, 0, 0, 0]; });
      score = 0;
      alive = true;
      announced = false;
      born = null;
      spawn();
      spawn();
      api.score(0);
      api.meta("Top tile " + highest());
      api.note("");
      api.overlay(null);
      draw();
    }

    function slide(line) {
      var tiles = line.filter(function (value) { return value !== 0; });
      var out = [];
      var gained = 0;
      var madeBig = false;
      var i;
      for (i = 0; i < tiles.length; i += 1) {
        if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
          var fused = tiles[i] * 2;
          out.push(fused);
          gained += fused;
          if (fused >= 2048) madeBig = true;
          i += 1;
        } else {
          out.push(tiles[i]);
        }
      }
      while (out.length < 4) out.push(0);
      return { out: out, gained: gained, madeBig: madeBig };
    }

    function move(dir) {
      if (!alive) return;
      var next = grid.map(function (row) { return row.slice(); });
      var gained = 0;
      var changed = false;
      var madeBig = false;

      if (dir === "left" || dir === "right") {
        next.forEach(function (row, y) {
          var line = row.slice();
          if (dir === "right") line.reverse();
          var result = slide(line);
          var out = result.out.slice();
          if (dir === "right") out.reverse();
          gained += result.gained;
          if (result.madeBig) madeBig = true;
          var x;
          for (x = 0; x < 4; x += 1) {
            if (out[x] !== grid[y][x]) changed = true;
          }
          next[y] = out;
        });
      } else {
        var x;
        for (x = 0; x < 4; x += 1) {
          var line = [0, 1, 2, 3].map(function (y) { return next[y][x]; });
          if (dir === "down") line.reverse();
          var result = slide(line);
          var out = result.out.slice();
          if (dir === "down") out.reverse();
          gained += result.gained;
          if (result.madeBig) madeBig = true;
          var y;
          for (y = 0; y < 4; y += 1) {
            if (out[y] !== grid[y][x]) changed = true;
            next[y][x] = out[y];
          }
        }
      }

      if (!changed) return;
      grid = next;
      score += gained;
      api.score(score);
      spawn();
      api.meta("Top tile " + highest());
      if (!canMove(grid)) {
        alive = false;
        api.finish(score, "No moves left.");
      } else if (madeBig && !announced) {
        announced = true;
        api.note("You built a 2,048 tile. Keep going.");
      }
      draw();
    }

    function draw() {
      ctx.fillStyle = "#100816";
      ctx.fillRect(0, 0, 480, 480);
      var y;
      var x;
      for (y = 0; y < 4; y += 1) {
        for (x = 0; x < 4; x += 1) {
          var px = PAD + x * (CELL + GAP);
          var py = PAD + y * (CELL + GAP);
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          roundRect(ctx, px, py, CELL, CELL, 14);
          ctx.fill();
          var value = grid[y][x];
          if (!value) continue;
          var pair = colors(value);
          ctx.fillStyle = pair[0];
          roundRect(ctx, px, py, CELL, CELL, 14);
          ctx.fill();
          if (born && born.x === x && born.y === y) {
            ctx.strokeStyle = "#62f6d6";
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          ctx.fillStyle = pair[1];
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          var size = value >= 1024 ? 28 : value >= 128 ? 34 : 42;
          ctx.font = "700 " + size + "px Outfit, sans-serif";
          ctx.fillText(String(value), px + CELL / 2, py + CELL / 2 + 1);
        }
      }
    }

    function onKey(event) {
      var map = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
        A: "left",
        D: "right",
        W: "up",
        S: "down"
      };
      var dir = map[event.key];
      if (!dir) return;
      event.preventDefault();
      move(dir);
    }

    function onPointerDown(event) {
      if (event.button != null && event.button !== 0) return;
      swipe = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event) {
      if (!swipe) return;
      var dx = event.clientX - swipe.x;
      var dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.hypot(dx, dy) < 28) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
      else move(dy > 0 ? "down" : "up");
    }

    document.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    reset();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (running) draw();
      });
    }

    return {
      destroy: function () {
        running = false;
        document.removeEventListener("keydown", onKey);
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
      }
    };
  }

  window.ScoutGames = window.ScoutGames || {};
  window.ScoutGames.merge = mount;
})();
