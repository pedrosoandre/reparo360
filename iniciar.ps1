Set-Location -Path $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  REPARO360 - iniciando ambiente de dev" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
    Write-Host "[1/2] node_modules nao encontrado. Rodando npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nFalha. Tentando com --legacy-peer-deps..." -ForegroundColor Yellow
        npm install --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) {
            Write-Host "`nErro na instalacao." -ForegroundColor Red
            Read-Host "Pressione Enter para sair"
            exit 1
        }
    }
} else {
    Write-Host "[1/2] Dependencias ja instaladas." -ForegroundColor Green
}

Write-Host "`n[2/2] Subindo servidor Next.js em http://localhost:3000" -ForegroundColor Green
Write-Host "Pressione Ctrl+C para parar.`n" -ForegroundColor Gray

Start-Process "http://localhost:3000"
npm run dev
