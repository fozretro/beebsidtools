@echo off
rem Open the BeebSID Disc Creator in a browser. Vite reloads on save.
rem --clean wipes generated installs/dist then bootstraps again.
rem --preview serves the static dist build (no live reload).
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
if not defined PORT set "PORT=4173"
call "%ROOT%\scripts\ensure.cmd" :parse_launcher_args %*
if errorlevel 1 exit /b 1
call "%ROOT%\scripts\ensure.cmd" :ensure_node
if errorlevel 1 exit /b 1
if "%LAUNCHER_CLEAN%"=="1" (
  call "%ROOT%\scripts\ensure.cmd" :ensure_clean
  if errorlevel 1 exit /b 1
)
call "%ROOT%\scripts\ensure.cmd" :ensure_player
if errorlevel 1 exit /b 1
call "%ROOT%\scripts\ensure.cmd" :ensure_app_bootstrap
if errorlevel 1 exit /b 1
if "%LAUNCHER_PREVIEW%"=="1" (
  call "%ROOT%\scripts\ensure.cmd" :ensure_app_dist
  if errorlevel 1 exit /b 1
  call npm run preview --prefix "%ROOT%\src.app" -- --host 127.0.0.1 --port %PORT% --open
  exit /b %ERRORLEVEL%
)
call npm run dev --prefix "%ROOT%\src.app" -- --host 127.0.0.1 --port %PORT% --open
exit /b %ERRORLEVEL%
