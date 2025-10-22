# 贡献指南

感谢您对太极文件传输系统的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

如果您发现 bug 或有功能建议：

1. 检查 [Issues](../../issues) 确保问题未被报告
2. 创建新 Issue，包含：
   - 清晰的标题
   - 详细的描述
   - 重现步骤（如果是 bug）
   - 期望行为
   - 实际行为
   - 截图（如果适用）
   - 环境信息（OS、浏览器、Node.js 版本）

### 提交代码

1. **Fork 项目**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   git clone https://github.com/your-username/beone.git
   cd beone
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **进行修改**
   - 遵循代码风格
   - 添加必要的注释
   - 确保代码可运行

4. **测试修改**
   ```bash
   # 启动后端
   cd backend
   npm install
   npm start

   # 启动前端
   cd ../frontend
   npm install
   npm run dev
   ```

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   # 或
   git commit -m "fix: 修复 bug 描述"
   ```

   提交信息格式：
   - `feat:` 新功能
   - `fix:` 修复 bug
   - `docs:` 文档更新
   - `style:` 代码格式调整
   - `refactor:` 重构
   - `test:` 测试相关
   - `chore:` 构建/工具相关

6. **推送到 GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写 PR 模板
   - 等待审核

## 代码规范

### JavaScript/JSX

- 使用 ES6+ 语法
- 使用 2 空格缩进
- 使用单引号
- 组件使用 PascalCase
- 函数使用 camelCase
- 常量使用 UPPER_SNAKE_CASE

### 后端代码示例

```javascript
import express from 'express';

const router = express.Router();

// 函数使用 camelCase
const handleRequest = (req, res) => {
  try {
    // 业务逻辑
    res.json({ success: true });
  } catch (error) {
    console.error('错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

router.get('/endpoint', handleRequest);

export default router;
```

### 前端代码示例

```jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function MyComponent({ prop1, prop2 }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    // 副作用逻辑
  }, []);

  const handleClick = () => {
    // 事件处理
  };

  return (
    <motion.div className="container">
      <button onClick={handleClick} className="btn-primary">
        点击
      </button>
    </motion.div>
  );
}
```

## 设计原则

### 1. 极简主义
- 保持界面简洁
- 减少不必要的元素
- 使用留白营造空间感

### 2. 黑白配色
- 主要使用黑色和白色
- 使用灰阶过渡
- 避免使用彩色（除非必要）

### 3. 太极主题
- 保持阴阳平衡的设计理念
- 使用太极图标作为视觉元素
- 流畅的动画效果

### 4. 响应式设计
- 移动端优先
- 适配各种屏幕尺寸
- 触摸友好的交互

## 功能开发建议

### 优先级

#### 高优先级
- Bug 修复
- 安全性改进
- 性能优化
- 用户体验提升

#### 中优先级
- 新功能开发
- UI/UX 改进
- 文档完善

#### 低优先级
- 代码重构
- 依赖更新
- 美化工作

### 功能建议

欢迎实现以下功能：

**用户管理**
- [ ] 多用户注册
- [ ] 用户权限管理
- [ ] 用户配额限制

**文件管理**
- [ ] 文件夹管理
- [ ] 文件搜索
- [ ] 批量操作
- [ ] 文件标签

**文件预览**
- [ ] 图片预览（大图查看）
- [ ] 视频播放
- [ ] 音频播放
- [ ] PDF 预览
- [ ] 代码高亮显示

**分享功能**
- [ ] 分享链接生成
- [ ] 链接过期时间
- [ ] 访问密码保护
- [ ] 下载次数限制

**进阶功能**
- [ ] WebSocket 实时通知
- [ ] 文件版本管理
- [ ] 回收站
- [ ] 文件加密
- [ ] 移动端原生应用

## 测试指南

### 后端测试

```bash
cd backend
npm test  # 如果有测试脚本
```

测试要点：
- API 接口功能
- 认证和授权
- 文件上传和下载
- 错误处理

### 前端测试

```bash
cd frontend
npm test  # 如果有测试脚本
```

测试要点：
- 组件渲染
- 用户交互
- 状态管理
- 响应式布局

### 手动测试清单

- [ ] 用户登录/登出
- [ ] 文件上传（小文件）
- [ ] 文件上传（大文件 > 100MB）
- [ ] 文件下载
- [ ] 文件删除
- [ ] 切换公开/私有
- [ ] 查看公开文件
- [ ] 移动端适配
- [ ] 不同浏览器兼容性

## 文档贡献

文档同样重要！欢迎改进：

- README.md - 项目介绍
- QUICKSTART.md - 快速开始
- USAGE.md - 使用手册
- DEPLOYMENT.md - 部署指南
- API 文档
- 代码注释

## 社区准则

### 行为准则

- 尊重他人
- 建设性的反馈
- 包容不同观点
- 专注于改进项目

### 沟通方式

- Issue 讨论功能和 bug
- Pull Request 讨论代码
- 使用清晰、友好的语言
- 及时回复评论

## 许可证

提交代码即表示您同意将贡献以 MIT 许可证发布。

## 联系方式

- GitHub Issues: [项目 Issues 页面](../../issues)
- Pull Requests: [项目 PR 页面](../../pulls)

---

**感谢您的贡献！** ⚫⚪

每一个贡献都让太极文件传输系统变得更好。

