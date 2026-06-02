const libraryTree = document.getElementById("library-tree");
const libraryStatus = document.getElementById("library-status");
const librarySearch = document.getElementById("library-search");
const addArtistBtn = document.getElementById("add-artist");
const targetAlbumEl = document.getElementById("target-album");
const trackEditor = document.getElementById("track-editor");
const uploadTracksBtn = document.getElementById("upload-tracks");
const uploadStatus = document.getElementById("upload-status");

const editSubtitle = document.getElementById("edit-subtitle");
const editArtistPanel = document.getElementById("edit-artist");
const editAlbumPanel = document.getElementById("edit-album");
const editTrackPanel = document.getElementById("edit-track");
const editArtistInput = document.getElementById("edit-artist-name");
const editAlbumInput = document.getElementById("edit-album-title");
const editTrackInput = document.getElementById("edit-track-title");
const newAlbumTitle = document.getElementById("new-album-title");
const newAlbumCover = document.getElementById("new-album-cover");
const albumCoverInput = document.getElementById("edit-album-cover");
const albumTrackInput = document.getElementById("album-track-input");
const saveArtistBtn = document.getElementById("save-artist");
const saveAlbumBtn = document.getElementById("save-album");
const saveTrackBtn = document.getElementById("save-track");
const deleteArtistBtn = document.getElementById("delete-artist");
const deleteAlbumBtn = document.getElementById("delete-album");
const deleteTrackBtn = document.getElementById("delete-track");
const addAlbumBtn = document.getElementById("add-album");
const saveAlbumCoverBtn = document.getElementById("save-album-cover");

const serverBase = window.FLOW_API_BASE || "http://127.0.0.1:8001";
let libraryCache = [];
let pendingFiles = [];
let currentArtist = null;
let currentAlbum = null;
let currentTrack = null;
const expandedState = JSON.parse(localStorage.getItem("flow-upload-expanded") || "{}");
const expandedArtists = new Set(expandedState.artists || []);
const expandedAlbums = new Set(expandedState.albums || []);

