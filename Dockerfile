# 多阶段构建 Dockerfile - 统一全栈版本

# 阶段1: 构建前端
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

# 阶段2: 最终运行镜像
FROM node:18-alpine
WORKDIR /app

# 安装 pnpm 和 curl (用于健康检查)
RUN apk add --no-cache curl && npm install -g pnpm

# 复制后端代码和依赖
COPY server/package*.json ./server/
RUN cd server && npm install

COPY server/ ./server/

# 复制前端编译产物到后端托管目录
COPY --from=frontend-builder /app/dist ./server/dist

# 配置数据库持久化路径
RUN mkdir -p /app/data
# 默认指向持久化目录
ENV DATABASE_URL="file:/app/data/dev.db"
ENV NODE_ENV=production
ENV PORT=3001

# 生成 Prisma 客户端并初始化数据库
WORKDIR /app/server
RUN npx prisma generate

# 暴露端口
EXPOSE 3001

# 启动脚本：确保运行迁移并启动服务器
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]