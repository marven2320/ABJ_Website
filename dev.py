#!/usr/bin/env python3
"""
Development launcher for the AB&J Engineering Works website.

Does three things in one command:

  1. Makes this folder a git repository if it isn't one already.
  2. Watches the site files and commits automatically whenever you save
     a change, so every edit is captured in history.
  3. Runs the local preview server and opens it in your browser.

Usage
-----
    python3 dev.py                # set up, watch, serve on first free port
    python3 dev.py 9000           # use port 9000
    python3 dev.py --no-browser   # don't open a browser
    python3 dev.py --no-commit    # serve and watch, but don't auto-commit

Press Control-C to stop. Auto-commits are local only; nothing is pushed
anywhere unless you run `git push` yourself.
"""

import os
import subprocess
import sys
import threading
import time
import webbrowser

import serve  # reuses the server from serve.py in this same folder

ROOT = os.path.dirname(os.path.abspath(__file__))

WATCH_EXTENSIONS = (".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".md", ".py")
SKIP_DIRS = {".git", "__pycache__", ".vscode", ".idea", "node_modules"}
POLL_SECONDS = 3
SETTLE_SECONDS = 2  # wait for edits to stop before committing


# ---------------------------------------------------------------- git helpers

def git(*args, check=False):
    """Run a git command in the site folder and return (code, output)."""
    result = subprocess.run(
        ("git",) + args,
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if check and result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout).strip())
    return result.returncode, (result.stdout + result.stderr).strip()


def git_available():
    try:
        return git("--version")[0] == 0
    except FileNotFoundError:
        return False


def ensure_identity():
    """Make sure commits won't fail for a missing name or email."""
    for key, fallback in (("user.name", "AB&J Website"),
                          ("user.email", "info@abj-enggworks.com")):
        code, value = git("config", key)
        if code != 0 or not value:
            git("config", key, fallback)  # local to this repo only


def ensure_repo():
    """Initialise the repository on first run. Returns True if git is usable."""
    if not git_available():
        print("  Git isn't installed, so changes won't be committed.")
        print("  The server will still run normally.\n")
        return False

    if os.path.isdir(os.path.join(ROOT, ".git")):
        ensure_identity()
        return True

    print("  No repository here yet - setting one up.")
    code, out = git("init")
    if code != 0:
        print("  Couldn't initialise the repository: %s\n" % out)
        return False

    ensure_identity()
    git("add", "-A")
    code, out = git("commit", "-m", "Initial commit: AB&J Engineering Works website")
    if code == 0:
        print("  Repository created and the current files committed.\n")
    else:
        print("  Repository created.\n")
    return True


def has_changes():
    code, out = git("status", "--porcelain")
    return code == 0 and bool(out)


def changed_summary():
    """A short description of what changed, for the commit message."""
    code, out = git("status", "--porcelain")
    if code != 0 or not out:
        return "site files"
    names = []
    for line in out.splitlines():
        # Lines look like " M assets/style.css" or "?? new.html".
        # Leading whitespace may already be stripped, so take the final
        # path token rather than slicing at a fixed offset. For renames
        # ("R old -> new") this keeps the new name.
        parts = line.split()
        if not parts:
            continue
        names.append(os.path.basename(parts[-1].strip('"')))
    unique = sorted(set(names))
    if len(unique) <= 3:
        return ", ".join(unique)
    return "%s and %d more" % (", ".join(unique[:3]), len(unique) - 3)


def commit_changes():
    if not has_changes():
        return None
    summary = changed_summary()
    git("add", "-A")
    stamp = time.strftime("%Y-%m-%d %H:%M")
    code, out = git("commit", "-m", "Update %s (%s)" % (summary, stamp))
    if code != 0:
        return None
    code, short = git("rev-parse", "--short", "HEAD")
    return "%s  %s" % (short if code == 0 else "", summary)


# ---------------------------------------------------------------- file watcher

def snapshot():
    """Map every watched file to its size and modification time."""
    state = {}
    for folder, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if not name.lower().endswith(WATCH_EXTENSIONS):
                continue
            path = os.path.join(folder, name)
            try:
                info = os.stat(path)
                state[path] = (info.st_size, info.st_mtime)
            except OSError:
                pass
    return state


def watch_and_commit(stop_event):
    """Commit automatically once edits settle."""
    previous = snapshot()
    pending_since = None

    while not stop_event.is_set():
        stop_event.wait(POLL_SECONDS)
        if stop_event.is_set():
            break

        current = snapshot()
        if current != previous:
            previous = current
            pending_since = time.time()
            continue

        # Files have stopped changing - commit whatever is outstanding.
        if pending_since and (time.time() - pending_since) >= SETTLE_SECONDS:
            pending_since = None
            try:
                result = commit_changes()
                if result:
                    print("  Committed  %s" % result)
            except Exception as exc:
                print("  Couldn't commit: %s" % exc)


# ---------------------------------------------------------------- entry point

def parse_args(argv):
    port, open_browser, auto_commit = serve.DEFAULT_PORT, True, True
    for arg in argv[1:]:
        if arg in ("--no-browser", "-n"):
            open_browser = False
        elif arg == "--no-commit":
            auto_commit = False
        elif arg in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)
        elif arg.isdigit():
            port = int(arg)
        else:
            print("  Unrecognised option: %s   (try --help)" % arg)
            sys.exit(1)
    return port, open_browser, auto_commit


def main():
    requested_port, open_browser, auto_commit = parse_args(sys.argv)

    print("")
    print("  AB&J Engineering Works - development server")
    print("  Folder: %s" % ROOT)
    print("")

    if not serve.check_site_files():
        sys.exit(1)

    repo_ready = ensure_repo() if auto_commit else False

    port = serve.find_port(requested_port)
    if port is None:
        print("  No free port between %d and %d.\n"
              % (requested_port, requested_port + serve.PORT_SEARCH_SPAN))
        sys.exit(1)

    url = "http://localhost:%d" % port
    if port != requested_port:
        print("  Port %d was busy, using %d instead." % (requested_port, port))

    print("  Address: %s" % url)
    if repo_ready:
        print("  Watching for changes - edits are committed automatically.")
    print("  Press Control-C to stop.")
    print("")

    stop_event = threading.Event()
    watcher = None
    if repo_ready:
        watcher = threading.Thread(target=watch_and_commit, args=(stop_event,), daemon=True)
        watcher.start()

    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    with serve.Server(("", port), serve.Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopping.")
        finally:
            stop_event.set()
            if watcher:
                watcher.join(timeout=POLL_SECONDS + 1)
            if repo_ready:
                try:
                    result = commit_changes()  # capture any last edits
                    if result:
                        print("  Committed  %s" % result)
                except Exception:
                    pass
            print("  Server stopped.\n")


if __name__ == "__main__":
    main()
