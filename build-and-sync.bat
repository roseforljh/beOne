@echo off
chcp 65001 >nul
echo ========================================
echo BeOne Mobile - 构建并同步到安卓
echo ========================================
echo.

echo [1/3] 构建前端项目...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo 构建失败!
    pause
    exit /b %errorlevel%
)
cd ..
echo 构建完成!
echo.

echo [2/3] 复制文件到移动端...
xcopy /E /I /Y frontend\dist beone-mobile\www
if %errorlevel% neq 0 (
    echo 复制失败!
    pause
    exit /b %errorlevel%
)
echo 复制完成!
echo.

echo [3/3] 同步 Capacitor...
cd beone-mobile
call npx cap sync android
if %errorlevel% neq 0 (
    echo 同步失败!
    cd ..
    pause
    exit /b %errorlevel%
)
cd ..
echo 同步完成!
echo.

echo ========================================
echo 全部完成! 可以在 Android Studio 中运行了
echo ========================================
pause