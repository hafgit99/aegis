# Postbuild script for SHA256SUMS.txt generation

Write-Host "[Build] Copying native-host-bridge.cjs..."
Copy-Item -Path 'native-host-bridge.cjs' -Destination 'dist_out/win-unpacked/resources/' -Force

$out = 'dist_out'
$unpackedDir = Join-Path $out 'win-unpacked'
$version = (Get-Content 'package.json' | ConvertFrom-Json).version
$zipName = "Aegis Vault-$version-x64.zip"
$zipPath = Join-Path $out $zipName

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host '[Build] Recreating ZIP with all files...'
Compress-Archive -Path (Join-Path $unpackedDir '*') -DestinationPath $zipPath -Force
Write-Host "[Build] ZIP recreated: $zipName"

Remove-Item -Path (Join-Path $out 'SHA256SUMS.txt') -ErrorAction SilentlyContinue

Write-Host '[Security] Creating SHA256 checksums...'
Get-ChildItem -Path $out -Filter '*.zip' | ForEach-Object {
    $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
    "$hash  $($_.Name)" | Out-File (Join-Path $out 'SHA256SUMS.txt') -Append -Encoding utf8
    Write-Host "[Security] Checksum created for $($_.Name): $hash"
}

Write-Host '[Build] Postbuild complete!'
