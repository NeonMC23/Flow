import argparse
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import cgi
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data" / "album"
ALBUM_LIST = ROOT / "src" / "data" / "album.json"
STATE_FILE = ROOT / "src" / "data" / "state.json"
ARTIST_LIST = ROOT / "src" / "data" / "artists.json"
SETTINGS_FILE = ROOT / "src" / "data" / "settings.json"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s-]+", "-", value)
    return value or "album"


def load_album_list():
    if not ALBUM_LIST.exists():
        return []
    with ALBUM_LIST.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_album_list(items):
    ALBUM_LIST.parent.mkdir(parents=True, exist_ok=True)
    with ALBUM_LIST.open("w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
        f.write("\n")


def load_artist_list():
    if not ARTIST_LIST.exists():
        return []
    with ARTIST_LIST.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_artist_list(items):
    ARTIST_LIST.parent.mkdir(parents=True, exist_ok=True)
    with ARTIST_LIST.open("w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
        f.write("\n")


def load_settings_file():
    if not SETTINGS_FILE.exists():
        return {}
    with SETTINGS_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_settings_file(data: dict):
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with SETTINGS_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def load_state():
    if not STATE_FILE.exists():
        return {}
    with STATE_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_state(data: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with STATE_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def load_album_info(folder: str):
    info_path = DATA_DIR / folder / "infos.json"
    if not info_path.exists():
        return None
    with info_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    data["folder"] = folder
    return data



def normalize_album_info(data: dict):
    payload = {k: v for k, v in data.items() if k != "folder"}
    tracks = payload.get("tracks")
    if isinstance(tracks, list):
        for track in tracks:
            if not isinstance(track, dict):
                continue
            lyrics = track.get("lyrics")
            if not isinstance(lyrics, list):
                track["lyrics"] = default_lyrics_for_duration(track.get("duration", "0:00"))
    return payload


def save_album_info(folder: str, data: dict):
    info_path = DATA_DIR / folder / "infos.json"
    info_path.parent.mkdir(parents=True, exist_ok=True)
    payload = normalize_album_info(data)
    with info_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")



def parse_duration_seconds(value):
    """Convert a duration value (seconds, m:ss, h:mm:ss) to seconds."""
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    if not isinstance(value, str):
        return 0.0

    value = value.strip()
    if not value:
        return 0.0

    try:
        if ":" not in value:
            return max(0.0, float(value))
        parts = [float(part) for part in value.split(":")]
    except ValueError:
        return 0.0

    seconds = 0.0
    for part in parts:
        seconds = seconds * 60 + part
    return max(0.0, seconds)


def default_lyrics_for_duration(duration):
    seconds = round(parse_duration_seconds(duration), 1)
    return [
        {
            "text": "empty lyrics",
            "start": 0,
            "duration": seconds,
        }
    ]


def build_library():
    albums = []
    for folder in load_album_list():
        info = load_album_info(folder)
        if info:
            albums.append(info)

    artists = {}
    for artist_name in load_artist_list():
        artists.setdefault(artist_name, [])

    for album in albums:
        artist = album.get("artist", "Unknown")
        artists.setdefault(artist, []).append(album)

    for _, items in artists.items():
        items.sort(key=lambda a: a.get("title", "").lower())
        for album in items:
            album["tracks"] = sorted(album.get("tracks", []), key=lambda t: t.get("title", "").lower())

    library = [
        {"artist": artist, "albums": items}
        for artist, items in sorted(artists.items(), key=lambda pair: pair[0].lower())
    ]
    return library


class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        if self.path == "/api/library":
            self._set_headers(200)
            self.wfile.write(json.dumps({"library": build_library()}).encode("utf-8"))
            return
        if self.path == "/api/state":
            self._set_headers(200)
            self.wfile.write(json.dumps({"state": load_state()}).encode("utf-8"))
            return
        if self.path == "/api/settings":
            self._set_headers(200)
            self.wfile.write(json.dumps({"settings": load_settings_file()}).encode("utf-8"))
            return

        parsed = urlparse(self.path)
        if parsed.path == "/api/lyrics":
            qs = parse_qs(parsed.query or "")
            folder = (qs.get("folder") or [""])[0].strip()
            filename = (qs.get("file") or [""])[0].strip()
            self.handle_get_lyrics(folder, filename)
            return
        self._set_headers(404)
        self.wfile.write(b"{\"error\":\"Not found\"}")

    def do_POST(self):
        try:
            if self.path == "/api/upload":
                self.handle_upload()
                return
            if self.path == "/api/delete_album":
                self.handle_delete_album()
                return
            if self.path == "/api/delete_track":
                self.handle_delete_track()
                return
            if self.path == "/api/create_artist":
                self.handle_create_artist()
                return
            if self.path == "/api/create_album":
                self.handle_create_album()
                return
            if self.path == "/api/rename_artist":
                self.handle_rename_artist()
                return
            if self.path == "/api/rename_album":
                self.handle_rename_album()
                return
            if self.path == "/api/rename_track":
                self.handle_rename_track()
                return
            if self.path == "/api/delete_artist":
                self.handle_delete_artist()
                return
            if self.path == "/api/update_cover":
                self.handle_update_cover()
                return
            if self.path == "/api/state":
                self.handle_state()
                return
            if self.path == "/api/settings":
                self.handle_settings()
                return
            if self.path == "/api/lyrics":
                self.handle_set_lyrics()
                return
            self._set_headers(404)
            self.wfile.write(b"{\"error\":\"Not found\"}")
        except Exception as exc:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(exc)}).encode("utf-8"))

    def handle_state(self):
        data = self._read_json()
        if not isinstance(data, dict):
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Invalid state\"}")
            return
        save_state(data)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_settings(self):
        data = self._read_json()
        if not isinstance(data, dict):
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Invalid settings\"}")
            return
        save_settings_file(data)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def _read_json(self):
        length = int(self.headers.get("content-length", 0))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def handle_delete_artist(self):
        data = self._read_json()
        artist = (data.get("artist") or "").strip()
        if not artist:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing artist\"}")
            return

        album_list = load_album_list()
        remaining = []
        for folder in album_list:
            info = load_album_info(folder)
            if info and info.get("artist") == artist:
                album_dir = DATA_DIR / folder
                if album_dir.exists():
                    for path in album_dir.rglob("*"):
                        if path.is_file():
                            path.unlink()
                    for path in sorted(album_dir.rglob("*"), reverse=True):
                        if path.is_dir():
                            path.rmdir()
                    album_dir.rmdir()
            else:
                remaining.append(folder)

        save_album_list(remaining)
        artists = [name for name in load_artist_list() if name != artist]
        save_artist_list(artists)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_create_artist(self):
        data = self._read_json()
        artist = (data.get("artist") or "").strip()
        if not artist:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing artist\"}")
            return
        artists = load_artist_list()
        if artist not in artists:
            artists.append(artist)
            artists.sort(key=lambda item: item.lower())
            save_artist_list(artists)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_create_album(self):
        data = self._read_json()
        artist = (data.get("artist") or "").strip()
        title = (data.get("title") or "").strip()
        if not artist or not title:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing artist or title\"}")
            return
        folder = slugify(title)
        album_dir = DATA_DIR / folder
        album_dir.mkdir(parents=True, exist_ok=True)
        info = {
            "title": title,
            "artist": artist,
            "cover": "",
            "tracks": [],
        }
        save_album_info(folder, info)
        album_list = load_album_list()
        if folder not in album_list:
            album_list.append(folder)
            save_album_list(album_list)
        artists = load_artist_list()
        if artist not in artists:
            artists.append(artist)
            artists.sort(key=lambda item: item.lower())
            save_artist_list(artists)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True, "folder": folder}).encode("utf-8"))

    def handle_rename_artist(self):
        data = self._read_json()
        old = (data.get("old") or "").strip()
        new = (data.get("new") or "").strip()
        if not old or not new:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing artist names\"}")
            return
        for folder in load_album_list():
            info = load_album_info(folder)
            if info and info.get("artist") == old:
                info["artist"] = new
                save_album_info(folder, info)
        artists = load_artist_list()
        if old in artists:
            artists = [new if name == old else name for name in artists]
        elif new not in artists:
            artists.append(new)
        artists = sorted(set(artists), key=lambda item: item.lower())
        save_artist_list(artists)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_rename_album(self):
        data = self._read_json()
        folder = (data.get("folder") or "").strip()
        title = (data.get("title") or "").strip()
        if not folder or not title:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing folder or title\"}")
            return
        info = load_album_info(folder)
        if not info:
            self._set_headers(404)
            self.wfile.write(b"{\"error\":\"Album not found\"}")
            return
        info["title"] = title
        save_album_info(folder, info)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_rename_track(self):
        data = self._read_json()
        folder = (data.get("folder") or "").strip()
        file = (data.get("file") or "").strip()
        title = (data.get("title") or "").strip()
        if not folder or not file or not title:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing data\"}")
            return
        info = load_album_info(folder)
        if not info:
            self._set_headers(404)
            self.wfile.write(b"{\"error\":\"Album not found\"}")
            return
        for track in info.get("tracks", []):
            if track.get("file") == file:
                track["title"] = title
        save_album_info(folder, info)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_update_cover(self):
        ctype, _ = cgi.parse_header(self.headers.get("content-type"))
        if ctype != "multipart/form-data":
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Expected multipart/form-data\"}")
            return

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST"},
            keep_blank_values=True,
        )
        folder = (form.getfirst("folder") or "").strip()
        if not folder:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing folder\"}")
            return
        info = load_album_info(folder)
        if not info:
            self._set_headers(404)
            self.wfile.write(b"{\"error\":\"Album not found\"}")
            return
        cover_item = form["cover"] if "cover" in form else None
        if cover_item is None or not getattr(cover_item, "filename", ""):
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing cover\"}")
            return

        cover_name = Path(cover_item.filename).name
        album_dir = DATA_DIR / folder
        cover_path = album_dir / cover_name
        with cover_path.open("wb") as f:
            f.write(cover_item.file.read())
        info["cover"] = cover_name
        save_album_info(folder, info)
        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_delete_album(self):
        data = self._read_json()
        folder = data.get("folder")
        if not folder:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing folder\"}")
            return

        album_dir = DATA_DIR / folder
        if album_dir.exists():
            for path in album_dir.rglob("*"):
                if path.is_file():
                    path.unlink()
            for path in sorted(album_dir.rglob("*"), reverse=True):
                if path.is_dir():
                    path.rmdir()
            album_dir.rmdir()

        album_list = load_album_list()
        if folder in album_list:
            album_list.remove(folder)
            save_album_list(album_list)

        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_delete_track(self):
        data = self._read_json()
        folder = data.get("folder")
        filename = data.get("file")
        if not folder or not filename:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing folder or file\"}")
            return

        info = load_album_info(folder)
        if not info:
            self._set_headers(404)
            self.wfile.write(b"{\"error\":\"Album not found\"}")
            return

        info["tracks"] = [t for t in info.get("tracks", []) if t.get("file") != filename]
        save_album_info(folder, info)

        track_path = DATA_DIR / folder / filename
        if track_path.exists():
            track_path.unlink()

        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def handle_upload(self):
        ctype, pdict = cgi.parse_header(self.headers.get("content-type"))
        if ctype != "multipart/form-data":
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Expected multipart/form-data\"}")
            return

        pdict["boundary"] = bytes(pdict["boundary"], "utf-8")
        pdict["CONTENT-LENGTH"] = int(self.headers.get("content-length"))
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST"},
            keep_blank_values=True,
        )

        mode = form.getfirst("mode", "new_album")
        folder = form.getfirst("folder", "").strip()

        title = form.getfirst("album_title", "").strip()
        artist = form.getfirst("artist", "").strip()

        if mode != "append_album" and folder:
            existing = load_album_info(folder)
            if existing:
                mode = "append_album"
                info = existing

        if mode == "append_album":
            if not folder:
                self._set_headers(400)
                self.wfile.write(b"{\"error\":\"Missing album folder\"}")
                return
            info = load_album_info(folder)
            if not info:
                self._set_headers(404)
                self.wfile.write(b"{\"error\":\"Album not found\"}")
                return
            title = info.get("title", title)
            artist = info.get("artist", artist)
            cover_name = info.get("cover", "")
            album_dir = DATA_DIR / folder
        else:
            if not title or not artist:
                self._set_headers(400)
                self.wfile.write(b"{\"error\":\"Missing album title or artist\"}")
                return
            folder = slugify(title)
            album_dir = DATA_DIR / folder
            album_dir.mkdir(parents=True, exist_ok=True)

            cover_item = form["cover"] if "cover" in form else None
            if cover_item is None or not getattr(cover_item, "filename", ""):
                self._set_headers(400)
                self.wfile.write(b"{\"error\":\"Missing cover\"}")
                return

            cover_name = Path(cover_item.filename).name
            cover_path = album_dir / cover_name
            with cover_path.open("wb") as f:
                f.write(cover_item.file.read())

        durations = {}
        durations_raw = form.getfirst("durations")
        if durations_raw:
            try:
                durations = json.loads(durations_raw)
            except json.JSONDecodeError:
                durations = {}

        titles = {}
        titles_raw = form.getfirst("titles")
        if titles_raw:
            try:
                titles = json.loads(titles_raw)
            except json.JSONDecodeError:
                titles = {}

        tracks = []
        if "tracks" not in form:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"No tracks provided\"}")
            return

        track_items = form["tracks"]
        if not isinstance(track_items, list):
            track_items = [track_items]

        used_names = set()
        for item in track_items:
            original_name = Path(item.filename).name
            filename = safe_filename(original_name, used_names)
            if not filename:
                continue
            track_path = album_dir / filename
            with track_path.open("wb") as f:
                f.write(item.file.read())
            duration = durations.get(original_name, "0:00")
            title = titles.get(original_name) or Path(original_name).stem
            tracks.append({
                "title": title,
                "file": filename,
                "duration": duration,
                "lyrics": default_lyrics_for_duration(duration),
            })

        if mode == "append_album":
            existing = info.get("tracks", [])
            info["tracks"] = existing + tracks
        else:
            info = {
                "title": title,
                "artist": artist,
                "cover": cover_name,
                "tracks": tracks,
            }
        save_album_info(folder, info)

        album_list = load_album_list()
        if folder not in album_list:
            album_list.append(folder)
            save_album_list(album_list)
        artists = load_artist_list()
        if artist not in artists:
            artists.append(artist)
            artists.sort(key=lambda item: item.lower())
            save_artist_list(artists)

        self._set_headers(200)
        self.wfile.write(json.dumps({"ok": True, "folder": folder}).encode("utf-8"))



    def _validate_lyrics(self, lyrics):
        if lyrics is None:
            return []
        if not isinstance(lyrics, list):
            raise ValueError("lyrics must be a list")

        cleaned = []
        for item in lyrics:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            try:
                start = float(item.get("start"))
            except Exception:
                start = 0.0
            try:
                duration = float(item.get("duration"))
            except Exception:
                duration = 0.0
            start = max(0.0, start)
            duration = max(0.0, duration)
            cleaned.append({"text": text, "start": round(start, 1), "duration": round(duration, 1)})

        cleaned.sort(key=lambda x: x["start"])
        for i in range(len(cleaned) - 1):
            end = cleaned[i]["start"] + cleaned[i]["duration"]
            if end > cleaned[i + 1]["start"] + 1e-6:
                raise ValueError("Lyrics timings overlap")
        return cleaned

    def handle_get_lyrics(self, folder: str, filename: str):
        if not folder or not filename:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing folder or file\"}")
            return

        info = load_album_info(folder)
        if not info:
            self._set_headers(404)
            self.wfile.write(b"{\"error\":\"Album not found\"}")
            return

        for track in info.get("tracks", []):
            if track.get("file") == filename:
                self._set_headers(200)
                self.wfile.write(json.dumps({"lyrics": track.get("lyrics") or []}).encode("utf-8"))
                return

        self._set_headers(404)
        self.wfile.write(b"{\"error\":\"Track not found\"}")

    def handle_set_lyrics(self):
        data = self._read_json()
        folder = (data.get("folder") or "").strip()
        filename = (data.get("file") or "").strip()
        if not folder or not filename:
            self._set_headers(400)
            self.wfile.write(b"{\"error\":\"Missing folder or file\"}")
            return

        info = load_album_info(folder)
        if not info:
            self._set_headers(404)
            self.wfile.write(b"{\"error\":\"Album not found\"}")
            return

        try:
            lyrics = self._validate_lyrics(data.get("lyrics"))
        except Exception as exc:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": str(exc)}).encode("utf-8"))
            return

        for track in info.get("tracks", []):
            if track.get("file") == filename:
                track["lyrics"] = lyrics
                save_album_info(folder, info)
                self._set_headers(200)
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                return

        self._set_headers(404)
        self.wfile.write(b"{\"error\":\"Track not found\"}")

def safe_filename(original: str, used: set) -> str:
    path = Path(original)
    stem = slugify(path.stem)
    ext = path.suffix.lower()
    if not ext:
        ext = ".mp3"
    candidate = f"{stem}{ext}" if stem else f"track{ext}"
    if candidate not in used:
        used.add(candidate)
        return candidate
    i = 2
    while True:
        candidate = f"{stem}-{i}{ext}" if stem else f"track-{i}{ext}"
        if candidate not in used:
            used.add(candidate)
            return candidate
        i += 1


def main():
    parser = argparse.ArgumentParser(description="Flow local upload server")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    httpd = HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Upload server running on http://127.0.0.1:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
