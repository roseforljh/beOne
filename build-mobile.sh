#!/bin/bash

echo "📱 构建移动端应用..."
echo "=================================="

# 进入前端目录
cd frontend

# 临时修改输出目录为移动端
echo "⚙️  配置移动端构建..."

# 备份原配置
cp vite.config.js vite.config.js.backup

# 修改输出目录
sed -i "s|outDir: 'dist'|outDir: '../beone-mobile/www'|g" vite.config.js

# 构建
echo "🔨 开始构建..."
npm run build

# 恢复配置
mv vite.config.js.backup vite.config.js

echo "✅ 移动端构建完成！"
echo ""
echo "📱 下一步："
echo "   cd beone-mobile"
echo "   npx cap sync android"
echo "   npx cap open android"
echo ""
echo "=================================="