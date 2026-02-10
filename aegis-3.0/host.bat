@echo off
set "NODE_PATH=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_PATH%" set NODE_PATH=node

"%NODE_PATH%" "%~dp0native-host-bridge.cjs"
