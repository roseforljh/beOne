#!/usr/bin/env node

/**
 * 太极文件传输系统 - 智能部署脚本
 * 支持自动配置、开机自启、进程保活
 */

const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logBox(title, content = []) {
  const width = 60;
  log('═'.repeat(width), 'cyan');
  log(`  ${title}`, 'bright');
  log('═'.repeat(width), 'cyan');
  content.forEach(line => log(`  ${line}`, 'green'));
  log('═'.repeat(width), 'cyan');
  console.log();
}

// 创建交互式输入
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// 检测操作系统
function detectOS() {
  const platform = os.platform();
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  if (platform === 'darwin') return 'macos';
  return 'unknown';
}

// 获取本机IP地址(优先IPv4)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.internal || iface.family !== 'IPv4') {
        continue;
      }
      addresses.push({
        name,
        address: iface.address,
        priority: iface.address.startsWith('192.168') ? 1 :
                 iface.address.startsWith('10.') ? 2 : 3
      });
    }
  }

  addresses.sort((a, b) => a.priority - b.priority);
  return addresses.length > 0 ? addresses[0].address : 'localhost';
}

// 更新前端配置文件
function updateFrontendConfig(ip) {
  const configPath = path.join(__dirname, 'frontend', 'src', 'config', 'api.config.js');
  const apiUrl = `http://${ip}:5000`;

  const configContent = `/**
 * API 配置文件
 * 此文件由部署脚本自动生成
 * 生成时间: ${new Date().toLocaleString('zh-CN')}
 */

const AUTO_DETECTED_URL = '${apiUrl}';
const IS_DEBUG = false;

const DEBUG_CONFIG = {
  API_URL: 'http://localhost:5000',
};

const PRODUCTION_CONFIG = {
  API_URL: AUTO_DETECTED_URL,
};

export const API_CONFIG = IS_DEBUG ? DEBUG_CONFIG : PRODUCTION_CONFIG;
export const IS_DEBUG_MODE = IS_DEBUG;
export const AUTO_DETECTED_IP = '${ip}';
`;

  fs.writeFileSync(configPath, configContent, 'utf8');
  log(`✓ 已更新前端配置: ${apiUrl}`, 'green');
}

// 检查并安装依赖
async function checkDependencies() {
  log('正在检查依赖...', 'yellow');

  const checkDir = (dir) => {
    const modulesPath = path.join(__dirname, dir, 'node_modules');
    return fs.existsSync(modulesPath);
  };

  const backendOk = checkDir('backend');
  const frontendOk = checkDir('frontend');

  if (backendOk) log('✓ backend 依赖已安装', 'green');
  if (frontendOk) log('✓ frontend 依赖已安装', 'green');

  if (!backendOk || !frontendOk) {
    log('\n正在安装依赖,请稍候...', 'yellow');
    
    if (!backendOk) {
      await new Promise((resolve, reject) => {
        log('安装后端依赖...', 'yellow');
        const install = spawn('npm', ['install'], {
          cwd: path.join(__dirname, 'backend'),
          shell: true,
          stdio: 'inherit'
        });
        install.on('close', (code) => {
          code === 0 ? (log('✓ 后端依赖安装完成', 'green'), resolve()) : reject(new Error('后端依赖安装失败'));
        });
      });
    }

    if (!frontendOk) {
      await new Promise((resolve, reject) => {
        log('安装前端依赖...', 'yellow');
        const install = spawn('npm', ['install'], {
          cwd: path.join(__dirname, 'frontend'),
          shell: true,
          stdio: 'inherit'
        });
        install.on('close', (code) => {
          code === 0 ? (log('✓ 前端依赖安装完成', 'green'), resolve()) : reject(new Error('前端依赖安装失败'));
        });
      });
    }
  }

  console.log();
}

// 创建 PM2 配置文件
function createPM2Config(projectPath) {
  const config = {
    apps: [
      {
        name: 'beone-backend',
        cwd: path.join(projectPath, 'backend'),
        script: 'npm',
        args: 'start',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production'
        }
      },
      {
        name: 'beone-frontend',
        cwd: path.join(projectPath, 'frontend'),
        script: 'npm',
        args: 'run dev',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G'
      }
    ]
  };

  const configPath = path.join(projectPath, 'ecosystem.config.js');
  fs.writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)}`);
  return configPath;
}

// 创建 Windows 服务脚本
function createWindowsService(projectPath) {
  const servicePath = path.join(projectPath, 'install-service-windows.bat');
  const serviceContent = `@echo off
chcp 65001 > nul
echo 正在安装 Windows 服务...
echo.

REM 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 错误: 需要管理员权限!
    echo 请右键点击此文件,选择"以管理员身份运行"
    pause
    exit /b 1
)

REM 安装 PM2
echo [1/3] 安装 PM2...
call npm install -g pm2
call npm install -g pm2-windows-startup

REM 配置 PM2 开机自启
echo [2/3] 配置开机自启...
call pm2-startup install

REM 启动服务
echo [3/3] 启动服务...
cd /d "${projectPath}"
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo ========================================
echo   ✓ Windows 服务安装完成!
echo ========================================
echo.
echo 服务已设置为开机自启动
echo 使用以下命令管理服务:
echo   pm2 list          - 查看服务状态
echo   pm2 restart all   - 重启所有服务
echo   pm2 stop all      - 停止所有服务
echo   pm2 logs          - 查看日志
echo.
pause
`;

  fs.writeFileSync(servicePath, serviceContent);
  log(`✓ 已创建 Windows 服务安装脚本: ${servicePath}`, 'green');
}

// 创建 Linux systemd 服务
function createLinuxService(projectPath, ip) {
  const serviceContent = `[Unit]
