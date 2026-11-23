@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo サーバーを起動してブラウザを開きます...
start "" http://localhost:3456
node server.js
pause
