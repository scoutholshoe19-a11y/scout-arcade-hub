/* Original Neon Snake for Scout's Pixel Den. */
(function () {
  "use strict";

  var COLS = 20;
  var CELL = 24;

  function mount(canvas, api) {
    var ctx = canvas.getContext("2d");
    var roundRect = window.ScoutDen.roundRect;
    var running = true;
    var raf = 0;
    var swipe = null;
    var state = {
      snake: [],
      dir: { x: 1, y: 0 },
      queue: [],
      food: { x: 10, y: 10 },
      score: 0,
      alive: true,
      acc: 0,
      last: 0,
      tick: 160
    };

    function paceLabel() {
      if (state.tick > 120) return "Easy glide";
      if (state.tick > 84) return "Picking up";
      return "Blazing";
    }

    function placeFood() {
      var open = [];
      var y;
      var x;
      for (y = 0; y < COLS; y += 1) {
        for (x = 0; x < COLS; x += 1) {
          if (!state.snake.some(function (part) { return part.x === x && part.y === y; })) {
            open.push({ x: x, y: y });
          }
        }
      }
      if (!open.length) {
        state.alive = false;
        api.finish(state.score, "The board is full.");
        return false;
      }
      state.food = open[Math.floor(Math.random() * open.length)];
      return true;
    }

    function reset() {
      canvas.width = 480;
      canvas.height = 480;
      state.snake = [
        { x: 8, y: 10 },
        { x: 7, y: 10 },
        { x: 6, y: 10 }
      ];
      state.dir = { x: 1, y: 0 };
      state.queue = [];
      state.score = 0;
      state.alive = true;
      state.acc = 0;
      state.last = 0;
      state.tick = 160;
      placeFood();
      api.score(0);
      api.meta(paceLabel());
      api.note("");
      api.overlay(null);
    }

    function enqueue(dx, dy) {
      if (!state.alive) return;
      var last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
      if (dx === last.x && dy === last.y) return;
      if (dx === -last.x && dy === -last.y) return;
      if (state.queue.length >= 3) return;
      state.queue.push({ x: dx, y: dy });
    }

    function die(message) {
      if (!state.alive) return;
      state.alive = false;
      api.finish(state.score, message || "The ribbon hit a wall or itself.");
    }

    function step() {
      if (!state.alive) return;
      if (state.queue.length) state.dir = state.queue.shift();
      var head = state.snake[0];
      var next = { x: head.x + state.dir.x, y: head.y + state.dir.y };
      if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= COLS) {
        die("The ribbon hit the wall.");
        return;
      }
      var willEat = next.x === state.food.x && next.y === state.food.y;
      var body = willEat ? state.snake : state.snake.slice(0, -1);
      if (body.some(function (part) { return part.x === next.x && part.y === next.y; })) {
        die("The ribbon ran into itself.");
        return;
      }
      state.snake.unshift(next);
      if (willEat) {
        state.score += 1;
        state.tick = Math.max(64, 160 - state.score * 8);
        api.score(state.score);
        api.meta(paceLabel());
        if (!placeFood()) return;
      } else {
        state.snake.pop();
      }
    }

    function mix(t) {
      var from = [98, 246, 214];
      var to = [255, 77, 141];
      var channels = from.map(function (value, index) {
        return Math.round(value + (to[index] - value) * t);
      });
      return "rgb(" + channels[0] + ", " + channels[1] + ", " + channels[2] + ")";
    }

    function draw(now) {
      var pulse = 0.55 + 0.45 * Math.sin(now / 180);
      ctx.fillStyle = "#100816";
      ctx.fillRect(0, 0, 480, 480);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      var i;
      for (i = 1; i < COLS; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * CELL + 0.5, 0);
        ctx.lineTo(i * CELL + 0.5, 480);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL + 0.5);
        ctx.lineTo(480, i * CELL + 0.5);
        ctx.stroke();
      }

      var foodSize = 10 + pulse * 6;
      var foodInset = (CELL - foodSize) / 2;
      ctx.fillStyle = "#ffc857";
      roundRect(ctx, state.food.x * CELL + foodInset, state.food.y * CELL + foodInset, foodSize, foodSize, 6);
      ctx.fill();

      state.snake.forEach(function (part, index) {
        var t = index / Math.max(1, state.snake.length - 1);
        ctx.fillStyle = index === 0 ? "#eafff8" : mix(t);
        roundRect(ctx, part.x * CELL + 3, part.y * CELL + 3, CELL - 6, CELL - 6, 7);
        ctx.fill();
      });

      var head = state.snake[0];
      var cx = head.x * CELL + CELL / 2 + state.dir.x * 4;
      var cy = head.y * CELL + CELL / 2 + state.dir.y * 4;
      var px = -state.dir.y;
      var py = state.dir.x;
      ctx.fillStyle = "#140818";
      ctx.beginPath();
      ctx.arc(cx + px * 4, cy + py * 4, 2.1, 0, Math.PI * 2);
      ctx.arc(cx - px * 4, cy - py * 4, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    function frame(now) {
      if (!running) return;
      if (!state.last) state.last = now;
      var dt = Math.min(48, now - state.last);
      state.last = now;
      if (state.alive) {
        state.acc += dt;
        var guard = 0;
        while (state.acc >= state.tick && state.alive && guard < 5) {
          state.acc -= state.tick;
          step();
          guard += 1;
        }
        if (state.acc > state.tick) state.acc = state.tick;
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    function onKey(event) {
      var map = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        a: [-1, 0],
        s: [0, 1],
        d: [1, 0],
        W: [0, -1],
        A: [-1, 0],
        S: [0, 1],
        D: [1, 0]
      };
      var next = map[event.key];
      if (!next) return;
      event.preventDefault();
      enqueue(next[0], next[1]);
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
      if (Math.abs(dx) > Math.abs(dy)) enqueue(dx > 0 ? 1 : -1, 0);
      else enqueue(0, dy > 0 ? 1 : -1);
    }

    function onPointerCancel() {
      swipe = null;
    }

    document.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    reset();
    raf = requestAnimationFrame(frame);

    return {
      destroy: function () {
        running = false;
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey);
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
      }
    };
  }

  window.ScoutGames = window.ScoutGames || {};
  window.ScoutGames.snake = mount;
})();
