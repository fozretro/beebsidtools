@echo off
rem Convert SIDs / pack a BeebSID disc. First run installs Node deps if needed.
rem --clean wipes generated installs then bootstraps again (not passed to the CLI).
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
call "%ROOT%\scripts\ensure.cmd" :parse_launcher_args %*
if errorlevel 1 exit /b 1
call "%ROOT%\scripts\ensure.cmd" :ensure_node
if errorlevel 1 exit /b 1
if "%LAUNCHER_CLEAN%"=="1" (
  call "%ROOT%\scripts\ensure.cmd" :ensure_clean
  if errorlevel 1 exit /b 1
)
call "%ROOT%\scripts\ensure.cmd" :ensure_pkg src.create
if errorlevel 1 exit /b 1
call "%ROOT%\scripts\ensure.cmd" :ensure_player
if errorlevel 1 exit /b 1
if not defined LAUNCHER_ARGS (
  node "%ROOT%\src.create\src\cli.js"
) else (
  node "%ROOT%\src.create\src\cli.js" %LAUNCHER_ARGS%
)
exit /b %ERRORLEVEL%
