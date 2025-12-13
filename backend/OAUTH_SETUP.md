# OAuth登录集成说明

## 功能说明
已为太极文件传输系统集成Google和QQ OAuth登录功能。通过email自动统一账号，实现跨平台数据同步。

## 核心特性
✅ **账号统一逻辑**：相同email的用户自动关联OAuth账号
✅ **首次登录自动创建**：OAuth登录时如email不存在则自动创建账号
✅ **多平台支持**：支持Google和QQ两种第三方登录方式
✅ **安全认证**：使用JWT token管理会话

## 已完成的工作

### 1. 数据库扩展 ✅
- `users`表已添加字段：
  - `email`: 用户邮箱（用于账号统一）
  - `oauth_provider`: OAuth提供商（google/qq）
  - `oauth_id`: OAuth用户唯一标识

### 2. 后端实现 ✅
- **Passport配置**：`backend/src/config/passport.js`
  - Google OAuth策略
  - QQ OAuth策略  
  - 账号统一逻辑（email匹配）
  - 自动创建新用户

- **认证路由**：`backend/src/routes/auth.js`
  - `GET /api/auth/google` - Google登录入口
  - `GET /api/auth/google/callback` - Google回调
  - `GET /api/auth/qq` - QQ登录入口
  - `GET /api/auth/qq/callback` - QQ回调

- **主应用集成**：`backend/src/index.js`
  - Express session配置
  - Passport初始化

### 3. 前端实现 ✅
- **登录页面**：`frontend/src/pages/Login.jsx`
  - Google登录按钮（带品牌icon）
  - QQ登录按钮（带品牌icon）
  - OAuth回调处理
  - Token自动保存

## 安装依赖（重要❗）

由于网络证书问题，依赖包未能自动安装。请手动运行：

```bash
cd backend
npm install passport passport-google-oauth20 passport-qq express-session
```

或使用yarn：
```bash
cd backend
yarn add passport passport-google-oauth20 passport-qq express-session
```

## 配置OAuth凭据

### 环境变量配置
需要在 `backend/.env` 文件中配置以下变量（已添加占位符）：

```env
# OAuth配置
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
QQ_APP_ID=your_qq_app_id
QQ_APP_KEY=your_qq_app_key
SESSION_SECRET=your_session_secret_random_string
```

### Google OAuth配置步骤

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 导航到 **APIs & Services > Credentials**
4. 点击 **Create Credentials > OAuth 2.0 Client ID**
5. 选择应用类型：**Web application**
6. 配置授权重定向URI：
   - 开发环境：`http://localhost:5000/api/auth/google/callback`
   - 生产环境：`https://your-domain.com/api/auth/google/callback`
7. 复制 **Client ID** 和 **Client Secret** 到 `.env` 文件

### QQ OAuth配置步骤

1. 访问 [QQ互联平台](https://connect.qq.com/)
2. 登录并创建应用
3. 在 **应用管理** 中填写应用信息
4. 配置回调地址：
   - 开发环境：`http://localhost:5000/api/auth/qq/callback`
   - 生产环境：`https://your-domain.com/api/auth/qq/callback`
5. 审核通过后，复制 **APP ID** 和 **APP Key** 到 `.env` 文件

### Session密钥生成

```bash
# 生成随机SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 账号统一逻辑说明

当用户通过OAuth登录时：

1. **首次OAuth登录**：
   - 检查email是否已存在
   - 如果email已存在：关联OAuth到现有账号
   - 如果email不存在：创建新账号并绑定OAuth

2. **已绑定OAuth**：
   - 直接登录，返回JWT token

3. **数据同步**：
   - 相同email的账号共享所有数据（文件、消息等）
   - 无论从哪个登录方式进入，都能访问相同数据

## 测试流程

1. **安装依赖**：运行上述npm install命令
2. **配置凭据**：填写.env文件中的OAuth配置
3. **重启服务**：重启后端服务器
4. **测试登录**：
   - 访问登录页面
   - 点击Google/QQ登录按钮
   - 授权后自动跳转回应用
   - 验证数据同步（使用相同email的账号测试）

## 故障排查

### 依赖安装失败
```bash
# 如果npm安装失败，尝试：
npm config set strict-ssl false
npm install passport passport-google-oauth20 passport-qq express-session
```

### OAuth未配置
- 如果OAuth凭据未配置，点击登录按钮会返回503错误
- 检查.env文件中的配置是否正确

### 回调地址不匹配
- 确保OAuth平台配置的回调地址与代码中一致
- 开发环境：`http://localhost:5000`
- 生产环境需更新为实际域名

### Session问题
- 确保SESSION_SECRET已配置
- 生产环境需设置secure cookie（HTTPS）

## 文件清单

```
backend/
├── .env (需配置OAuth凭据)
├── src/
│   ├── config/
│   │   ├── passport.js (新增 - Passport策略配置)
│   │   └── database.js (已更新 - 添加OAuth字段)
│   ├── routes/
│   │   └── auth.js (已更新 - 添加OAuth路由)
│   └── index.js (已更新 - 集成Passport)
│
frontend/
└── src/
    └── pages/
        └── Login.jsx (已更新 - 添加OAuth按钮)
```

## 后续优化建议

1. **邮箱验证**：添加邮箱验证机制
2. **更多OAuth提供商**：微信、GitHub等
3. **账号解绑**：允许用户管理关联的OAuth账号
4. **隐私设置**：让用户控制数据共享范围
