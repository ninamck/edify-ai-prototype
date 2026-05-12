#!/usr/bin/env bash
# Install the limit.maxfiles LaunchDaemon so macOS raises the
# system-wide file-descriptor limit on every boot. This is a one-time
# fix; once installed you never need to think about EMFILE again.
#
# Why: the macOS default soft limit (256) is too small for Next.js's
# file watchers and you see `Watchpack Error: EMFILE: too many open
# files` followed by HMR silently dying. This raises it to 65536.
#
# Usage:  sudo bash scripts/raise-maxfiles.sh
#
# Safe to re-run — the operations below are idempotent: copy will
# overwrite, launchctl unload before load handles the "already loaded"
# case.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_SOURCE="$SCRIPT_DIR/limit.maxfiles.plist"
PLIST_DEST="/Library/LaunchDaemons/limit.maxfiles.plist"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "This script needs root. Run with: sudo bash $0" >&2
  exit 1
fi

if [[ ! -f "$PLIST_SOURCE" ]]; then
  echo "Source plist not found at $PLIST_SOURCE" >&2
  exit 1
fi

echo "Before:"
launchctl limit maxfiles || true
echo

echo "Installing $PLIST_SOURCE → $PLIST_DEST"
cp "$PLIST_SOURCE" "$PLIST_DEST"
chown root:wheel "$PLIST_DEST"
chmod 644 "$PLIST_DEST"

# Unload if a previous version is already loaded so the new values take
# effect now, not just on next boot.
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load -w "$PLIST_DEST"

echo
echo "After:"
launchctl limit maxfiles

echo
echo "Done. New shells and apps started from now on will inherit the"
echo "raised limit. Existing dev servers should be restarted to pick it up."
