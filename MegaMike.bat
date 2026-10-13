@echo off
rem Serves the emulator on a local port and opens it in the default browser.
rem Needs only Python; no packages. Close this window to stop the server.
setlocal
cd /d "%~dp0"
start "" http://localhost:8766/
python -m http.server 8766 --bind 127.0.0.1
