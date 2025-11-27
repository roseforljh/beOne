@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo Taiji Mobile Builder
echo ===================================================
echo.

:MENU
echo Select build type:
echo 1. Debug Build (Development)
echo 2. Release Build (Production)
echo 3. Exit
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto DEBUG
if "%choice%"=="2" goto RELEASE
if "%choice%"=="3" goto END

echo Invalid choice. Please try again.
goto MENU

:DEBUG
echo.
echo [DEBUG] Building frontend for mobile...
cd frontend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Frontend build failed!
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo [DEBUG] Syncing Capacitor...
cd beone-mobile
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo Capacitor sync failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [DEBUG] Building Android APK (Debug)...
cd android
call gradlew assembleDebug
if %ERRORLEVEL% neq 0 (
    echo Android build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Debug APK built successfully!
echo Location: beone-mobile\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Attempting to install on connected device...
call gradlew installDebug
if %ERRORLEVEL% neq 0 (
    echo Installation failed. Please check if device is connected and USB debugging is enabled.
) else (
    echo App installed successfully!
)
cd ..\..
pause
goto END

:RELEASE
echo.
echo [RELEASE] Building frontend for mobile...
cd frontend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo Frontend build failed!
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo [RELEASE] Syncing Capacitor...
cd beone-mobile
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo Capacitor sync failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [RELEASE] Building Android APK (Release)...
echo Note: You must have configured signing in build.gradle or it will be unsigned.
cd android
call gradlew assembleRelease
if %ERRORLEVEL% neq 0 (
    echo Android build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Release APK built successfully!
echo Location: beone-mobile\android\app\build\outputs\apk\release\app-release-unsigned.apk
echo (Or app-release.apk if signing is configured)
cd ..\..
pause
goto END

:END
echo.
echo Exiting...