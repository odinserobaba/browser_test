# PowerShell script for automatic Node.js installation and project build
# Run: .\setup-and-build.ps1

Write-Host "AI Playwright Recorder - Automatic Setup and Build" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = $null

# Check if node command exists
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    try {
        $versionOutput = & node --version 2>&1
        if ($versionOutput -match "v\d+\.\d+\.\d+") {
            $nodeVersion = $matches[0]
        }
    }
    catch {
        $nodeVersion = $null
    }
}

if ($nodeVersion) {
    Write-Host "Node.js is already installed: $nodeVersion" -ForegroundColor Green
}
else {
    Write-Host "Node.js not found. Starting installation..." -ForegroundColor Red
    Write-Host ""
    
    # Determine system architecture
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    
    Write-Host "Downloading Node.js LTS..." -ForegroundColor Yellow
    
    # URL for Node.js LTS download (Windows x64)
    $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
    $installerPath = "$env:TEMP\nodejs-installer.msi"
    
    try {
        # Download installer
        Write-Host "Downloading from $nodeUrl..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
        
        Write-Host "Installer downloaded: $installerPath" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANT: Node.js installation window will open" -ForegroundColor Yellow
        Write-Host "   1. Follow the installer instructions" -ForegroundColor Yellow
        Write-Host "   2. Make sure 'Add to PATH' option is enabled" -ForegroundColor Yellow
        Write-Host "   3. After installation, restart this script" -ForegroundColor Yellow
        Write-Host ""
        
        # Run installer
        Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait
        
        Write-Host "Waiting for installation to complete..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        
        # Update PATH in current session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Check installation
        $nodeVersion = $null
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCmd) {
            try {
                $versionOutput = & node --version 2>&1
                if ($versionOutput -match "v\d+\.\d+\.\d+") {
                    $nodeVersion = $matches[0]
                }
            }
            catch {
                $nodeVersion = $null
            }
        }
        
        if (-not $nodeVersion) {
            Write-Host ""
            Write-Host "Node.js installed but not found in PATH" -ForegroundColor Red
            Write-Host "   Please:" -ForegroundColor Yellow
            Write-Host "   1. Close and reopen PowerShell" -ForegroundColor Yellow
            Write-Host "   2. Run this script again: .\setup-and-build.ps1" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   Or install Node.js manually:" -ForegroundColor Yellow
            Write-Host "   https://nodejs.org/" -ForegroundColor Cyan
            exit 1
        }
        
        Write-Host "Node.js successfully installed: $nodeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host ""
        Write-Host "Error installing Node.js: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Node.js manually:" -ForegroundColor Yellow
        Write-Host "1. Open https://nodejs.org/" -ForegroundColor Cyan
        Write-Host "2. Download LTS version" -ForegroundColor Cyan
        Write-Host "3. Install with default settings" -ForegroundColor Cyan
        Write-Host "4. Restart PowerShell" -ForegroundColor Cyan
        Write-Host "5. Run this script again" -ForegroundColor Cyan
        exit 1
    }
}

Write-Host ""
Write-Host "Installing project dependencies..." -ForegroundColor Yellow

# Check for package.json
if (-not (Test-Path "package.json")) {
    Write-Host "package.json file not found!" -ForegroundColor Red
    exit 1
}

# Install dependencies
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    Write-Host "Dependencies installed" -ForegroundColor Green
}
catch {
    Write-Host "Error installing dependencies: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Building project..." -ForegroundColor Yellow

# Build project
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed"
    }
    Write-Host "Project built successfully" -ForegroundColor Green
}
catch {
    Write-Host "Error building project: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Checking readiness..." -ForegroundColor Yellow

# Check structure
if ((Test-Path "dist\background\index.js") -and (Test-Path "dist\content\index.js") -and (Test-Path "dist\manifest.json")) {
    Write-Host "All files in place" -ForegroundColor Green
}
else {
    Write-Host "Some files are missing" -ForegroundColor Yellow
}

Write-Host ""
$separator = "=" * 60
Write-Host $separator -ForegroundColor Cyan
Write-Host "DONE! Project built successfully" -ForegroundColor Green
Write-Host $separator -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "   1. Open Chrome and go to: chrome://extensions/" -ForegroundColor White
Write-Host "   2. Enable 'Developer mode' (top right)" -ForegroundColor White
Write-Host "   3. Click 'Load unpacked extension'" -ForegroundColor White
Write-Host "   4. Select folder: $PWD\dist" -ForegroundColor White
Write-Host ""
Write-Host "Extension is ready to use!" -ForegroundColor Green
