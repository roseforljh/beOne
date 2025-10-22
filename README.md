# 太极 · 文件传输系统

<div align="center">

一个以太极为主题的黑白色系文件传输系统，支持在手机与电脑之间传输各类文件。

**简洁 · 优雅 · 高效**

</div>

## ✨ 特性

- 🎨 **太极主题**：黑白配色，极简设计，以太极图为视觉核心
- 📱 **响应式设计**：完美支持手机和电脑访问
- 🚀 **大文件支持**：支持 1GB+ 大文件分片上传
- 💬 **实时对话板**：WebSocket 实时通信，文本和文件即时传输
- 🔒 **权限控制**：文件可设置公开或私有
- 📦 **全类型支持**：视频、图片、音频、文档、文本等所有文件类型
- ⚡ **高性能**：流式下载、缩略图生成、并发上传
- 🎯 **易部署**：SQLite 数据库，无需复杂配置

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

## 📦 快速部署（推荐）

### 使用 Docker（一键部署）

**环境要求：**
- Docker
- Docker Compose

**部署步骤：**

```bash
# 1. 克隆项目
git clone https://github.com/roseforljh/beOne.git
cd beOne

# 2. 一键启动
docker-compose up -d

# 3. 访问应用
# 前端：http://your-ip （默认 80 端口，无需指定）
# 后端 API：http://your-ip:5000
```

**或使用快速脚本：**

```bash
chmod +x deploy.sh
./deploy.sh
```

详细部署文档请查看：[DEPLOY.md](DEPLOY.md)

---

## 📦 手动安装

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 1. 克隆项目

```bash
git clone https://github.com/roseforljh/beOne.git
cd beOne
```

### 2. 安装后端依赖

```bash
cd backend
npm install
```

### 3. 安装前端依赖

```bash
cd ../frontend
npm install
```

## 🚀 启动

### 开发环境

**启动后端（终端 1）：**

```bash
cd backend
npm start
```

后端将运行在 `http://localhost:5000`

**启动前端（终端 2）：**

```bash
cd frontend
npm run dev
```

前端将运行在 `http://localhost:5173`

### 访问系统

在浏览器中打开：`http://localhost:5173`

**默认账号**：
- 用户名：`root`
- 密码：`123456`

## 📱 使用方法

### 1. 登录
使用默认账号 `root / 123456` 登录系统

### 2. 上传文件
- 拖拽文件到上传区域
- 或点击「选择文件」按钮
- 支持所有文件类型，自动分片上传大文件

### 3. 管理文件
- **下载**：点击文件卡片上的「下载」按钮
- **公开/私有**：切换文件可见性
  - 公开：任何人都可以在「公开文件」页面访问
  - 私有：仅自己可见
- **删除**：点击「删除」按钮移除文件

### 4. 实时对话板 🆕
点击顶部导航栏的「💬 对话板」进入实时聊天
- **发送文本**：输入消息后点击「发送」或按 Enter
- **发送文件**：点击 📎 按钮选择文件，自动上传并发送
- **在线状态**：右侧显示当前在线用户
- **实时同步**：所有设备实时接收消息
- **输入提示**：显示其他用户正在输入

### 5. 查看公开文件
点击顶部导航栏的「公开文件」，查看所有公开可见的文件

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

### 后端配置（backend/.env）

```env
PORT=5000
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```

### 文件上传限制

默认配置：
- 分片大小：5MB
- 支持单文件最大：1GB+
- 并发上传分片

可在 `frontend/src/utils/uploadHelper.js` 中修改 `CHUNK_SIZE` 调整分片大小

## 🔒 安全说明

本系统设计用于**个人搭建和内网使用**，采用基础的 JWT 认证机制。

**建议**：
- 修改默认密码
- 更改 JWT_SECRET
- 在生产环境使用 HTTPS
- 配置防火墙规则

## 📝 开发计划

- [x] ~~实时对话板~~ ✅
- [x] ~~WebSocket 实时通信~~ ✅
- [ ] 支持多用户注册
- [ ] 文件夹分类管理
- [ ] 文件搜索功能
- [ ] 批量操作
- [ ] 文件预览（视频、音频、PDF）
- [ ] 消息已读状态
- [ ] 移动端原生应用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

<div align="center">

**太极 · 至简至美**

Made with ⚫⚪ and ❤️

</div>

