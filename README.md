# Flow - Modern Music Player

Flow is a lightweight, browser-based music player built with vanilla JavaScript, HTML, and CSS. It supports a dynamic music library, album-based organization, real-time filtering, and waveform visualization using the Web Audio API.

---

## Features

- Play local audio files (MP3, WAV, FLAC)
- Organize tracks by album and artist
- Live search and filtering by album or artist
- Album cover display
- Real-time oscilloscope waveform using Web Audio API
- JSON-based music database
- Modern, foobar-inspired compact UI
- Column sorting (Title, Artist, Album, Time)
- Mini queue panel
- Keyboard shortcuts (Space, arrows, Ctrl+F)

---

## Project Structure

```
flow/
|-- index.html        # Main music player UI
|-- upload.html       # Instructions to add music
|-- src/
|   |-- css/
|   |   `-- style.css
|   |-- icon/
|   |   `-- (SVGs + logo)
|   |-- javascript/
|   |   |-- script.js  # Core logic (player + fetch)
|   |   |-- filter.js  # Filtering logic
|   |   `-- effect.js  # Oscilloscope
|   `-- data/
|       |-- album.json # List of album folder names
|       `-- album/
|           `-- your-album/
|               |-- infos.json
|               |-- cover.png
|               `-- *.mp3
```

---

## How to Add Music

1. Navigate to `src/data/album/`
2. Create a new folder for your album (example: `my-album`)
3. Add the audio tracks and a `cover.png` image to this folder
4. Create an `infos.json` file in the same folder with the following structure:

```json
{
  "title": "Album Title",
  "artist": "Artist Name",
  "cover": "cover.png",
  "tracks": [
    { "title": "Track 1", "file": "track1.mp3", "duration": "3:21" },
    { "title": "Track 2", "file": "track2.mp3", "duration": "4:05" }
  ]
}
```

5. Open `src/data/album.json` and add your new folder name to the array:

```json
["album1", "album2", "your-album"]
```

6. Reload the web player. Your new album should now appear in the library.

For a step-by-step visual guide, see `upload.html`.

---

## Keyboard Shortcuts

- Space: play/pause
- Left arrow: previous track
- Right arrow: next track (queue first)
- Ctrl+F: focus search

---

## Tech Stack

- HTML / CSS / JavaScript (no framework)
- Web Audio API
- JSON for music metadata
- No dependencies or build tools required

---

## Local Development

1. Clone the repository
2. Install Python (if you do not have it)
3. Navigate to your project directory in a terminal

```bash
cd path/to/your/project
```

Then run:

```bash
python3 -m http.server 5500
```

Or on Windows if `python3` does not work:

```bash
python -m http.server 5500
```

Open:

```
http://127.0.0.1:5500/index.html
```

---

## License

This project is open-source and available under the MIT License.

---

## Credits

Created by \[Neon]. Contributions are welcome via pull requests or issues on GitHub.
