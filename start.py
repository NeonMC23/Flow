import argparse
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import time
import webbrowser
from port_manager import get_port

def write_runtime_config(upload_port: int):
    config_path = Path(__file__).resolve().parent / "src" / "javascript" / "runtime_config.js"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        "window.FLOW_API_BASE = 'http://127.0.0.1:%d';\n" % upload_port,
        encoding="utf-8",
    )


def run_web(port: int):
    os.chdir(Path(__file__).resolve().parent)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), SimpleHTTPRequestHandler)
    print(f"Web server running on http://127.0.0.1:{port} \n")
    httpd.serve_forever()


def run_upload(port: int):
    from scripts.upload_server import Handler
    from http.server import HTTPServer

    httpd = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Upload server running on http://127.0.0.1:{port} \n")
    httpd.serve_forever()


def main():
    os.chdir(Path(__file__).resolve().parent)  # Ensure cwd is project root (UNC-safe)
    parser = argparse.ArgumentParser(description="Start Flow local servers")
    parser.add_argument("--web", type=int, default=None)
    parser.add_argument("--upload", type=int, default=8001)
    parser.add_argument("--no-browser", action="store_true", help="Do not open the web UI automatically")
    args = parser.parse_args()

    web_port = args.web if args.web is not None else get_port(default=5500)
    write_runtime_config(args.upload)

    web_thread = threading.Thread(target=run_web, args=(web_port,), daemon=True)
    upload_thread = threading.Thread(target=run_upload, args=(args.upload,), daemon=True)

    web_thread.start()
    upload_thread.start()

    if not args.no_browser:
        # Give the server a moment to bind before opening the UI
        time.sleep(0.25)
        webbrowser.open("http://127.0.0.1:%d/index.html" % web_port, new=2)

    web_thread.join()


if __name__ == "__main__":
    main()

