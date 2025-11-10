#!/bin/bash

echo "🔄 太极文件传输系统 - 更新脚本"
echo "=================================="

# 检查是否在正确的目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误：未找到 docker compose.yml 文件"
    echo "请确保在项目根目录下运行此脚本"
    exit 1
fi

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main || git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ 拉取代码失败，请检查 Git 配置"
    exit 1
fi

echo "✅ 代码更新成功"

# 停止旧容器
echo "🛑 停止旧容器..."
docker compose down

# 清理旧镜像（可选，节省空间）
echo "🧹 清理未使用的镜像..."
docker image prune -f

# 重新构建并启动
echo "🚀 重新构建并启动服务..."
docker compose up -d --build

if [ $? -ne 0 ]; then
    echo "❌ 启动失败，请查看日志"
    docker compose logs
    exit 1
fi

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "📊 检查服务状态..."
docker compose ps

echo ""
echo "=================================="
echo "✅ 更新完成！"
echo ""
echo "📝 查看日志："
echo "   docker compose logs -f"
echo ""
echo "🔍 检查服务状态："
echo "   docker compose ps"
echo ""
echo "🛑 如需回滚，请运行："
echo "   git reset --hard HEAD~1"
echo "   docker compose up -d --build"
echo "=================================="