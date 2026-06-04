@echo off
setlocal enabledelayedexpansion

echo ============================================
echo    NoobSynth3 - Build Script
echo ============================================
echo.

:: Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: Please run this script from the NoobSynth3 root directory
    exit /b 1
)

:: Step 1: Build frontend
echo [1/2] Building frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed
    exit /b 1
)
echo      Frontend OK
echo.

:: Step 2: Build Tauri app (includes frontend bundling)
echo [2/2] Building Tauri app (noobsynth3.exe)...
call npx tauri build
if errorlevel 1 (
    echo ERROR: Tauri build failed
    exit /b 1
)
echo      Tauri app OK
echo.

:: Show results
echo ============================================
echo    Build Complete!
echo ============================================
echo.
echo Output files:
echo   - target\release\noobsynth3.exe
echo.

:: Optional: Copy to a dist folder
if "%1"=="--dist" (
    echo Creating dist folder...
    if not exist "dist" mkdir dist
    copy /Y "target\release\noobsynth3.exe" "dist\" >nul
    echo Files copied to dist\
    echo.
)

endlocal
