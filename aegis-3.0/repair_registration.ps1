$currentDir = Get-Location
$manifestPath = Join-Path $currentDir "com.aegis.vault.json"
$firefoxManifestPath = Join-Path $currentDir "com.aegis.vault.firefox.json"
$hostBatPath = (Join-Path $currentDir "host.bat").Replace('\', '\\')

# 1. Update Manifest JSONs with absolute paths
if (Test-Path $manifestPath) {
    $json = Get-Content $manifestPath | ConvertFrom-Json
    $json.path = (Join-Path $currentDir "host.bat")
    # Add common local development IDs just in case
    if ($json.allowed_origins -notcontains "chrome-extension://knldjmfmopnpolahpmmgbagdohdnhkik/") {
        $json.allowed_origins += "chrome-extension://knldjmfmopnpolahpmmgbagdohdnhkik/"
    }
    $json | ConvertTo-Json | Set-Content $manifestPath
    Write-Host "Updated Chrome Manifest: $manifestPath"
}

if (Test-Path $firefoxManifestPath) {
    $json = Get-Content $firefoxManifestPath | ConvertFrom-Json
    $json.path = (Join-Path $currentDir "host.bat")
    $json | ConvertTo-Json | Set-Content $firefoxManifestPath
    Write-Host "Updated Firefox Manifest: $firefoxManifestPath"
}

# 2. Update Registry
$chromeRegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.aegis.vault"
$firefoxRegPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\com.aegis.vault"

if (!(Test-Path $chromeRegPath)) { New-Item -Path $chromeRegPath -Force }
Set-ItemProperty -Path $chromeRegPath -Name "(default)" -Value $manifestPath
Write-Host "Registered Chrome Host in Registry"

if (!(Test-Path $firefoxRegPath)) { New-Item -Path $firefoxRegPath -Force }
Set-ItemProperty -Path $firefoxRegPath -Name "(default)" -Value $firefoxManifestPath
Write-Host "Registered Firefox Host in Registry"

Write-Host "`nRepair Complete! Please restart your browser." -ForegroundColor Green
