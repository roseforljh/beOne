# 快速启动指南

## Windows 用户

### 方式一：使用启动脚本（推荐）

双击运行 `start.bat` 文件，脚本会自动：
1. 检查并安装依赖
2. 启动后端服务
3. 启动前端服务
4. 打开浏览器

### 方式二：手动启动

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 启动后端（新终端）
npm start

# 3. 安装前端依赖（新终端）
cd frontend
npm install

# 4. 启动前端
npm run dev
```

然后在浏览器打开：`http://localhost:5173`

## macOS / Linux 用户

### 方式一：使用启动脚本（推荐）

```bash
# 添加执行权限
chmod +x start.sh

# 运行脚本
./start.sh
```

### 方式二：手动启动

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 启动后端（新终端）
npm start

# 3. 安装前端依赖（新终端）
cd ../frontend
npm install

# 4. 启动前端
npm run dev
```

然后在浏览器打开：`http://localhost:5173`

## 默认登录信息

- **用户名**：root
- **密码**：123456

## 端口说明

- 后端：`http://localhost:5000`
- 前端：`http://localhost:5173`

如果端口被占用，可以修改：
- 后端：修改 `backend/.env` 中的 `PORT`
- 前端：修改 `frontend/vite.config.js` 中的 `server.port`

## 常见问题

### 1. 端口被占用

**错误**：`Error: listen EADDRINUSE: address already in use`

**解决**：
- Windows：`netstat -ano | findstr :5000` 查找进程，`taskkill /PID <PID> /F` 结束进程
- macOS/Linux：`lsof -ti:5000 | xargs kill -9`

### 2. 依赖安装失败

**解决**：
```bash
# 清除缓存重试
npm cache clean --force
npm install
```

### 3. 无法访问

**检查**：
- 后端是否正常启动（终端无报错）
- 前端是否正常启动（终端显示运行地址）
- 浏览器是否输入了正确地址

## 手机访问

确保手机和电脑在同一局域网：

1. 查看电脑 IP 地址
   - Windows：`ipconfig` 查看 IPv4 地址
   - macOS/Linux：`ifconfig` 或 `ip addr`

2. 修改前端 API 地址
   - 编辑 `frontend/src/utils/api.js`
   - 将 `/api` 改为 `http://<电脑IP>:5000/api`

3. 在手机浏览器访问：`http://<电脑IP>:5173`

## 停止服务

- **Windows**：关闭启动的命令行窗口
- **macOS/Linux**：在终端按 `Ctrl + C`

## 数据位置

- 数据库：`backend/database.db`
- 上传文件：`backend/uploads/files/`
- 缩略图：`backend/uploads/thumbs/`

---

**享受使用太极文件传输系统！** ⚫⚪

