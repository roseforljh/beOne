# 部署指南

本文档介绍如何将太极文件传输系统部署到生产环境。

## 目录

1. [环境准备](#环境准备)
2. [后端部署](#后端部署)
3. [前端部署](#前端部署)
4. [Nginx 配置](#nginx-配置)
5. [HTTPS 配置](#https-配置)
6. [进程管理](#进程管理)

## 环境准备

### 系统要求

- **操作系统**：Ubuntu 20.04+ / CentOS 7+ / Windows Server
- **Node.js**：16.0.0+
- **内存**：最少 1GB RAM
- **磁盘**：根据文件存储需求

### 安装 Node.js

**Ubuntu/Debian**：
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL**：
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

**Windows**：
从 [nodejs.org](https://nodejs.org/) 下载安装包

### 安装 Git

```bash
# Ubuntu/Debian
sudo apt-get install git

# CentOS/RHEL
sudo yum install git

# Windows
# 从 git-scm.com 下载安装
```

## 后端部署

### 1. 克隆代码

```bash
cd /var/www  # 或你选择的目录
git clone <repository-url> beone
cd beone
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
nano .env  # 或使用其他编辑器
```

修改配置：
```env
PORT=5000
JWT_SECRET=your_very_secure_random_string_here
NODE_ENV=production
```

**重要**：务必修改 `JWT_SECRET` 为一个强随机字符串！

### 3. 安装依赖

```bash
npm install --production
```

### 4. 测试运行

```bash
npm start
```

访问 `http://your-server:5000/api/health` 确认后端正常运行。

### 5. 配置文件权限

```bash
# 确保上传目录有正确权限
chmod -R 755 uploads
chown -R www-data:www-data uploads  # Ubuntu/Debian
# 或
chown -R nginx:nginx uploads  # CentOS/RHEL
```

## 前端部署

### 1. 安装依赖

```bash
cd ../frontend
npm install
```

### 2. 配置生产环境

创建 `.env.production` 文件：
```env
VITE_API_URL=https://your-domain.com/api
```

### 3. 构建生产版本

```bash
npm run build
```

构建完成后，`dist/` 目录包含所有静态文件。

### 4. 测试构建

```bash
npm run preview
```

## Nginx 配置

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt-get install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. 配置站点

创建配置文件 `/etc/nginx/sites-available/beone`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/beone/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存策略
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 上传大小限制
        client_max_body_size 2G;
        
        # 超时设置
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;
}
```

### 3. 启用站点

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/beone /etc/nginx/sites-enabled/
sudo nginx -t  # 测试配置
sudo systemctl restart nginx

# CentOS/RHEL
sudo cp /etc/nginx/sites-available/beone /etc/nginx/conf.d/beone.conf
sudo nginx -t
sudo systemctl restart nginx
```

## HTTPS 配置

### 使用 Let's Encrypt（免费）

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书并自动配置
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

Certbot 会自动修改 Nginx 配置并设置 HTTPS。

### 手动配置 HTTPS

如果你有自己的证书，修改 Nginx 配置：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... 其他配置同上 ...
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 进程管理

### 使用 PM2（推荐）

#### 1. 安装 PM2

```bash
sudo npm install -g pm2
```

#### 2. 创建 PM2 配置文件

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'beone-backend',
    script: './backend/src/index.js',
    cwd: '/var/www/beone/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

#### 3. 启动服务

```bash
cd /var/www/beone
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 设置开机自启
```

#### 4. 常用命令

```bash
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 restart all     # 重启所有
pm2 stop all        # 停止所有
pm2 delete all      # 删除所有
pm2 monit           # 监控面板
```

### 使用 Systemd

创建 `/etc/systemd/system/beone.service`：

```ini
[Unit]
Description=BeOne File Transfer Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/beone/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=beone
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable beone
sudo systemctl start beone
sudo systemctl status beone
```

## 防火墙配置

### UFW (Ubuntu)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Firewalld (CentOS)

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 数据备份

### 自动备份脚本

创建 `/var/www/beone/backup.sh`：

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/beone"
DATE=$(date +%Y%m%d_%H%M%S)
SOURCE_DIR="/var/www/beone/backend"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp $SOURCE_DIR/database.db $BACKUP_DIR/database_$DATE.db

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz $SOURCE_DIR/uploads

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

设置定时任务：

```bash
chmod +x /var/www/beone/backup.sh
crontab -e

# 添加：每天凌晨 2 点备份
0 2 * * * /var/www/beone/backup.sh
```

## 监控和日志

### 日志位置

- **Nginx 访问日志**：`/var/log/nginx/access.log`
- **Nginx 错误日志**：`/var/log/nginx/error.log`
- **PM2 日志**：`~/.pm2/logs/`
- **应用日志**：`/var/www/beone/backend/logs/`

### 监控脚本

创建健康检查：

```bash
#!/bin/bash

# 检查后端健康
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "Backend: OK"
else
    echo "Backend: FAILED"
    # 发送告警或重启服务
    pm2 restart beone-backend
fi
```

## 性能优化

### 1. 数据库优化

SQLite 配置优化（在代码中）：

```javascript
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');
db.run('PRAGMA cache_size = 10000');
```

### 2. 文件存储优化

考虑使用对象存储（如 AWS S3、阿里云 OSS）存储大量文件。

### 3. CDN 加速

将静态资源放到 CDN，提升全球访问速度。

## 安全加固

### 1. 修改默认密码

首次部署后，立即修改默认密码。

### 2. 限制 API 访问

使用 Nginx 限流：

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api {
    limit_req zone=api burst=20;
    # ... 其他配置 ...
}
```

### 3. 定期更新依赖

```bash
npm audit
npm update
```

## 故障排除

### 1. 后端无法启动

检查：
- 端口是否被占用
- 环境变量是否正确
- 数据库文件权限

### 2. 文件上传失败

检查：
- uploads 目录权限
- 磁盘空间
- Nginx 上传大小限制

### 3. 性能问题

- 检查服务器资源（CPU、内存、磁盘）
- 查看日志找出瓶颈
- 考虑使用缓存或 CDN

---

**部署成功！** 🎉

如有问题，请查阅其他文档或提交 Issue。

