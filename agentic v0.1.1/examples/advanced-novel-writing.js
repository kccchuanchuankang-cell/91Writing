import dotenv from 'dotenv';
import readline from 'readline';
import { ChatOpenAI } from '@langchain/openai';
import { ReActAgent } from '../src/react-agent.js';
import { ProjectManager } from '../src/project-manager.js';
import { ContextManager } from '../src/context-manager.js';
import { getAllFileOperationTools } from '../src/tools/file-operations.js';
import { getAllNovelWritingTools } from '../src/tools/novel-writing/index.js';
import fs from 'fs';
import path from 'path';

// 加载环境变量
dotenv.config();

/**
 * 真正的 Agent 小说创作系统
 * Agent 完全自主决策，调用工具完成任务
 */
class TrueAgentNovelWritingTool {
    constructor() {
        this.projectManager = null;
        this.contextManager = null;
        this.agent = null;
        this.currentProject = null;
        
        // 对话历史
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
        
        // 配置
        this.config = {
            model: process.env.MODEL_NAME || 'gpt-4',
            apiKey: process.env.API_KEY,
            baseURL: process.env.API_BASE_URL
        };
    }

    /**
     * 初始化工具
     */
    async initialize() {
        console.log('🚀 真正的 Agent 小说创作系统启动中...\n');
        
        // 检查API配置
        if (!this.config.apiKey || !this.config.baseURL) {
            console.error('❌ 请先配置API密钥和地址');
            process.exit(1);
        }

        // 初始化LLM
        const llm = new ChatOpenAI({
            modelName: this.config.model,
            temperature: 0.8,
            openAIApiKey: this.config.apiKey,
            configuration: {
                baseURL: this.config.baseURL
            },
            streaming: false  // ✅ 禁用流式输出，使用真正的 Agent
        });

        // 加载提示词
        const promptPath = path.join(process.cwd(), 'prompts', 'novel-writing-clean.md');
        const systemPrompt = fs.readFileSync(promptPath, 'utf8');

        // ✅ 初始化 ReAct Agent
        this.agent = new ReActAgent({
            llm: llm,
            systemPrompt,
            verbose: true,  // 显示 Agent 思考过程
            maxIterations: 15
        });

        // ✅ 注册所有工具到 Agent
        const fileTools = getAllFileOperationTools();
        const novelTools = getAllNovelWritingTools();
        
        [...fileTools, ...novelTools].forEach(tool => {
            this.agent.addTool(tool);
        });

        console.log('✅ Agent 初始化完成');
        console.log(`🤖 使用模型: ${this.config.model}`);
        console.log(`🔧 已注册工具: ${fileTools.length + novelTools.length} 个`);
        console.log(`   📁 文件操作: ${fileTools.map(t => t.name).join(', ')}`);
        console.log(`   ✍️ 创作工具: ${novelTools.map(t => t.name).join(', ')}`);
        console.log('');
    }

    /**
     * 创建或加载项目
     */
    async setupProject() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const projectName = await new Promise(resolve => {
            rl.question('📝 请输入项目名称（或回车使用默认项目）: ', resolve);
        });

        const finalProjectName = projectName.trim() || '默认小说项目';
        
        // 初始化项目管理器
        this.projectManager = new ProjectManager(finalProjectName);
        await this.projectManager.initProject();
        
        // 初始化上下文管理器
        this.contextManager = new ContextManager(this.projectManager);
        
        this.currentProject = finalProjectName;
        
        console.log(`\n📁 项目 "${finalProjectName}" 已准备就绪`);
        
        // 显示项目概览
        await this.showProjectOverview();
        
