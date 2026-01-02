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
echo [1/3] Building frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed
    exit /b 1
)
echo      Frontend OK
echo.

:: Step 2: Build Tauri app (includes frontend bundling)
echo [2/3] Building Tauri app (noobsynth3.exe)...
call npx tauri build
if errorlevel 1 (
    echo ERROR: Tauri build failed
    exit /b 1
)
echo      Tauri app OK
echo.

:: Step 3: Build VST plugin
echo [3/3] Building VST plugin (noobsynth_vst.dll)...
cargo build -p noobsynth_vst --release
if errorlevel 1 (
    echo ERROR: VST build failed
    exit /b 1
)
echo      VST plugin OK
echo.

:: Show results
echo ============================================
echo    Build Complete!
echo ============================================
echo.
echo Output files:
echo   - target\release\noobsynth3.exe
echo   - target\release\noobsynth_vst.dll
echo.
echo To use the VST:
echo   1. Copy both files to the same folder
echo   2. Load noobsynth_vst.dll in your DAW
echo.

:: Optional: Copy to a dist folder
if "%1"=="--dist" (
    echo Creating dist folder...
    if not exist "dist-vst" mkdir dist-vst
    copy /Y "target\release\noobsynth3.exe" "dist-vst\" >nul
    copy /Y "target\release\noobsynth_vst.dll" "dist-vst\" >nul
    echo Files copied to dist-vst\
    echo.
)

endlocal
