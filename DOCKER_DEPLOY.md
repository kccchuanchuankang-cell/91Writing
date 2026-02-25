# AI 写作 - Docker 部署指南

本项目现在支持使用 **统一的全栈 Docker 镜像** 进行部署。这意味着前端页面和后端服务将被打包在同一个镜像中，只需一个命令即可启动。

## 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0

## 快速启动（推荐）

使用 Docker Compose 是最简单的方法，它会自动处理端口映射和数据持久化。

```bash
# 构建并启动（包含前端构建和后端启动）
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

服务启动后，可以通过 `http://localhost:3001` 访问完整应用。

## 数据持久化

为了防止容器重启或更新导致数据丢失，我们配置了挂载卷（Volumes）：

- **数据库路径**：容器内的 `/app/data` 映射到宿主机的 `./data` 文件夹。
- **持久化内容**：包含所有小说、章节、提示词配置、计费信息以及系统设置。

> [!IMPORTANT]
> 请定期备份宿主机的 `./data` 文件夹以确保数据安全。

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
 