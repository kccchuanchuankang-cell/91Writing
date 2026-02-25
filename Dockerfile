# 多阶段构建 Dockerfile

# --- 阶段 1: 基础环境 ---
FROM node:18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml ./

# --- 阶段 2: 开发环境 (仅前端开发服务器) ---
FROM base AS development
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# --- 阶段 3: 构建阶段 (编译前端静态文件) ---
FROM base AS builder
RUN pnpm install
COPY . .
RUN pnpm build

# --- 阶段 4: 生产环境 (全栈 Node.js 运行镜像) ---
FROM node:18-alpine AS production
WORKDIR /app

# 安装必要工具
RUN apk add --no-cache curl && npm install -g pnpm

# 复制后端代码和依赖
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/

# 从构建阶段复制前端产物
COPY --from=builder /app/dist ./server/dist

# 配置持久化与环境变量
RUN mkdir -p /app/data
ENV DATABASE_URL="file:/app/data/dev.db"
ENV NODE_ENV=production
ENV PORT=3001

# 初始化 Prisma
WORKDIR /app/server
RUN npx prisma generate

EXPOSE 3001

# 启动全栈服务
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]