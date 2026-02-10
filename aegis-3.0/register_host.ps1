$ErrorActionPreference = "Stop"

# Chrome Native Messaging Host Definition
$ChromeHostName = "com.aegis.vault"
$ManifestPath = Join-Path $PSScriptRoot "host_manifest.json"
$ChromeRegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$ChromeHostName"

# Firefox Native Messaging Host Definition
$FirefoxHostName = "com.aegis.vault"
$FirefoxRegistryPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\$FirefoxHostName"

Write-Host "Registering Native Messaging Host for Aegis Vault..." -ForegroundColor Cyan

# 1. Register for Chrome
try {
    if (!(Test-Path $ChromeRegistryPath)) {
        New-Item -Path $ChromeRegistryPath -Force | Out-Null
    }
    Set-ItemProperty -Path $ChromeRegistryPath -Name "(Default)" -Value $ManifestPath -Force
    Write-Host "[OK] Chrome host registered successfully." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to register Chrome host: $_" -ForegroundColor Red
}

# 2. Register for Firefox
try {
    if (!(Test-Path $FirefoxRegistryPath)) {
        New-Item -Path $FirefoxRegistryPath -Force | Out-Null
    }
    Set-ItemProperty -Path $FirefoxRegistryPath -Name "(Default)" -Value $ManifestPath -Force
    Write-Host "[OK] Firefox host registered successfully." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to register Firefox host: $_" -ForegroundColor Red
}

# 3. Create/Update Batch Launcher for Chrome
# Chrome needs a .bat file to launch Node.js correctly
$BatchPath = Join-Path $PSScriptRoot "host-chrome.bat"
$NodePath = "C:\Program Files\nodejs\node.exe" 
$BridgePath = Join-Path $PSScriptRoot "native-host-bridge.cjs"
$BatchContent = "@echo off`r`n`"$NodePath`" `"$BridgePath`""

try {
    Set-Content -Path $BatchPath -Value $BatchContent -Force
    Write-Host "[OK] Launcher batch file created." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create launcher batch: $_" -ForegroundColor Red
}

Write-Host "`nRegistration complete! Please restart your browser." -ForegroundColor Yellow
Start-Sleep -Seconds 5
