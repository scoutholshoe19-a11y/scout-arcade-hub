/* Original Sky Hopper for Scout's Pixel Den. */
(function () {
  "use strict";

  var W = 480;
  var H = 480;

  function mount(canvas, api) {
    var ctx = canvas.getContext("2d");
    var roundRect = window.ScoutDen.roundRect;
    var running = true;
    var raf = 0;
    var last = 0;
    var mode = "ready";
    var score = 0;
    var bird = { x: 128, y: 220, vy: 0 };
    var gates = [];
    var stars = [];

    function makeGate(x) {
      var gap = Math.max(124, 176 - score * 3);
      var minY = 36;
      var maxY = H - 36 - gap;
      var gapY = minY + Math.random() * Math.max(1, maxY - minY);
      return { x: x, w: 64, gapY: gapY, gap: gap, scored: false, hue: Math.random() < 0.5 ? "#ff4d8d" : "#62f6d6" };
    }

    function reset() {
      canvas.width = W;
      canvas.height = H;
      mode = "ready";
      score = 0;
      bird.x = 128;
      bird.y = 220;
      bird.vy = 0;
      gates = [makeGate(460), makeGate(720)];
      stars = [];
      var i;
      for (i = 0; i < 28; i += 1) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          s: Math.random() * 1.8 + 0.6,
          v: Math.random() * 18 + 10
        });
      }
      api.score(0);
      api.meta("");
      api.overlay(null);
      api.note("Tap, click, or press space.");
    }

    function crash() {
      if (mode !== "play") return;
      mode = "dead";
      api.finish(score, "The drone clipped the course.");
    }

    function flap() {
      if (mode === "dead") return;
      if (mode === "ready") mode = "play";
      bird.vy = -360;
      api.note("");
    }

    function circleHits(rect) {
      var nearestX = Math.max(rect.x, Math.min(bird.x, rect.x + rect.w));
      var nearestY = Math.max(rect.y, Math.min(bird.y, rect.y + rect.h));
      var dx = bird.x - nearestX;
      var dy = bird.y - nearestY;
      return dx * dx + dy * dy <= 12 * 12;
    }

    function hitsGate(gate) {
      var pad = 6;
      var top = { x: gate.x + pad, y: 0, w: gate.w - pad * 2, h: gate.gapY };
      var bottom = {
        x: gate.x + pad,
        y: gate.gapY + gate.gap,
        w: gate.w - pad * 2,
        h: H - (gate.gapY + gate.gap)
      };
      return circleHits(top) || circleHits(bottom);
    }

    function ensureGates() {
      var rightmost = gates.reduce(function (max, gate) {
        return Math.max(max, gate.x);
      }, -999);
      if (rightmost < 250) gates.push(makeGate(W + 40));
    }

    function tick(dt) {
      bird.vy = Math.min(560, bird.vy + 1050 * dt);
      bird.y += bird.vy * dt;
      var speed = Math.min(260, 148 + score * 6);
      var i;
      for (i = gates.length - 1; i >= 0; i -= 1) {
        var gate = gates[i];
        gate.x -= speed * dt;
        if (!gate.scored && gate.x + gate.w < bird.x) {
          gate.scored = true;
          score += 1;
          api.score(score);
        }
        if (mode === "play" && hitsGate(gate)) crash();
        if (gate.x + gate.w < -40) gates.splice(i, 1);
      }
      if (mode === "play" && (bird.y < 34 || bird.y > H - 34)) crash();
    }

    function update(dt, now) {
      stars.forEach(function (star) {
        if (mode !== "play") return;
        star.x -= star.v * dt;
        if (star.x < 0) {
          star.x = W;
          star.y = Math.random() * H;
        }
      });
      if (mode === "ready") {
        bird.y = 220 + Math.sin(now / 280) * 12;
        bird.vy = 0;
        return;
      }
      if (mode !== "play") return;
      var left = Math.min(dt, 0.033);
      var step = 1 / 120;
      while (left > 0 && mode === "play") {
        var slice = Math.min(step, left);
        tick(slice);
        left -= slice;
      }
      if (mode === "play") ensureGates();
    }

    function drawDrone() {
      ctx.save();
      ctx.translate(bird.x, bird.y);
      var tilt = mode === "ready" ? 0 : Math.max(-0.6, Math.min(0.7, bird.vy / 520));
      ctx.rotate(tilt);
      ctx.fillStyle = "#ff4d8d";
      ctx.beginPath();
      ctx.ellipse(-6, 6, 9, 4.5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#62f6d6";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#140c1e";
      ctx.beginPath();
      ctx.ellipse(6, -1, 6, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff6ea";
      ctx.beginPath();
      ctx.arc(8, -2, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      ctx.fillStyle = "#100816";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      stars.forEach(function (star) {
        ctx.fillRect(star.x, star.y, star.s, star.s);
      });

      gates.forEach(function (gate) {
        ctx.fillStyle = gate.hue;
        roundRect(ctx, gate.x, 8, gate.w, Math.max(0, gate.gapY - 8), 10);
        ctx.fill();
        roundRect(ctx, gate.x, gate.gapY + gate.gap, gate.w, Math.max(0, H - (gate.gapY + gate.gap) - 8), 10);
        ctx.fill();
      });

      ctx.fillStyle = "rgba(98, 246, 214, 0.35)";
      ctx.fillRect(0, 0, W, 10);
      ctx.fillRect(0, H - 10, W, 10);
      drawDrone();
    }

    function frame(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = (now - last) / 1000;
      last = now;
      update(dt, now);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function onKey(event) {
      if (event.repeat) return;
      if (event.key !== " " && event.key !== "Spacebar") return;
      if (event.target && event.target.closest && event.target.closest("button, a, input, textarea, select")) return;
      event.preventDefault();
      flap();
    }

    function onPointerDown(event) {
      if (event.button != null && event.button !== 0) return;
      flap();
    }

    document.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown);
    reset();
    raf = requestAnimationFrame(frame);

    return {
      destroy: function () {
        running = false;
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey);
        canvas.removeEventListener("pointerdown", onPointerDown);
      }
    };
  }

  window.ScoutGames = window.ScoutGames || {};
  window.ScoutGames.hopper = mount;
})();
