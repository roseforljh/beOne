@echo off
chcp 65001 > nul
echo.
echo 🎯 太极文件传输系统 - 一键部署脚本
echo ==================================
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Docker 未安装，请先安装 Docker Desktop
    pause
    exit /b 1
)

REM 检查 Docker Compose 是否可用
docker compose version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Docker Compose 未安装或不可用
    pause
    exit /b 1
)

echo ✅ Docker 和 Docker Compose 已安装
echo.

REM 停止旧容器
echo 🛑 停止旧容器...
docker compose down

REM 构建并启动
echo 🚀 构建并启动服务...
docker compose up -d --build

REM 等待服务启动
echo ⏳ 等待服务启动...
timeout /t 5 /nobreak > nul

REM 检查服务状态
echo 📊 检查服务状态...
docker compose ps

REM 获取本机 IP 地址
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set SERVER_IP=%IP: =%

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║          ✅ 部署成功！太极文件传输系统已启动            ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 📱 访问地址：
echo    ┌─ 前端访问地址
echo    │  http://%SERVER_IP%
echo    │  http://localhost
echo    │
echo    ├─ 后端 API 地址
echo    │  http://%SERVER_IP%:5000
echo    │  http://localhost:5000
echo    │
echo    └─ 📱 安卓端 API 地址 (在 App 登录页面输入)
echo       http://%SERVER_IP%:5000
echo.
echo 🔐 默认账号：
echo    用户名: root
echo    密码: 123456
echo    ⚠️  首次登录后请立即修改密码！
echo.
echo 📱 安卓端使用说明：
echo    1. 打开安卓 App
echo    2. 在登录页面的 'API 地址' 输入框中填写：
echo       http://%SERVER_IP%:5000
echo    3. 输入用户名和密码登录
echo.
echo 🔧 管理命令：
echo    查看日志:   docker compose logs -f
echo    停止服务:   docker compose down
echo    重启服务:   docker compose restart
echo    查看状态:   docker compose ps
echo.
echo 💡 提示：
echo    • 确保防火墙开放 80 和 5000 端口
echo    • 安卓设备需要与服务器在同一网络
echo    • 如使用公网 IP,请将上述地址中的 %SERVER_IP% 替换为公网 IP
echo.
echo ════════════════════════════════════════════════════════
echo.
pause