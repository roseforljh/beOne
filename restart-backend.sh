#!/bin/bash

echo "🔄 重启后端服务以应用JWT修复..."

# 重启后端服务
pm2 restart beone-backend

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 3

# 检查服务状态
pm2 status

echo "✅ 后端服务已重启，JWT修复已应用"
echo "📝 请刷新浏览器页面并重新登录"