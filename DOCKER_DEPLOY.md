# AI 写作 - Docker 部署指南

本项目现在支持使用 **统一的全栈 Docker 镜像** 进行部署。这意味着前端页面和后端服务将被打包在同一个镜像中，只需一个命令即可启动。

## 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0

## 快速启动

本项目支持两种运行模式：**开发模式**（支持前端热重载）和 **生产模式**（全栈打包）。

### 1. 开发模式 (Development)
适用于修改代码并实时查看效果。

```bash
# 启动开发环境 (前端: 3000, 后端: 3001)
docker-compose --profile dev up -d

# 查看日志
docker-compose --profile dev logs -f

# 停止并删除开发容器
docker-compose --profile dev down
```

### 2. 生产模式 (Production)
适用于稳定运行，前端将被打包进后端服务器中。

```bash
# 构建并启动应用 (仅需暴露 8100 端口)
docker-compose --profile prod up -d --build

# 查看日志
docker-compose --profile prod logs -f

# 停止并删除生产容器
docker-compose --profile prod down
```

## 数据持久化

无论使用何种模式，您的数据都存储在宿主机的 `./data` 文件夹中。

- **数据库路径**：容器内的 `/app/data` 映射到 `./data`。
- **持久化内容**：小说、配置、计费信息等。

## 详细配置


### 单独使用 Docker 运行

如果您不想使用 docker-compose，也可以直接操作：

```bash
# 1. 构建镜像
docker build -t ai-writing:latest .

# 2. 运行容器（映射端口并挂载数据目录）
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  --name ai-writing-app \
  ai-writing:latest
```

### 环境变量

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `3001` | 服务运行端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `JWT_SECRET` | `your-secret-key` | JWT 加密密钥（建议修改） |
| `DATABASE_URL` | `file:/app/data/dev.db` | SQLite 数据库文件路径 |

## 常见问题

1. **无法访问网页**
   - 检查容器是否正常启动：`docker ps`
   - 检查端口 3001 是否被占用：`netstat -ano | findstr :3001`

2. **数据未保存**
   - 确保宿主机有写入 `./data` 目录的权限。
   - 检查 `docker-compose.yml` 中的 `volumes` 配置是否正确。
 