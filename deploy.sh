#!/bin/bash

echo "🎯 太极文件传输系统 - 一键部署脚本"
echo "=================================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 和 Docker Compose 已安装"

# 停止旧容器
echo "🛑 停止旧容器..."
docker compose down

# 构建并启动
echo "🚀 构建并启动服务..."
docker compose up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "📊 检查服务状态..."
docker compose ps

echo ""
echo "=================================="
echo "✅ 部署完成！"
echo ""
echo "📱 访问地址："
echo "   前端：http://$(hostname -I | awk '{print $1}')"
echo "   后端：http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "🔐 默认账号："
echo "   用户名：root"
echo "   密码：123456"
echo ""
echo "📝 查看日志："
echo "   docker compose logs -f"
echo ""
echo "🛑 停止服务："
echo "   docker compose down"
echo "=================================="
