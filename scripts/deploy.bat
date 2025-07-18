@echo off
REM Deploy Script für Windows
REM Benötigt WinSCP oder PuTTY/PSCP

set REMOTE_HOST=192.168.178.73
set REMOTE_USER=apexpam
set REMOTE_PASS=Reyhan2012!
set REMOTE_PATH=/home/apexpam/repos
set APP_NAME=raspizulassungsstellewz

echo 🚀 Deploying App to Raspberry Pi...

REM Prüfe ob package.json existiert
if not exist "package.json" (
    echo ❌ Error: package.json not found. Run from project root.
    pause
    exit /b 1
)

REM Erstelle temporäres Verzeichnis
if exist "temp_deploy" rmdir /s /q "temp_deploy"
mkdir temp_deploy

echo 📦 Preparing files...

REM Kopiere Dateien (ohne node_modules)
xcopy /s /e /i /q . temp_deploy\ /exclude:deploy_exclude.txt

REM Verwende PSCP (Teil von PuTTY) zum Upload
echo 📂 Uploading files...
pscp -r -pw %REMOTE_PASS% temp_deploy\* %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PATH%/%APP_NAME%/

REM SSH Befehle über plink (Teil von PuTTY)
echo 🔧 Installing dependencies...
plink -pw %REMOTE_PASS% %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH%/%APP_NAME% && npm install --production"

echo 🚀 Starting app...
plink -pw %REMOTE_PASS% %REMOTE_USER%@%REMOTE_HOST% "cd %REMOTE_PATH%/%APP_NAME% && pkill -f 'node.*index.js' || true && nohup npm start > app.log 2>&1 &"

REM Cleanup
rmdir /s /q "temp_deploy"

echo ✅ Deploy completed!
echo 🌐 URL: http://192.168.178.73:3000
pause
