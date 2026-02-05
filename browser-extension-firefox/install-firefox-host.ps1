# Firefox Native Messaging Host Installer
# NO ADMIN RIGHTS REQUIRED - Uses HKCU (Current User) registry

$hostName = "com.aegis.vault"

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

# Paths
$manifestTemplatePath = Join-Path $projectRoot "aegis-data\com.aegis.vault.firefox.json"
$userDataPath = Join-Path $env:APPDATA "aegis-vault"
$manifestPath = Join-Path $userDataPath "com.aegis.vault.firefox.json"

# Firefox Native Messaging Host Registry Path (HKCU - no admin required)
$registryPath = "HKCU:\SOFTWARE\Mozilla\NativeMessagingHosts\$hostName"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Aegis Vault - Firefox Native Messaging Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installing for current user (no admin rights needed)..." -ForegroundColor Green
Write-Host ""

# Create user data directory if it doesn't exist
if (-not (Test-Path $userDataPath)) {
    Write-Host "Creating user data directory..." -ForegroundColor Yellow
    New-Item -Path $userDataPath -ItemType Directory -Force | Out-Null
}

# Check if template manifest file exists
if (-not (Test-Path $manifestTemplatePath)) {
    Write-Host "ERROR: Template manifest file not found at $manifestTemplatePath" -ForegroundColor Red
    exit 1
}

# Read template and update path
try {
    $manifestContent = Get-Content $manifestTemplatePath -Raw | ConvertFrom-Json
    
    # Update the path to the bridge script
    $bridgePath = Join-Path $projectRoot "aegis-data\aegis-bridge.bat"
    $manifestContent.path = $bridgePath
    
    # Save to user directory
    $manifestContent | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8
    Write-Host "✓ Manifest file created at: $manifestPath" -ForegroundColor Green
    
} catch {
    Write-Host "ERROR: Failed to create manifest file" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Create registry key
try {
    # Remove existing key if it exists
    if (Test-Path $registryPath) {
        Write-Host "Removing existing registry key..." -ForegroundColor Yellow
        Remove-Item -Path $registryPath -Force
    }
    
    # Create or update the registry key using reg.exe (format HKCU\...)
    # We use cmd.exe /c to ensure reg.exe treats arguments correctly
    $regPathStandard = "HKCU\SOFTWARE\Mozilla\NativeMessagingHosts\$hostName"
    Invoke-Expression "reg add `"$regPathStandard`" /ve /t REG_SZ /d `"$manifestPath`" /f" | Out-Null
    
    Write-Host "✓ Registry key created at: $registryPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "  Installation Complete!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  Registry: $registryPath" -ForegroundColor White
    Write-Host "  Manifest: $manifestPath" -ForegroundColor White
    Write-Host "  Bridge:   $bridgePath" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Make sure Aegis Vault desktop app is installed" -ForegroundColor White
    Write-Host "  2. Install the Firefox extension (.xpi file)" -ForegroundColor White
    Write-Host "  3. Open Aegis Vault and unlock your vault" -ForegroundColor White
    Write-Host "  4. Test the extension on any website" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR: Failed to create registry key" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
