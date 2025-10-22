# 太极文件传输系统 - Docker 部署指南

## 快速部署

### 前置要求
- Docker
- Docker Compose
- Git

### 部署步骤

1. **克隆项目**
```bash
git clone https://github.com/roseforljh/beOne.git
cd beOne
```

2. **创建数据目录**
```bash
mkdir -p data/uploads/chunks data/uploads/files data/uploads/thumbs
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **访问应用**
- 前端：http://your-vps-ip （默认 80 端口）
- 后端 API：http://your-vps-ip:5000

5. **默认账号**
- 用户名：root
- 密码：123456

### 常用命令

**查看日志**
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend
```

**停止服务**
```bash
docker-compose down
```

**重启服务**
```bash
docker-compose restart
```

**重新构建并启动**
```bash
docker-compose up -d --build
```

**查看运行状态**
```bash
docker-compose ps
```

### 数据持久化

数据会自动保存在以下位置：
- 上传的文件：`./data/uploads`
- 数据库：`./data/database.db`

### 端口配置

默认端口：
- 前端：80（HTTP 默认端口，访问时无需指定）
- 后端：5000

如需修改端口，编辑 `docker-compose.yml`：
```yaml
services:
  frontend:
    ports:
      - "8080:80"  # 修改为 8080，访问时需要 http://your-ip:8080
  backend:
    ports:
      - "5001:5000"  # 修改为 5001，访问时需要 http://your-ip:5001
```

**注意**：如果修改前端端口为非 80，访问时需要加上端口号，例如 `http://your-ip:8080`

### 环境变量

可以在 `docker-compose.yml` 中修改环境变量：
```yaml
environment:
  - JWT_SECRET=your_custom_secret  # 修改 JWT 密钥
  - PORT=5000
```

### 安全建议

1. **修改默认密码**
   - 首次登录后立即修改 root 密码

2. **修改 JWT 密钥**
   - 在 `docker-compose.yml` 中修改 `JWT_SECRET`

3. **使用 HTTPS**
   - 建议使用 Nginx 反向代理并配置 SSL 证书

4. **防火墙配置**
   ```bash
   # 只开放必要的端口
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

### 故障排查

**容器无法启动**
```bash
# 查看详细日志
docker-compose logs

# 检查端口占用
netstat -tulpn | grep :80
netstat -tulpn | grep :5000
```

**无法访问**
- 检查防火墙是否开放端口
- 检查 Docker 容器是否正常运行
- 查看日志排查错误

**数据库错误**
```bash
# 删除旧数据库重新初始化
rm data/database.db
docker-compose restart backend
```

### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

### 备份数据

```bash
# 备份数据库和文件
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 恢复备份
tar -xzf backup-20251022.tar.gz
```

## 生产环境建议

### 使用 Nginx 反向代理 + SSL

1. **安装 Certbot**
```bash
apt install certbot python3-certbot-nginx
```

2. **获取 SSL 证书**
```bash
certbot --nginx -d your-domain.com
```

3. **Nginx 配置示例**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 性能优化

1. **增加文件上传限制**
   - 修改 `frontend/nginx.conf` 添加：
   ```nginx
   client_max_body_size 2G;
   ```

2. **启用 Redis 缓存**（可选）
   - 可以添加 Redis 服务用于会话管理

3. **数据库优化**
   - 定期备份数据库
   - 考虑迁移到 PostgreSQL 或 MySQL

## 技术支持

如有问题，请提交 Issue：
https://github.com/roseforljh/beOne/issues
