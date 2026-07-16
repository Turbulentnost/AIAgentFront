# Запуск фронтенда с portable Node из turbodon (без глобальной установки Node.js)
$ErrorActionPreference = "Stop"
$nodeBin = "C:\Users\d.zalibin\turbodon\desktop\.tools\node\node-v20.19.2-win-x64"

if (-not (Test-Path (Join-Path $nodeBin "node.exe"))) {
    Write-Host "Portable Node not found: $nodeBin" -ForegroundColor Red
    Write-Host "Run: cd C:\Users\d.zalibin\turbodon\desktop; .\setup-node-portable.ps1"
    exit 1
}

$env:PATH = "$nodeBin;$env:PATH"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
}

Write-Host "Node: $(node -v)  npm: $(npm -v)"

if (-not (Test-Path "node_modules\vite")) {
    Write-Host "Running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Starting dev server at http://localhost:5173"
npm run dev
