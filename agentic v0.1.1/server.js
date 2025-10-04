import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { FunctionCallingAgent } from './src/function-calling-agent.js';
import { ProjectManager } from './src/project-manager.js';
import { ContextManager } from './src/context-manager.js';
import { ConversationManager } from './src/conversation-manager.js';
import { getAllFileOperationTools } from './src/tools/file-operations.js';
import { getAllNovelWritingTools } from './src/tools/novel-writing/index.js';

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
        const novelsDir = './novels';
        if (!fs.existsSync(novelsDir)) {
            fs.mkdirSync(novelsDir, { recursive: true });
        }
        
        const projects = fs.readdirSync(novelsDir)
            .filter(name => {
                const stat = fs.statSync(join(novelsDir, name));
                return stat.isDirectory();
            })
            .map(name => {
                const configPath = join(novelsDir, name, 'project-config.json');
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
 * 获取文件列表
 */
app.get('/api/projects/:name/files/:type', (req, res) => {
    try {
        const { name, type } = req.params;
        const typeDir = join('./novels', name, type);
        
        if (!fs.existsSync(typeDir)) {
            return res.json({ success: true, files: [] });
        }
        
        const files = fs.readdirSync(typeDir)
            .filter(f => f.endsWith('.md') && f !== 'index.md')
            .map(file => {
                const filePath = join(typeDir, file);
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf8');
                
                // 提取标题
                const lines = content.split('\n');
                let title = file.replace(/\.md$/, '');
                for (const line of lines) {
                    if (line.startsWith('# ')) {
                        title = line.substring(2).trim();
                        break;
                    }
                }
                
                return {
                    filename: file,
                    title,
                    size: stats.size,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.modified) - new Date(a.modified));
        
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
        const filePath = join('./novels', name, type, filename);
        
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
        
        const typeDir = join('./novels', name, type);
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
        const filePath = join('./novels', name, type, filename);
        
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
        
        // 初始化 LLM
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在加载提示词...' })}\n\n`);
        
        // 加载提示词（Function Calling 专用）
        const promptPath = path.join(process.cwd(), 'prompts', 'novel-writing-function-calling.md');
        const systemPrompt = fs.readFileSync(promptPath, 'utf8');
        
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在初始化 AI Agent...' })}\n\n`);
        
        // ✅ 初始化 Function Calling Agent（使用 OpenAI 原生 Function Calling）
        const agent = new FunctionCallingAgent({
            apiKey: process.env.API_KEY,
            baseURL: process.env.API_BASE_URL,
            model: process.env.MODEL_NAME || 'gpt-4',
            temperature: 0.8,
            systemPrompt,
            verbose: true,
            maxIterations: 15
        });
        
        res.write(`data: ${JSON.stringify({ type: 'initializing', data: '正在注册工具...' })}\n\n`);
        
        // ✅ 注册所有工具（绑定项目名称到工具闭包）
        const fileTools = getAllFileOperationTools();
        const novelTools = getAllNovelWritingTools();
        
        // 🔥 关键：为每个文件操作工具注入项目名称
        const boundFileTools = fileTools.map(tool => ({
            ...tool,
            func: async (input) => {
                // 在工具内部临时设置环境变量，传递项目名称
                const originalEnv = process.env.CURRENT_PROJECT;
                process.env.CURRENT_PROJECT = name;
                try {
                    return await tool.func(input);
                } finally {
                    if (originalEnv !== undefined) {
                        process.env.CURRENT_PROJECT = originalEnv;
                    } else {
                        delete process.env.CURRENT_PROJECT;
                    }
                }
            }
        }));
        
        [...boundFileTools, ...novelTools].forEach(tool => {
            agent.addTool(tool);
        });
        
        // 🔥 使用 ConversationManager 构建增强提示（包含历史上下文）
        const enhancedPrompt = conversationManager.buildEnhancedPrompt(prompt, 10);
        
        // 🔥 保存用户原始消息到文件（不包含系统生成的文件引用提示）
        const messageToSave = originalMessage || prompt;  // 优先使用原始消息，回退到完整提示
        conversationManager.addMessage('user', messageToSave);
        
        // 发送开始信号
        res.write(`data: ${JSON.stringify({ type: 'start', data: '🤖 Agent 开始工作...' })}\n\n`);
        
        // ✅ 调用 Agent（真正的 ReAct 循环，带进度回调）
        try {
            let fullThinkingProcess = '';
            let currentIteration = 0;
            
            const result = await agent.run(enhancedPrompt, (progress) => {
                // 🔥 检查任务是否被停止
                const taskStatus = runningTasks.get(name);
                if (taskStatus && taskStatus.shouldStop) {
                    throw new Error('Task stopped by user');
                }
                
                // 🔥 区分不同类型的进度，分别发送
                if (progress.type === 'iteration') {
                    currentIteration = progress.iteration;
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
                    // 同时累积到完整历史
                    const beforeLLM = fullThinkingProcess.split('\n---LLM输出---\n')[0];
                    fullThinkingProcess = beforeLLM + '\n---LLM输出---\n' + progress.message;
                } else if (progress.type === 'thought') {
                    fullThinkingProcess += `\n💭 思考: ${progress.message}\n`;
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
                    
                    fullThinkingProcess += `\n${friendlyAction}: ${inputDisplay}\n`;
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
                            const { type, filename } = inputParams;
                            
                            // 读取文件当前内容（作为 oldContent）
                            const filePath = join('./novels', name, type, filename);
                            if (fs.existsSync(filePath)) {
                                const oldContent = fs.readFileSync(filePath, 'utf8');
                                
                                // 保存到临时变量，等待工具执行完毕后读取新内容
                                res.locals = res.locals || {};
                                res.locals.pendingFileUpdate = {
                                    type,
                                    filename,
                                    oldContent
                                };
                            }
                        } catch (error) {
                            console.error('读取文件旧内容失败:', error.message);
                        }
                    }
                } else if (progress.type === 'observation') {
                    fullThinkingProcess += `\n✅ 结果: ${progress.message}\n`;
                    res.write(`data: ${JSON.stringify({ type: 'progress', data: fullThinkingProcess })}\n\n`);
                    
                    // 🔥 如果刚刚调用了 update_file，现在发送 file_update 事件
                    if (res.locals && res.locals.pendingFileUpdate) {
                        try {
                            const { type, filename, oldContent } = res.locals.pendingFileUpdate;
                            const filePath = join('./novels', name, type, filename);
                            
                            if (fs.existsSync(filePath)) {
                                const newContent = fs.readFileSync(filePath, 'utf8');
                                
                                // 发送 file_update 事件给前端
                                res.write(`data: ${JSON.stringify({
                                    type: 'file_update',
                                    data: {
                                        type,
                                        filename,
                                        oldContent,
                                        newContent
                                    }
                                })}\n\n`);
                            }
                        } catch (error) {
                            console.error('发送文件更新事件失败:', error.message);
                        } finally {
                            // 清除临时变量
                            delete res.locals.pendingFileUpdate;
                        }
                    }
                }
            });
            
            if (result.success) {
                // 🔥 保存 AI 回复到文件，包含推理过程
                conversationManager.addMessage('assistant', result.answer, {
                    thinkingProcess: fullThinkingProcess,
                    iterations: result.iterations,
                    scratchpad: result.scratchpad
                });
                
                res.write(`data: ${JSON.stringify({ type: 'content', data: result.answer })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', data: result.error })}\n\n`);
            }
        } catch (error) {
            // 🔥 如果是用户停止任务，不记录为错误
            if (error.message === 'Task stopped by user') {
                console.log(`🛑 [${name}] Agent 执行已停止（用户主动停止）`);
                res.write(`data: ${JSON.stringify({ type: 'stopped', data: '已停止' })}\n\n`);
            } else {
                console.error(`❌ [${name}] Agent 执行错误:`, error.message);
                res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
            }
        } finally {
            // 🔥 清理任务状态和心跳定时器
            runningTasks.delete(name);
            if (typeof heartbeatInterval !== 'undefined') {
                clearInterval(heartbeatInterval);
            }
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
        const promptPath = join('./novels', name, '创作提示词知识库.md');
        
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
        
        const promptPath = join('./novels', name, '创作提示词知识库.md');
        
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
 * 获取系统提示词（prompts/novel-writing-function-calling.md）
 */
app.get('/api/prompts/system', (req, res) => {
    try {
        const promptPath = './prompts/novel-writing-function-calling.md';
        
        if (!fs.existsSync(promptPath)) {
            return res.status(404).json({ 
                success: false, 
                error: '系统提示词文件不存在' 
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
        
        const promptPath = './prompts/novel-writing-function-calling.md';
        
        // 备份原文件
        if (fs.existsSync(promptPath)) {
            const backupPath = promptPath + '.backup';
            fs.copyFileSync(promptPath, backupPath);
        }
        
        fs.writeFileSync(promptPath, content, 'utf8');
        
        res.json({ 
            success: true, 
            message: '系统提示词已更新',
            path: promptPath
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🤖 就要创作 - AI 小说创作系统已启动                     ║
║                                                            ║
║   🌐 访问地址: http://localhost:${PORT}                      ║
║                                                            ║
║   ✨ 特点:                                                 ║
║      • 真正的 Agent 系统                                  ║
║      • AI 自主决策并调用工具                              ║
║      • 实时显示 Agent 思考过程                            ║
║      • 对话历史记忆                                       ║
║                                                            ║
║   💡 提示: 在浏览器中打开上述地址开始使用                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

