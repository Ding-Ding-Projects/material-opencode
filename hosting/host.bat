@echo off
rem Start the OpenCode web app in Docker on Windows and print the verified local-network URL.
rem   hosting\host.bat                 run on this computer (Docker Desktop)
rem   hosting\host.bat --ssh user@host run on a Docker host over SSH
rem   hosting\host.bat --build         build the image from this checkout
rem   hosting\host.bat --down          stop the container (data volume is kept)
setlocal enabledelayedexpansion
set "HERE=%~dp0"
set "TARGET="
set "BUILD=0"
set "DOWN=0"
:args
if "%~1"=="" goto parsed
if "%~1"=="--ssh" (set "TARGET=%~2" & shift & shift & goto args)
if "%~1"=="--build" (set "BUILD=1" & shift & goto args)
if "%~1"=="--down" (set "DOWN=1" & shift & goto args)
echo unknown option: %~1 1>&2
exit /b 2
:parsed
if not exist "%HERE%.env" bun "%HERE%setup.ts" || exit /b 1
for /f "usebackq tokens=1,* delims==" %%A in ("%HERE%.env") do (
  set "LINE=%%A"
  if not "!LINE:~0,1!"=="#" set "%%A=%%B"
)
if "%BUILD%"=="1" (
  docker build -f "%HERE%Dockerfile" -t material-opencode:local "%HERE%.." || exit /b 1
  set "OPENCODE_IMAGE=material-opencode:local"
)
if not "%TARGET%"=="" (
  set "REMOTE=material-opencode-%OPENCODE_INSTANCE%"
  ssh %TARGET% "mkdir -p ~/!REMOTE!" || exit /b 1
  scp -q "%HERE%compose.yaml" "%HERE%.env" %TARGET%:~/!REMOTE!/ || exit /b 1
  if "%DOWN%"=="1" (ssh %TARGET% "cd ~/!REMOTE! && docker compose --env-file .env down" & exit /b !errorlevel!)
  ssh %TARGET% "cd ~/!REMOTE! && (docker compose --env-file .env pull -q || true) && docker compose --env-file .env up -d" || exit /b 1
  for /f %%I in ('ssh %TARGET% "hostname -I | cut -d' ' -f1"') do set "HOST=%%I"
) else (
  if "%DOWN%"=="1" (docker compose --env-file "%HERE%.env" -f "%HERE%compose.yaml" down & exit /b !errorlevel!)
  if "%BUILD%"=="0" docker compose --env-file "%HERE%.env" -f "%HERE%compose.yaml" pull -q
  docker compose --env-file "%HERE%.env" -f "%HERE%compose.yaml" up -d || exit /b 1
  for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /c:"IPv4"') do if not defined HOST set "HOST=%%I"
  set "HOST=!HOST: =!"
)
set "URL=http://%HOST%:%OPENCODE_PORT%"
echo Waiting for %URL%
for /l %%N in (1,1,60) do (
  curl -fsS -o NUL "%URL%/" && (echo Ready: %URL%  ^(password is in hosting\.env^) & exit /b 0)
  timeout /t 2 /nobreak >NUL
)
echo The app did not answer within 2 minutes. Logs: docker logs %OPENCODE_INSTANCE% 1>&2
exit /b 1
