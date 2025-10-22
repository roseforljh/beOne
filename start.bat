@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   太极 · 文件传输系统
echo ========================================
echo.

echo [1/4] 检查依赖...

cd backend
if not exist "node_modules" (
    echo [2/4] 安装后端依赖...
    call npm install
) else (
    echo [2/4] 后端依赖已安装
)

cd ..\frontend
if not exist "node_modules" (
    echo [3/4] 安装前端依赖...
    call npm install
) else (
    echo [3/4] 前端依赖已安装
)

echo.
echo [4/4] 启动服务...
echo.
echo 后端: http://localhost:5000
echo 前端: http://localhost:5173
echo.
echo 默认账号: root / 123456
echo.
echo ========================================
echo.

cd ..\backend
start "太极后端" cmd /k "npm start"

timeout /t 3 /nobreak > nul

cd ..\frontend
start "太极前端" cmd /k "npm run dev"

echo 服务启动中，请稍候...
timeout /t 5 /nobreak > nul

start http://localhost:5173

echo.
echo 浏览器已打开，开始使用吧！
echo.
pause

