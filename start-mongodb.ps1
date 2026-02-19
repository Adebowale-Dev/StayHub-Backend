# Start MongoDB Service
Write-Host "Starting MongoDB..." -ForegroundColor Cyan

# Check if MongoDB service exists
$service = Get-Service -Name MongoDB -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -eq "Running") {
        Write-Host "✓ MongoDB is already running" -ForegroundColor Green
    } else {
        Start-Service MongoDB
        Write-Host "✓ MongoDB started successfully" -ForegroundColor Green
    }
} else {
    Write-Host "× MongoDB service not found. Installation may not be complete." -ForegroundColor Red
    Write-Host "Trying to start mongod manually..." -ForegroundColor Yellow
    
    # Try to start mongod manually
    $mongoPath = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
    if (Test-Path $mongoPath) {
        Write-Host "Starting MongoDB manually..." -ForegroundColor Yellow
        Start-Process -FilePath $mongoPath -ArgumentList "--dbpath", "C:\data\db" -NoNewWindow
        Write-Host "✓ MongoDB started" -ForegroundColor Green
    } else {
        Write-Host "MongoDB installation path not found. Please wait for installation to complete." -ForegroundColor Red
    }
}

Write-Host "`nMongoDB Status:" -ForegroundColor Cyan
Get-Service -Name MongoDB -ErrorAction SilentlyContinue | Format-Table -AutoSize
