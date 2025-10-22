# 使用手册

## 目录

1. [功能概览](#功能概览)
2. [基础操作](#基础操作)
3. [高级功能](#高级功能)
4. [手机访问](#手机访问)
5. [API 使用](#api-使用)
6. [故障排除](#故障排除)

## 功能概览

太极文件传输系统提供以下核心功能：

- ✅ 文件上传（支持拖拽、大文件分片）
- ✅ 文件下载（流式传输）
- ✅ 权限控制（公开/私有）
- ✅ 图片缩略图预览
- ✅ 文件类型识别
- ✅ 响应式设计

## 基础操作

### 登录系统

1. 在浏览器访问 `http://localhost:5173`
2. 输入用户名：`root`
3. 输入密码：`123456`
4. 点击「登录」按钮

### 上传文件

#### 方式一：拖拽上传

1. 将文件拖拽到上传区域
2. 文件信息会自动显示
3. 点击「开始上传」按钮
4. 等待上传完成

#### 方式二：选择上传

1. 点击「选择文件」按钮
2. 在文件选择器中选择文件
3. 点击「开始上传」按钮
4. 等待上传完成

**支持的文件类型**：
- 图片：jpg, png, gif, webp, svg
- 视频：mp4, avi, mov, mkv
- 音频：mp3, wav, flac, aac
- 文档：pdf, doc, docx, xls, xlsx, ppt, pptx
- 压缩包：zip, rar, 7z
- 文本：txt, md, json, xml
- 其他所有类型

**文件大小限制**：
- 单文件最大：1GB+
- 自动分片上传，无需担心大文件问题

### 管理文件

#### 查看文件列表

在首页可以看到所有已上传的文件，包括：
- 文件预览图/图标
- 文件名
- 文件大小
- 上传时间
- 公开/私有状态

#### 筛选文件

使用顶部的筛选按钮：
- **全部**：显示所有文件
- **公开**：仅显示公开文件
- **私有**：仅显示私有文件

#### 下载文件

点击文件卡片上的「下载」按钮，浏览器会自动下载文件。

#### 切换可见性

点击文件卡片上的「设为公开」或「设为私有」按钮：
- **公开**：文件会出现在「公开文件」页面，所有登录用户可见
- **私有**：仅你自己可见

#### 删除文件

1. 点击文件卡片上的「删除」按钮
2. 确认删除操作
3. 文件和相关数据将被永久删除

### 查看公开文件

1. 点击顶部导航栏的「公开文件」
2. 查看所有标记为公开的文件
3. 可以下载任何公开文件

## 高级功能

### 大文件上传

系统自动处理大文件上传：

1. **自动分片**：文件会被分成 5MB 的块
2. **并发上传**：多个分片同时上传
3. **断点续传**：网络中断后可重新上传失败的分片
4. **实时进度**：显示上传百分比

### 图片预览

系统自动为图片生成缩略图：
- 300x300 像素
- 保持比例
- 快速加载

支持的图片格式：
- JPEG/JPG
- PNG
- GIF
- WebP

### 文件类型识别

系统根据 MIME 类型自动识别文件：
- 🖼️ 图片
- 🎬 视频
- 🎵 音频
- 📕 PDF
- 📘 Word 文档
- 📗 Excel 表格
- 📙 PowerPoint 演示
- 📦 压缩包
- 📝 文本文件
- 📄 其他文件

## 手机访问

### 局域网访问

1. **获取电脑 IP 地址**

   Windows：
   ```bash
   ipconfig
   # 查找 IPv4 地址，如：192.168.1.100
   ```

   macOS/Linux：
   ```bash
   ifconfig
   # 或
   ip addr
   ```

2. **配置后端允许跨域**
   
   后端默认已配置 CORS，无需额外设置

3. **在手机浏览器访问**
   
   访问：`http://<电脑IP>:5173`
   
   例如：`http://192.168.1.100:5173`

### 注意事项

- 确保手机和电脑在同一 Wi-Fi 网络
- 确保电脑防火墙允许端口 5000 和 5173
- 手机浏览器推荐使用 Chrome 或 Safari

## API 使用

### 认证

所有需要认证的 API 需要在请求头中包含 JWT Token：

```
Authorization: Bearer <token>
```

### API 端点

#### 1. 登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "root",
  "password": "123456"
}
```

响应：
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "root"
  }
}
```

#### 2. 初始化上传

```http
POST /api/upload/init
Authorization: Bearer <token>
Content-Type: application/json

{
  "filename": "example.pdf",
  "totalChunks": 10,
  "fileSize": 52428800,
  "mimetype": "application/pdf"
}
```

响应：
```json
{
  "uploadId": "1234567890-abc123"
}
```

#### 3. 上传分片

```http
POST /api/upload/chunk
Authorization: Bearer <token>
Content-Type: multipart/form-data

chunk: <binary_data>
uploadId: "1234567890-abc123"
chunkIndex: 0
```

#### 4. 完成上传

```http
POST /api/upload/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "uploadId": "1234567890-abc123",
  "filename": "example.pdf",
  "totalChunks": 10,
  "mimetype": "application/pdf"
}
```

#### 5. 获取文件列表

```http
GET /api/files
Authorization: Bearer <token>
```

#### 6. 获取公开文件

```http
GET /api/files/public
```

#### 7. 下载文件

```http
GET /api/files/:id/download
Authorization: Bearer <token> (私有文件需要)
```

#### 8. 切换可见性

```http
PATCH /api/files/:id/visibility
Authorization: Bearer <token>
```

#### 9. 删除文件

```http
DELETE /api/files/:id
Authorization: Bearer <token>
```

## 故障排除

### 上传失败

**可能原因**：
1. 文件太大，网络超时
2. 磁盘空间不足
3. 权限问题

**解决方案**：
1. 检查网络连接
2. 确保 `backend/uploads/` 目录有写入权限
3. 检查磁盘剩余空间
4. 刷新页面重试

### 无法登录

**可能原因**：
1. 用户名或密码错误
2. 后端未启动
3. 数据库文件损坏

**解决方案**：
1. 确认使用默认账号 `root / 123456`
2. 检查后端是否正常运行
3. 删除 `backend/database.db` 重新启动（会丢失数据）

### 图片不显示

**可能原因**：
1. 缩略图生成失败
2. 文件路径错误

**解决方案**：
1. 检查 `backend/uploads/thumbs/` 目录
2. 确保安装了 `sharp` 依赖
3. 重新上传图片

### 下载失败

**可能原因**：
1. 文件已被删除
2. 权限不足
3. 文件路径错误

**解决方案**：
1. 刷新文件列表
2. 确认文件权限
3. 检查 `backend/uploads/files/` 目录

## 性能优化建议

### 服务器端

1. **使用 SSD 存储**：提高文件读写速度
2. **增加内存**：提升数据库查询性能
3. **使用 Nginx 反向代理**：提供静态文件服务
4. **启用 Gzip 压缩**：减少传输数据量

### 客户端

1. **使用现代浏览器**：Chrome、Firefox、Edge、Safari
2. **稳定的网络连接**：Wi-Fi 或有线网络
3. **关闭不必要的浏览器扩展**：避免冲突

## 数据备份

重要数据位置：
- 数据库：`backend/database.db`
- 文件：`backend/uploads/files/`
- 缩略图：`backend/uploads/thumbs/`

建议定期备份这些目录。

## 联系支持

如有问题，请：
1. 查看 [README.md](README.md)
2. 查看 [QUICKSTART.md](QUICKSTART.md)
3. 提交 GitHub Issue

---

**愿你使用愉快！** ⚫⚪

