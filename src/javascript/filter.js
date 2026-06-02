function toggleFilterMenu() {
  const menu = document.getElementById("filterMenu");
  if (menu) {
    menu.classList.toggle("show");
  }
}

document.addEventListener("click", function (e) {
  const menu = document.getElementById("filterMenu");
  const trigger = document.querySelector(".filter-trigger");
  if (menu && trigger && !menu.contains(e.target) && !trigger.contains(e.target)) {
    menu.classList.remove("show");
  }
});

const searchInput = document.getElementById("search");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    saveFilterState();
    applyFilters();
  });
}

const clearFiltersBtn = document.getElementById("clear-filters");
if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", () => {
    const artistFilter = document.getElementById("artist-filter");
    const albumFilter = document.getElementById("album-filter");
    const searchTerm = document.getElementById("search");
    if (artistFilter) artistFilter.value = "";
    if (albumFilter) albumFilter.value = "";
    if (searchTerm) searchTerm.value = "";
    saveFilterState();
    applyFilters();
  });
}

const filterBar = document.querySelector(".filter-bar");
const toggleFiltersBtn = document.getElementById("toggle-filters");
if (toggleFiltersBtn && filterBar) {
  toggleFiltersBtn.addEventListener("click", () => {
    filterBar.classList.toggle("is-collapsed");
    const hidden = filterBar.classList.contains("is-collapsed");
    toggleFiltersBtn.classList.toggle("active", hidden);
    localStorage.setItem("flow-filters-collapsed", hidden ? "1" : "0");
  });
  const collapsed = localStorage.getItem("flow-filters-collapsed") === "1";
  if (collapsed) {
    filterBar.classList.add("is-collapsed");
    toggleFiltersBtn.classList.add("active");
  }
}

let musicData = [];
let currentTracks = [];
let currentIndex = -1;
let currentSort = { key: "title", dir: "asc" };
let queue = [];
let currentPlaylist = "all";
let favorites = new Set(JSON.parse(localStorage.getItem("flow-favorites") || "[]"));
let recent = JSON.parse(localStorage.getItem("flow-recent") || "[]");
let isSeeking = false;
let rafId = null;
let durationCache = JSON.parse(localStorage.getItem("flow-duration-cache") || "{}");
let lastTrackSrc = localStorage.getItem("flow-last-track") || "";
let lastTrackTime = parseFloat(localStorage.getItem("flow-last-time") || "0");
let lastPlaylist = localStorage.getItem("flow-last-playlist") || "all";
let storedQueue = JSON.parse(localStorage.getItem("flow-queue") || "[]");
let storedSort = JSON.parse(localStorage.getItem("flow-sort") || "null");
let storedFilters = JSON.parse(localStorage.getItem("flow-filters") || "{}");
let storedVolume = parseFloat(localStorage.getItem("flow-volume") || "1");
let stateUpdatedAt = parseInt(localStorage.getItem("flow-state-updated") || "0", 10);
let stateSyncTimer = null;
let stateApiAvailable = false;
const STATE_API = `${window.FLOW_API_BASE || "http://127.0.0.1:8001"}/api/state`;
function handleLyricsButtonClick(e) {
  const button = e.target.closest ? e.target.closest(".lyrics-btn") : null;
  if (!button) return;

  e.preventDefault();
  e.stopPropagation();

  const row = button.closest(".track-row");
  const src = row ? row.dataset.src : "";
  const track = currentTracks.find((item) => item.src === src) || musicData.find((item) => item.src === src);
  if (track) openLyricsModal(track);
}

document.addEventListener("click", handleLyricsButtonClick);

if (storedSort && storedSort.key && storedSort.dir) {
  currentSort = storedSort;
}

function getLocalStateSnapshot() {
  return {
    updatedAt: stateUpdatedAt || Date.now(),
    favorites: [...favorites],
    queue: queue.map((track) => track.src),
    recent,
    lastTrack: lastTrackSrc,
    lastTime: lastTrackTime,
    playlist: currentPlaylist,
    sort: currentSort,
    filters: storedFilters,
    volume: storedVolume,
  };
}

