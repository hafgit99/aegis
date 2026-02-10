@echo off
set "KEY_NAME=HKCU\Software\Google\Chrome\NativeMessagingHosts\com.aegis.vault"
set "MANIFEST_PATH=%~dp0com.aegis.vault.json"

reg add "%KEY_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
echo Native host registered at %KEY_NAME%
pause