function saveExpandedState() {
  localStorage.setItem(
    "flow-upload-expanded",
    JSON.stringify({ artists: [...expandedArtists], albums: [...expandedAlbums] })
  );
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function getDurations(files) {
  const durations = {};
  const tasks = Array.from(files).map(
    (file) =>
      new Promise((resolve) => {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        audio.preload = "metadata";
        audio.src = url;
        audio.addEventListener("loadedmetadata", () => {
          durations[file.name] = formatDuration(audio.duration);
          URL.revokeObjectURL(url);
          resolve();
        });
        audio.addEventListener("error", () => {
          durations[file.name] = "0:00";
          URL.revokeObjectURL(url);
          resolve();
        });
      })
  );
  await Promise.all(tasks);
  return durations;
}

async function fetchLibrary() {
  if (!libraryTree) return;
  libraryTree.textContent = "Loading...";
  try {
    const res = await fetch(`${serverBase}/api/library`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    libraryCache = data.library || [];
    if (libraryStatus) libraryStatus.textContent = "Server: online";
    renderLibrary(libraryCache);
  } catch (err) {
    if (libraryStatus) libraryStatus.textContent = "Server: offline";
    libraryTree.textContent = "Start the server with: python start.py";
  }
}

function setEditPanel(type) {
  if (editArtistPanel) editArtistPanel.classList.add("hidden");
  if (editAlbumPanel) editAlbumPanel.classList.add("hidden");
  if (editTrackPanel) editTrackPanel.classList.add("hidden");

  if (type === "artist") {
    editArtistPanel.classList.remove("hidden");
  } else if (type === "album") {
    editAlbumPanel.classList.remove("hidden");
  } else if (type === "track") {
    editTrackPanel.classList.remove("hidden");
  }
}

function renderLibrary(library) {
  if (!libraryTree) return;
  const query = (librarySearch?.value || "").toLowerCase();
  const searchActive = query.length > 0;
  libraryTree.innerHTML = "";

  if (!library.length) {
    libraryTree.textContent = "No albums yet.";
    return;
  }

  library.forEach((artist) => {
    const artistMatch = artist.artist.toLowerCase().includes(query);
    const artistNode = document.createElement("div");
    artistNode.className = "tree-artist";

    const artistHeader = document.createElement("div");
    artistHeader.className = "tree-row";
    artistHeader.innerHTML = `
      <button class="tree-toggle" data-artist="${artist.artist}">+</button>
      <span class="tree-title">${artist.artist}</span>
      <div class="tree-actions">
        <button class="ghost-btn" data-action="edit-artist" data-artist="${artist.artist}">Edit</button>
        <button class="danger-btn" data-action="delete-artist" data-artist="${artist.artist}">Delete</button>
      </div>
    `;

    const albumList = document.createElement("div");
    albumList.className = "tree-children hidden";

    artist.albums.forEach((album) => {
      const albumMatch = album.title.toLowerCase().includes(query);
      const albumNode = document.createElement("div");
      albumNode.className = "tree-album";
      albumNode.innerHTML = `
        <div class="tree-row">
          <button class="tree-toggle" data-album="${album.folder}">+</button>
          <span class="tree-title">${album.title}</span>
          <div class="tree-actions">
            <button class="ghost-btn" data-action="edit-album" data-folder="${album.folder}" data-title="${album.title}" data-artist="${artist.artist}">Edit</button>
          </div>
        </div>
      `;

      const trackList = document.createElement("div");
      trackList.className = "tree-children hidden";

      album.tracks.forEach((track) => {
        const trackMatch = track.title.toLowerCase().includes(query);
        if (query && !artistMatch && !albumMatch && !trackMatch) {
          return;
        }
        const trackRow = document.createElement("div");
        trackRow.className = "tree-row track-row";
        trackRow.innerHTML = `
          <span class="tree-title">${track.title}</span>
          <span class="track-meta">${track.duration}</span>
          <div class="tree-actions">
            <button class="ghost-btn" data-action="edit-track" data-folder="${album.folder}" data-file="${track.file}" data-title="${track.title}">Edit</button>
          </div>
        `;
        trackList.appendChild(trackRow);
      });

      if (query && !artistMatch && !albumMatch && trackList.childElementCount === 0) {
        return;
      }

      albumNode.appendChild(trackList);
      albumList.appendChild(albumNode);

      const albumToggle = albumNode.querySelector(".tree-toggle");
      const albumOpen = searchActive || expandedAlbums.has(album.folder);
      trackList.classList.toggle("hidden", !albumOpen);
      if (albumToggle) albumToggle.textContent = albumOpen ? "-" : "+";
    });

    if (query && !artistMatch && albumList.childElementCount === 0) {
      return;
    }

    artistNode.appendChild(artistHeader);
    artistNode.appendChild(albumList);
    libraryTree.appendChild(artistNode);

    const artistToggle = artistHeader.querySelector(".tree-toggle");
    const artistOpen = searchActive || expandedArtists.has(artist.artist);
    albumList.classList.toggle("hidden", !artistOpen);
    if (artistToggle) artistToggle.textContent = artistOpen ? "-" : "+";
  });

  const toggleNode = (toggleBtn, container) => {
    if (!toggleBtn || !container) return;
    container.classList.toggle("hidden");
    const isOpen = !container.classList.contains("hidden");
    toggleBtn.textContent = isOpen ? "-" : "+";
    if (toggleBtn.dataset.artist) {
      if (isOpen) {
        expandedArtists.add(toggleBtn.dataset.artist);
      } else {
        expandedArtists.delete(toggleBtn.dataset.artist);
      }
      saveExpandedState();
    }
    if (toggleBtn.dataset.album) {
      if (isOpen) {
        expandedAlbums.add(toggleBtn.dataset.album);
      } else {
        expandedAlbums.delete(toggleBtn.dataset.album);
      }
      saveExpandedState();
    }
  };

  libraryTree.querySelectorAll(".tree-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = btn.closest(".tree-row")?.nextElementSibling;
      toggleNode(btn, container);
    });
  });

  libraryTree.querySelectorAll(".tree-title").forEach((title) => {
    title.addEventListener("click", () => {
      const container = title.closest(".tree-row")?.nextElementSibling;
      const toggle = title.closest(".tree-row")?.querySelector(".tree-toggle");
      toggleNode(toggle, container);
    });
  });

  libraryTree.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      if (action === "edit-artist") {
        currentArtist = btn.dataset.artist;
        currentAlbum = null;
        currentTrack = null;
        if (editSubtitle) editSubtitle.textContent = `Editing artist: ${currentArtist}`;
        if (editArtistInput) editArtistInput.value = currentArtist;
        setEditPanel("artist");
        return;
      }
      if (action === "edit-album") {
        currentAlbum = {
          folder: btn.dataset.folder,
          title: btn.dataset.title,
          artist: btn.dataset.artist,
        };
        currentArtist = currentAlbum.artist;
        currentTrack = null;
        if (editSubtitle) editSubtitle.textContent = `Editing album: ${currentAlbum.title}`;
        if (editAlbumInput) editAlbumInput.value = currentAlbum.title;
        setEditPanel("album");
        return;
      }
      if (action === "edit-track") {
        currentTrack = {
          folder: btn.dataset.folder,
          file: btn.dataset.file,
          title: btn.dataset.title,
        };
        if (editSubtitle) editSubtitle.textContent = `Editing track: ${currentTrack.title}`;
        if (editTrackInput) editTrackInput.value = currentTrack.title;
        setEditPanel("track");
        return;
      }
      if (action === "delete-artist") {
        const name = btn.dataset.artist;
        if (!name) return;
        if (!confirm(`Delete artist ${name} and all albums?`)) return;
        await postJson("/api/delete_artist", { artist: name });
        fetchLibrary();
      }
    });
  });
}

