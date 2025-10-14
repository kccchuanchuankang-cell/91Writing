import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { UniversalAgent } from './src/universal-agent.js';
import { ToolRegistry } from './src/tool-registry.js';
import { ProjectManager } from './src/project-manager.js';
import { ContextManager } from './src/context-manager.js';
import { ConversationManager } from './src/conversation-manager.js';
import { ProjectContextInjector } from './src/project-context-injector.js';
import logger from './src/logger.js';  // 🔥 导入日志系统

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 🔥 全局存储：追踪每个项目的运行状态
const runningTasks = new Map(); // key: projectName, value: { shouldStop: boolean, startTime: number }
const server = createServer(app);

// 中间件
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// 🔥 处理客户端断开连接
app.use((req, res, next) => {
    req.on('close', () => {
        if (!req.complete) {
            console.log(`⚠️ 客户端断开连接: ${req.method} ${req.url}`);
        }
    });
    next();
});

// ==================== API 路由 ====================

/**
 * 获取所有项目列表
 */
app.get('/api/projects', (req, res) => {
    try {
        const projectsDir = './product';
        if (!fs.existsSync(projectsDir)) {
            fs.mkdirSync(projectsDir, { recursive: true });
        }
        
        const projects = fs.readdirSync(projectsDir)
            .filter(name => {
                const stat = fs.statSync(join(projectsDir, name));
                return stat.isDirectory();
            })
            .map(name => {
                const configPath = join(projectsDir, name, 'project-config.json');
                let config = { projectName: name };
                
                if (fs.existsSync(configPath)) {
                    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                }
                
                return {
                    name,
                    ...config
                };
            });
        
        res.json({ success: true, projects });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建新项目
 */
app.post('/api/projects', async (req, res) => {
    try {
        const { name } = req.body;
        const projectManager = new ProjectManager(name);
        await projectManager.initProject();
        
        res.json({ success: true, message: `项目 "${name}" 创建成功` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取项目的所有文件夹和根目录文件
 */
app.get('/api/projects/:name/folders', (req, res) => {
    try {
        const { name } = req.params;
        const projectDir = join('./product', name);
        
        if (!fs.existsSync(projectDir)) {
            return res.json({ success: true, folders: [], rootFiles: [] });
        }
        
        const items = fs.readdirSync(projectDir);
        
        // 处理根目录文件
        let rootFiles = items
            .filter(item => {
                const itemPath = join(projectDir, item);
                const stat = fs.statSync(itemPath);
                const name = item.toLowerCase();
                return stat.isFile() && 
                       name.endsWith('.md') && 
                       !name.includes('.backup-') && 
                       !name.includes('.revision-history') &&
                       !name.startsWith('.');
            })
            .map(filename => {
                const filePath = join(projectDir, filename);
                const stats = fs.statSync(filePath);
                
                // 显示完整文件名（包括后缀）
                const title = filename;
                
                return {
                    filename,
                    title,
                    modified: stats.mtime
                };
            });
        
        // 按文件名排序（VSCode 方式）
        rootFiles.sort((a, b) => a.filename.localeCompare(b.filename, 'zh-CN', { numeric: true, sensitivity: 'base' }));
        
        // 处理文件夹
        const folders = items
            .filter(item => {
                const itemPath = join(projectDir, item);
                const stat = fs.statSync(itemPath);
                return stat.isDirectory() && 
                       !item.startsWith('.') && 
                       item !== 'node_modules';
            })
            .map(folderName => {
                const folderPath = join(projectDir, folderName);
                const stats = fs.statSync(folderPath);
                
                let fileCount = 0;
                try {
                    const files = fs.readdirSync(folderPath);
                    fileCount = files.filter(f => {
                        const name = f.toLowerCase();
                        return name.endsWith('.md') && 
                               !name.includes('.backup-') && 
                               !name.includes('.revision-history');
                    }).length;
                } catch (err) {
                    fileCount = 0;
                }
                
                return {
                    name: folderName,
                    fileCount,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => {
                const order = ['章节内容', '人物设定', '世界观设定'];
                const aIndex = order.indexOf(a.name);
                const bIndex = order.indexOf(b.name);
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.name.localeCompare(b.name, 'zh-CN');
            });
        
        res.json({ success: true, folders, rootFiles });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取根目录文件内容
 */
app.get('/api/projects/:name/root-files/:filename', (req, res) => {
    try {
        const { name, filename } = req.params;
        const filePath = join('./product', name, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, content });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 保存根目录文件内容
 */
app.put('/api/projects/:name/root-files/:filename', (req, res) => {
    try {
        const { name, filename } = req.params;
        const { content } = req.body;
        
        if (!content && content !== '') {
            return res.status(400).json({ success: false, error: '缺少文件内容' });
        }
        
        const filePath = join('./product', name, filename);
        fs.writeFileSync(filePath, content, 'utf8');
        
        res.json({ success: true, message: '保存成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建新文件夹
 */
app.post('/api/projects/:name/folders', (req, res) => {
    try {
        const { name } = req.params;
        const { folderName, parentFolder } = req.body;
        
        if (!folderName) {
            return res.status(400).json({ success: false, error: '缺少文件夹名称' });
        }
        
        const folderPath = parentFolder 
            ? join('./product', name, parentFolder, folderName)
            : join('./product', name, folderName);
        
        if (fs.existsSync(folderPath)) {
            return res.status(400).json({ success: false, error: '文件夹已存在' });
        }
        
        fs.mkdirSync(folderPath, { recursive: true });
        res.json({ success: true, message: '文件夹创建成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建新文件
 */
app.post('/api/projects/:name/files', (req, res) => {
    try {
        const { name } = req.params;
        const { fileName, folderName, content } = req.body;
        
        if (!fileName) {
            return res.status(400).json({ success: false, error: '缺少文件名称' });
        }
        
        // 确保文件名以 .md 结尾
        const fullFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
        
        const filePath = folderName 
            ? join('./product', name, folderName, fullFileName)
            : join('./product', name, fullFileName);
        
        if (fs.existsSync(filePath)) {
            return res.status(400).json({ success: false, error: '文件已存在' });
        }
        
        // 创建默认内容
        const defaultContent = content || `# ${fileName}\n\n创建于 ${new Date().toLocaleString()}`;
        fs.writeFileSync(filePath, defaultContent, 'utf8');
        
        res.json({ success: true, message: '文件创建成功', fileName: fullFileName });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除文件或文件夹
 */
app.delete('/api/projects/:name/items', (req, res) => {
    try {
        const { name } = req.params;
        const { itemPath, isFolder } = req.body;
        
        if (!itemPath) {
            return res.status(400).json({ success: false, error: '缺少路径' });
        }
        
        const fullPath = join('./product', name, itemPath);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ success: false, error: '文件或文件夹不存在' });
        }
        
        if (isFolder) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(fullPath);
        }
        
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 移动文件到另一个文件夹
 */
app.put('/api/projects/:name/items/move', (req, res) => {
    try {
        const { name } = req.params;
        const { sourcePath, targetFolder } = req.body;
        
        if (!sourcePath) {
            return res.status(400).json({ success: false, error: '缺少源路径' });
        }
        
        const sourceFullPath = join('./product', name, sourcePath);
        
        if (!fs.existsSync(sourceFullPath)) {
            return res.status(404).json({ success: false, error: '源文件不存在' });
        }
        
        // 提取文件名
        const filename = path.basename(sourcePath);
        
        // 构建目标路径
        const targetPath = targetFolder 
            ? join('./product', name, targetFolder, filename)
            : join('./product', name, filename);
        
        if (fs.existsSync(targetPath)) {
            return res.status(400).json({ success: false, error: '目标位置已存在同名文件' });
        }
        
        // 确保目标文件夹存在
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // 移动文件
        fs.renameSync(sourceFullPath, targetPath);
        
        res.json({ success: true, message: '文件移动成功', newPath: targetFolder ? `${targetFolder}/${filename}` : filename });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 重命名文件或文件夹
 */
app.put('/api/projects/:name/items/rename', (req, res) => {
    try {
        const { name } = req.params;
        const { oldPath, newName, isFolder } = req.body;
        
        if (!oldPath || !newName) {
            return res.status(400).json({ success: false, error: '缺少参数' });
        }
        
        const oldFullPath = join('./product', name, oldPath);
        
        if (!fs.existsSync(oldFullPath)) {
            return res.status(404).json({ success: false, error: '文件或文件夹不存在' });
        }
        
        // 构建新路径 - 统一处理路径分隔符（支持 / 和 \）
        const normalizedOldPath = oldPath.replace(/\\/g, '/');
        const pathParts = normalizedOldPath.split('/');
        pathParts[pathParts.length - 1] = isFolder ? newName : (newName.endsWith('.md') ? newName : `${newName}.md`);
        const newPath = pathParts.join('/');
        const newFullPath = join('./product', name, newPath);
        
        console.log('重命名服务器端调试:', {
            oldPath,
            normalizedOldPath,
            newName,
            isFolder,
            pathParts,
            newPath,
            oldFullPath,
            newFullPath
        });
        
        if (fs.existsSync(newFullPath)) {
            return res.status(400).json({ success: false, error: '目标名称已存在' });
        }
        
        fs.renameSync(oldFullPath, newFullPath);
        res.json({ success: true, message: '重命名成功', newPath });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取项目概览
 */
app.get('/api/projects/:name/overview', async (req, res) => {
    try {
        const { name } = req.params;
        const projectManager = new ProjectManager(name);
        const contextManager = new ContextManager(projectManager);
        
        const overview = await contextManager.getContentOverview();
        
        res.json({ success: true, overview });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取项目文件树
 */
app.get('/api/projects/:name/file-tree', (req, res) => {
    try {
        const { name } = req.params;
        const projectManager = new ProjectManager(name);
        const tree = projectManager.getFileTree();
        
        res.json({ success: true, tree });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建文件夹
 */
app.post('/api/projects/:name/folders', (req, res) => {
    try {
        const { name } = req.params;
        const { path: folderPath } = req.body;
        
        const projectManager = new ProjectManager(name);
        const created = projectManager.createFolder(folderPath);
        
        if (created) {
            res.json({ success: true, message: '文件夹创建成功' });
        } else {
            res.json({ success: false, error: '文件夹已存在' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除文件夹
 */
app.delete('/api/projects/:name/folders', (req, res) => {
    try {
        const { name } = req.params;
        const { path: folderPath } = req.body;
        
        const projectManager = new ProjectManager(name);
        const deleted = projectManager.deleteFolder(folderPath);
        
        if (deleted) {
            res.json({ success: true, message: '文件夹删除成功' });
        } else {
            res.json({ success: false, error: '文件夹不存在' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 重命名文件夹
 */
app.put('/api/projects/:name/folders', (req, res) => {
    try {
        const { name } = req.params;
        const { oldPath, newPath } = req.body;
        
        const projectManager = new ProjectManager(name);
        const renamed = projectManager.renameFolder(oldPath, newPath);
        
        if (renamed) {
            res.json({ success: true, message: '文件夹重命名成功' });
        } else {
            res.json({ success: false, error: '文件夹不存在' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 读取任意路径的文件（新API）
 */
app.post('/api/projects/:name/files/read', (req, res) => {
    try {
        const { name } = req.params;
        const { path: filePath } = req.body;
        
        const fullPath = join('./product', name, filePath);
        
        if (!fs.existsSync(fullPath)) {
            return res.json({ success: false, error: '文件不存在' });
        }
        
        const content = fs.readFileSync(fullPath, 'utf8');
        res.json({ success: true, content });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 创建任意路径的文件（新API）
 */
app.post('/api/projects/:name/files/create', (req, res) => {
    try {
        const { name } = req.params;
        const { path: filePath, content = '' } = req.body;
        
        const fullPath = join('./product', name, filePath);
        const dirPath = path.dirname(fullPath);
        
        // 确保父目录存在
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // 检查文件是否已存在
        if (fs.existsSync(fullPath)) {
            return res.json({ success: false, error: '文件已存在' });
        }
        
        fs.writeFileSync(fullPath, content, 'utf8');
        res.json({ success: true, message: '文件创建成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 保存任意路径的文件（新API）
 */
app.post('/api/projects/:name/files/save', (req, res) => {
    try {
        const { name } = req.params;
        const { path: filePath, content } = req.body;
        
        const fullPath = join('./product', name, filePath);
        
        if (!fs.existsSync(fullPath)) {
            return res.json({ success: false, error: '文件不存在' });
        }
        
        fs.writeFileSync(fullPath, content, 'utf8');
        res.json({ success: true, message: '文件保存成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除任意路径的文件（新API）
 */
app.delete('/api/projects/:name/files', (req, res) => {
    try {
        const { name } = req.params;
        const { path: filePath } = req.body;
        
        const fullPath = join('./product', name, filePath);
        
        if (!fs.existsSync(fullPath)) {
            return res.json({ success: false, error: '文件不存在' });
        }
        
        fs.unlinkSync(fullPath);
        res.json({ success: true, message: '文件删除成功' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取文件列表（兼容旧API）
 */
app.get('/api/projects/:name/files/:type', (req, res) => {
    try {
        const { name, type } = req.params;
        const typeDir = join('./product', name, type);
        
        if (!fs.existsSync(typeDir)) {
            return res.json({ success: true, files: [] });
        }
        
        let files = fs.readdirSync(typeDir)
            .filter(f => f.endsWith('.md') && f !== 'index.md')
            .map(file => {
                const filePath = join(typeDir, file);
                const stats = fs.statSync(filePath);
                // 显示完整文件名（包括后缀）
                const title = file;
                
                return {
                    filename: file,
                    title,
                    size: stats.size,
                    modified: stats.mtime
                };
            });
        
        // 按文件名排序（VSCode 方式）
        files.sort((a, b) => a.filename.localeCompare(b.filename, 'zh-CN', { numeric: true, sensitivity: 'base' }));
        
        res.json({ success: true, files });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 读取文件内容
 */
app.get('/api/projects/:name/files/:type/:filename', (req, res) => {
    try {
        const { name, type, filename } = req.params;
        const filePath = join('./product', name, type, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, content });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 保存文件内容
 */
app.put('/api/projects/:name/files/:type/:filename', (req, res) => {
    try {
        const { name, type, filename } = req.params;
        const { content } = req.body;
        
        if (!content && content !== '') {
            return res.status(400).json({ success: false, error: '缺少文件内容' });
        }
        
        const typeDir = join('./product', name, type);
        const filePath = join(typeDir, filename);
        
        // 确保目录存在
        if (!fs.existsSync(typeDir)) {
            fs.mkdirSync(typeDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ success: true, message: '文件已保存' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 🗑️ 删除文件
 */
app.delete('/api/projects/:name/files/:type/:filename', (req, res) => {
    try {
        const { name, type, filename } = req.params;
        const filePath = join('./product', name, type, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: '文件不存在' });
        }
        
        fs.unlinkSync(filePath);
        res.json({ success: true, message: '文件已删除' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 🔥 停止正在运行的 Agent 任务
 */
app.post('/api/projects/:name/stop', (req, res) => {
    const { name } = req.params;
    
    if (runningTasks.has(name)) {
        runningTasks.get(name).shouldStop = true;
        console.log(`🛑 [${name}] 收到停止请求，设置 shouldStop=true`);
        res.json({ success: true, message: 'Agent 停止信号已发送' });
    } else {
        console.log(`⚠️ [${name}] 没有正在运行的任务`);
        res.json({ success: false, message: '没有正在运行的任务' });
    }
});

/**
 * ✅ 使用真正的 Agent 进行创作（流式输出）
 */
app.post('/api/projects/:name/generate', async (req, res) => {
    try {
        const { name } = req.params;
        const { prompt, originalMessage } = req.body;  // 🔥 接收原始消息（用于保存到历史）
        
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
        
        console.log(`📡 [${name}] 开始流式响应，客户端 IP: ${req.ip}`);
        
        // 🔥 注册运行中的任务
        runningTasks.set(name, { shouldStop: false, startTime: Date.now() });
        let dataSentCount = 0;
        
        // 追踪数据发送（简化日志）
        const originalWrite = res.write.bind(res);
        res.write = function(...args) {
            dataSentCount++;
            return originalWrite(...args);
        };
        
        // 🔥 立即发送连接建立信号（JSON格式，前端可以识别）
        res.write(`data: ${JSON.stringify({ type: 'connected', data: '连接已建立' })}\n\n`);
        
        // 🔥 设置定期心跳，防止连接超时（每10秒发送一次）
        const heartbeatInterval = setInterval(() => {
            try {
                if (!res.writableEnded) {
                    res.write(`: heartbeat\n\n`);
                } else {
                    clearInterval(heartbeatInterval);
                }
            } catch (e) {
                clearInterval(heartbeatInterval);
            }
        }, 10000);
        
        // 🔥 清理心跳定时器
        res.on('close', () => {
            clearInterval(heartbeatInterval);
        });
        
        // 🔥 发送初始化开始信号
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在初始化...' })}\n\n`);
        
        // 初始化项目
        const projectManager = new ProjectManager(name);
        const contextManager = new ContextManager(projectManager);
        const conversationManager = new ConversationManager(name);
        
        // 🔥 初始化项目上下文注入器（像 Cursor 一样）
        const contextInjector = new ProjectContextInjector(name);
        
        // 初始化 LLM
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在加载Agent配置...' })}\n\n`);
        
        // 🔥 使用新的通用Agent系统
        const toolRegistry = new ToolRegistry();
        
        // 设置当前项目环境变量（供工具使用）
        process.env.CURRENT_PROJECT = name;
        
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在初始化 AI Agent...' })}\n\n`);
        
        // ✅ 初始化通用Agent（从配置文件加载）
        const agent = new UniversalAgent({
            configName: 'novel-writing',  // 使用小说创作配置
            toolRegistry: toolRegistry,
            apiKey: process.env.API_KEY,
            baseURL: process.env.API_BASE_URL,
            model: process.env.MODEL_NAME || 'gpt-4',
            verbose: true
        });
        
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在加载配置和工具...' })}\n\n`);
        
        // 从配置文件初始化Agent和工具
        await agent.initializeFromConfig();
        await agent.registerTools();
        
        // 🔥 第一步：注入项目结构上下文（像 Cursor 一样）
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在扫描项目结构...' })}\n\n`);
        const projectContext = contextInjector.generateCompactContext();
        const smartHints = contextInjector.generateSmartHints();
        
        // 构建项目结构文本
        let contextText = '';
        if (projectContext.hasFiles) {
            contextText = contextInjector.generateContextText();
            
            // 添加智能提示
            if (smartHints.hints.length > 0) {
                contextText += `\n\n💡 系统提示：\n${smartHints.hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}`;
            }
            
            console.log(`✅ 已注入项目上下文：${projectContext.totalFiles} 个文件`);
        } else {
            console.log(`📭 空白项目，无需注入文件结构`);
        }
        
        // 🔥 第二步：构建结构化的对话上下文（OpenAI 消息格式）
        const structuredMessages = conversationManager.buildStructuredContext(
            contextText ? `${contextText}\n\n${prompt}` : prompt,
            10  // 使用最近 10 条对话
        );
        
        console.log(`📚 对话上下文：${structuredMessages.length - 1} 条历史消息`);
        
        // 用于显示的增强提示（旧格式，保留用于日志）
        const enhancedPrompt = conversationManager.buildEnhancedPrompt(prompt, 10);
        
        // 🔥 保存用户原始消息到文件（不包含系统生成的文件引用提示）
        const messageToSave = originalMessage || prompt;  // 优先使用原始消息，回退到完整提示
        conversationManager.addMessage('user', messageToSave);
        
        // 发送开始信号
        res.write(`data: ${JSON.stringify({ type: 'start', data: '🤖 Agent 开始工作...' })}\n\n`);
        
        // ✅ 调用 Agent（真正的 ReAct 循环，带进度回调）
        try {
            // 用于累积完整的推理过程（结构化保存）
            let reasoningSteps = [];  // 结构化的推理步骤数组
            let currentStepIndex = 0;  // 当前步骤索引
            let currentStepContent = '';  // 当前步骤的累积内容
            let fullThinkingProcess = '';  // 兼容旧代码
            let currentIteration = 0;
            
            // 🔥 使用结构化的对话历史，而不是纯文本
            const result = await agent.run(structuredMessages, (progress) => {
                // 🔥 检查任务是否被停止
                const taskStatus = runningTasks.get(name);
                if (taskStatus && taskStatus.shouldStop) {
                    throw new Error('Task stopped by user');
                }
                
                // 🔥 区分不同类型的进度，分别发送
                if (progress.type === 'iteration') {
                    currentIteration = progress.iteration;
                    
                    // 保存上一个步骤（如果存在）
                    if (currentStepIndex > 0 && currentStepContent) {
                        reasoningSteps.push({
                            index: currentStepIndex,
                            title: currentStepIndex === 1 ? '初始分析' : `第 ${currentStepIndex} 轮推理`,
                            content: currentStepContent,
                            iteration: currentStepIndex
                        });
                        console.log(`💾 [后端] 保存第 ${currentStepIndex} 轮推理，内容长度: ${currentStepContent.length} 字符`);
                        
                        // 🔥 立即写入文件，避免丢失进度
                        conversationManager.updateInProgressMessage('assistant', `推理进行中...（已完成 ${currentStepIndex} 轮）`, {
                            reasoningSteps: reasoningSteps,
                            iterations: currentStepIndex,
                            totalSteps: reasoningSteps.length,
                            inProgress: true
                        });
                        console.log(`💾 [后端] 已实时保存到文件，当前进度: ${currentStepIndex} 轮`);
                    }
                    
                    // 开始新步骤
                    currentStepIndex++;
                    currentStepContent = '';
                    
                    // 发送新的迭代开始信号（前端可以创建新的区域）
                    res.write(`data: ${JSON.stringify({ 
                        type: 'iteration_start', 
                        iteration: currentIteration,
                        message: progress.message 
                    })}\n\n`);
                    fullThinkingProcess += `\n${'='.repeat(50)}\n${progress.message}\n${'='.repeat(50)}\n`;
                } else if (progress.type === 'llm_stream') {
                    // 🔥 LLM 流式输出：实时发送当前轮的思考
                    res.write(`data: ${JSON.stringify({ 
                        type: 'llm_stream', 
                        iteration: currentIteration,
                        data: progress.message 
                    })}\n\n`);
                    
                    // 同时累积到完整历史（旧格式，兼容用）
                    const beforeLLM = fullThinkingProcess.split('\n---LLM输出---\n')[0];
                    fullThinkingProcess = beforeLLM + '\n---LLM输出---\n' + progress.message;
                    
                    // 🔥 重要：也要累积到当前步骤内容（新格式，结构化保存）
                    const beforeLLMStep = currentStepContent.split('\n---LLM输出---\n')[0];
                    currentStepContent = beforeLLMStep + '\n---LLM输出---\n' + progress.message;
                } else if (progress.type === 'thought') {
                    const thoughtText = `\n💭 思考: ${progress.message}\n`;
                    fullThinkingProcess += thoughtText;
                    currentStepContent += thoughtText;  // 累积到当前步骤
                    res.write(`data: ${JSON.stringify({ type: 'progress', data: fullThinkingProcess })}\n\n`);
                } else if (progress.type === 'action') {
                    // 🔥 将工具名称转换为用户友好的描述
                    const actionName = progress.action;
                    const actionMap = {
                        'generate_long_content': '✍️ 正在创作',
                        'save_file': '💾 正在保存文件',
                        'read_file': '📖 正在读取',
                        'list_files': '📂 正在查看文件列表',
                        'update_file': '✏️ 正在修改文件',
                        'append_to_file': '➕ 正在追加内容',
                        'move_file': '🔄 正在移动文件',
                        'view_revision_history': '📜 正在查看修改历史'
                    };
                    const friendlyAction = actionMap[actionName] || `🔧 ${actionName}`;
                    
                    // 🔥 格式化输入参数，提取关键信息
                    let inputDisplay = '';
                    try {
                        let inputObj = progress.input;
                        if (typeof inputObj === 'string') {
                            try {
                                inputObj = JSON.parse(inputObj);
                            } catch (e) {
                                inputObj = { raw: inputObj };
                            }
                        }
                        
                        if (actionName === 'generate_long_content' || actionName === 'save_file') {
                            inputDisplay = `《${inputObj.title || '未命名'}》（${inputObj.type || ''}）`;
                        } else if (actionName === 'read_file' || actionName === 'update_file') {
                            inputDisplay = `《${inputObj.filename || inputObj.title || ''}》（${inputObj.type || ''}）`;
                        } else if (actionName === 'list_files') {
                            inputDisplay = `${inputObj.type || '全部'} 文件夹`;
                        } else {
                            inputDisplay = JSON.stringify(inputObj, null, 2).substring(0, 200);
                        }
                    } catch (e) {
                        inputDisplay = String(progress.input).substring(0, 200);
                    }
                    
                    const actionText = `\n${friendlyAction}: ${inputDisplay}\n`;
                    fullThinkingProcess += actionText;
                    currentStepContent += actionText;  // 累积到当前步骤
                    res.write(`data: ${JSON.stringify({ type: 'progress', data: fullThinkingProcess })}\n\n`);
                    
                    // 🔥 检测 update_file 工具调用：读取文件旧内容
                    if (progress.action === 'update_file') {
                        try {
                            let inputParams;
                            if (typeof progress.input === 'string') {
                                try {
                                    inputParams = JSON.parse(progress.input);
                                } catch (parseError) {
                                    console.error('❌ server.js JSON 解析失败:', parseError.message);
                                    inputParams = progress.input; // 如果解析失败，尝试直接使用
                                }
                            } else {
                                inputParams = progress.input;
                            }
                            const { type, filename, revision_note } = inputParams;
                            
                            // 读取文件当前内容（作为 oldContent）
                            const filePath = join('./product', name, type, filename);
                            if (fs.existsSync(filePath)) {
                                const oldContent = fs.readFileSync(filePath, 'utf8');
                                
                                // 保存到临时变量，等待工具执行完毕后读取新内容
                                res.locals = res.locals || {};
                                res.locals.pendingFileUpdate = {
                                    type,
                                    filename,
                                    oldContent,
                                    revisionNote: revision_note || ''
                                };
                            }
                        } catch (error) {
                            console.error('读取文件旧内容失败:', error.message);
                        }
                    }
                } else if (progress.type === 'observation') {
                    const observationText = `\n✅ 结果: ${progress.message}\n`;
                    fullThinkingProcess += observationText;
                    currentStepContent += observationText;  // 累积到当前步骤
                    res.write(`data: ${JSON.stringify({ type: 'progress', data: fullThinkingProcess })}\n\n`);
                    
                    // 🔥 如果刚刚调用了 update_file，现在发送 diff 事件
                    if (res.locals && res.locals.pendingFileUpdate) {
                        try {
                            const { type, filename, oldContent, revisionNote } = res.locals.pendingFileUpdate;
                            const filePath = join('./product', name, type, filename);
                            
                            if (fs.existsSync(filePath)) {
                                const newContent = fs.readFileSync(filePath, 'utf8');
                                
                                // 发送 diff 事件给前端（而不是直接应用）
                                res.write(`data: ${JSON.stringify({
                                    type: 'diff',
                                    data: {
                                        type,
                                        filename,
                                        oldContent,
                                        newContent,
                                        revisionNote: revisionNote || '文件已更新'
                                    }
                                })}\n\n`);
                                
                                console.log(`📝 发送 diff 预览: ${type}/${filename}`);
                            }
                        } catch (error) {
                            console.error('发送diff事件失败:', error.message);
                        } finally {
                            // 清除临时变量
                            delete res.locals.pendingFileUpdate;
                        }
                    }
                }
            });
            
            // 🔥 无论成功还是失败，都保存最后一个步骤
            if (currentStepIndex > 0 && currentStepContent) {
                reasoningSteps.push({
                    index: currentStepIndex,
                    title: currentStepIndex === 1 ? '初始分析' : `第 ${currentStepIndex} 轮推理`,
                    content: currentStepContent,
                    iteration: currentStepIndex
                });
                console.log(`💾 [后端] 保存最后一个步骤: 第 ${currentStepIndex} 轮`);
            }
            
            if (result.success) {
                // 🔥 完成"进行中"的消息（而不是添加新消息）
                conversationManager.finalizeInProgressMessage(result.answer, {
                    reasoningSteps: reasoningSteps,  // 结构化的推理步骤数组
                    iterations: result.iterations,
                    totalSteps: reasoningSteps.length,
                    completed: true
                });
                
                console.log(`✅ [后端] 对话已保存（成功完成），共 ${reasoningSteps.length} 个推理步骤`);
                
                res.write(`data: ${JSON.stringify({ type: 'content', data: result.answer })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            } else {
                // 🔥 判断是否为达到最大推理次数
                if (result.reachedMaxIterations) {
                    // 🔥 完成"进行中"的消息
                    conversationManager.finalizeInProgressMessage(result.message, {
                        reasoningSteps: reasoningSteps,
                        iterations: result.iterations,
                        totalSteps: reasoningSteps.length,
                        reachedMaxIterations: true  // 标记为达到限制
                    });
                    
                    console.log(`⚠️ [${name}] 达到最大推理次数：${result.iterations} 轮`);
                    console.log(`✅ [后端] 对话已保存（达到限制），共 ${reasoningSteps.length} 个推理步骤`);
                    
                    res.write(`data: ${JSON.stringify({ 
                        type: 'max_iterations', 
                        data: result.message,
                        iterations: result.iterations 
                    })}\n\n`);
                    // 🔥 仍然发送 done 信号，让 UI 恢复正常
                    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
                } else {
                    // 🔥 真正的错误，也保存推理进度（如果有的话）
                    const errorMessage = result.error || '执行出错';
                    
                    if (reasoningSteps.length > 0) {
                        conversationManager.finalizeInProgressMessage(`执行出错: ${errorMessage}`, {
                            reasoningSteps: reasoningSteps,
                            iterations: result.iterations || 0,
                            totalSteps: reasoningSteps.length,
                            error: true  // 标记为错误
                        });
                        console.log(`✅ [后端] 对话已保存（错误），共 ${reasoningSteps.length} 个推理步骤`);
                    }
                    
                    res.write(`data: ${JSON.stringify({ type: 'error', data: errorMessage })}\n\n`);
                }
            }
        } catch (error) {
            // 🔥 保存最后一个步骤（如果有）
            if (currentStepIndex > 0 && currentStepContent && !reasoningSteps.find(s => s.index === currentStepIndex)) {
                reasoningSteps.push({
                    index: currentStepIndex,
                    title: currentStepIndex === 1 ? '初始分析' : `第 ${currentStepIndex} 轮推理`,
                    content: currentStepContent,
                    iteration: currentStepIndex
                });
                console.log(`💾 [后端] 异常时保存最后步骤: 第 ${currentStepIndex} 轮`);
            }
            
            // 🔥 如果是用户停止任务，不记录为错误
            if (error.message === 'Task stopped by user') {
                // 🔥 用户停止时，完成"进行中"的消息
                if (reasoningSteps.length > 0) {
                    conversationManager.finalizeInProgressMessage('（任务已被用户停止）', {
                        reasoningSteps: reasoningSteps,
                        iterations: currentIteration || 0,
                        totalSteps: reasoningSteps.length,
                        userStopped: true  // 标记为用户停止
                    });
                    console.log(`✅ [后端] 对话已保存（用户停止），共 ${reasoningSteps.length} 个推理步骤`);
                }
                
                console.log(`🛑 [${name}] Agent 执行已停止（用户主动停止）`);
                res.write(`data: ${JSON.stringify({ type: 'stopped', data: '已停止' })}\n\n`);
            } else {
                // 🔥 其他错误，也保存推理进度
                if (reasoningSteps.length > 0) {
                    conversationManager.finalizeInProgressMessage(`执行异常: ${error.message}`, {
                        reasoningSteps: reasoningSteps,
                        iterations: currentIteration || 0,
                        totalSteps: reasoningSteps.length,
                        exception: true  // 标记为异常
                    });
                    console.log(`✅ [后端] 对话已保存（异常），共 ${reasoningSteps.length} 个推理步骤`);
                }
                
                console.error(`❌ [${name}] Agent 执行错误:`, error.message);
                res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
            }
        } finally {
            // 🔥 清理任务状态和心跳定时器
            runningTasks.delete(name);
            if (typeof heartbeatInterval !== 'undefined') {
                clearInterval(heartbeatInterval);
            }
            // 清理环境变量
            delete process.env.CURRENT_PROJECT;
            console.log(`🏁 [${name}] 响应结束，共发送 ${dataSentCount} 个数据块`);
            res.end();
        }
        
    } catch (error) {
        console.error(`❌ [${req.params.name}] 生成错误:`, error);
        runningTasks.delete(req.params.name);
        
        // 🔥 检查响应是否已经发送
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
        }
        
        // 🔥 安全地发送错误信息
        try {
            res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
            res.end();
        } catch (writeError) {
            console.error(`❌ [${req.params.name}] 无法写入响应:`, writeError.message);
            if (!res.writableEnded) {
                res.end();
            }
        }
    }
});


/**
 * 清空对话历史
 */
app.post('/api/projects/:name/clear-history', (req, res) => {
    try {
        const { name } = req.params;
        const conversationManager = new ConversationManager(name);
        conversationManager.clearHistory();
        res.json({ success: true, message: '对话历史已清空' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取对话历史
 */
app.get('/api/projects/:name/conversation-history', (req, res) => {
    try {
        const { name } = req.params;
        const conversationManager = new ConversationManager(name);
        const history = conversationManager.loadHistory();
        const stats = conversationManager.getStats();
        
        res.json({ 
            success: true, 
            history,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除指定消息
 */
app.delete('/api/projects/:name/conversation-history/:index', (req, res) => {
    try {
        const { name, index } = req.params;
        const conversationManager = new ConversationManager(name);
        const success = conversationManager.deleteMessage(parseInt(index));
        
        if (success) {
            res.json({ success: true, message: '消息已删除' });
        } else {
            res.status(400).json({ success: false, error: '删除失败' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 提示词管理 API ====================

/**
 * 获取项目提示词（创作提示词知识库.md）
 */
app.get('/api/projects/:name/prompts/project', (req, res) => {
    try {
        const { name } = req.params;
        const promptPath = join('./product', name, '创作提示词知识库.md');
        
        if (!fs.existsSync(promptPath)) {
            return res.status(404).json({ 
                success: false, 
                error: '项目提示词文件不存在' 
            });
        }
        
        const content = fs.readFileSync(promptPath, 'utf8');
        res.json({ 
            success: true, 
            content,
            path: promptPath
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新项目提示词
 */
app.put('/api/projects/:name/prompts/project', (req, res) => {
    try {
        const { name } = req.params;
        const { content } = req.body;
        
        if (!content && content !== '') {
            return res.status(400).json({ 
                success: false, 
                error: '内容不能为空' 
            });
        }
        
        const promptPath = join('./product', name, '创作提示词知识库.md');
        
        // 备份原文件
        if (fs.existsSync(promptPath)) {
            const backupPath = promptPath + '.backup';
            fs.copyFileSync(promptPath, backupPath);
        }
        
        fs.writeFileSync(promptPath, content, 'utf8');
        
        res.json({ 
            success: true, 
            message: '项目提示词已更新',
            path: promptPath
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 获取系统提示词（从环境变量或配置文件读取路径）
 */
app.get('/api/prompts/system', (req, res) => {
    try {
        // 🔥 优先使用环境变量，否则使用配置文件
        let promptPath = process.env.SYSTEM_PROMPT_FILE;
        
        if (!promptPath) {
            // 从 agent-config.json 读取
            const configPath = './config/agent-config.json';
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                promptPath = config.agents['novel-writing']?.systemPromptFile || 'prompts/novel-writing-improved.md';
            } else {
                promptPath = 'prompts/novel-writing-improved.md'; // 默认值
            }
        }
        
        const fullPath = join('.', promptPath);
        
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ 
                success: false, 
                error: `系统提示词文件不存在: ${promptPath}` 
            });
        }
        
        const content = fs.readFileSync(fullPath, 'utf8');
        res.json({ 
            success: true, 
            content,
            path: promptPath  // 返回当前使用的文件路径
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 更新系统提示词
 */
app.put('/api/prompts/system', (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content && content !== '') {
            return res.status(400).json({ 
                success: false, 
                error: '内容不能为空' 
            });
        }
        
        // 🔥 使用与读取相同的路径逻辑
        let promptPath = process.env.SYSTEM_PROMPT_FILE;
        
        if (!promptPath) {
            // 从 agent-config.json 读取
            const configPath = './config/agent-config.json';
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                promptPath = config.agents['novel-writing']?.systemPromptFile || 'prompts/novel-writing-improved.md';
            } else {
                promptPath = 'prompts/novel-writing-improved.md'; // 默认值
            }
        }
        
        const fullPath = join('.', promptPath);
        
        // 备份原文件
        if (fs.existsSync(fullPath)) {
            const backupPath = fullPath + '.backup';
            fs.copyFileSync(fullPath, backupPath);
        }
        
        fs.writeFileSync(fullPath, content, 'utf8');
        
        res.json({ 
            success: true, 
            message: `系统提示词已更新: ${promptPath}`,
            path: promptPath
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 删除项目
 */
app.delete('/api/projects/:name', (req, res) => {
    try {
        const { name } = req.params;
        const projectPath = join('./product', name);
        
        if (!fs.existsSync(projectPath)) {
            return res.status(404).json({ success: false, error: '项目不存在' });
        }
        
        // 递归删除整个项目目录
        fs.rmSync(projectPath, { recursive: true, force: true });
        
        res.json({ success: true, message: '项目已删除' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 读取API配置
 */
app.get('/api/config', (req, res) => {
    try {
        const config = {
            apiKey: process.env.API_KEY ? true : false, // 不返回真实key，只返回是否已设置
            realApiKey: process.env.API_KEY || '', // 返回真实的API Key用于显示
            apiBaseUrl: process.env.API_BASE_URL || '',
            modelName: process.env.MODEL_NAME || '',
            temperature: process.env.TEMPERATURE || '',
            maxIterations: process.env.MAX_ITERATIONS || ''
        };
        
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 保存API配置到.env文件
 */
app.put('/api/config', (req, res) => {
    try {
        const { apiKey, apiBaseUrl, modelName, temperature, maxIterations } = req.body;
        
        // 读取现有.env文件或创建新的
        let envContent = '';
        const envPath = '.env';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        // 更新或添加配置项
        const updateEnv = (key, value) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (value && value.trim()) {
                const newLine = `${key}=${value}`;
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, newLine);
                } else {
                    envContent += `\n${newLine}`;
                }
            }
        };
        
        // 只更新提供了值的配置项
        if (apiKey && apiKey !== '••••••••••••••••') {
            updateEnv('API_KEY', apiKey);
        }
        if (apiBaseUrl) updateEnv('API_BASE_URL', apiBaseUrl);
        if (modelName) updateEnv('MODEL_NAME', modelName);
        if (temperature) updateEnv('TEMPERATURE', temperature);
        if (maxIterations) updateEnv('MAX_ITERATIONS', maxIterations);
        
        // 写入文件
        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
        
        res.json({ 
            success: true, 
            message: '配置已保存到 .env 文件，请重启服务器使配置生效' 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * 测试API连接
 */
app.post('/api/test-connection', async (req, res) => {
    try {
        const startTime = Date.now();
        
        // 使用当前配置测试连接
        const testResponse = await fetch(`${process.env.API_BASE_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (testResponse.ok) {
            res.json({ 
                success: true, 
                model: process.env.MODEL_NAME,
                responseTime 
            });
        } else {
            const error = await testResponse.text();
            res.json({ 
                success: false, 
                error: `API返回错误: ${testResponse.status} ${error}` 
            });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🤖 就要创作 - AI 小说创作系统已启动                        ║
║                                                            ║
║   🌐 访问地址: http://localhost:${PORT}                    ║
║                                                            ║
║   ✨ 特点:                                                 ║
║      • 真正的 Agent 系统                                    ║
║      • AI 自主决策并调用工具                                 ║
║      • 实时显示 Agent 思考过程                               ║
║      • 对话历史记忆                                         ║
║                                                            ║
║   💡 提示: 在浏览器中打开上述地址开始使用                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

