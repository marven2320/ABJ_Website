#!/usr/bin/env python3
"""
Local development server for the AB&J Engineering Works website.

Usage
-----
    python3 serve.py              # serve on the first free port from 8000
    python3 serve.py 9000         # serve on port 9000
    python3 serve.py --no-browser # don't open a browser automatically

Serves the folder this file lives in, so it works no matter which
directory you run it from. Press Control-C to stop.

Responses are sent with no-cache headers, so a plain refresh always
picks up your latest edits to the HTML, CSS, and JS.
"""

import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

# The site lives alongside this script.
ROOT = os.path.dirname(os.path.abspath(__file__))

DEFAULT_PORT = 8000
PORT_SEARCH_SPAN = 50
REQUIRED_FILES = ("index.html", "pv-estimate.html", "assets")


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static file handler that always serves the site folder and never caches."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the console readable: only report problems, not every 200 OK.
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):
            sys.stderr.write("  %s %s\n" % (status, args[0]))


class Server(socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def port_is_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        return probe.connect_ex(("127.0.0.1", port)) != 0


def find_port(start):
    """Return the first free port at or above `start`, or None."""
    for port in range(start, min(start + PORT_SEARCH_SPAN, 65535) + 1):
        if port_is_free(port):
            return port
    return None


def check_site_files():
    missing = [name for name in REQUIRED_FILES if not os.path.exists(os.path.join(ROOT, name))]
    if missing:
        print("\n  Missing from this folder: " + ", ".join(missing))
        print("  Put serve.py in the same folder as the website files.\n")
        return False
    return True


def parse_args(argv):
    port, open_browser = DEFAULT_PORT, True
    for arg in argv[1:]:
        if arg in ("--no-browser", "-n"):
            open_browser = False
        elif arg in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)
        elif arg.isdigit():
            port = int(arg)
        else:
            print("  Unrecognised option: %s   (try --help)" % arg)
            sys.exit(1)
    return port, open_browser


def main():
    requested_port, open_browser = parse_args(sys.argv)

    if not check_site_files():
        sys.exit(1)

    port = find_port(requested_port)
    if port is None:
        print("\n  No free port between %d and %d.\n"
              % (requested_port, requested_port + PORT_SEARCH_SPAN))
        sys.exit(1)

    url = "http://localhost:%d" % port

    if port != requested_port:
        print("\n  Port %d was busy, using %d instead." % (requested_port, port))

    print("")
    print("  AB&J Engineering Works - local preview")
    print("  Serving: %s" % ROOT)
    print("  Address: %s" % url)
    print("")
    print("  Press Control-C to stop.")
    print("")

    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    with Server(("", port), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server stopped.\n")


if __name__ == "__main__":
    main()