async function postJson(path, payload) {
  const res = await fetch(`${serverBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function renderPendingTracks(files) {
  if (!trackEditor) return;
  trackEditor.innerHTML = "";
  if (!files.length) {
    trackEditor.textContent = "No tracks selected.";
    return;
  }

  files.forEach((file) => {
    const row = document.createElement("div");
    row.className = "track-row-edit";
    row.innerHTML = `
      <input type="text" data-filename="${file.name}" value="${file.name.replace(/\.[^/.]+$/, "")}" />
      <span class="track-filename">${file.name}</span>
    `;
    trackEditor.appendChild(row);
  });
}

function collectTrackTitles() {
  const map = {};
  if (!trackEditor) return map;
  trackEditor.querySelectorAll("input[data-filename]").forEach((input) => {
    const name = input.dataset.filename;
    const value = input.value.trim();
    if (name && value) {
      map[name] = value;
    }
  });
  return map;
}

if (librarySearch) {
  librarySearch.addEventListener("input", () => renderLibrary(libraryCache));
}

if (addArtistBtn) {
  addArtistBtn.addEventListener("click", async () => {
    const name = prompt("Artist name");
    if (!name) return;
    await postJson("/api/create_artist", { artist: name });
    fetchLibrary();
  });
}

if (saveArtistBtn) {
  saveArtistBtn.addEventListener("click", async () => {
    if (!currentArtist || !editArtistInput?.value) return;
    await postJson("/api/rename_artist", { old: currentArtist, new: editArtistInput.value });
    currentArtist = editArtistInput.value;
    fetchLibrary();
  });
}

if (deleteArtistBtn) {
  deleteArtistBtn.addEventListener("click", async () => {
    if (!currentArtist) return;
    if (!confirm(`Delete artist ${currentArtist} and all albums?`)) return;
    await postJson("/api/delete_artist", { artist: currentArtist });
    currentArtist = null;
    setEditPanel(null);
    if (editSubtitle) editSubtitle.textContent = "Select an artist, album, or track to edit.";
    fetchLibrary();
  });
}

if (addAlbumBtn) {
  addAlbumBtn.addEventListener("click", async () => {
    if (!currentArtist) return;
    if (!newAlbumTitle?.value) return;
    const created = await postJson("/api/create_album", { artist: currentArtist, title: newAlbumTitle.value });
    if (newAlbumCover?.files?.length) {
      const fd = new FormData();
      fd.set("folder", created.folder);
      fd.set("cover", newAlbumCover.files[0]);
      await fetch(`${serverBase}/api/update_cover`, { method: "POST", body: fd });
    }
    newAlbumTitle.value = "";
    if (newAlbumCover) newAlbumCover.value = "";
    fetchLibrary();
  });
}

if (saveAlbumBtn) {
  saveAlbumBtn.addEventListener("click", async () => {
    if (!currentAlbum || !editAlbumInput?.value) return;
    await postJson("/api/rename_album", { folder: currentAlbum.folder, title: editAlbumInput.value });
    currentAlbum.title = editAlbumInput.value;
    fetchLibrary();
  });
}

if (deleteAlbumBtn) {
  deleteAlbumBtn.addEventListener("click", async () => {
    if (!currentAlbum) return;
    if (!confirm(`Delete album ${currentAlbum.title}?`)) return;
    await postJson("/api/delete_album", { folder: currentAlbum.folder });
    currentAlbum = null;
    setEditPanel(null);
    if (editSubtitle) editSubtitle.textContent = "Select an artist, album, or track to edit.";
    fetchLibrary();
  });
}

if (saveAlbumCoverBtn) {
  saveAlbumCoverBtn.addEventListener("click", async () => {
    if (!currentAlbum || !albumCoverInput?.files?.length) return;
    const fd = new FormData();
    fd.set("folder", currentAlbum.folder);
    fd.set("cover", albumCoverInput.files[0]);
    await fetch(`${serverBase}/api/update_cover`, { method: "POST", body: fd });
    albumCoverInput.value = "";
    fetchLibrary();
  });
}

if (saveTrackBtn) {
  saveTrackBtn.addEventListener("click", async () => {
    if (!currentTrack || !editTrackInput?.value) return;
    await postJson("/api/rename_track", {
      folder: currentTrack.folder,
      file: currentTrack.file,
      title: editTrackInput.value,
    });
    currentTrack.title = editTrackInput.value;
    fetchLibrary();
  });
}

if (deleteTrackBtn) {
  deleteTrackBtn.addEventListener("click", async () => {
    if (!currentTrack) return;
    if (!confirm(`Delete track ${currentTrack.title}?`)) return;
    await postJson("/api/delete_track", {
      folder: currentTrack.folder,
      file: currentTrack.file,
    });
    currentTrack = null;
    setEditPanel(null);
    if (editSubtitle) editSubtitle.textContent = "Select an artist, album, or track to edit.";
    fetchLibrary();
  });
}

if (albumTrackInput) {
  albumTrackInput.addEventListener("change", () => {
    pendingFiles = Array.from(albumTrackInput.files || []);
    renderPendingTracks(pendingFiles);
  });
}

if (uploadTracksBtn) {
  uploadTracksBtn.addEventListener("click", async () => {
    if (!currentAlbum) {
      if (uploadStatus) uploadStatus.textContent = "Select an album first.";
      return;
    }
    if (!pendingFiles.length) {
      if (uploadStatus) uploadStatus.textContent = "Select audio files first.";
      return;
    }

    if (uploadStatus) uploadStatus.textContent = "Reading tracks...";
    const durations = await getDurations(pendingFiles);
    const titles = collectTrackTitles();

    const formData = new FormData();
    formData.set("mode", "append_album");
    formData.set("folder", currentAlbum.folder);
    formData.set("album_title", currentAlbum.title);
    formData.set("artist", currentAlbum.artist);
    formData.set("titles", JSON.stringify(titles));
    formData.set("durations", JSON.stringify(durations));
    pendingFiles.forEach((file) => formData.append("tracks", file));

    if (uploadStatus) uploadStatus.textContent = "Uploading...";
    try {
      const res = await fetch(`${serverBase}/api/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (uploadStatus) uploadStatus.textContent = `Uploaded to ${currentAlbum.title}`;
      pendingFiles = [];
      if (albumTrackInput) albumTrackInput.value = "";
      renderPendingTracks([]);
      fetchLibrary();
    } catch (err) {
      if (uploadStatus) uploadStatus.textContent = `Error: ${err.message}`;
    }
  });
}

fetchLibrary();
