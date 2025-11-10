# VPS 更新部署指南

## 快速更新

在 VPS 上更新已部署的项目非常简单，只需几个命令即可完成。

### 步骤 1：连接到 VPS

```bash
ssh your-username@your-vps-ip
```

### 步骤 2：进入项目目录

```bash
cd beOne
```

### 步骤 3：运行更新脚本

```bash
# 首次使用需要添加执行权限
chmod +x update.sh

# 运行更新
./update.sh
```

就这么简单！脚本会自动完成所有更新操作。

## 更新过程说明

更新脚本会自动执行以下操作：

1. ✅ 从 GitHub 拉取最新代码
2. ✅ 停止旧的 Docker 容器
3. ✅ 清理未使用的镜像（节省空间）
4. ✅ 重新构建 Docker 镜像
5. ✅ 启动新的容器
6. ✅ 检查服务状态

**预计耗时**：2-5 分钟（取决于网络速度和服务器性能）

## 手动更新（备选方案）

如果你更喜欢手动控制每一步：

```bash
# 1. 拉取最新代码
git pull

# 2. 停止旧容器
docker compose down

# 3. 重新构建并启动
docker compose up -d --build

# 4. 查看服务状态
docker compose ps
```

## 常见问题

### Q: 更新会丢失数据吗？

**A:** 不会。更新只会替换代码和应用程序，你的数据（上传的文件和数据库）保存在 Docker volumes 中，不会被删除。

### Q: 更新需要多长时间？

**A:** 通常 2-5 分钟，期间服务会短暂中断。

### Q: 如何查看更新日志？

```bash
# 查看最近的提交记录
git log --oneline -10

# 查看详细更改
git show HEAD

# 查看容器日志
docker compose logs -f
```

### Q: 更新失败怎么办？

```bash
# 1. 查看错误日志
docker compose logs

# 2. 回滚到上一版本
git reset --hard HEAD~1
docker compose up -d --build
```

### Q: 如何验证更新成功？

```bash
# 检查容器状态
docker compose ps

# 查看应用日志
docker compose logs -f backend
docker compose logs -f frontend

# 访问应用
curl http://localhost
```

## 更新前检查清单

在更新之前，建议：

- [ ] 确认当前服务运行正常
- [ ] 查看 GitHub 上的更新日志
- [ ] 在非高峰时段进行更新
- [ ] 备份重要数据（可选）

## 备份数据（可选）

如果你想在更新前备份数据：

```bash
# 备份数据库
docker run --rm -v beone_database:/data -v $(pwd):/backup alpine tar czf /backup/database-backup-$(date +%Y%m%d).tar.gz -C /data .

# 备份上传的文件
docker run --rm -v beone_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 监控更新状态

更新后，可以通过以下方式监控服务：

```bash
# 实时查看日志
docker compose logs -f

# 查看资源使用情况
docker stats

# 检查端口监听
netstat -tulpn | grep -E ':(80|5000)'
```

## 自动化更新（高级）

如果你想设置定期自动更新（需谨慎使用）：

```bash
# 创建 cron 任务
crontab -e

# 添加以下行（每天凌晨 3 点更新）
0 3 * * * cd /path/to/beOne && ./update.sh >> /var/log/beone-update.log 2>&1
```

**注意**：自动更新可能导致意外问题，建议手动更新。

## 获取帮助

如果遇到问题：

1. 查看 [DEPLOY.md](DEPLOY.md) 完整部署文档
2. 查看项目 Issues：https://github.com/roseforljh/beOne/issues
3. 提交新的 Issue 描述你的问题

## 版本管理

查看当前版本：

```bash
# 查看当前 Git 版本
git log -1 --oneline

# 查看 Docker 镜像版本
docker images | grep beone
```

## 总结

更新部署就是这么简单：

```bash
cd beOne
./update.sh
```

一条命令搞定！🎉