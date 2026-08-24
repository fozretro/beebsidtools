@echo off
rem Shared first-run setup for create.cmd and app.cmd.
rem Callers set ROOT, then: call "%ROOT%\scripts\ensure.cmd" :func [args]
call %*
goto :eof

:parse_launcher_args
set LAUNCHER_CLEAN=0
set LAUNCHER_PREVIEW=0
set "LAUNCHER_ARGS="
:parse_launcher_args_loop
if "%~1"=="" goto :eof
if /I "%~1"=="--clean" set LAUNCHER_CLEAN=1
if /I "%~1"=="--preview" set LAUNCHER_PREVIEW=1
if /I not "%~1"=="--clean" if /I not "%~1"=="--preview" set "LAUNCHER_ARGS=%LAUNCHER_ARGS% %1"
shift
goto parse_launcher_args_loop

:ensure_node
where node >nul 2>nul
if errorlevel 1 goto :ensure_node_missing
where npm >nul 2>nul
if errorlevel 1 goto :ensure_node_missing
node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit(M>24||(M===24&&m>=15)?0:1)"
if errorlevel 1 (
  for /f "delims=" %%V in ('node -v') do echo BeebSID Tools needs Node.js 24.15 or newer ^(found %%V^).
  echo Install from https://nodejs.org/ then try again.
  exit /b 1
)
goto :eof

:ensure_node_missing
echo BeebSID Tools needs Node.js 24.15 or newer ^(includes npm^).
echo Install from https://nodejs.org/ then try again.
exit /b 1

:ensure_clean
echo Cleaning generated files...
if exist "%ROOT%\src.create\node_modules\" rmdir /s /q "%ROOT%\src.create\node_modules"
if exist "%ROOT%\src.app\node_modules\" rmdir /s /q "%ROOT%\src.app\node_modules"
if exist "%ROOT%\node_modules\" rmdir /s /q "%ROOT%\node_modules"
if exist "%ROOT%\src.player\out\" rmdir /s /q "%ROOT%\src.player\out"
if exist "%ROOT%\src.app\dist\" rmdir /s /q "%ROOT%\src.app\dist"
if exist "%ROOT%\src.app\public\jsbeeb\" rmdir /s /q "%ROOT%\src.app\public\jsbeeb"
if exist "%ROOT%\logs\" rmdir /s /q "%ROOT%\logs"
if exist "%ROOT%\src.app\public\player\" (
  for %%F in ("%ROOT%\src.app\public\player\*") do (
    if /I not "%%~nxF"==".gitkeep" if exist "%%F" del /q "%%F"
  )
)
echo Cleaned.
goto :eof

:run_logged
set "_logname=%~1"
set "_doing=%~2"
set "_ok=%~3"
shift
shift
shift
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
set "_log=%ROOT%\logs\%_logname%"
echo %_doing%
echo === %DATE% %TIME% %* === > "%_log%"
call %* >> "%_log%" 2>&1
if errorlevel 1 (
  echo Failed: %_doing%
  echo See %_log%
  exit /b 1
)
echo %_ok%
goto :eof

:ensure_pkg
set "_dir=%~1"
if exist "%ROOT%\%_dir%\node_modules\" goto :eof
call :run_logged "install-%_dir%.log" "Building (first run, may take a minute)..." "Build succeeded." npm install --prefix "%ROOT%\%_dir%"
goto :eof

:_bootstrap_app
if not exist "%ROOT%\src.create\node_modules\" (
  call npm install --prefix "%ROOT%\src.create"
  if errorlevel 1 exit /b 1
)
if not exist "%ROOT%\src.app\node_modules\" (
  call npm install --prefix "%ROOT%\src.app"
  if errorlevel 1 exit /b 1
)
goto :eof

:ensure_app_bootstrap
if exist "%ROOT%\src.create\node_modules\" if exist "%ROOT%\src.app\node_modules\" goto :eof
call :run_logged "build-app.log" "Building (first run, may take a minute)..." "Build succeeded." :_bootstrap_app
goto :eof

:ensure_app_dist
if exist "%ROOT%\src.app\dist\index.html" goto :eof
call :run_logged "build-app.log" "Building (first run, may take a minute)..." "Build succeeded." npm run build:app --prefix "%ROOT%"
goto :eof

:ensure_player
set "_out=%ROOT%\src.player\out"
set "_golden=%ROOT%\src.player\test\golden"
if not exist "%_out%" mkdir "%_out%"
for %%N in (sidpl.o sidpelk.o) do (
  if not exist "%_out%\%%N" (
    if not exist "%_golden%\%%N" (
      echo Missing bundled player %_golden%\%%N
      exit /b 1
    )
    copy /y "%_golden%\%%N" "%_out%\%%N" >nul
  )
)
goto :eof
