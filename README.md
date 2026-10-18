# Flow

 <img src="src/icon/logo.png" width="128" alt="Flow Logo">

**Your music. Your library. Your flow.**

A lightweight, browser-based music player built with vanilla JavaScript, HTML, and CSS.

[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-FF66C4?style=flat-square&labelColor=171717)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![HTML5](https://img.shields.io/badge/HTML5-Web-A3E635?style=flat-square&labelColor=171717)](https://developer.mozilla.org/en-US/docs/Web/HTML) [![CSS3](https://img.shields.io/badge/CSS3-Styling-FF66C4?style=flat-square&labelColor=171717)](https://developer.mozilla.org/en-US/docs/Web/CSS) [![License](https://img.shields.io/badge/License-MIT-A3E635?style=flat-square&labelColor=171717)](LICENSE)

[**Launch Flow**](https://neonmc23.github.io/Flow/) · [Features](#-features) · [Getting Started](#-getting-started) · [Add Music](#-building-your-library)

---

## ◈ Preview

![Flow music player preview](src/image.png)

*Your library, your albums, your music — all in one place.*

---

## ◈ Overview

Flow is a compact, browser-based music player designed around your local music library.

Its interface combines album-based organization, instant search, sortable track lists, a playback queue, and a real-time waveform visualization powered by the Web Audio API.

No framework. No build pipeline. Just a lightweight web player built with standard web technologies.

## ✦ Features

| Feature | Description |
| --- | --- |
| 🎵 **Local music library** | Play supported local audio files, including MP3, WAV, and FLAC. |
| 💿 **Album organization** | Browse music organized by album and artist. |
| 🔎 **Live search** | Filter your collection by album or artist. |
| 🖼️ **Album artwork** | Display cover art alongside your music. |
| 〰️ **Audio visualization** | Watch a real-time oscilloscope powered by the Web Audio API. |
| 📋 **Sortable library** | Sort tracks by title, artist, album, or duration. |
| ⏭️ **Playback queue** | Navigate tracks with a compact queue panel. |
| 🗂️ **JSON-based library** | Manage album and track metadata through simple JSON files. |
| ⌨️ **Keyboard controls** | Control playback and search without relying entirely on the mouse. |

## ▸ Getting Started

### Requirements

- A modern web browser.
- Python 3 or another local HTTP server.
- Your audio files and album metadata.

No JavaScript framework, package installation, or build step is required.

### 1. Clone the repository

```bash
git clone https://github.com/NeonMC23/Flow.git
cd Flow
```

### 2. Start the local server

```bash
python3 -m http.server 5500
```

If `python3` is unavailable on Windows, try:

```powershell
python -m http.server 5500
```

### 3. Open Flow

Navigate to:

`http://127.0.0.1:5500/index.html`

Keep the server running while using the player.

## ♪ Building Your Library

Flow uses a folder-based album library with JSON metadata.

### Project structure

```text
Flow/
├── index.html
├── upload.html
├── src/
│   ├── css/
│   │   └── style.css
│   ├── icon/
│   │   └── ...
│   ├── javascript/
│   │   ├── script.js
│   │   ├── filter.js
│   │   └── effect.js
│   └── data/
│       ├── album.json
│       └── album/
│           └── your-album/
│               ├── infos.json
│               ├── cover.png
│               ├── track1.mp3
│               └── track2.mp3
├── scripts/
├── logs/
└── README.md
```

### 1. Create an album folder

Inside `src/data/album/`, create a folder for your album.

Example: `my-album/`

### 2. Add your files

Place your audio tracks and album cover in the new folder. Use `cover.png` for the cover image.

### 3. Create `infos.json`

Add an `infos.json` file to the album folder:

```json
{
  "title": "Album Title",
  "artist": "Artist Name",
  "cover": "cover.png",
  "tracks": [
    {
      "title": "Track 1",
      "file": "track1.mp3",
      "duration": "3:21"
    },
    {
      "title": "Track 2",
      "file": "track2.mp3",
      "duration": "4:05"
    }
  ]
}
```

Replace the example values with your album's actual metadata and filenames.

### 4. Register the album

Open `src/data/album.json` and add your folder name to the array:

```json
[
  "album1",
  "album2",
  "my-album"
]
```

Preserve valid JSON syntax and make sure the folder name matches exactly.

### 5. Reload Flow

Refresh the browser to load the updated library.

For additional guidance, see [`upload.html`](upload.html).

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `←` Left Arrow | Previous track |
| `→` Right Arrow | Next track, prioritizing the queue |
| `Ctrl + F` | Focus the search field |

## ⛭ Technology

| Component | Technology |
| --- | --- |
| Interface | HTML5 |
| Styling | CSS3 |
| Player and library logic | Vanilla JavaScript |
| Audio visualization | Web Audio API |
| Music metadata | JSON |
| Local development server | Python's built-in HTTP server |

## ◈ Design Philosophy

- **Lightweight:** no framework or build tools.
- **Organized:** albums and tracks follow a predictable structure.
- **Responsive interaction:** search, filtering, and playback controls are designed to stay accessible.
- **Customizable:** extend the library and interface using familiar web technologies.

## 🤝 Contributing

Ideas, bug reports, and improvements are welcome.

1. Fork the repository.
2. Create a branch for your changes.
3. Make and test your changes locally.
4. Commit and push your branch.
5. Open a Pull Request.

## 📄 License

Flow is open-source software distributed under the [MIT License](LICENSE).

---

*Less clutter. More music.*

**Flow — Find your rhythm.**

