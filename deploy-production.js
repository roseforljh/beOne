#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

console.log('🚀 开始生产环境部署 beOne...
');

// 检查是否需要配置 SSL
const needSSL = () => {
  // 检查是否已经配置了 SSL
  return !fs.existsSync('/etc/nginx/sites-available/beone');
};

// 询问用户
const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
};

const main = async () => {
  try {
    // 检查是否需要 SSL 配置
    if (needSSL()) {
      console.log('🔍 检测到未配置 SSL...
');
      const answer = await askQuestion('是否需要配置 HTTPS/SSL？(y/n，推荐选 y): ');
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('\n🔐 开始配置 SSL...');
        console.log('⚠️  注意: SSL 配置需要 root 权限
');
        
        try {
          // 运行 SSL 配置脚本
          execSync('sudo bash setup-ssl.sh', { stdio: 'inherit' });
          console.log('\n✅ SSL 配置完成，服务已启动!');
          return;
        } catch (error) {
          console.error('
❌ SSL 配置失败，继续普通部署...\n');
        }
      }
    }

    // 普通部署流程
    // 1. 安装后端依赖
    console.log('📦 安装后端依赖...');
    execSync('cd backend && npm install', { stdio: 'inherit' });

    // 2. 安装前端依赖
    console.log('
📦 安装前端依赖...');
    execSync('cd frontend && npm install', { stdio: 'inherit' });

    // 3. 构建前端
    console.log('\n🔨 构建前端生产版本...');
    execSync('cd frontend && npm run build', { stdio: 'inherit' });

    // 4. 停止旧服务
    console.log('
🛑 停止旧服务...');
    try {
      execSync('pm2 stop all', { stdio: 'inherit' });
    } catch (e) {
      console.log('没有运行中的服务');
    }

    // 5. 使用 PM2 启动服务
    console.log('
🔄 启动服务...');
    execSync('pm2 start ecosystem.config.js', { stdio: 'inherit' });

    // 6. 保存 PM2 配置
    console.log('
💾 保存 PM2 配置...');
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
    console.log('
📝 注意:');
    console.log('  - 如需外网访问，请配置防火墙开放端口 5000 和 4173');
    console.log('  - 如果使用 HTTPS 域名访问，需要配置 SSL: sudo bash setup-ssl.sh');
  } catch (error) {
    console.error('
❌ 部署失败:', error.message);
    console.error('
💡 故障排查:');
    console.error('  1. 确保已安装 Node.js 和 npm');
    console.error('  2. 确保已全局安装 PM2: npm install -g pm2');
    console.error('  3. 检查端口 5000 和 4173 是否被占用');
    console.error('  4. 查看详细错误日志: pm2 logs');
    process.exit(1);
  }
};

main();