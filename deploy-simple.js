#!/usr/bin/env node

const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        if (iface.address.startsWith('192.168') || iface.address.startsWith('10.')) {
          return iface.address;
        }
      }
    }
  }
  return 'localhost';
}

function updateConfig(ip) {
  const configPath = path.join(__dirname, 'frontend', 'src', 'config', 'api.config.js');
  const content = `export const API_CONFIG = { API_URL: 'http://${ip}:5000' };
export const IS_DEBUG_MODE = false;
export const AUTO_DETECTED_IP = '${ip}';`;
  fs.writeFileSync(configPath, content);
  log(`配置已更新: http://${ip}:5000`, 'green');
}

async function main() {
  console.clear();
  log('太极文件传输系统 - 一键部署', 'cyan');
  
  const osType = os.platform() === 'win32' ? 'Windows' : os.platform() === 'linux' ? 'Linux' : 'macOS';
  const ip = getLocalIP();
  
  log(`系统: ${osType}`, 'cyan');
  log(`IP: ${ip}`, 'cyan');
  
  updateConfig(ip);
  
  const autostart = await question('\n是否配置开机自启? (y/n): ');
  if (autostart.toLowerCase() === 'y') {
    log('\n请手动安装 PM2: npm install -g pm2', 'yellow');
    log('然后运行: pm2 start ecosystem.config.js', 'yellow');
    log('设置开机自启: pm2 startup && pm2 save', 'yellow');
  }
  
  rl.close();
  
  log('\n正在启动服务...', 'yellow');
  
  spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'backend'),
    shell: true,
    stdio: 'inherit'
  });
  
  setTimeout(() => {
    spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'frontend'),
      shell: true,
      stdio: 'inherit'
    });
  }, 3000);
  
  setTimeout(() => {
    log(`\n部署成功!`, 'green');
    log(`后端: http://${ip}:5000`, 'cyan');
    log(`前端: http://${ip}:5173`, 'cyan');
    log(`安卓端API: http://${ip}:5000`, 'cyan');
  }, 8000);
}

main().catch(console.error);