        rl.close();
    }

    /**
     * 显示项目概览
     */
    async showProjectOverview() {
        const overview = await this.contextManager.getContentOverview();
        
        console.log('\n📊 项目内容概览:');
        for (const [type, info] of Object.entries(overview)) {
            console.log(`   ${type}: ${info.count}个文件`);
        }
        console.log('');
    }

    /**
     * 主交互循环
     */
    async startInteraction() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '💭 你想做什么？\n> '
        });

        console.log('\n🎯 系统已就绪！直接告诉我你想做什么，Agent 会自主决策并调用工具完成任务。');
        console.log('💡 提示: 输入 "help" 查看帮助，"exit" 退出\n');

        rl.prompt();

        rl.on('line', async (input) => {
            const userInput = input.trim();

            if (!userInput) {
                rl.prompt();
                return;
            }

            // 系统命令
            if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
                console.log('\n👋 再见！');
                rl.close();
                process.exit(0);
            }

            if (userInput.toLowerCase() === 'help') {
                this.showHelp();
                rl.prompt();
                return;
            }

            if (userInput.toLowerCase() === 'clear') {
                this.conversationHistory = [];
                console.log('✅ 对话历史已清空');
                rl.prompt();
                return;
            }

            if (userInput.toLowerCase() === 'history') {
                this.showHistory();
                rl.prompt();
                return;
            }

            if (userInput.toLowerCase() === 'overview') {
                await this.showProjectOverview();
                rl.prompt();
                return;
            }

            // ✅ 让 Agent 处理请求
            await this.processWithAgent(userInput);
            rl.prompt();
        });
    }

    /**
     * 让 Agent 处理请求
     */
    async processWithAgent(userInput) {
        try {
            // 记录到对话历史
            this.addToHistory('user', userInput);

            console.log('\n🤖 Agent 开始工作...');
            console.log('──────────────────────────────────────────────────\n');

            // 构建提示（包含对话历史）
            let enhancedPrompt = '';
            
            // 添加对话历史
            if (this.conversationHistory.length > 1) {
                enhancedPrompt += '以下是我们的对话历史：\n';
                for (const msg of this.conversationHistory.slice(-this.maxHistoryLength)) {
                    if (msg.role === 'user') {
                        enhancedPrompt += `用户: ${msg.content}\n`;
                    } else {
                        enhancedPrompt += `AI: ${msg.content}\n`;
                    }
                }
                enhancedPrompt += '\n';
            }
            
            // 添加当前请求
            enhancedPrompt += `当前用户请求：${userInput}`;

            // ✅ 调用 Agent（真正的 ReAct 循环）
            const result = await this.agent.run(enhancedPrompt);

            if (result.success) {
                console.log('\n✅ 任务完成！');
                console.log('──────────────────────────────────────────────────');
                console.log(`📝 结果: ${result.answer}\n`);
                
                // 记录 AI 回复到历史
                this.addToHistory('assistant', result.answer);
            } else {
                console.log('\n❌ 任务失败！');
                console.log('──────────────────────────────────────────────────');
                console.log(`错误: ${result.error}\n`);
            }

        } catch (error) {
            console.error('\n❌ 处理请求时出现错误:', error.message);
            console.error(error.stack);
        }
    }

    /**
     * 添加到对话历史
     */
    addToHistory(role, content) {
        this.conversationHistory.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });

        // 保持历史记录在限制范围内
        if (this.conversationHistory.length > this.maxHistoryLength * 2) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
        }
    }

    /**
     * 显示对话历史
     */
    showHistory() {
        if (this.conversationHistory.length === 0) {
            console.log('📜 对话历史为空');
            return;
        }

        console.log('\n📜 对话历史:');
        console.log('──────────────────────────────────────────────────');
        for (const msg of this.conversationHistory) {
            const icon = msg.role === 'user' ? '👤' : '🤖';
            const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN');
            console.log(`${icon} [${time}] ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        }
        console.log('──────────────────────────────────────────────────\n');
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        console.log('\n📖 帮助信息');
        console.log('──────────────────────────────────────────────────');
        console.log('💬 直接输入你的需求，Agent 会自主决策并调用工具完成');
        console.log('');
        console.log('🎯 示例：');
        console.log('   - "创建一个中国神界的主角角色，保存到人物设定里"');
        console.log('   - "列出所有人物设定文件"');
        console.log('   - "把某个文件从创作笔记移动到人物设定"');
        console.log('   - "读取某个章节内容"');
        console.log('');
        console.log('🛠️ 系统命令：');
        console.log('   help     - 显示此帮助信息');
        console.log('   overview - 显示项目概览');
        console.log('   history  - 显示对话历史');
        console.log('   clear    - 清空对话历史');
        console.log('   exit     - 退出系统');
        console.log('──────────────────────────────────────────────────\n');
    }
}

// 主函数
async function main() {
    const tool = new TrueAgentNovelWritingTool();
    await tool.initialize();
    await tool.setupProject();
    await tool.startInteraction();
}

main().catch(console.error);
