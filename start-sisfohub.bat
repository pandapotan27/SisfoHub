@echo off
setlocal
cd /d "%~dp0"
echo ===========================================
echo       SISFO HUB - START APLIKASI
echo ===========================================
if not exist "server\.env" (
  echo File server\.env belum ada.
  echo Salin server\.env.example menjadi server\.env, lalu sesuaikan password MySQL.
  pause
  exit /b 1
)
if not exist "server\node_modules" (
  echo Memasang dependency backend...
  cd server
  call npm.cmd install
  cd ..
)
if not exist "client\node_modules" (
  echo Memasang dependency frontend...
  cd client
  call npm.cmd install
  cd ..
)
start "Sisfo Hub API" cmd /k "cd /d ""%~dp0server"" && npm.cmd run dev"
start "Sisfo Hub UI" cmd /k "cd /d ""%~dp0client"" && npm.cmd run dev"
timeout /t 3 >nul
start http://localhost:5173
echo Browser akan terbuka. Jangan tutup dua jendela terminal Sisfo Hub.
