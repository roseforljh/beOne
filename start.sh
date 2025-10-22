#!/bin/bash

echo ""
echo "========================================"
echo "  太极 · 文件传输系统"
echo "========================================"
echo ""

echo "[1/4] 检查依赖..."

cd backend
if [ ! -d "node_modules" ]; then
    echo "[2/4] 安装后端依赖..."
    npm install
else
    echo "[2/4] 后端依赖已安装"
fi

cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "[3/4] 安装前端依赖..."
    npm install
else
    echo "[3/4] 前端依赖已安装"
fi

echo ""
echo "[4/4] 启动服务..."
echo ""
echo "后端: http://localhost:5000"
echo "前端: http://localhost:5173"
echo ""
echo "默认账号: root / 123456"
echo ""
echo "========================================"
echo ""

# 启动后端
cd ../backend
npm start &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# 等待前端启动
sleep 5

# 尝试打开浏览器
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:5173
elif command -v open > /dev/null; then
    open http://localhost:5173
fi

echo ""
echo "服务已启动！"
echo ""
echo "按 Ctrl+C 停止服务"

# 等待用户中断
wait

