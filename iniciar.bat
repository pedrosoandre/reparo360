@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   REPARO360 - iniciando ambiente de dev
echo ============================================
echo.

if not exist "node_modules" (
    echo [1/2] node_modules nao encontrado. Rodando npm install...
    call npm install
    if errorlevel 1 (
        echo.
        echo Falha no npm install. Tentando com --legacy-peer-deps...
        call npm install --legacy-peer-deps
        if errorlevel 1 (
            echo.
            echo Erro na instalacao. Verifique o log acima.
            pause
            exit /b 1
        )
    )
) else (
    echo [1/2] Dependencias ja instaladas.
)

echo.
echo [2/2] Subindo servidor Next.js em http://localhost:3000
echo Pressione Ctrl+C para parar.
echo.

start "" http://localhost:3000
call npm run dev

endlocal
