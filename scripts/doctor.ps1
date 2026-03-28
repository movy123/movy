$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Resolve-ToolPath {
  param(
    [string]$DirectPath,
    [scriptblock]$Fallback
  )

  if ($DirectPath -and (Test-Path $DirectPath)) {
    return $DirectPath
  }

  if ($Fallback) {
    return & $Fallback
  }

  return $null
}

function Invoke-Tool {
  param(
    [string]$ExePath,
    [string[]]$Arguments
  )

  if (-not $ExePath) {
    throw "Executable not found."
  }

  $quotedExe = '"' + $ExePath + '"'
  $quotedArgs = ($Arguments | ForEach-Object { '"' + $_ + '"' }) -join " "
  return cmd /c "$quotedExe $quotedArgs" 2>&1
}

function Test-Command {
  param(
    [string]$Name,
    [scriptblock]$Runner
  )

  try {
    $result = & $Runner
    [PSCustomObject]@{
      Name = $Name
      Ok = $true
      Details = ($result | Select-Object -First 2) -join " "
    }
  } catch {
    [PSCustomObject]@{
      Name = $Name
      Ok = $false
      Details = $_.Exception.Message
    }
  }
}

$javaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
$androidHome = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")
$dockerExe = Resolve-ToolPath -DirectPath "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$gitExe = Resolve-ToolPath -DirectPath "C:\Program Files\Git\cmd\git.exe"
$rgExe = Resolve-ToolPath -Fallback {
  Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter rg.exe |
    Select-Object -First 1 -ExpandProperty FullName
}
$javaExePath = $null
if ($javaHome) {
  $javaExePath = Join-Path $javaHome "bin\java.exe"
}
$adbExePath = $null
if ($androidHome) {
  $adbExePath = Join-Path $androidHome "adb.exe"
}
$javaExe = Resolve-ToolPath -DirectPath $javaExePath
$adbExe = Resolve-ToolPath -DirectPath $adbExePath

$checks = @(
  (Test-Command -Name "Node.js" -Runner { powershell -NoProfile -Command "node -v" }),
  (Test-Command -Name "npm" -Runner { powershell -NoProfile -Command "npm -v" }),
  (Test-Command -Name "Git" -Runner { Invoke-Tool -ExePath $gitExe -Arguments @("--version") }),
  (Test-Command -Name "ripgrep" -Runner { Invoke-Tool -ExePath $rgExe -Arguments @("--version") }),
  (Test-Command -Name "Java" -Runner { Invoke-Tool -ExePath $javaExe -Arguments @("-version") }),
  (Test-Command -Name "ADB" -Runner { Invoke-Tool -ExePath $adbExe -Arguments @("version") }),
  (Test-Command -Name "Docker CLI" -Runner { Invoke-Tool -ExePath $dockerExe -Arguments @("--version") }),
  (Test-Command -Name "Docker Engine" -Runner { Invoke-Tool -ExePath $dockerExe -Arguments @("info","--format","{{.ServerVersion}}") }),
  (Test-Command -Name "Backend tests" -Runner { powershell -NoProfile -Command "npm run test --workspace backend" }),
  (Test-Command -Name "Monorepo lint" -Runner { powershell -NoProfile -Command "npm run lint" })
)

$checks | Format-Table -AutoSize

$failed = $checks | Where-Object { -not $_.Ok }
if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Environment has failing checks." -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "Environment ready for MOVY local development." -ForegroundColor Green
