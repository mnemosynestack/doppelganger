#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"

mkdir -p /app/data

echo "[vnc] Starting Xvfb on $DISPLAY"
Xvfb "$DISPLAY" -screen 0 1280x720x24 -nolisten tcp -ac &

echo "[vnc] Starting x11vnc on :5900"
X11VNC_OPTS="-display $DISPLAY -forever -shared -nopw -rfbport 5900 -wait 5"
x11vnc $X11VNC_OPTS >> /app/data/x11vnc.log 2>&1 &

NOVNC_DIR="/usr/share/novnc"
if [ ! -d "$NOVNC_DIR" ]; then
  NOVNC_DIR="/opt/novnc"
fi

if [ ! -d "$NOVNC_DIR" ]; then
  echo "[vnc] noVNC not found, downloading..."
  mkdir -p /opt/novnc
  curl -fsSL https://github.com/novnc/noVNC/archive/refs/tags/v1.4.0.tar.gz \
    | tar -xz --strip-components=1 -C /opt/novnc
  NOVNC_DIR="/opt/novnc"
fi

echo "[vnc] Serving noVNC on 0.0.0.0:54311"
if command -v websockify >/dev/null 2>&1; then
  for _ in {1..50}; do
    if bash -c "echo > /dev/tcp/127.0.0.1/5900" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  (
    while true; do
      websockify --web "$NOVNC_DIR" 0.0.0.0:54311 localhost:5900 >> /app/data/novnc.log 2>&1
      sleep 1
    done
  ) &
else
  echo "[vnc] websockify not found" >> /app/data/novnc.log
fi

echo "[vnc] Starting server"
exec node /app/server.js
