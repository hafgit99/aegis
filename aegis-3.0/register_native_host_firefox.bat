@echo off
set "KEY_NAME=HKCU\Software\Mozilla\NativeMessagingHosts\com.aegis.vault"
set "MANIFEST_PATH=%~dp0com.aegis.vault.firefox.json"

reg add "%KEY_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
echo Firefox Native host registered at %KEY_NAME%
pause