function applyStateSnapshot(state) {
  if (!state || typeof state !== "object") return;
  if (Array.isArray(state.favorites)) {
    favorites = new Set(state.favorites);
    localStorage.setItem("flow-favorites", JSON.stringify([...favorites]));
  }
  if (Array.isArray(state.queue)) {
    storedQueue = state.queue;
    localStorage.setItem("flow-queue", JSON.stringify(storedQueue));
  }
  if (Array.isArray(state.recent)) {
    recent = state.recent;
    localStorage.setItem("flow-recent", JSON.stringify(recent));
  }
  if (typeof state.lastTrack === "string") {
    lastTrackSrc = state.lastTrack;
    localStorage.setItem("flow-last-track", lastTrackSrc);
  }
  if (Number.isFinite(state.lastTime)) {
    lastTrackTime = state.lastTime;
    localStorage.setItem("flow-last-time", state.lastTime.toString());
  }
  if (typeof state.playlist === "string") {
    lastPlaylist = state.playlist;
    localStorage.setItem("flow-last-playlist", lastPlaylist);
  }
  if (state.sort && state.sort.key && state.sort.dir) {
    currentSort = state.sort;
    localStorage.setItem("flow-sort", JSON.stringify(currentSort));
  }
  if (state.filters && typeof state.filters === "object") {
    storedFilters = state.filters;
    localStorage.setItem("flow-filters", JSON.stringify(storedFilters));
  }
  if (Number.isFinite(state.volume)) {
    storedVolume = state.volume;
    localStorage.setItem("flow-volume", storedVolume.toString());
  }
  if (Number.isFinite(state.updatedAt)) {
    stateUpdatedAt = state.updatedAt;
    localStorage.setItem("flow-state-updated", stateUpdatedAt.toString());
  }
}

function scheduleStateSync() {
  if (!stateApiAvailable) return;
  if (stateSyncTimer) clearTimeout(stateSyncTimer);
  stateSyncTimer = setTimeout(async () => {
    const payload = getLocalStateSnapshot();
    payload.updatedAt = Date.now();
    stateUpdatedAt = payload.updatedAt;
    localStorage.setItem("flow-state-updated", stateUpdatedAt.toString());
    try {
      await fetch(STATE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("State sync failed.", err);
    }
  }, 700);
}

window.flowStateReady = fetch(STATE_API)
  .then((res) => res.json())
  .then((data) => {
    stateApiAvailable = true;
    const remote = data?.state || {};
    const remoteUpdated = parseInt(remote.updatedAt || "0", 10);
    if (remoteUpdated > stateUpdatedAt) {
      applyStateSnapshot(remote);
    } else {
      scheduleStateSync();
    }
  })
  .catch(() => {
    stateApiAvailable = false;
  });

function updateMarquee(nowTitle) {
  const marquee = nowTitle?.querySelector(".title-marquee");
  if (!marquee) return;
  const overflow = marquee.scrollWidth - nowTitle.clientWidth;
  const shouldScroll = overflow > 8;
  nowTitle.classList.toggle("is-marquee", shouldScroll);
  if (shouldScroll) {
    const distance = overflow + 24;
    const duration = Math.max(8, distance / 40);
    nowTitle.style.setProperty("--marquee-distance", `${distance}px`);
    nowTitle.style.setProperty("--marquee-duration", `${duration}s`);
  } else {
    nowTitle.style.removeProperty("--marquee-distance");
    nowTitle.style.removeProperty("--marquee-duration");
  }
}

function scheduleMarqueeUpdate() {
  const nowTitle = document.getElementById("nowplaying-title");
  if (!nowTitle) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => updateMarquee(nowTitle));
  });
  setTimeout(() => updateMarquee(nowTitle), 120);
}

function generateFilterOptions(tracks) {
  const artistSet = new Set();
  const albumSet = new Set();

  tracks.forEach((track) => {
    artistSet.add(track.artist);
    albumSet.add(track.album);
  });

  const artistSelect = document.getElementById("artist-filter");
  const albumSelect = document.getElementById("album-filter");

  if (!artistSelect || !albumSelect) return;

  artistSelect.innerHTML = '<option value="">All</option>';
  albumSelect.innerHTML = '<option value="">All</option>';

  artistSet.forEach((artist) => {
    const option = document.createElement("option");
    option.value = artist;
    option.textContent = artist;
    artistSelect.appendChild(option);
  });

  albumSet.forEach((album) => {
    const option = document.createElement("option");
    option.value = album;
    option.textContent = album;
    albumSelect.appendChild(option);
  });

  artistSelect.addEventListener("change", () => {
    saveFilterState();
    applyFilters();
  });
  albumSelect.addEventListener("change", () => {
    saveFilterState();
    applyFilters();
  });
}

