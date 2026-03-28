$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$dockerExe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$dockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

Write-Host "Starting Docker Desktop if available..."
if (Test-Path $dockerDesktopExe) {
  Start-Process $dockerDesktopExe | Out-Null
}

Write-Host "Waiting for Docker engine..."
$ready = $false
for ($i = 0; $i -lt 18; $i++) {
  & $dockerExe info *> $null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 5
}

if (-not $ready) {
  throw "Docker engine did not become ready in time."
}

Write-Host "Starting Postgres and Redis..."
& $dockerExe compose -f infra/docker-compose.local.yml up -d
if ($LASTEXITCODE -ne 0) {
  throw "Failed to start docker compose services."
}

Write-Host "Preparing Prisma local schema..."
npm run prisma:bootstrap:local
if ($LASTEXITCODE -ne 0) {
  throw "Failed to generate/apply/seed Prisma schema locally."
}

Write-Host ""
Write-Host "MOVY infra is ready." -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  1. Set MOVY_DATA_MODE=prisma in .env if you want persistent local runtime"
Write-Host "  2. npm run dev:backend"
Write-Host "  3. npm run dev:frontend"
Write-Host "  4. npm run dev:mobile"
Write-Host "  5. npm run smoke:backend (after backend is running)"
