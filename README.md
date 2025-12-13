# SyncHub

个人数据中心 - 集云盘与即时通讯于一体的跨平台应用

## 项目结构

```
beOne/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── models/    # SQLAlchemy 数据模型
│   │   ├── schemas/   # Pydantic 数据验证
│   │   ├── routers/   # API 路由
│   │   ├── services/  # 业务逻辑
│   │   └── utils/     # 工具函数
│   ├── alembic/       # 数据库迁移
│   └── uploads/       # 本地文件存储
├── frontend/          # Next.js + Electron (待开发)
├── android/           # Android 客户端 (待开发)
└── docker-compose.yml # 容器编排
```

## 快速开始

### 1. 启动基础服务 (PostgreSQL + Redis + MinIO)

```bash
docker-compose up -d postgres redis minio
```

### 2. 本地开发后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 复制环境变量
cp .env.example .env

# 运行数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload
```

### 3. 或使用 Docker 启动全部服务

```bash
docker-compose up -d
```

## API 文档

启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 主要功能

- **云盘**: 文件上传/下载、文件夹管理
- **图床**: 上传图片获取公开 URL (Markdown/HTML)
- **对话板**: 多设备实时同步 (WebSocket)
- **认证**: Google & QQ OAuth2 (开发中)
- **隐私**: 公开/私有文件切换

## 技术栈

- **后端**: Python 3.11, FastAPI, SQLAlchemy (Async), Pydantic
- **数据库**: PostgreSQL 16
- **缓存/消息**: Redis 7
- **存储**: 本地文件系统 / MinIO (S3 兼容)
- **前端**: Next.js 14, Tailwind CSS, Shadcn/ui, Electron
- **移动端**: Kotlin, Jetpack Compose

## 开发进度

- [x] **Phase 1: 后端基础架构**
  - [x] FastAPI 项目结构
  - [x] PostgreSQL + Redis + MinIO 环境
  - [x] JWT 认证 (Dev Login)
  - [x] 文件上传/下载 API
  - [x] WebSocket 实时消息

- [x] **Phase 2: Web 前端 + PC 客户端**
  - [x] Next.js 14 + Shadcn/ui 现代化界面
  - [x] 对话板 (Chat Board)
  - [x] 云盘文件管理 (Cloud Drive)
  - [x] Electron 桌面端集成 (Windows/Mac/Linux)

- [x] **Phase 3: Android 客户端**
  - [x] Kotlin + Jetpack Compose 原生开发
  - [x] WebSocket 实时同步服务
  - [x] 系统分享集成 (Share Intent)
  - [x] 移动端 UI 适配

- [x] **Phase 4: 部署与发布**
  - [x] Docker Compose 全栈部署
  - [x] Nginx 前端静态托管

## 运行指南

### 1. 启动服务 (Backend + DB + Frontend)

```bash
docker-compose up -d --build
```

- 后端 API: http://localhost:8000
- Web 前端: http://localhost:3000
- MinIO 控制台: http://localhost:9001 (user/password: minioadmin)

### 2. Electron 桌面端开发

```bash
cd frontend
npm install
npm run electron:dev
```

打包构建:
```bash
npm run electron:build
```

### 3. Android 客户端开发

1. 使用 Android Studio 打开 `android` 目录。
2. 同步 Gradle 项目。
3. 修改 `app/src/main/java/com/synchub/app/network/NetworkModule.kt` 中的 `BASE_URL` 为你的电脑 IP。
4. 运行到模拟器或真机。