function parseDuration(duration) {
  if (!duration) return 0;
  const parts = duration.split(":").map((part) => parseInt(part, 10));
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function sortTracks(tracks) {
  const sorted = [...tracks];
  sorted.sort((a, b) => {
    let aVal = a[currentSort.key];
    let bVal = b[currentSort.key];

    if (currentSort.key === "duration") {
      aVal = parseDuration(aVal);
      bVal = parseDuration(bVal);
    } else {
      aVal = (aVal || "").toString().toLowerCase();
      bVal = (bVal || "").toString().toLowerCase();
    }

    if (aVal < bVal) return currentSort.dir === "asc" ? -1 : 1;
    if (aVal > bVal) return currentSort.dir === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}

function filterByPlaylist(tracks) {
  if (currentPlaylist === "favorites") {
    return tracks.filter((track) => favorites.has(track.src));
  }
  if (currentPlaylist === "recent") {
    const recentSet = new Set(recent);
    const bySrc = new Map(tracks.map((track) => [track.src, track]));
    return recent
      .filter((src) => recentSet.has(src) && bySrc.has(src))
      .map((src) => bySrc.get(src));
  }
  return tracks;
}

function applyFilters() {
  const artistFilter = document.getElementById("artist-filter");
  const albumFilter = document.getElementById("album-filter");
  const searchTerm = (document.getElementById("search")?.value || "").toLowerCase();

  const selectedArtist = (artistFilter?.value || "").toLowerCase();
  const selectedAlbum = (albumFilter?.value || "").toLowerCase();

  const filtered = filterByPlaylist(musicData).filter((track) => {
    const matchArtist =
      selectedArtist === "" || track.artist.toLowerCase() === selectedArtist;
    const matchAlbum =
      selectedAlbum === "" || track.album.toLowerCase() === selectedAlbum;
    const matchSearch =
      track.title.toLowerCase().includes(searchTerm) ||
      track.artist.toLowerCase().includes(searchTerm) ||
      track.album.toLowerCase().includes(searchTerm);

    return matchArtist && matchAlbum && matchSearch;
  });

  renderTracks(filtered);
  updateFilterStatus();
}

function updateFilterStatus() {
  const status = document.getElementById("filter-count");
  const wrapper = document.querySelector(".filter-status");
  if (!status || !wrapper) return;
  const artist = document.getElementById("artist-filter")?.value || "";
  const album = document.getElementById("album-filter")?.value || "";
  const search = document.getElementById("search")?.value || "";
  let count = 0;
  if (artist) count += 1;
  if (album) count += 1;
  if (search.trim()) count += 1;
  status.textContent = count.toString();
  wrapper.classList.toggle("is-active", count > 0);
}

function updateStats(tracks) {
  const trackCount = document.getElementById("track-count");
  const artistCount = document.getElementById("artist-count");
  const albumCount = document.getElementById("album-count");

  if (!trackCount || !artistCount || !albumCount) return;

  const artists = new Set(tracks.map((track) => track.artist));
  const albums = new Set(tracks.map((track) => track.album));

  trackCount.textContent = tracks.length.toString();
  artistCount.textContent = artists.size.toString();
  albumCount.textContent = albums.size.toString();
}

function saveDurationCache() {
  localStorage.setItem("flow-duration-cache", JSON.stringify(durationCache));
}

function saveQueueState() {
  storedQueue = queue.map((q) => q.src);
  localStorage.setItem("flow-queue", JSON.stringify(storedQueue));
}

function saveFilterState() {
  const artistFilter = document.getElementById("artist-filter");
  const albumFilter = document.getElementById("album-filter");
  const searchTerm = document.getElementById("search");
  const payload = {
    artist: artistFilter?.value || "",
    album: albumFilter?.value || "",
    search: searchTerm?.value || "",
  };
  localStorage.setItem("flow-filters", JSON.stringify(payload));
  storedFilters = payload;
  scheduleStateSync();
}

function setNowPlaying(track) {
  const nowTitle = document.getElementById("nowplaying-title");
  const cover = document.getElementById("player-cover");
  if (nowTitle) {
    const marquee = nowTitle.querySelector(".title-marquee");
    const text = `${track.title} - ${track.artist}`;
    if (marquee) {
      marquee.textContent = text;
      scheduleMarqueeUpdate();
    } else {
      nowTitle.textContent = text;
    }
  }
  if (cover) {
    cover.src = track.cover;
    cover.alt = `${track.album} cover`;
  }
}

function ensureDuration(track) {
  if (!track?.src) return;
  if (durationCache[track.src]) return;

  const audio = new Audio();
  audio.preload = "metadata";
  audio.src = track.src;
  audio.addEventListener("loadedmetadata", () => {
    const seconds = audio.duration;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;
    durationCache[track.src] = formatted;
    saveDurationCache();
    const row = document.querySelector(`.track-row[data-src=\"${track.src}\"] .cell.time`);
    if (row) row.textContent = formatted;
  });
  audio.addEventListener("error", () => {
    durationCache[track.src] = track.duration || "0:00";
    saveDurationCache();
  });
}

function updateSortUI() {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    const isActive = btn.dataset.sort === currentSort.key;
    const label = btn.dataset.label || btn.textContent;
    btn.classList.toggle("active", isActive);
    btn.innerHTML = isActive
      ? `${label} <span>${currentSort.dir === "asc" ? "^" : "v"}</span>`
      : label;
  });
}

function setSort(key) {
  if (currentSort.key === key) {
    currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
  } else {
    currentSort.key = key;
    currentSort.dir = "asc";
  }
  localStorage.setItem("flow-sort", JSON.stringify(currentSort));
  scheduleStateSync();
  applyFilters();
  updateSortUI();
}

function playTrack(track, index) {
  const audio = document.getElementById("audio");
  const nowTitle = document.getElementById("nowplaying-title");
  const cover = document.getElementById("player-cover");
  const playBtn = document.getElementById("play-btn");

  if (!audio) return;

  audio.src = encodeURI(track.src);
  localStorage.setItem("flow-last-track", track.src);
  localStorage.setItem("flow-last-time", "0");
  lastTrackTime = 0;
  lastTrackSrc = track.src;
  scheduleStateSync();
  audio.play().catch(() => {});
  if (playBtn) {
    playBtn.textContent = "Pause";
  }
  setNowPlaying(track);
  recent = [track.src, ...recent.filter((src) => src !== track.src)].slice(0, 30);
  localStorage.setItem("flow-recent", JSON.stringify(recent));
  scheduleStateSync();
  currentIndex = index ?? currentTracks.findIndex((t) => t.src === track.src);
  document.querySelectorAll(".track-row").forEach((row) => {
    row.classList.toggle("active", row.dataset.src === track.src);
  });
}

function playNext() {
  if (queue.length > 0) {
    const nextTrack = queue.shift();
    renderQueue();
    playTrack(nextTrack, currentTracks.findIndex((t) => t.src === nextTrack.src));
    return;
  }

  if (currentIndex < currentTracks.length - 1) {
    const nextIndex = currentIndex + 1;
    playTrack(currentTracks[nextIndex], nextIndex);
  }
}

function playPrev() {
  if (currentIndex > 0) {
    const prevIndex = currentIndex - 1;
    playTrack(currentTracks[prevIndex], prevIndex);
  }
}

function addToQueue(track) {
  queue.push(track);
  renderQueue();
  saveQueueState();
  scheduleStateSync();
}

function removeFromQueue(index) {
  queue.splice(index, 1);
  renderQueue();
  saveQueueState();
  scheduleStateSync();
}

function moveQueueItem(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [item] = queue.splice(fromIndex, 1);
  queue.splice(toIndex, 0, item);
  renderQueue();
  saveQueueState();
  scheduleStateSync();
}

function renderQueue() {
  const queueList = document.getElementById("queue-list");
  if (!queueList) return;
  queueList.innerHTML = "";

  if (queue.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("queue-item");
    empty.innerHTML =
      "<div class=\"meta\"><strong>Queue is empty</strong><span>Add tracks from the library.</span></div>";
    queueList.appendChild(empty);
    return;
  }

  queue.forEach((track, idx) => {
    const li = document.createElement("li");
    li.classList.add("queue-item");
    li.setAttribute("draggable", "true");
    li.dataset.index = idx.toString();
    li.innerHTML = `
      <img src="${track.cover}" alt="${track.album} cover">
      <div class="meta">
        <strong>${track.title}</strong>
        <span>${track.artist}</span>
      </div>
      <button class="queue-remove" type="button" aria-label="Remove from queue">x</button>
    `;
    li.querySelector(".queue-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromQueue(idx);
    });
    li.addEventListener("dragstart", (e) => {
      li.classList.add("dragging");
      e.dataTransfer.setData("text/plain", idx.toString());
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
    });
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const toIndex = parseInt(li.dataset.index || "0", 10);
      moveQueueItem(fromIndex, toIndex);
    });
    li.onclick = () => {
      playTrack(track, currentTracks.findIndex((t) => t.src === track.src));
    };
    queueList.appendChild(li);
  });
}

