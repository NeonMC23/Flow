import json
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
PORT_FILE = os.path.join(PROJECT_ROOT, "port.json")


def _write_port_file(port):
    try:
        with open(PORT_FILE, "w", encoding="utf-8") as f:
            json.dump({"port": port}, f, indent=2)
            f.write("\n")
    except OSError:
        # Never crash if writing fails (permissions, UNC/cwd issues, etc.)
        pass


def get_port(default=5000):
    """Read the port from port.json and return it.

    - Create port.json with `default` if missing (unless default is None)
    - If corrupt/invalid, recreate with `default` (unless default is None)
    - Never crashes if the file can't be written
    """

    if not os.path.exists(PORT_FILE):
        if default is None:
            return None
        _write_port_file(default)
        return default

    try:
        with open(PORT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        port = data.get("port")
        if isinstance(port, int) and 1 <= port <= 65535:
            return port
    except (json.JSONDecodeError, OSError, AttributeError):
        pass

    if default is None:
        return None
    _write_port_file(default)
    return default


def set_port(port):
    """Update port.json with the given port."""

    if port is None:
        raise ValueError("port cannot be None")
    if not isinstance(port, int) or not (1 <= port <= 65535):
        raise ValueError("port must be an int in range 1..65535")
    _write_port_file(port)