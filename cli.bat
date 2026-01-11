@echo off
chcp 65001 > nul
set ELECTRON_RUN_AS_NODE=1
"%~dp0Aegis Vault.exe" "%~dp0cli.js" %*
