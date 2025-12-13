#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

console.log('🚀 开始生产环境部署 beOne...');

// 检查是否需要配置 SSL
const needSSL = () => {
  // 检查是否已经配置了 SSL
  return !fs.existsSync('/etc/nginx/sites-available/beone');
};

// SSL 配置提示
const showSSLSetupInfo = () => {
  console.log('\n🔐 SSL 配置指南:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('由于 setup-ssl.sh 已被移除，请手动配置 SSL:');
  console.log('');
  console.log('1. 安装 Nginx 和 Certbot:');
  console.log('   sudo apt update');
  console.log('   sudo apt install nginx certbot python3-certbot-nginx');
  console.log('');
  console.log('2. 配置 Nginx (参考 WEBSOCKET_FIX_GUIDE.md)');
  console.log('');
  console.log('3. 申请 SSL 证书:');
  console.log('   sudo certbot --nginx -d your-domain.com');
  console.log('');
  console.log('4. 重启服务:');
  console.log('   sudo systemctl restart nginx');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
      console.log('🔍 检测到未配置 SSL...');
      const answer = await askQuestion('是否需要配置 HTTPS/SSL？(y/n，推荐选 y): ');
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        showSSLSetupInfo();
        console.log('❌ 请按照上述指南手动配置 SSL 后重新运行部署');
        process.exit(0);
      }
    }

    // 普通部署流程
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
    console.log('\n📝 注意:');
    console.log('  - 如需外网访问，请配置防火墙开放端口 5000 和 4173');
    console.log('  - 如果使用 HTTPS 域名访问，需要配置 SSL: sudo bash setup-ssl.sh');
  } catch (error) {
    console.error('\n❌ 部署失败:', error.message);
    console.error('\n💡 故障排查:');
    console.error('  1. 确保已安装 Node.js 和 npm');
    console.error('  2. 确保已全局安装 PM2: npm install -g pm2');
    console.error('  3. 检查端口 5000 和 4173 是否被占用');
    console.error('  4. 查看详细错误日志: pm2 logs');
    process.exit(1);
  }
};

main();