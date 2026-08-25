# ==============================================================================
# Hemmers Agent - Universal AI Agent Enhancement Platform Installer for Windows
# https://github.com/zakmijo2-dotcom/Hermmers-agent
# ==============================================================================

$ErrorActionPreference = "Stop"

function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param($Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-ErrorMsg { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

Write-Host @"
  _    _                                          
 | |  | |                                         
 | |__| | ___ _ __ ___  _ __ ___   ___ _ __ ___   
 |  __  |/ _ \ '_ \` _ \| '_ \` _ \ / _ \ '__/ __|  
 | |  | |  __/ | | | | | | | | | |  __/ |  \__ \  
 |_|  |_|\___|_| |_| |_|_| |_| |_|\___|_|  |___/  
                                                  
 Universal AI Agent Enhancement Platform & Runtime
"@ -ForegroundColor Cyan

# Check Node.js
Write-Info "Checking prerequisites..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-ErrorMsg "Node.js is not installed."
    Write-Host "Please download and install Node.js (>= 18): https://nodejs.org/"
    exit 1
}

$nodeVersion = (node -v).TrimStart('v')
$nodeMajor = [int]($nodeVersion.Split('.')[0])

if ($nodeMajor -lt 18) {
    Write-ErrorMsg "Node.js version is v$nodeVersion. Hemmers requires Node.js >= v18.0.0."
    exit 1
}
Write-Success "Found Node.js v$nodeVersion"

# Check Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-ErrorMsg "Git is not installed."
    Write-Host "Please install Git: https://git-scm.com/"
    exit 1
}
Write-Success "Found Git"

$installDir = if ($env:HEMMERS_DIR) { $env:HEMMERS_DIR } else { Join-Path $HOME ".hemmers" }
$repoUrl = "https://github.com/zakmijo2-dotcom/Hermmers-agent.git"

if (Test-Path (Join-Path $installDir ".git")) {
    Write-Info "Existing Hemmers installation found at $installDir. Updating..."
    git -C $installDir fetch origin main
    git -C $installDir reset --hard origin/main
} else {
    Write-Info "Cloning Hemmers into $installDir..."
    if (Test-Path $installDir) { Remove-Item -Recurse -Force $installDir }
    git clone $repoUrl $installDir
}

Set-Location $installDir

Write-Info "Installing dependencies..."
npm install

Write-Info "Building TypeScript..."
npm run build

Write-Info "Registering global command via npm link..."
try {
    npm link
} catch {
    Write-Warning "npm link failed. You may need to run PowerShell as Administrator."
}

Write-Host ""
Write-Success "Hemmers Agent installed successfully!"
Write-Host ""
Write-Host "Get Started:" -ForegroundColor White
Write-Host "  1. Verify setup:  hemmers doctor" -ForegroundColor Cyan
Write-Host "  2. Detect agents: hemmers agents" -ForegroundColor Cyan
Write-Host "  3. Initialize:    hemmers init" -ForegroundColor Cyan
Write-Host "  4. Search skills: hemmers search coder" -ForegroundColor Cyan
Write-Host ""
