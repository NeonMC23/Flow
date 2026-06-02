const fileInput = document.getElementById("fileInput");
const trackList = document.getElementById("track-list");
const audio = document.getElementById("audio");
const nowTitle = document.getElementById("nowplaying-title");

// Manual file add (upload)
if (fileInput) {
  fileInput.addEventListener("change", function () {
    const files = Array.from(this.files);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const li = document.createElement("li");
      li.textContent = file.name;
      li.onclick = () => {
        audio.src = url;
        audio.play();
        nowTitle.textContent = file.name;
      };
      trackList.appendChild(li);
    });
  });
}

async function loadAlbums() {
  try {
    const albumsListRes = await fetch(`src/data/album.json?v=${Date.now()}`, {
      cache: "no-store",
    });
    const albumFolders = await albumsListRes.json();

    for (const albumName of albumFolders) {
      try {
        const res = await fetch(
          `src/data/album/${albumName}/infos.json?v=${Date.now()}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          console.warn(`Album ${albumName} not found.`);
          continue;
        }
        const albumInfo = await res.json();

        albumInfo.tracks.forEach((track) => {
          const cover = albumInfo.cover
            ? `src/data/album/${albumName}/${albumInfo.cover}`
            : "src/icon/logo.png";
          musicData.push({
            title: track.title,
            artist: albumInfo.artist,
            album: albumInfo.title,
            duration: track.duration,
            cover,
            src: encodeURI(`src/data/album/${albumName}/${track.file}`),
            folder: albumName,
            file: track.file,
          });
        });
      } catch (err) {
        console.error(`Error loading album ${albumName}:`, err);
      }
    }

    renderTracks(musicData);
    generateFilterOptions(musicData);
    if (window.flowStateReady) {
      try {
        await window.flowStateReady;
      } catch (err) {
        console.warn("State sync unavailable.", err);
      }
    }
    if (typeof window.restoreFlowState === "function") {
      window.restoreFlowState();
    }
  } catch (err) {
    console.error("Error loading album list:", err);
  }
}

// Keep musicData global for filter.js
window.musicData = musicData;

// Load albums on page load
loadAlbums();
