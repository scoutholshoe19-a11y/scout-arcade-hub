/* Original Brick Breaker for Scout's Pixel Den. */
(function () {
  "use strict";

  var W = 480;
  var H = 480;
  var HUES = ["#ff4d8d", "#ffc857", "#62f6d6", "#9b87ff"];

  function mount(canvas, api) {
    var ctx = canvas.getContext("2d");
    var roundRect = window.ScoutDen.roundRect;
    var running = true;
    var raf = 0;
    var last = 0;
    var state = {
      level: 1,
      lives: 3,
      score: 0,
      bricks: [],
      over: false,
      left: false,
      right: false,
      control: "keys",
      pointer: null,
      paddle: { x: 190, y: 448, w: 100, h: 12 },
      ball: { x: 240, y: 430, r: 7, vx: 0, vy: 0, stuck: true }
    };

    function lifeLabel() {
      var word = state.lives === 1 ? " life" : " lives";
      return state.lives + word + " · level " + state.level;
    }

    function stickBall() {
      var ball = state.ball;
      var paddle = state.paddle;
      ball.stuck = true;
      ball.vx = 0;
      ball.vy = 0;
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 3;
    }

    function buildBricks() {
      var cols = 8;
      var rows = Math.min(2 + state.level, 7);
      var gap = 6;
      var margin = 18;
      var bw = (W - margin * 2 - gap * (cols - 1)) / cols;
      var bh = 18;
      var top = 28;
      state.bricks = [];
      var r;
      var c;
      for (r = 0; r < rows; r += 1) {
        for (c = 0; c < cols; c += 1) {
          if (state.level >= 2 && r === rows - 1 && c % 2 === 1) continue;
          if (state.level >= 4 && r === 1 && c % 3 === 0) continue;
          var tough = state.level >= 3 && r === 0;
          state.bricks.push({
            x: margin + c * (bw + gap),
            y: top + r * (bh + gap),
            w: bw,
            h: bh,
            hp: tough ? 2 : 1,
            max: tough ? 2 : 1,
            hue: r % HUES.length
          });
        }
      }
      if (!state.bricks.length) {
        state.bricks.push({ x: margin, y: top, w: bw, h: bh, hp: 1, max: 1, hue: 0 });
      }
    }

    function layoutPaddle() {
      state.paddle.w = Math.max(58, 100 - (state.level - 1) * 8);
      state.paddle.x = Math.max(10, Math.min(W - state.paddle.w - 10, state.paddle.x));
    }

    function reset(full) {
      canvas.width = W;
      canvas.height = H;
      if (full) {
        state.level = 1;
        state.lives = 3;
        state.score = 0;
        state.over = false;
        state.paddle.x = 190;
      }
      layoutPaddle();
      buildBricks();
      stickBall();
      api.score(state.score);
      api.meta(lifeLabel());
      api.overlay(null);
      api.note(full ? "Space, click, or tap to launch." : "Level " + state.level + ". Launch when you are ready.");
    }

    function launch() {
      if (state.over || !state.ball.stuck) return;
      var speed = Math.min(420, 250 + (state.level - 1) * 18);
      var angle = (Math.random() * 0.7 - 0.35);
      state.ball.stuck = false;
      state.ball.vx = Math.sin(angle) * speed;
      state.ball.vy = -Math.abs(Math.cos(angle) * speed);
      api.note("");
    }

    function loseLife() {
      state.lives -= 1;
      api.meta(lifeLabel());
      if (state.lives <= 0) {
        state.over = true;
        api.finish(state.score, "Out of lives on level " + state.level + ".");
        return;
      }
      stickBall();
      api.note("Life lost. Launch when you are ready.");
    }

    function nextLevel() {
      state.level += 1;
      state.score += 100;
      api.score(state.score);
      layoutPaddle();
      buildBricks();
      stickBall();
      api.meta(lifeLabel());
      api.note("Level " + state.level + ". Launch when you are ready.");
    }

    function hits(ball, rect) {
      var nearestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
      var nearestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
      var dx = ball.x - nearestX;
      var dy = ball.y - nearestY;
      return dx * dx + dy * dy <= ball.r * ball.r;
    }

    function reflect(ball, brick, prevX, prevY) {
      var fromLeft = prevX + ball.r <= brick.x;
      var fromRight = prevX - ball.r >= brick.x + brick.w;
      var fromTop = prevY + ball.r <= brick.y;
      var fromBottom = prevY - ball.r >= brick.y + brick.h;
      if ((fromLeft || fromRight) && !(fromTop || fromBottom)) ball.vx *= -1;
      else if ((fromTop || fromBottom) && !(fromLeft || fromRight)) ball.vy *= -1;
      else if (fromLeft || fromRight || fromTop || fromBottom) {
        if (fromLeft || fromRight) ball.vx *= -1;
        if (fromTop || fromBottom) ball.vy *= -1;
      } else if (Math.abs(ball.vx) > Math.abs(ball.vy)) ball.vx *= -1;
      else ball.vy *= -1;

      var cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
      var cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
      var dx = ball.x - cx;
      var dy = ball.y - cy;
      var dist = Math.hypot(dx, dy);
      if (dist === 0) {
        dx = 0;
        dy = ball.vy >= 0 ? -1 : 1;
        dist = 1;
      }
      var overlap = ball.r - dist;
      if (overlap > 0) {
        ball.x += (dx / dist) * (overlap + 0.4);
        ball.y += (dy / dist) * (overlap + 0.4);
      }
    }

    function capSpeed(ball) {
      var speed = Math.hypot(ball.vx, ball.vy);
      var max = 460;
      if (speed > max) {
        ball.vx = (ball.vx / speed) * max;
        ball.vy = (ball.vy / speed) * max;
      }
    }

    function update(dt) {
      if (state.over) return;
      var paddle = state.paddle;
      if (state.control === "pointer" && state.pointer != null) {
        paddle.x = state.pointer - paddle.w / 2;
      } else {
        var keys = 460;
        if (state.left) paddle.x -= keys * dt;
        if (state.right) paddle.x += keys * dt;
      }
      paddle.x = Math.max(10, Math.min(W - paddle.w - 10, paddle.x));

      var ball = state.ball;
      if (ball.stuck) {
        stickBall();
        return;
      }

      var prevX = ball.x;
      var prevY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < ball.r) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x > W - ball.r) {
        ball.x = W - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y < ball.r) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      if (
        ball.vy > 0 &&
        ball.y + ball.r >= paddle.y &&
        prevY + ball.r <= paddle.y + paddle.h &&
        ball.x >= paddle.x - ball.r &&
        ball.x <= paddle.x + paddle.w + ball.r
      ) {
        var hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
        hit = Math.max(-1, Math.min(1, hit));
        var speed = Math.min(460, Math.hypot(ball.vx, ball.vy) * 1.02);
        var angle = hit * (Math.PI / 3);
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.abs(Math.cos(angle) * speed);
        ball.y = paddle.y - ball.r - 1;
      }

      var i;
      for (i = state.bricks.length - 1; i >= 0; i -= 1) {
        var brick = state.bricks[i];
        if (!hits(ball, brick)) continue;
        reflect(ball, brick, prevX, prevY);
        brick.hp -= 1;
        if (brick.hp <= 0) {
          state.score += 10 * brick.max;
          state.bricks.splice(i, 1);
        }
        api.score(state.score);
        break;
      }

      capSpeed(ball);
      if (!state.bricks.length) {
        nextLevel();
        return;
      }
      if (ball.y - ball.r > H) loseLife();
    }

    function draw() {
      ctx.fillStyle = "#100816";
      ctx.fillRect(0, 0, W, H);
      state.bricks.forEach(function (brick) {
        ctx.globalAlpha = brick.hp < brick.max ? 0.72 : 1;
        ctx.fillStyle = HUES[brick.hue];
        roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 5);
        ctx.fill();
        if (brick.max > 1 && brick.hp === brick.max) {
          ctx.strokeStyle = "rgba(255,255,255,0.75)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });

      ctx.fillStyle = "#62f6d6";
      roundRect(ctx, state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h, 6);
      ctx.fill();

      ctx.fillStyle = "#fff6ea";
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
      ctx.fill();
    }

    function pointerX(event) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width) return state.paddle.x + state.paddle.w / 2;
      return ((event.clientX - rect.left) * canvas.width) / rect.width;
    }

    function onPointerMove(event) {
      if (event.pointerType === "mouse" || event.buttons || event.pointerType === "touch") {
        state.control = "pointer";
        state.pointer = pointerX(event);
      }
    }

    function onPointerDown(event) {
      if (event.button != null && event.button !== 0) return;
      state.control = "pointer";
      state.pointer = pointerX(event);
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
      }
      launch();
    }

    function onPointerUp() {
      state.pointer = null;
    }

    function onPointerLeave(event) {
      if (event.pointerType === "mouse" && !event.buttons) state.pointer = null;
    }

    function onKeyDown(event) {
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        state.control = "keys";
        state.pointer = null;
        state.left = true;
        event.preventDefault();
      } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        state.control = "keys";
        state.pointer = null;
        state.right = true;
        event.preventDefault();
      } else if (event.key === " " || event.key === "Spacebar") {
        if (event.repeat) return;
        var target = event.target;
        if (target && target.closest && target.closest("button, a, input, textarea, select")) return;
        event.preventDefault();
        launch();
      }
    }

    function onKeyUp(event) {
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") state.left = false;
      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") state.right = false;
    }

    function frame(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    reset(true);
    raf = requestAnimationFrame(frame);

    return {
      destroy: function () {
        running = false;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
      }
    };
  }

  window.ScoutGames = window.ScoutGames || {};
  window.ScoutGames.breaker = mount;
})();
