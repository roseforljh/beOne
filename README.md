# 太极 · 文件传输系统

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18-61dafb.svg)

一个以太极为主题的黑白色系文件传输系统，支持在手机与电脑之间传输各类文件。

**简洁 · 优雅 · 高效**

[在线演示](#) | [快速开始](#-一键部署最简单) | [使用文档](USAGE.md) | [部署指南](DEPLOY_README.md)

</div>

---

## 📸 预览

<div align="center">

*太极主题界面 - 黑白配色，极简设计*

</div>


## ✨ 核心特性

### 🎨 设计理念
- **太极主题**：黑白配色，极简设计，以太极图为视觉核心
- **响应式设计**：完美适配手机、平板和电脑等各种设备
- **流畅动画**：基于 Framer Motion 的优雅过渡效果

### 🚀 强大功能
- **大文件支持**：支持 1GB+ 大文件分片上传，断点续传
- **实时对话板**：WebSocket 实时通信，支持文本和文件即时传输
- **多设备同步**：消息实时同步到所有在线设备
- **独立对话空间**：每个用户拥有独立对话板，消息互不干扰

### 🔐 安全便捷
- **游客模式**：无需注册，快速体验，退出即清空数据
- **权限控制**：文件可设置公开或私有，灵活管理访问权限
- **JWT 认证**：安全的用户身份验证机制

### ⚡ 高性能
- **全类型支持**：视频、图片、音频、文档、文本等所有文件类型
- **流式下载**：大文件流式传输，节省内存
- **智能缩略图**：自动生成图片和视频缩略图
- **并发上传**：多分片并发上传，提升传输速度

### 🎯 易部署
- **一键部署**：`npm start` 自动配置并启动
- **Docker 支持**：使用 Docker Compose 快速启动
- **进程保活**：支持 PM2 自动重启和开机自启
- **SQLite 数据库**：轻量级数据库，无需额外配置
- **跨平台支持**：支持 Windows、Linux、macOS
- **安卓 App**：原生安卓应用支持

## 🛠️ 技术栈

### 后端
- Node.js + Express
- SQLite3
- JWT 认证
- Socket.IO（WebSocket 实时通信）
- Multer（文件上传）
- Sharp（图片处理）

### 前端
- React 18
- Vite
- Tailwind CSS
- Framer Motion（动画）
- Axios

## 🚀 快速开始

### 方式一：一键部署（推荐）⚡

只需一条命令即可启动整个系统！

```bash
# 克隆项目
git clone https://github.com/roseforljh/beOne.git
cd beOne

# 一键部署
npm start
```

**自动完成：**
- ✅ 自动检测操作系统（Windows/Linux/macOS）
- ✅ 自动检测本机 IP 地址（优先 IPv4）
- ✅ 自动配置前后端连接
- ✅ 自动安装所有依赖
- ✅ 同时启动前后端服务
- ✅ 交互式询问是否配置开机自启
- ✅ 显示所有访问地址

**部署输出示例：**
```
太极 · 文件传输系统 - 智能部署

系统: Windows
IP: 192.168.1.100

配置已更新: http://192.168.1.100:5000

是否配置开机自启? (y/n): y

正在启动服务...

部署成功!
后端: http://192.168.1.100:5000
前端: http://192.168.1.100:5173
安卓端API: http://192.168.1.100:5000
```

**配置开机自启（可选）：**

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start ecosystem.config.js

# 配置开机自启
pm2 startup
pm2 save
```

> 📖 **详细说明**：
> - 部署指南：[DEPLOY_README.md](DEPLOY_README.md)
> - 服务配置：[SERVICE_SETUP.md](SERVICE_SETUP.md)

---

### 方式二：Docker 部署 🐳

**环境要求：**
- Docker >= 20.10
- Docker Compose >= 2.0

#### 标准部署（推荐）

适用于大多数场景,使用 Docker 桥接网络。

```bash
# 1. 克隆项目
git clone https://github.com/roseforljh/beOne.git
cd beOne

# 2. 一键启动（后台运行）
docker compose up -d

# 3. 查看运行状态
docker compose ps

# 4. 访问应用
# 前端：http://your-ip （默认 80 端口）
# 后端 API：http://your-ip:5000
```

**使用部署脚本（推荐）：**

```bash
# Linux/macOS
chmod +x deploy.sh
./deploy.sh

# Windows
deploy.bat
```

#### Host 网络模式部署（高性能）

适用于 VPS 或需要最佳性能的场景,直接使用主机网络。

```bash
# 1. 克隆项目
git clone https://github.com/roseforljh/beOne.git
cd beOne

# 2. 停止旧服务（如果有）
docker compose -f docker-compose.host.yml down

# 3. 重新构建并启动
docker compose -f docker-compose.host.yml up -d --build

# 4. 查看日志
docker compose -f docker-compose.host.yml logs -f
```

**使用便捷脚本：**

```bash
# 赋予执行权限
chmod +x deploy-host.sh

# 启动服务
./deploy-host.sh up

# 重新构建并启动
./deploy-host.sh build

# 查看日志
./deploy-host.sh logs

# 停止服务
./deploy-host.sh down

# 查看状态
./deploy-host.sh status
```

**Host 模式优势：**
- ⚡ 更高的网络性能（无 NAT 转换）
- 🚀 更低的延迟
- 💪 适合高并发场景
- 🎯 VPS 部署推荐

**注意事项：**
- Host 模式仅支持 Linux 系统
- 端口直接绑定到主机（前端 80，后端 5000）
- 确保端口未被占用

**部署输出示例：**
```
╔════════════════════════════════════════════════════════╗
║          ✅ 部署成功！太极文件传输系统已启动            ║
╚════════════════════════════════════════════════════════╝

📱 访问地址：
   ┌─ 前端访问地址
   │  http://192.168.1.100
   │  http://localhost
   │
   ├─ 后端 API 地址
   │  http://192.168.1.100:5000
   │  http://localhost:5000
   │
   └─ 📱 安卓端 API 地址 (在 App 登录页面输入)
      http://192.168.1.100:5000

🔐 默认账号：
   用户名: root
   密码: 123456
   ⚠️  首次登录后请立即修改密码！

📱 安卓端使用说明：
   1. 打开安卓 App
   2. 在登录页面的 'API 地址' 输入框中填写：
      http://192.168.1.100:5000
   3. 输入用户名和密码登录
```

**常用命令：**

```bash
# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 更新部署（推荐使用更新脚本）
./update.sh
```

> 💡 **提示**：
> - 详细部署文档请查看 [DEPLOY.md](DEPLOY.md)
> - 更新部署指南请查看 [UPDATE_GUIDE.md](UPDATE_GUIDE.md)

---

---

### 方式三：手动安装 🛠️

**环境要求：**
- Node.js >= 16.0.0
- npm >= 7.0.0 或 yarn >= 1.22.0

**安装步骤：**

```bash
# 1. 克隆项目
git clone https://github.com/roseforljh/beOne.git
cd beOne

# 2. 安装后端依赖
cd backend
npm install

# 3. 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件，修改配置

# 4. 安装前端依赖
cd ../frontend
npm install
```

**启动服务：**

```bash
# 推荐：一键启动（自动配置 IP）
npm start

# 或使用传统脚本
# Linux/macOS
chmod +x start.sh
./start.sh

# Windows
start.bat
```

**访问应用：**

- 前端：http://localhost:5173
- 后端 API：http://localhost:5000

**默认账号：**
- 用户名：`root`
- 密码：`123456`

> ⚠️ **安全提示**：首次登录后请立即修改默认密码！

---

## 📱 安卓端部署

### 构建安卓 App

```bash
# 1. 构建前端资源
chmod +x build-mobile.sh
./build-mobile.sh

# 2. 同步到 Android
cd beone-mobile
npx cap sync android

# 3. 打开 Android Studio
npx cap open android
```

### 配置安卓端

1. **部署后端服务**（使用上述任一方式）
2. **获取 API 地址**
   - 从部署输出中找到"安卓端 API 地址"
   - 格式: `http://服务器IP:5000`
3. **配置 App**
   - 打开安卓 App
   - 在登录页面输入 API 地址
   - 输入用户名密码登录

> 💡 **提示**：
> - 安卓设备需要与服务器在同一网络
> - 确保防火墙开放 5000 端口
> - 使用真实 IP 地址,不要使用 localhost

---

## 🔧 进程管理

### 使用 PM2 管理服务

PM2 提供进程保活、自动重启、开机自启等功能。

**安装 PM2：**
```bash
npm install -g pm2
```

**启动服务：**
```bash
pm2 start ecosystem.config.js
```

**常用命令：**
```bash
pm2 list          # 查看服务状态
pm2 restart all   # 重启所有服务
pm2 stop all      # 停止所有服务
pm2 logs          # 查看日志
pm2 monit         # 实时监控
```

**配置开机自启：**

**Windows:**
```bash
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

**Linux:**
```bash
pm2 startup
# 按照提示执行生成的命令
pm2 save
```

> 📖 **详细文档**：查看 [SERVICE_SETUP.md](SERVICE_SETUP.md)

---

## 📱 使用指南

### 快速开始

#### 1️⃣ 登录系统
- **正式账号**：使用默认账号 `root / 123456` 登录（Token 有效期 30 天）
- **游客模式**：点击「游客登录」快速体验，退出后数据自动清空

#### 2️⃣ 上传文件
- **拖拽上传**：直接拖拽文件到上传区域
- **点击上传**：点击「选择文件」按钮选择文件
- **批量上传**：支持同时选择多个文件
- **大文件**：自动分片上传，支持 1GB+ 大文件

#### 3️⃣ 管理文件
- **下载**：点击文件卡片上的「下载」按钮
- **预览**：支持图片、视频在线预览
- **权限设置**：
  - 🌐 **公开**：任何人都可以在「公开文件」页面访问
  - 🔒 **私有**：仅自己可见
- **删除**：点击「删除」按钮移除文件（不可恢复）

#### 4️⃣ 实时对话板 💬
点击顶部导航栏的「💬 对话板」进入实时聊天

**功能特性：**
- 📝 **发送文本**：输入消息后点击「发送」或按 `Enter` 键
- 📎 **发送文件**：点击 📎 按钮选择文件，自动上传并发送
- 👥 **在线状态**：右侧显示当前在线用户列表
- 🔄 **实时同步**：所有设备实时接收消息
- 💬 **多设备支持**：同一用户的多设备消息分左右显示
- ⌨️ **输入提示**：显示其他用户正在输入的状态
- 🔐 **独立空间**：每个用户拥有独立对话板，消息互不干扰

#### 5️⃣ 查看公开文件
点击顶部导航栏的「公开文件」，浏览所有用户分享的公开文件

> 📖 **详细使用文档**：查看 [USAGE.md](USAGE.md) 了解更多功能

## 📂 项目结构

```
beOne/
├── backend/                 # 后端
│   ├── src/
│   │   ├── config/         # 数据库配置
│   │   ├── middleware/     # 认证中间件
│   │   ├── routes/         # API 路由
│   │   ├── controllers/    # 业务逻辑
│   │   └── index.js        # 入口文件
│   ├── uploads/            # 文件存储（自动创建）
│   │   ├── files/          # 完整文件
│   │   ├── chunks/         # 分片临时文件
│   │   └── thumbs/         # 缩略图
│   ├── database.db         # SQLite 数据库（自动创建）
│   └── package.json
├── frontend/               # 前端
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面组件
│   │   ├── contexts/      # 状态管理
│   │   ├── utils/         # 工具函数
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## 🔌 API 接口

### 认证
- `POST /api/auth/login` - 用户登录

### 上传
- `POST /api/upload/init` - 初始化分片上传
- `POST /api/upload/chunk` - 上传文件分片
- `POST /api/upload/complete` - 完成上传，合并分片

### 文件管理
- `GET /api/files` - 获取文件列表（需认证）
- `GET /api/files/public` - 获取公开文件列表
- `GET /api/files/:id/download` - 下载文件
- `GET /api/files/:id/thumbnail` - 获取缩略图
- `PATCH /api/files/:id/visibility` - 切换公开/私有
- `DELETE /api/files/:id` - 删除文件

### 消息（WebSocket + REST）
- `GET /api/messages` - 获取消息历史（需认证）
- `DELETE /api/messages/:id` - 删除消息（需认证）
- `WebSocket /` - 实时消息通信
  - `send_message` - 发送文本消息
  - `send_file_message` - 发送文件消息
  - `typing` - 用户正在输入
  - `new_message` - 接收新消息
  - `online_users` - 在线用户列表

## 🎨 设计理念

### 太极哲学
- **阴阳平衡**：黑白两色的和谐统一
- **简约至上**：去除冗余，保留本质
- **动静相宜**：流畅的动画与宁静的界面

### 色彩系统
- 主色：纯黑 `#000000` 与纯白 `#FFFFFF`
- 灰阶：9 个等级的灰色过渡
- 强调：通过黑白对比实现视觉层次

### 交互设计
- 拖拽上传：直观的文件传输方式
- 实时反馈：上传进度、动画过渡
- 响应式布局：适配各种设备尺寸

## ⚙️ 配置说明

### 后端配置

创建 [`backend/.env`](backend/.env) 文件：

```env
# 服务端口
PORT=5000

# JWT 密钥（请修改为随机字符串）
JWT_SECRET=your_secret_key_here_change_in_production

# 运行环境
NODE_ENV=development

# 数据库路径（可选）
DATABASE_PATH=./database.db

# 文件上传路径（可选）
UPLOAD_PATH=./uploads
```

### 前端配置

修改 [`frontend/vite.config.js`](frontend/vite.config.js:1) 中的代理配置：

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // 后端地址
        changeOrigin: true
      }
    }
  }
})
```

### 文件上传配置

**默认限制：**
- 分片大小：5MB
- 单文件最大：1GB+
- 并发分片数：3

**自定义配置：**

修改 [`frontend/src/utils/uploadHelper.js`](frontend/src/utils/uploadHelper.js:1) 中的常量：

```javascript
const CHUNK_SIZE = 5 * 1024 * 1024; // 分片大小（字节）
const MAX_CONCURRENT = 3;            // 并发数
```

## 🔒 安全说明

本系统设计用于**个人搭建和内网使用**，采用基础的 JWT 认证机制。

### 安全建议

**必须执行：**
- ✅ 修改默认密码（`root / 123456`）
- ✅ 更改 `JWT_SECRET` 为强随机字符串
- ✅ 生产环境使用 HTTPS
- ✅ 配置防火墙规则，限制访问 IP

**推荐执行：**
- 🔐 定期备份数据库文件
- 🔐 设置文件上传大小限制
- 🔐 启用访问日志记录
- 🔐 使用反向代理（Nginx/Caddy）

### 数据隐私

- 游客模式数据在退出后自动清空
- 私有文件仅文件所有者可访问
- 对话消息存储在本地数据库
- 不会收集或上传任何用户数据到第三方

> ⚠️ **重要提示**：请勿在公网环境直接暴露系统，建议使用 VPN 或内网穿透访问

## 📝 开发路线图

### ✅ 已完成
- [x] 实时对话板
- [x] WebSocket 实时通信
- [x] 游客模式
- [x] 多设备消息同步
- [x] 独立对话板
- [x] 一键智能部署
- [x] Docker 容器化部署
- [x] PM2 进程管理
- [x] 开机自启配置
- [x] 大文件分片上传
- [x] 图片视频缩略图
- [x] 安卓原生应用
- [x] 跨平台支持

### 🚧 开发中
- [ ] 文件预览增强（视频、音频、PDF）
- [ ] 文件夹分类管理
- [ ] 文件搜索功能

### 📋 计划中
- [ ] 多用户注册系统
- [ ] 批量文件操作
- [ ] 消息已读状态
- [ ] 文件分享链接
- [ ] 移动端原生应用
- [ ] 国际化支持（i18n）
- [ ] 主题切换（深色/浅色）

### 💡 建议与反馈

欢迎在 [Issues](https://github.com/roseforljh/beOne/issues) 中提出功能建议或报告问题！

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. **Fork** 本仓库
2. **创建**特性分支 (`git checkout -b feature/AmazingFeature`)
3. **提交**更改 (`git commit -m 'Add some AmazingFeature'`)
4. **推送**到分支 (`git push origin feature/AmazingFeature`)
5. **提交** Pull Request

### 贡献类型

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🎨 优化 UI/UX
- ⚡ 性能优化
- ✅ 添加测试

详细贡献指南请查看：[CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

```
MIT License

Copyright (c) 2024 beOne

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

## 🙏 致谢

感谢所有为本项目做出贡献的开发者！

## 📞 联系方式

- 项目主页：https://github.com/roseforljh/beOne
- 问题反馈：https://github.com/roseforljh/beOne/issues
- 更新日志：[CHANGELOG.md](CHANGELOG.md)

## ⭐ Star History

如果这个项目对你有帮助，请给我们一个 Star ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=roseforljh/beOne&type=Date)](https://star-history.com/#roseforljh/beOne&Date)

---

<div align="center">

**太极 · 至简至美**

Made with ⚫⚪ and ❤️

</div>