function renderTracks(tracks) {
  const trackList = document.getElementById("track-list");
  if (!trackList) return;

  const sortedTracks = currentPlaylist === "recent" ? [...tracks] : sortTracks(tracks);
  currentTracks = sortedTracks;

  trackList.innerHTML = "";
  updateStats(sortedTracks);

  sortedTracks.forEach((track, index) => {
    const li = document.createElement("li");
    li.classList.add("track-row");
    const isFavorite = favorites.has(track.src);

    li.innerHTML = `
      <div class="cell title">
        <img class="cover" src="${track.cover}" alt="${track.album} cover">
        <div class="title-text">
          <strong>${track.title}</strong>
          <span>${track.artist}</span>
        </div>
        <button class="fav-btn ${isFavorite ? "active" : ""}" type="button">${
          isFavorite ? "Fav" : "Fav"
        }</button>
        <button class="queue-add" type="button">Queue</button>
        <button class="lyrics-btn" type="button">Lyrics</button>
      </div>
      <div class="cell artist">${track.artist}</div>
      <div class="cell album">${track.album}</div>
      <div class="cell time">${durationCache[track.src] || track.duration}</div>
    `;

    li.querySelector(".fav-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (favorites.has(track.src)) {
        favorites.delete(track.src);
      } else {
        favorites.add(track.src);
      }
      localStorage.setItem("flow-favorites", JSON.stringify([...favorites]));
      scheduleStateSync();
      applyFilters();
    });

    li.querySelector(".queue-add").addEventListener("click", (e) => {
      e.stopPropagation();
      addToQueue(track);
    });

    li.querySelector(".lyrics-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openLyricsModal(track);
    });

    li.dataset.src = track.src;
    li.onclick = () => {
      playTrack(track, index);
    };

    trackList.appendChild(li);
    ensureDuration(track);
  });

  const audio = document.getElementById("audio");
  if (audio && audio.src) {
    const currentSrc = audio.src;
    document.querySelectorAll(".track-row").forEach((row) => {
      const rowSrc = row.dataset.src || "";
      row.classList.toggle("active", currentSrc.endsWith(rowSrc));
    });
  }
}

