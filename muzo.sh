#!/usr/bin/env bash
# =================================================================
# Muzo - Free Music Streaming Player (Linux Launcher)
# =================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================="
echo "  🎵 Launching Muzo Free Music Player for Linux..."
echo "  Smart Recommendations • Free Songs • No Ads"
echo "======================================================="

PORT=5050

# 1. Start backend server if Node is installed
if command -v node >/dev/null 2>&1; then
    # Check if port is already running
    if ! curl -s "http://127.0.0.1:$PORT/api/network-info" >/dev/null 2>&1; then
        echo "Starting Muzo background server on port $PORT..."
        PORT=$PORT node server.js >/dev/null 2>&1 &
        SERVER_PID=$!
        sleep 1
    fi
fi

URL="http://localhost:$PORT"

# 2. Launch in native App Mode if a Chromium-based browser is found
if command -v google-chrome >/dev/null 2>&1; then
    google-chrome --app="$URL" --user-data-dir="$HOME/.config/muzo-profile" &
elif command -v chromium-browser >/dev/null 2>&1; then
    chromium-browser --app="$URL" --user-data-dir="$HOME/.config/muzo-profile" &
elif command -v chromium >/dev/null 2>&1; then
    chromium --app="$URL" --user-data-dir="$HOME/.config/muzo-profile" &
elif command -v brave-browser >/dev/null 2>&1; then
    brave-browser --app="$URL" --user-data-dir="$HOME/.config/muzo-profile" &
elif command -v msedge >/dev/null 2>&1; then
    msedge --app="$URL" --user-data-dir="$HOME/.config/muzo-profile" &
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
else
    echo "Muzo is running at: $URL"
fi
