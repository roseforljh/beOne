# 更新日志

所有重要的项目变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [1.2.0] - 2025-01-XX

### 新增 ✨

#### 游客模式功能
- **即时体验**：无需注册即可体验系统功能
- **即时清理**：游客退出网页后数据立即清空
- **权限控制**：游客可下载/预览公共文件，使用对话板
- **会话管理**：基于 WebSocket 连接管理游客会话
- **独立数据**：游客数据与正式用户完全隔离

#### 后端增强
- 用户表新增 `is_guest` 和 `expires_at` 字段
- 新增 `/api/auth/guest-login` 游客登录接口
- 新增游客会话管理系统 (`utils/guestCleanup.js`)
- WebSocket 断开时自动清理游客数据
- 定时清理超过5分钟无活动的游客
- 文件接口增加游客权限控制

#### 前端增强
- 登录页面新增「游客模式」按钮
- Header 显示游客身份和剩余时间
- 游客模式下禁用文件上传功能
- 游客模式下只显示公共文件列表
- AuthContext 新增 `guestLogin` 方法
- 页面关闭时自动断开 Socket 连接

### 优化 🔧
- 文件选择器弹出位置优化（首页下方，对话框上方）
- FileTypeSelector 组件支持 `position` 参数
- 游客数据清理机制优化（即时清理 + 定时清理）

## [1.1.0] - 2025-01-XX

### 新增 ✨

#### 实时对话板功能
- **WebSocket 实时通信**：基于 Socket.IO 实现毫秒级消息传递
- **文本消息**：支持多行文本、实时发送和接收
- **文件消息**：在对话中直接发送文件，自动上传并共享
- **在线状态**：实时显示在线用户列表和数量
- **输入提示**：显示其他用户正在输入状态
- **消息历史**：自动加载最近 100 条历史消息
- **响应式设计**：桌面端和移动端完美适配

#### 后端增强
- 新增 `messages` 数据表存储消息记录
- 新增 `/api/messages` REST API 接口
- 新增 WebSocket 服务器配置 (`socket.js`)
- 新增消息路由处理 (`routes/messages.js`)
- 升级 Express 服务器支持 Socket.IO

#### 前端增强
- 新增对话板页面 (`pages/Chat.jsx`)
- 新增消息组件 (`components/ChatMessage.jsx`)
- 新增输入组件 (`components/ChatInput.jsx`)
- 新增 Socket 连接管理 (`utils/socket.js`)
- 导航栏新增「💬 对话板」入口
- 路由新增 `/chat` 路径

### 依赖更新 📦
- **后端**：新增 `socket.io@^4.6.1`
- **前端**：新增 `socket.io-client@^4.6.1`

### 文档更新 📝
- 更新 `README.md` 添加对话板功能说明
- 新增 `CHAT_FEATURE.md` 详细功能文档
- 新增 `CHANGELOG.md` 更新日志

## [1.0.0] - 2025-01-XX

### 初始发布 🎉

#### 核心功能
- 用户认证系统（JWT）
- 文件上传（支持大文件分片）
- 文件下载（流式传输）
- 文件管理（增删查改）
- 权限控制（公开/私有）
- 图片缩略图生成

#### 技术特性
- 太极主题黑白设计
- 响应式布局
- 动画效果（Framer Motion）
- SQLite 数据库
- RESTful API
- 单页应用（React）

#### 文档
- README.md
- QUICKSTART.md
- USAGE.md
- DEPLOYMENT.md
- CONTRIBUTING.md
- LICENSE

---

## 版本说明

### 主版本号 (Major)
- 不兼容的 API 更改
- 重大架构调整

### 次版本号 (Minor)
- 向下兼容的新功能
- 功能增强

### 修订号 (Patch)
- 向下兼容的问题修复
- 小改进和优化

---

**持续更新中...** 🚀