function attachSortHandlers() {
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSort(btn.dataset.sort);
    });
  });
  updateSortUI();
}

function attachPlaylistHandlers() {
  document.querySelectorAll(".playlist-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPlaylist = btn.dataset.playlist || "all";
      localStorage.setItem("flow-last-playlist", currentPlaylist);
      scheduleStateSync();
      document
        .querySelectorAll(".playlist-btn")
        .forEach((button) => button.classList.remove("active"));
      btn.classList.add("active");
      applyFilters();
    });
  });
}

function attachQueueHandlers() {
  const clearBtn = document.getElementById("clear-queue");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      queue = [];
      renderQueue();
      saveQueueState();
      scheduleStateSync();
    });
  }
  const queueList = document.getElementById("queue-list");
  if (queueList) {
    queueList.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    queueList.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!queueList.hasChildNodes()) return;
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (Number.isNaN(fromIndex)) return;
      moveQueueItem(fromIndex, queue.length - 1);
    });
  }
  renderQueue();
}

function attachKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    const isInput =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.tagName === "BUTTON");

    if (e.ctrlKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      document.getElementById("search")?.focus();
      return;
    }

    if (isInput) return;

    if (e.code === "Space") {
      e.preventDefault();
      const audio = document.getElementById("audio");
      const playBtn = document.getElementById("play-btn");
      if (audio) {
        if (audio.paused) {
          audio.play();
          if (playBtn) playBtn.textContent = "Pause";
        } else {
          audio.pause();
          if (playBtn) playBtn.textContent = "Play";
        }
      }
    }

    if (e.key === "ArrowRight") {
      playNext();
    }

    if (e.key === "ArrowLeft") {
      playPrev();
    }
  });
}

