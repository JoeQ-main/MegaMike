@echo off
rem Builds MegaMike.exe in this folder. Requires Python with pywebview and pyinstaller:
rem   pip install pywebview pyinstaller
setlocal
cd /d "%~dp0"

python tools\make_icon.py || exit /b 1

pyinstaller --noconfirm --clean --onefile --windowed ^
  --name MegaMike ^
  --icon "%~dp0assets\megamike.ico" ^
  --add-data "%~dp0index.html;." ^
  --add-data "%~dp0style.css;." ^
  --add-data "%~dp0src;src" ^
  --distpath build\dist --workpath build\work --specpath build ^
  launcher.py || exit /b 1

copy /y build\dist\MegaMike.exe MegaMike.exe >nul
echo.
echo Built MegaMike.exe