Description=BeOne File Transfer System
After=network.target

[Service]
Type=simple
User=${os.userInfo().username}
WorkingDirectory=${projectPath}
ExecStart=/usr/bin/node ${path.join(projectPath, 'deploy-auto.js')} --service
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=beone

Environment=NODE_ENV=production
Environment=API_URL=http://${ip}:5000

[Install]
WantedBy=multi-user.target
`;

  const servicePath = '/tmp/beone.service';
  fs.writeFileSync(servicePath, serviceContent);

  const installScript = path.join(projectPath, 'install-service-linux.sh');
  const installContent = `#!/bin/bash

echo "正在安装 Linux 系统服务..."
echo ""

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "错误: 需要 root 权限!"
    echo "请使用: sudo bash install-service-linux.sh"
    exit 1
fi

# 复制服务文件
echo "[1/3] 复制服务文件..."
cp /tmp/beone.service /etc/systemd/system/

# 重载 systemd
echo "[2/3] 重载 systemd..."
systemctl daemon-reload

# 启用并启动服务
echo "[3/3] 启动服务..."
systemctl enable beone
systemctl start beone

echo ""
echo "========================================"
echo "  ✓ Linux 服务安装完成!"
echo "========================================"
echo ""
echo "服务已设置为开机自启动"
echo "使用以下命令管理服务:"
echo "  systemctl status beone   - 查看服务状态"
echo "  systemctl restart beone  - 重启服务"
echo "  systemctl stop beone     - 停止服务"
echo "  journalctl -u beone -f   - 查看日志"
echo ""
`;

  fs.writeFileSync(installScript, installContent);
  fs.chmodSync(installScript, '755');
  log(`✓ 已创建 Linux 服务安装脚本: ${installScript}`, 'green');
}

// 交互式配置
async function interactiveSetup(osType, ip) {
  console.log();
  logBox('🔧 部署配置', [
    `操作系统: ${osType}`,
    `检测到 IP: ${ip}`,
    ''
  ]);

  // 询问是否配置开机自启
  const autoStart = await question('是否配置开机自启动? (y/n): ');
  
  if (autoStart.toLowerCase() === 'y') {
    log('\n正在生成系统服务配置...', 'yellow');
    
    const projectPath = __dirname;
    createPM2Config(projectPath);
    
    if (osType === 'windows') {
      createWindowsService(projectPath);
      log('\n✓ 已生成 Windows 服务配置', 'green');
      log('请运行 install-service-windows.bat (需要管理员权限)', 'cyan');
    } else if (osType === 'linux') {
      createLinuxService(projectPath, ip);
      log('\n✓ 已生成 Linux 服务配置', 'green');
      log('请运行: sudo bash install-service-linux.sh', 'cyan');
    } else {
      log('
当前系统暂不支持自动配置开机自启', 'yellow');
      log('建议手动配置或使用 PM2: npm install -g pm2', 'cyan');
    }
    
    console.log();
    const installNow = await question('是否现在安装服务? (y/n): ');
    
    if (installNow.toLowerCase() === 'y') {
      if (osType === 'windows') {
        log('\n请手动运行 install-service-windows.bat (需要管理员权限)', 'yellow');
      } else if (osType === 'linux') {
        log('
正在安装服务...', 'yellow');
        exec('sudo bash install-service-linux.sh', (error, stdout, stderr) => {
          if (error) {
            log(`安装失败: ${error.message}`, 'red');
          } else {
            log(stdout, 'green');
          }
        });
      }
    }
  }

  console.log();
}

// 启动服务
async function startServices(ip) {
  log('正在启动服务...', 'yellow');
  console.log();

  const backend = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'backend'),
    shell: true,
    stdio: 'inherit'
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    stdio: 'inherit'
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  const backendUrl = `http://${ip}:5000`;
  const frontendUrl = `http://${ip}:5173`;
  const localhostUrl = 'http://localhost:5173';

  logBox('🎉 部署成功!', [
    '',
    `后端 API 地址: ${backendUrl}`,
    `前端访问地址: ${frontendUrl}`,
    `本地访问地址: ${localhostUrl}`,
    '',
    `默认账号: root`,
    `默认密码: 123456`,
    '',
    `安卓端 API 地址: ${backendUrl}`,
    '',
    '按 Ctrl+C 停止服务'
  ]);

  // 打开浏览器
  const platform = os.platform();
  let command;
  if (platform === 'win32') command = `start ${localhostUrl}`;
  else if (platform === 'darwin') command = `open ${localhostUrl}`;
  else command = `xdg-open ${localhostUrl}`;

  setTimeout(() => exec(command), 2000);

  // 处理退出
  const cleanup = () => {
    log('\n正在停止服务...', 'yellow');
    backend.kill();
    frontend.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await new Promise(() => {});
}

// 主函数
async function main() {
  try {
    console.clear();
    logBox('太极 · 文件传输系统 - 智能部署');

    // 检测系统
    const osType = detectOS();
    log(`检测到操作系统: ${osType}`, 'cyan');

    // 获取IP
    const ip = getLocalIP();
    log(`检测到本机IP: ${ip}`, 'cyan');
    console.log();

    // 更新配置
    updateFrontendConfig(ip);
    console.log();

    // 检查依赖
    await checkDependencies();

    // 交互式配置
    await interactiveSetup(osType, ip);

    // 关闭 readline
    rl.close();

    // 启动服务
    await startServices(ip);

  } catch (error) {
    log(`\n错误: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
  }
}

// 运行
main();