const audioEl = document.getElementById("audio");
if (audioEl) {
  audioEl.addEventListener("ended", () => {
    const autoplay =
      window.flowSettings?.autoplayNext !== undefined ? window.flowSettings.autoplayNext : true;
    if (autoplay) playNext();
  });
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function attachPlayerControls() {
  const audio = document.getElementById("audio");
  if (!audio) return;

  const playBtn = document.getElementById("play-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const progress = document.getElementById("progress");
  const currentTime = document.getElementById("current-time");
  const duration = document.getElementById("duration");
  const volume = document.getElementById("volume");

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (audio.paused) {
        audio.play();
        playBtn.textContent = "Pause";
      } else {
        audio.pause();
        playBtn.textContent = "Play";
      }
    });
  }

  if (prevBtn) prevBtn.addEventListener("click", playPrev);
  if (nextBtn) nextBtn.addEventListener("click", playNext);

  if (volume) {
    volume.addEventListener("input", () => {
      audio.volume = parseFloat(volume.value);
      localStorage.setItem("flow-volume", volume.value);
      storedVolume = parseFloat(volume.value);
      scheduleStateSync();
    });
  }

  if (Number.isFinite(storedVolume)) {
    const safeVolume = Math.min(1, Math.max(0, storedVolume));
    audio.volume = safeVolume;
    if (volume) volume.value = safeVolume.toString();
  }

  if (progress) {
    progress.addEventListener("input", () => {
      isSeeking = true;
      const pct = parseFloat(progress.value) / 100;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = pct * audio.duration;
        if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
      }
    });
    progress.addEventListener("change", () => {
      isSeeking = false;
      if (!audio.paused) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const update = () => {
            if (isSeeking) return;
            if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
            if (progress && Number.isFinite(audio.duration) && audio.duration > 0) {
              progress.value = ((audio.currentTime / audio.duration) * 100).toFixed(2);
            }
            if (!audio.paused) rafId = requestAnimationFrame(update);
          };
          update();
        });
      }
    });
  }

  audio.addEventListener("seeking", () => {
    if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener("seeked", () => {
    if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener("loadedmetadata", () => {
    if (duration) duration.textContent = formatTime(audio.duration);
    if (audio.src && lastTrackSrc && audio.src.endsWith(lastTrackSrc) && lastTrackTime > 0) {
      const safeTime = Math.min(lastTrackTime, Math.max(0, audio.duration - 0.5));
      if (Number.isFinite(safeTime) && safeTime > 0) {
        audio.currentTime = safeTime;
        if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
        if (progress && Number.isFinite(audio.duration) && audio.duration > 0) {
          progress.value = ((audio.currentTime / audio.duration) * 100).toFixed(2);
        }
      }
    }
  });

  audio.addEventListener("error", () => {
    if (playBtn) playBtn.textContent = "Play";
    if (currentTime) currentTime.textContent = "0:00";
    if (duration) duration.textContent = "0:00";
    const nowTitle = document.getElementById("nowplaying-title");
    if (nowTitle) nowTitle.textContent = "Missing audio file";
  });

  let lastTimeSave = 0;
  const persistTime = () => {
    if (!audio.src) return;
    const now = Date.now();
    if (now - lastTimeSave < 900) return;
    if (Number.isFinite(audio.currentTime)) {
      localStorage.setItem("flow-last-time", audio.currentTime.toFixed(2));
      lastTrackTime = audio.currentTime;
      lastTimeSave = now;
    }
  };
  audio.addEventListener("timeupdate", persistTime);
  audio.addEventListener("pause", persistTime);
  audio.addEventListener("seeking", persistTime);
  audio.addEventListener("ended", () => {
    localStorage.setItem("flow-last-time", "0");
    lastTrackTime = 0;
    scheduleStateSync();
  });

  const updateProgress = () => {
    if (isSeeking) return;
    if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
    if (progress && Number.isFinite(audio.duration) && audio.duration > 0) {
      progress.value = ((audio.currentTime / audio.duration) * 100).toFixed(2);
    }
    if (!audio.paused) {
      rafId = requestAnimationFrame(updateProgress);
    }
  };

  audio.addEventListener("play", () => {
    if (playBtn) playBtn.textContent = "Pause";
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateProgress);
  });
  audio.addEventListener("pause", () => {
    if (playBtn) playBtn.textContent = "Play";
    if (rafId) cancelAnimationFrame(rafId);
    scheduleStateSync();
  });
}

function restoreFlowState() {
  const audio = document.getElementById("audio");
  const playBtn = document.getElementById("play-btn");
  const artistFilter = document.getElementById("artist-filter");
  const albumFilter = document.getElementById("album-filter");
  const searchTerm = document.getElementById("search");

  if (lastPlaylist) {
    currentPlaylist = lastPlaylist;
    document.querySelectorAll(".playlist-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.playlist === currentPlaylist);
    });
  }

  if (storedFilters && typeof storedFilters === "object") {
    if (searchTerm && typeof storedFilters.search === "string") {
      searchTerm.value = storedFilters.search;
    }
    if (artistFilter && typeof storedFilters.artist === "string") {
      artistFilter.value = storedFilters.artist;
    }
    if (albumFilter && typeof storedFilters.album === "string") {
      albumFilter.value = storedFilters.album;
    }
  }

  if (audio && lastTrackSrc) {
    const track = musicData.find((t) => t.src === lastTrackSrc);
    if (track) {
      audio.src = encodeURI(track.src);
      setNowPlaying(track);
      if (playBtn) playBtn.textContent = "Play";
    }
  }

  if (Array.isArray(storedQueue) && storedQueue.length) {
    queue = storedQueue
      .map((src) => musicData.find((track) => track.src === src))
      .filter(Boolean);
  }

  applyFilters();
  updateSortUI();
  renderQueue();

  if (audio && lastTrackSrc) {
    currentIndex = currentTracks.findIndex((t) => t.src === lastTrackSrc);
  }
}

window.restoreFlowState = restoreFlowState;

attachSortHandlers();
attachPlaylistHandlers();
attachQueueHandlers();
attachKeyboardShortcuts();
attachPlayerControls();

window.addEventListener("resize", () => {
  const nowTitle = document.getElementById("nowplaying-title");
  if (nowTitle) updateMarquee(nowTitle);
});

window.addEventListener("load", () => {
  scheduleMarqueeUpdate();
});

const LYRICS_API_BASE = window.FLOW_API_BASE || "http://127.0.0.1:8001";
let lyricsModalRaf = null;
let lyricsCurrent = null;

function openLyricsModal(track) {
  const modal = document.getElementById("lyrics-modal");
  if (!modal) return;

  lyricsCurrent = track;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const titleEl = document.getElementById("lyrics-track");
  const subEl = document.getElementById("lyrics-sub");
  if (titleEl) titleEl.textContent = track.title;
  if (subEl) subEl.textContent = `${track.artist} • ${track.album}`;

  setLyricsEditMode(false);
  loadAndRenderLyrics();
  startLyricsSync();
}

function closeLyricsModal() {
  const modal = document.getElementById("lyrics-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  stopLyricsSync();
}

function stopLyricsSync() {
  if (lyricsModalRaf) cancelAnimationFrame(lyricsModalRaf);
  lyricsModalRaf = null;
}

function startLyricsSync() {
  stopLyricsSync();
  const audio = document.getElementById("audio");
  if (!audio) return;

  const tick = () => {
    const view = document.getElementById("lyrics-view");
    if (!view || view.classList.contains("hidden")) {
      lyricsModalRaf = requestAnimationFrame(tick);
      return;
    }

    const t = audio.currentTime || 0;
    const lines = Array.from(view.querySelectorAll(".lyrics-line"));
    let activeEl = null;
    for (const el of lines) {
      const start = parseFloat(el.dataset.start || "0");
      const dur = parseFloat(el.dataset.duration || "0");
      if (t >= start && t < start + dur) {
        activeEl = el;
        break;
      }
    }

    let changed = false;
    lines.forEach((el) => {
      const next = el === activeEl;
      if (next !== el.classList.contains("active")) changed = true;
      el.classList.toggle("active", next);
    });

    if (activeEl && changed) {
      activeEl.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    lyricsModalRaf = requestAnimationFrame(tick);
  };

  lyricsModalRaf = requestAnimationFrame(tick);
}

async function loadAndRenderLyrics() {
  const view = document.getElementById("lyrics-view");
  const editBtn = document.getElementById("lyrics-edit");
  if (!view || !lyricsCurrent) return;

  if (!lyricsCurrent.folder || !lyricsCurrent.file) {
    view.innerHTML = '<div class="lyrics-empty">Impossible d\'identifier ce morceau (metadata manquantes).</div>';
    if (editBtn) editBtn.disabled = true;
    return;
  }

  if (editBtn) editBtn.disabled = false;

  try {
    const url = `${LYRICS_API_BASE}/api/lyrics?folder=${encodeURIComponent(
      lyricsCurrent.folder
    )}&file=${encodeURIComponent(lyricsCurrent.file)}`;
    const res = await fetch(url);
    const data = await res.json();
    const lyrics = Array.isArray(data.lyrics) ? data.lyrics : [];
    renderLyricsView(lyrics);
    renderLyricsEditor(lyrics);
  } catch (err) {
    view.innerHTML = '<div class="lyrics-empty">Serveur upload hors ligne. Lance: python start.py</div>';
  }
}

function renderLyricsView(lyrics) {
  const view = document.getElementById("lyrics-view");
  if (!view) return;

  if (!lyrics || lyrics.length === 0) {
    view.innerHTML = '<div class="lyrics-empty">Aucune parole disponible. Ajoutez-en !</div>';
    return;
  }

  view.innerHTML = "";
  lyrics.forEach((line) => {
    const div = document.createElement("div");
    div.className = "lyrics-line";
    div.dataset.start = String(line.start ?? 0);
    div.dataset.duration = String(line.duration ?? 0);
    div.textContent = line.text || "";
    view.appendChild(div);
  });
}

function renderLyricsEditor(lyrics) {
  const rows = document.getElementById("lyrics-rows");
  if (!rows) return;
  rows.innerHTML = "";

  const list = Array.isArray(lyrics) ? lyrics : [];
  list.forEach((line) => addLyricsRow(line.text, line.start, line.duration));
}

function addLyricsRow(text = "", start = 0, duration = 0) {
  const rows = document.getElementById("lyrics-rows");
  if (!rows) return;

  const row = document.createElement("div");
  row.className = "lyrics-row";
  row.innerHTML = `
    <input type="text" placeholder="Text" value="${escapeHtml(text)}" />
    <input type="number" step="0.1" min="0" placeholder="Start" value="${Number(start) || 0}" />
    <input type="number" step="0.1" min="0" placeholder="Duration" value="${Number(duration) || 0}" />
    <button class="lyrics-delete" type="button">Delete</button>
  `;
  row.querySelector(".lyrics-delete").addEventListener("click", () => row.remove());
  rows.appendChild(row);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setLyricsEditMode(enabled) {
  const view = document.getElementById("lyrics-view");
  const editor = document.getElementById("lyrics-editor");
  const btn = document.getElementById("lyrics-edit");
  const error = document.getElementById("lyrics-error");

  if (error) {
    error.classList.add("hidden");
    error.textContent = "";
  }

  if (enabled) {
    if (view) view.classList.add("hidden");
    if (editor) editor.classList.remove("hidden");
    if (btn) btn.textContent = "View";
  } else {
    if (editor) editor.classList.add("hidden");
    if (view) view.classList.remove("hidden");
    if (btn) btn.textContent = "Edit";
  }
}

function collectLyricsFromEditor() {
  const rows = document.getElementById("lyrics-rows");
  if (!rows) return [];

  const result = [];
  rows.querySelectorAll(".lyrics-row").forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const text = (inputs[0]?.value || "").trim();
    const start = parseFloat(inputs[1]?.value || "0");
    const duration = parseFloat(inputs[2]?.value || "0");
    result.push({ text, start: Math.max(0, start), duration: Math.max(0, duration) });
  });

  result.sort((a, b) => a.start - b.start);
  return result.map((l) => ({
    ...l,
    start: Math.round(l.start * 10) / 10,
    duration: Math.round(l.duration * 10) / 10,
  }));
}

function validateLyrics(lyrics) {
  for (let i = 0; i < lyrics.length - 1; i++) {
    const end = lyrics[i].start + lyrics[i].duration;
    if (end > lyrics[i + 1].start + 1e-6) {
      return `Overlap between lines ${i + 1} and ${i + 2}.`;
    }
  }
  return null;
}

async function saveLyrics() {
  const error = document.getElementById("lyrics-error");
  if (!lyricsCurrent?.folder || !lyricsCurrent?.file) return;

  const lyrics = collectLyricsFromEditor();
  const validation = validateLyrics(lyrics);
  if (validation) {
    if (error) {
      error.textContent = validation;
      error.classList.remove("hidden");
    }
    return;
  }

  try {
    const res = await fetch(`${LYRICS_API_BASE}/api/lyrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: lyricsCurrent.folder, file: lyricsCurrent.file, lyrics }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    setLyricsEditMode(false);
    loadAndRenderLyrics();
  } catch (err) {
    if (error) {
      error.textContent = `Error: ${err.message}`;
      error.classList.remove("hidden");
    }
  }
}

document.addEventListener("click", (e) => {
  const target = e.target;
  if (!target) return;
  if (target.matches("[data-lyrics-close]") || target.closest("[data-lyrics-close]")) {
    closeLyricsModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("lyrics-modal");
    if (modal && !modal.classList.contains("hidden")) {
      closeLyricsModal();
    }
  }
});

const lyricsEditBtn = document.getElementById("lyrics-edit");
if (lyricsEditBtn) {
  lyricsEditBtn.addEventListener("click", () => {
    const editor = document.getElementById("lyrics-editor");
    const enabled = editor && editor.classList.contains("hidden");
    setLyricsEditMode(enabled);
  });
}

const lyricsAddBtn = document.getElementById("lyrics-add");
if (lyricsAddBtn) {
  lyricsAddBtn.addEventListener("click", () => addLyricsRow("", 0, 0));
}

const lyricsCancelBtn = document.getElementById("lyrics-cancel");
if (lyricsCancelBtn) {
  lyricsCancelBtn.addEventListener("click", () => {
    setLyricsEditMode(false);
    loadAndRenderLyrics();
  });
}

const lyricsSaveBtn = document.getElementById("lyrics-save");
if (lyricsSaveBtn) {
  lyricsSaveBtn.addEventListener("click", saveLyrics);
}