/* Private movie shelf. Files stay in IndexedDB on this device. */
(function () {
  "use strict";

  var Scout = window.ScoutDen;
  var DB_NAME = "scouts-pixel-den";
  var STORE = "movies";
  var dbPromise = null;
  var busy = false;
  var currentId = "";
  var currentUrl = "";
  var thumbUrls = [];
  var dragDepth = 0;

  function uid() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function titleFrom(name) {
    var base = String(name || "").replace(/\.[^.]+$/, "").trim();
    return base || "Untitled video";
  }

  function looksLikeVideo(file) {
    if (!file || file.size <= 0) return false;
    var type = file.type || "";
    if (type.indexOf("video/") === 0) return true;
    if (type && type !== "application/octet-stream") return false;
    return /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|avi|mpeg|mpg|3gp|wmv)$/i.test(file.name || "");
  }

  function isQuota(err) {
    return Boolean(err && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22));
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function database() {
    if (!dbPromise) {
      dbPromise = openDb().catch(function (err) {
        dbPromise = null;
        throw err;
      });
    }
    return dbPromise;
  }

  function getAll() {
    return database().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var request = tx.objectStore(STORE).getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function putRecord(record) {
    return database().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("aborted")); };
      });
    });
  }

  function deleteRecord(id) {
    return database().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function grabFrame(video) {
    return new Promise(function (resolve) {
      try {
        var width = 320;
        var height = 180;
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        var vw = video.videoWidth;
        var vh = video.videoHeight;
        if (!ctx || !vw || !vh) {
          resolve(null);
          return;
        }
        var scale = Math.max(width / vw, height / vh);
        var dw = vw * scale;
        var dh = vh * scale;
        ctx.fillStyle = "#140c1e";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
        canvas.toBlob(function (blob) { resolve(blob); }, "image/jpeg", 0.82);
      } catch (err) {
        resolve(null);
      }
    });
  }

  function inspectVideo(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var video = document.createElement("video");
      var settled = false;
      var timer = 0;

      function finish(duration, thumb) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.onerror = null;
        try { video.pause(); } catch (err) { /* ignore */ }
        video.removeAttribute("src");
        URL.revokeObjectURL(url);
        resolve({
          duration: Number.isFinite(duration) ? duration : null,
          thumb: thumb || null
        });
      }

      timer = setTimeout(function () { finish(video.duration, null); }, 8000);
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.onerror = function () { finish(NaN, null); };
      video.addEventListener("loadeddata", function () {
        var duration = video.duration;
        var target = Number.isFinite(duration) && duration > 0.25 ? Math.min(0.8, Math.max(0.1, duration * 0.12)) : 0;
        var captured = false;
        function capture() {
          if (captured) return;
          captured = true;
          grabFrame(video).then(function (thumb) { finish(duration, thumb); });
        }
        if (!(target > 0)) {
          capture();
          return;
        }
        var seekTimer = setTimeout(capture, 1500);
        video.addEventListener("seeked", function () {
          clearTimeout(seekTimer);
          capture();
        }, { once: true });
        try {
          video.currentTime = target;
        } catch (err) {
          clearTimeout(seekTimer);
          capture();
        }
      }, { once: true });
      video.src = url;
    });
  }

  Scout.ready(function () {
    var shelf = document.getElementById("shelf");
    var player = document.getElementById("player");
    var screen = document.getElementById("screen");
    var nowPlaying = document.getElementById("now-playing");
    var status = document.getElementById("movie-status");
    var estimateLine = document.getElementById("storage-estimate");
    var moviesLine = document.getElementById("storage-movies");
    var dropzone = document.getElementById("dropzone");
    var input = document.getElementById("video-files");
    if (!shelf || !player || !input) return;

    function setStatus(text) {
      if (status) status.textContent = text || "";
    }

    function revokeThumbs() {
      thumbUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      thumbUrls = [];
    }

    function stopPlayer() {
      try { player.pause(); } catch (err) { /* ignore */ }
      player.onerror = null;
      player.removeAttribute("src");
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = "";
      currentId = "";
      if (screen) screen.classList.remove("is-live");
      if (nowPlaying) nowPlaying.textContent = "Nothing playing yet.";
    }

    function guard(work) {
      return Promise.resolve()
        .then(work)
        .catch(function () {
          setStatus("Couldn't update the local library.");
        });
    }

    async function refreshStorage(records) {
      var bytes = records.reduce(function (sum, record) { return sum + (record.size || 0); }, 0);
      var count = records.length;
      if (moviesLine) {
        moviesLine.textContent = count
          ? "Shelf: " + count + (count === 1 ? " video · " : " videos · ") + Scout.formatBytes(bytes)
          : "Shelf: empty";
      }
      if (!estimateLine) return;
      try {
        if (!navigator.storage || !navigator.storage.estimate) {
          estimateLine.textContent = "This browser does not share a storage estimate.";
          return;
        }
        var estimate = await navigator.storage.estimate();
        var usage = Scout.formatBytes(estimate.usage || 0);
        var quota = estimate.quota ? Scout.formatBytes(estimate.quota) : "an unknown quota";
        estimateLine.textContent = "This site is using " + usage + " of about " + quota + " in this browser.";
      } catch (err) {
        estimateLine.textContent = "Storage estimate is unavailable in this browser.";
      }
    }

    function buildCard(record) {
      var card = document.createElement("article");
      card.className = "movie-card" + (record.id === currentId ? " is-active" : "");
      card.dataset.id = record.id;

      var thumbBtn = document.createElement("button");
      thumbBtn.type = "button";
      thumbBtn.className = "thumb-btn";
      thumbBtn.setAttribute("aria-label", "Play " + record.title);
      if (record.thumb) {
        var img = document.createElement("img");
        var url = URL.createObjectURL(record.thumb);
        thumbUrls.push(url);
        img.src = url;
        img.alt = "";
        thumbBtn.appendChild(img);
      } else {
        var fallback = document.createElement("span");
        fallback.className = "thumb-fallback";
        fallback.setAttribute("aria-hidden", "true");
        thumbBtn.appendChild(fallback);
      }
      thumbBtn.addEventListener("click", function () { guard(function () { return play(record.id); }); });

      var body = document.createElement("div");
      body.className = "movie-body";

      var title = document.createElement("input");
      title.className = "title-edit";
      title.type = "text";
      title.value = record.title;
      title.maxLength = 180;
      title.spellcheck = false;
      title.setAttribute("aria-label", "Title for " + (record.fileName || "video"));
      title.addEventListener("change", function () { guard(function () { return saveTitle(record.id, title.value); }); });
      title.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          title.blur();
        }
      });

      var meta = document.createElement("p");
      meta.className = "movie-meta";
      var duration = document.createElement("span");
      duration.textContent = Scout.formatDuration(record.duration);
      var size = document.createElement("span");
      size.textContent = Scout.formatBytes(record.size || 0);
      meta.appendChild(duration);
      meta.appendChild(size);

      var actions = document.createElement("div");
      actions.className = "card-actions";
      var playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "btn btn-ghost";
      playBtn.textContent = "Play";
      playBtn.addEventListener("click", function () { guard(function () { return play(record.id); }); });

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        if (deleteBtn.dataset.armed === "1") {
          guard(function () { return remove(record.id); });
          return;
        }
        deleteBtn.dataset.armed = "1";
        deleteBtn.textContent = "Confirm delete";
        setStatus("Click confirm to remove this video from the device.");
      });

      actions.appendChild(playBtn);
      actions.appendChild(deleteBtn);
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(actions);
      card.appendChild(thumbBtn);
      card.appendChild(body);
      return card;
    }

    function render(records) {
      revokeThumbs();
      shelf.replaceChildren();
      if (!records.length) {
        var empty = document.createElement("p");
        empty.className = "empty-shelf";
        empty.textContent = "Your shelf is empty. Add a video from this device to start a private library.";
        shelf.appendChild(empty);
        return;
      }
      records.forEach(function (record) {
        shelf.appendChild(buildCard(record));
      });
    }

    async function load() {
      var records = await getAll();
      records.sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
      render(records);
      await refreshStorage(records);
      return records;
    }

    async function play(id) {
      var records = await getAll();
      var record = records.find(function (item) { return item.id === id; });
      if (!record) return;
      currentId = id;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(record.blob);
      player.src = currentUrl;
      if (screen) screen.classList.add("is-live");
      if (nowPlaying) nowPlaying.textContent = record.title;
      Array.prototype.forEach.call(shelf.querySelectorAll(".movie-card"), function (card) {
        card.classList.toggle("is-active", card.dataset.id === id);
      });
      var attempt = player.play();
      if (attempt && typeof attempt.catch === "function") attempt.catch(function () {});
    }

    async function saveTitle(id, value) {
      var records = await getAll();
      var record = records.find(function (item) { return item.id === id; });
      if (!record) return;
      var next = String(value || "").trim() || titleFrom(record.fileName);
      record.title = next;
      await putRecord(record);
      var inputEl = shelf.querySelector('.movie-card[data-id="' + id + '"] .title-edit');
      if (inputEl && inputEl.value !== next) inputEl.value = next;
      var thumb = shelf.querySelector('.movie-card[data-id="' + id + '"] .thumb-btn');
      if (thumb) thumb.setAttribute("aria-label", "Play " + next);
      if (currentId === id && nowPlaying) nowPlaying.textContent = next;
      setStatus("Title saved on this device.");
    }

    async function remove(id) {
      await deleteRecord(id);
      if (currentId === id) stopPlayer();
      await load();
      setStatus("Deleted from this device.");
    }

    async function askPersist() {
      try {
        if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
      } catch (err) { /* The browser may ignore persist requests. */ }
    }

    async function addFiles(fileList) {
      if (busy) return;
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return;
      busy = true;
      var added = 0;
      var skipped = 0;
      var failed = null;
      try {
        var i;
        for (i = 0; i < files.length; i += 1) {
          var file = files[i];
          setStatus("Saving " + (i + 1) + " of " + files.length + "…");
          if (!looksLikeVideo(file)) {
            skipped += 1;
            continue;
          }
          try {
            var info = await inspectVideo(file);
            await putRecord({
              id: uid(),
              title: titleFrom(file.name),
              fileName: file.name,
              mime: file.type || "video/mp4",
              size: file.size,
              duration: info.duration,
              addedAt: Date.now(),
              blob: file,
              thumb: info.thumb
            });
            added += 1;
          } catch (err) {
            failed = err;
            break;
          }
        }
        if (added) await askPersist();
        await load();
        if (failed && isQuota(failed)) {
          setStatus(added
            ? "The browser ran out of room after saving " + added + "."
            : "The browser ran out of room for that video.");
        } else if (failed) {
          setStatus("Couldn't save that video in this browser.");
        } else if (!added && skipped) {
          setStatus("Those files are not videos. Choose a video file.");
        } else if (skipped) {
          setStatus("Saved " + added + " on this device. Skipped " + skipped + " that were not videos.");
        } else if (added === 1) {
          setStatus("Saved 1 video on this device.");
        } else {
          setStatus("Saved " + added + " videos on this device.");
        }
      } finally {
        busy = false;
      }
    }

    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.value = "";
      if (files.length) guard(function () { return addFiles(files); });
    });

    document.addEventListener("dragenter", function (event) {
      event.preventDefault();
      dragDepth += 1;
      dropzone.classList.add("is-hot");
    });
    document.addEventListener("dragover", function (event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    document.addEventListener("dragleave", function () {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) dropzone.classList.remove("is-hot");
    });
    document.addEventListener("drop", function (event) {
      event.preventDefault();
      dragDepth = 0;
      dropzone.classList.remove("is-hot");
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        guard(function () { return addFiles(event.dataTransfer.files); });
      }
    });
    document.addEventListener("dragend", function () {
      dragDepth = 0;
      dropzone.classList.remove("is-hot");
    });
    document.addEventListener("click", function (event) {
      if (event.target && event.target.closest && event.target.closest("[data-armed='1']")) return;
      Array.prototype.forEach.call(shelf.querySelectorAll('[data-armed="1"]'), function (button) {
        button.dataset.armed = "";
        button.textContent = "Delete";
      });
    });
    window.addEventListener("pagehide", function () {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      revokeThumbs();
    });

    if (!window.indexedDB) {
      setStatus("This browser has no IndexedDB, so videos can't be stored here.");
      if (estimateLine) estimateLine.textContent = "Storage estimate is unavailable in this browser.";
      return;
    }

    load().catch(function () {
      setStatus("This browser blocked the local movie library.");
    });
  });
})();
