# 使用 Node.js 官方镜像
FROM node:18-alpine

# 安装构建工具（用于编译 native 模块）
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建必要的目录
RUN mkdir -p uploads/chunks uploads/files uploads/thumbs data

# 暴露端口
EXPOSE 5000

# 启动应用
CMD ["npm", "start"]
