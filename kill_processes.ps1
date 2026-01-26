# Kill all Electron and Aegis processes
Get-Process | Where-Object {
    $_.ProcessName -match 'electron' -or $_.ProcessName -match 'Aegis' -or $_.MainWindowTitle -match 'Aegis'
} | ForEach-Object {
    Write-Host "Stopping: $($_.ProcessName) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

Write-Host "Processes killed. Now cleaning dist_out..."

# Remove dist_out
Remove-Item -Path "dist_out" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

if (Test-Path "dist_out") {
    Write-Host "ERROR: dist_out still exists"
} else {
    Write-Host "SUCCESS: dist_out removed"
}
