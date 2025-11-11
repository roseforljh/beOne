#!/bin/bash

# BeOne SSL 自动配置脚本
# 为 5000 端口配置 SSL 证书

set -e

echo "🔐 BeOne SSL 自动配置脚本"
echo "================================"
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 root 权限运行此脚本"
    echo "   使用: sudo bash setup-ssl.sh"
    exit 1
fi

# 获取域名
read -p "请输入你的域名 (例如: one.everytalk.cc): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ 域名不能为空"
    exit 1
fi

echo ""
echo "📋 配置信息:"
echo "   域名: $DOMAIN"
echo "   后端端口: 5000"
echo "   前端端口: 4173"
echo ""

# 检查 Nginx 是否安装
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# 检查 Certbot 是否安装
if ! command -v certbot &> /dev/null; then
    echo "📦 安装 Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# 创建 Nginx 配置文件
echo "📝 创建 Nginx 配置..."

cat > /etc/nginx/sites-available/beone << EOF
# 前端服务 (4173 -> 80/443)
server {
    listen 80;
    server_name $DOMAIN;
    
    # 重定向到 HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL 证书路径（Certbot 会自动填充）
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 代理到前端 4173 端口
    location / {
        proxy_pass http://localhost:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 后端 API 服务 (5000 -> 5000 with SSL)
server {
    listen 5000 ssl http2;
    server_name $DOMAIN;
    
    # SSL 证书路径
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 代理到后端 Node.js 服务
    location / {
        proxy_pass http://localhost:5001;  # 后端实际运行在 5001
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket 支持
        proxy_read_timeout 86400;
    }
    
    # Socket.IO 特殊处理
    location /socket.io/ {
        proxy_pass http://localhost:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        
        # WebSocket 超时设置
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/beone /etc/nginx/sites-enabled/

# 测试 Nginx 配置
echo "🔍 测试 Nginx 配置..."
nginx -t

# 重启 Nginx
echo "🔄 重启 Nginx..."
systemctl restart nginx

# 申请 SSL 证书
echo ""
echo "🔐 申请 SSL 证书..."
echo "   注意: 请确保域名已正确解析到此服务器"
echo ""

certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || {
    echo ""
    echo "⚠️  自动申请证书失败，尝试手动模式..."
    certbot --nginx -d $DOMAIN
}

# 修改后端端口配置
echo ""
echo "📝 修改后端配置..."

# 获取当前脚本所在目录的父目录（项目根目录）
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 修改 ecosystem.config.js，将后端端口改为 5001
if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
    sed -i "s/NODE_ENV: 'production'/NODE_ENV: 'production',
        PORT: 5001/" "$PROJECT_DIR/ecosystem.config.js"
fi

# 创建 .env 文件
cat > "$PROJECT_DIR/backend/.env" << EOF
PORT=5001
NODE_ENV=production
JWT_SECRET=your_jwt_secret_change_in_production
EOF

echo ""
echo "✅ SSL 配置完成!"
echo "================================"
echo ""
echo "📋 配置摘要:"
echo "   ✓ Nginx 已配置并启动"
echo "   ✓ SSL 证书已申请"
echo "   ✓ 前端: https://$DOMAIN (443 -> 4173)"
echo "   ✓ 后端: https://$DOMAIN:5000 (5000 -> 5001)"
echo ""
echo "🚀 开始部署应用..."
echo ""

# 自动运行部署脚本
cd "$PROJECT_DIR"
node deploy-production.js

echo ""
echo "================================"
echo "✅ 全部完成!"
echo "================================"
echo ""
echo "🌐 访问地址: https://$DOMAIN"
echo ""
echo "💡 提示:"
echo "   - SSL 证书会自动续期"
echo "   - 后端实际运行在 5001 端口，Nginx 在 5000 端口提供 SSL"
echo "   - 查看服务状态: pm2 status"
echo "   - 查看日志: pm2 logs"
echo "   - 查看 Nginx 日志: tail -f /var/log/nginx/error.log"
echo ""