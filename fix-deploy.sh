#!/bin/bash

echo "修复 Docker 部署配置..."

# 停止现有容器并删除数据卷
echo "停止现有容器..."
docker-compose down -v

# 重新构建并启动
echo "重新构建并启动服务..."
docker-compose up -d --build

# 等待服务启动
echo "等待服务启动..."
sleep 5

# 查看日志
echo "查看服务状态..."
docker-compose ps
echo ""
echo "查看后端日志（按 Ctrl+C 退出）："
docker-compose logs -f backend
