#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始生产环境部署 beOne...\n');

try {
  // 1. 安装后端依赖
  console.log('📦 安装后端依赖...');
  execSync('cd backend && npm install', { stdio: 'inherit' });

  // 2. 安装前端依赖
  console.log('\n📦 安装前端依赖...');
  execSync('cd frontend && npm install', { stdio: 'inherit' });

  // 3. 构建前端
  console.log('\n🔨 构建前端生产版本...');
  execSync('cd frontend && npm run build', { stdio: 'inherit' });

  // 4. 停止旧服务
  console.log('\n🛑 停止旧服务...');
  try {
    execSync('pm2 stop all', { stdio: 'inherit' });
  } catch (e) {
    console.log('没有运行中的服务');
  }

  // 5. 使用 PM2 启动服务
  console.log('\n🔄 启动服务...');
  execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });

  // 6. 保存 PM2 配置
  console.log('\n💾 保存 PM2 配置...');
  execSync('pm2 save', { stdio: 'inherit' });

  console.log('\n✅ 部署成功!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 后端API: http://localhost:5000');
  console.log('🌐 前端页面: http://localhost:4173');
  console.log('📱 移动端API: http://localhost:5000');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 常用命令:');
  console.log('  查看日志: pm2 logs');
  console.log('  重启服务: pm2 restart all');
  console.log('  停止服务: pm2 stop all');
  console.log('  查看状态: pm2 status');
  console.log('  开机自启: pm2 startup && pm2 save');
  console.log('\n📝 注意: 如需外网访问，请配置防火墙开放端口 5000 和 4173');
} catch (error) {
  console.error('\n❌ 部署失败:', error.message);
  console.error('\n💡 故障排查:');
  console.error('  1. 确保已安装 Node.js 和 npm');
  console.error('  2. 确保已全局安装 PM2: npm install -g pm2');
  console.error('  3. 检查端口 5000 和 4173 是否被占用');
  console.error('  4. 查看详细错误日志: pm2 logs');
  process.exit(1);
}