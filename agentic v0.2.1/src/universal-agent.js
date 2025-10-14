import fs from 'fs';
import path from 'path';
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { ToolRegistry } from './tool-registry.js';

/**
 * 通用Agent类
 * 支持从配置文件加载，动态工具注册，多种Agent类型
 */
export class UniversalAgent {
    constructor(options = {}) {
        // 支持从配置文件加载
        this.configName = options.configName || 'novel-writing';
        this.config = options.config || null;
        
        // 工具注册器
        this.toolRegistry = options.toolRegistry || new ToolRegistry();
        
        // 基础配置
        this.apiKey = options.apiKey || process.env.API_KEY;
        this.baseURL = options.baseURL || process.env.API_BASE_URL;
        this.modelName = options.model || process.env.MODEL_NAME || 'gpt-4';
        this.temperature = options.temperature ?? 0.8;
        
        // 🔥 从环境变量读取最大推理轮次
        // 如果 MAX_ITERATIONS 为空或未设置，则无限轮（Infinity）
        // 如果设置了数字，则使用该数字
        const envMaxIterations = process.env.MAX_ITERATIONS;
        if (options.maxIterations !== undefined) {
            this.maxIterations = options.maxIterations;
        } else if (envMaxIterations && envMaxIterations.trim() !== '') {
            this.maxIterations = parseInt(envMaxIterations, 10);
            if (isNaN(this.maxIterations) || this.maxIterations <= 0) {
                console.warn(`⚠️ MAX_ITERATIONS 值无效 (${envMaxIterations})，使用默认值 Infinity（无限轮）`);
                this.maxIterations = Infinity;
            }
        } else {
            this.maxIterations = Infinity; // 默认无限轮
        }
        
        this.verbose = options.verbose ?? true;
        this.systemPrompt = options.systemPrompt || null;
        
        // Agent类型
        this.agentType = options.agentType || 'function-calling'; // 'function-calling' 或 'react'
        
        // 验证必需参数
        if (!this.apiKey) {
            throw new Error('API密钥未设置。请在环境变量中设置 API_KEY 或通过构造函数传入 apiKey 参数。');
        }
        
        if (!this.baseURL) {
            throw new Error('API基础URL未设置。请在环境变量中设置 API_BASE_URL 或通过构造函数传入 baseURL 参数。');
        }
        
        // 初始化LLM（延迟到真正需要时）
        this.llm = null;
        this.initialized = false;
    }

    /**
     * 从配置文件初始化
     */
    async initializeFromConfig(configPath = null) {
        try {
            const fullConfigPath = configPath || path.join(process.cwd(), 'config', 'agent-config.json');
            
            if (!fs.existsSync(fullConfigPath)) {
                throw new Error(`配置文件不存在: ${fullConfigPath}`);
            }

            const configContent = fs.readFileSync(fullConfigPath, 'utf8');
            const fullConfig = JSON.parse(configContent);
            
            // 获取指定的agent配置
            const agentConfig = fullConfig.agents[this.configName];
            if (!agentConfig || !agentConfig.enabled) {
                throw new Error(`Agent配置 "${this.configName}" 不存在或已禁用`);
            }

            this.config = agentConfig;
            
            // 应用配置
            this.agentType = agentConfig.type || 'function-calling';
            // 🔥 只有当配置文件中的模型名称不为null时才覆盖，否则使用环境变量或构造参数
            if (agentConfig.model?.name !== null && agentConfig.model?.name !== undefined) {
                this.modelName = agentConfig.model.name;
            }
            this.temperature = agentConfig.model?.temperature ?? this.temperature;
            this.maxIterations = agentConfig.behavior?.maxIterations ?? this.maxIterations;
            this.verbose = agentConfig.behavior?.verbose ?? this.verbose;
            
            // 🔥 加载系统提示词（优先级：环境变量 > 配置文件 > 默认值）
            const promptFile = process.env.SYSTEM_PROMPT_FILE || 
                              agentConfig.systemPromptFile || 
                              'prompts/novel-writing-improved.md';  // 最终默认值
            
            const promptPath = path.join(process.cwd(), promptFile);
            if (fs.existsSync(promptPath)) {
                this.systemPrompt = fs.readFileSync(promptPath, 'utf8');
                console.log(`✅ 已加载系统提示词: ${promptFile}`);
            } else {
                console.warn(`⚠️  系统提示词文件不存在: ${promptPath}`);
                console.warn(`💡 提示：请在 .env 文件中设置 SYSTEM_PROMPT_FILE 环境变量`);
            }
            
            console.log(`✅ 已加载Agent配置: ${agentConfig.name} (${this.agentType})`);
            return this.config;
        } catch (error) {
            console.error('❌ 初始化Agent配置失败:', error.message);
            throw error;
        }
    }

    /**
     * 初始化LLM
     */
    initializeLLM() {
        if (this.llm) return this.llm;
        
        this.llm = new ChatOpenAI({
            modelName: this.modelName,
            temperature: this.temperature,
            openAIApiKey: this.apiKey,
            configuration: {
                baseURL: this.baseURL,
            },
            streaming: true,
        });
        
        if (this.verbose) {
            console.log(`✅ LLM已初始化: ${this.modelName} (温度: ${this.temperature})`);
        }
        
        return this.llm;
    }

    /**
     * 注册工具
     */
    async registerTools(toolNames = null) {
        // 如果没有指定工具名称，从配置中获取
        if (!toolNames && this.config?.tools?.include) {
            toolNames = this.config.tools.include;
            
            // 处理通配符 "*"
            if (toolNames.includes('*')) {
                await this.toolRegistry.registerAllTools();
                return this.toolRegistry.getAllTools();
            }
        }
        
        // 注册所有工具
        await this.toolRegistry.registerAllTools();
        
        // 如果指定了工具名称，过滤
        if (toolNames && Array.isArray(toolNames)) {
            const selectedTools = toolNames
                .map(name => this.toolRegistry.getTool(name))
                .filter(Boolean);
            
            if (this.verbose) {
                console.log(`✅ 已选择 ${selectedTools.length} 个工具: ${toolNames.join(', ')}`);
            }
            
            return selectedTools;
        }
        
        return this.toolRegistry.getAllTools();
    }

    /**
     * 添加自定义工具
     */
    addTool(tool) {
        if (tool.name && tool.func) {
            this.toolRegistry.registerTool(tool.name, tool.func, {
                description: tool.description,
                parameters: tool.parameters,
                category: tool.category || 'custom'
            });
        } else {
            console.warn('⚠️  工具格式不正确，需要包含 name 和 func 属性');
        }
    }

    /**
     * 获取工具
     */
    getTool(name) {
        return this.toolRegistry.getTool(name);
    }

    /**
     * 执行工具
     */
    async executeTool(toolName, input) {
        const tool = this.toolRegistry.getTool(toolName);
        if (!tool) {
            return `错误：未找到工具 "${toolName}"`;
        }
        
        try {
            const result = await tool.func(input);
            return result;
        } catch (error) {
            return `执行工具 "${toolName}" 时出错：${error.message}`;
        }
    }

    /**
     * 运行Agent（Function Calling模式）
     */
    async run(input, onProgress = null) {
        // 确保已初始化
        if (!this.initialized) {
            await this.initializeFromConfig();
            await this.registerTools();
            this.initializeLLM();
            this.initialized = true;
        }

        if (this.agentType === 'function-calling') {
            return await this.runFunctionCalling(input, onProgress);
        } else if (this.agentType === 'react') {
            return await this.runReAct(input, onProgress);
        } else {
            throw new Error(`不支持的Agent类型: ${this.agentType}`);
        }
    }

    /**
     * Function Calling模式执行
     * @param {string|Array} input - 用户输入（字符串）或完整的消息历史（数组）
     * @param {function} onProgress - 进度回调函数
     */
    async runFunctionCalling(input, onProgress = null) {
        let iterations = 0;
        let conversationHistory;
        
        // 🔥 支持两种输入格式
        if (Array.isArray(input)) {
            // 格式1：结构化的消息数组（包含历史对话）
            conversationHistory = [
                {
                    role: "system",
                    content: this.systemPrompt || "You are a helpful assistant."
                },
                ...input  // 展开历史消息
            ];
        } else {
            // 格式2：简单字符串（向后兼容）
            conversationHistory = [
                {
                    role: "system",
                    content: this.systemPrompt || "You are a helpful assistant."
                },
                {
                    role: "user",
                    content: input
                }
            ];
        }
        
        if (this.verbose) {
            console.log(`\n🤖 开始 Function Calling 推理循环...`);
            const currentInput = Array.isArray(input) 
                ? input[input.length - 1].content 
                : input;
            console.log(`📝 当前问题: ${currentInput.substring(0, 100)}...`);
            console.log(`📚 对话历史: ${conversationHistory.length - 1} 条消息\n`);
        }
        
        while (iterations < this.maxIterations) {
            iterations++;
            
            // 发送进度：开始思考
            this.safeOnProgress(onProgress, {
                type: 'iteration',
                iteration: iterations,
                message: `🔄 第 ${iterations} 轮推理...`
            });
            
            try {
                // 将工具转换为OpenAI格式
                const tools = this.toolRegistry.toOpenAIFormat();
                
                let llmWithFunctions;
                try {
                    llmWithFunctions = this.llm.bindTools(tools);
                } catch (bindToolsError) {
                    if (this.verbose) {
                        console.log('⚠️ bindTools 失败，回退到旧版 bind');
                    }
                    llmWithFunctions = this.llm.bind({
                        functions: tools.map(t => t.function),
                        function_call: "auto"
                    });
                }
                
                // 调用LLM（流式输出）
                let fullResponse = '';
                let functionCall = null;
                
                if (onProgress) {
                    const stream = await llmWithFunctions.stream(conversationHistory);
                    let chunks = [];
                    
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                        
                        if (chunk.content) {
                            fullResponse += chunk.content;
                            this.safeOnProgress(onProgress, {
                                type: 'llm_stream',
                                message: fullResponse
                            });
                        }
                        
                        // 检查工具调用
                        if (chunk.tool_calls && chunk.tool_calls.length > 0) {
                            const toolCall = chunk.tool_calls[0];
                            if (!functionCall) {
                                functionCall = { name: '', arguments: '' };
                            }
                            if (toolCall.name) {
                                functionCall.name = toolCall.name;
                            }
                            if (toolCall.args) {
                                const argsStr = typeof toolCall.args === 'string' 
                                    ? toolCall.args 
                                    : JSON.stringify(toolCall.args);
                                if (argsStr !== '{}' && argsStr.trim() !== '') {
                                    functionCall.arguments = argsStr;
                                }
                            }
                        }
                        
                        // 🔥 检查流式tool_call_chunks（累积参数）
                        if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
                            const toolChunk = chunk.tool_call_chunks[0];
                            if (!functionCall) {
                                functionCall = { name: '', arguments: '' };
                            }
                            if (toolChunk.name) {
                                // 🔥 清理工具名称中的尖括号（某些模型会添加XML风格的标签）
                                const cleanName = toolChunk.name.replace(/^<|>$/g, '');
                                functionCall.name = cleanName;
                                if (this.verbose) {
                                    if (cleanName !== toolChunk.name) {
                                        console.log(`📞 开始累积工具调用: ${toolChunk.name} → ${cleanName} (已清理)`);
                                    } else {
                                        console.log(`📞 开始累积工具调用: ${cleanName}`);
                                    }
                                }
                            }
                            if (toolChunk.args !== undefined) {
                                const argsStr = typeof toolChunk.args === 'string' 
                                    ? toolChunk.args 
                                    : JSON.stringify(toolChunk.args);
                                if (argsStr !== '{}' && argsStr.trim() !== '') {
                                    functionCall.arguments += argsStr;
                                    if (this.verbose && functionCall.arguments.length % 100 === 0) {
                                        console.log(`📊 参数累积中... 当前长度: ${functionCall.arguments.length} 字符`);
                                    }
                                }
                            }
                        }
                    }
                    
                    // 🔥 验证和修复累积的 JSON 参数
                    if (functionCall && functionCall.arguments) {
                        const originalArgs = functionCall.arguments;
                        
                        if (this.verbose) {
                            console.log(`📋 参数累积完成，总长度: ${originalArgs.length} 字符`);
                            console.log(`📋 参数前100字符: ${originalArgs.substring(0, 100)}`);
                            console.log(`📋 参数后100字符: ${originalArgs.substring(Math.max(0, originalArgs.length - 100))}`);
                        }
                        
                        // 验证 JSON 完整性
                        const isValidJSON = (str) => {
                            try {
                                JSON.parse(str);
                                return true;
                            } catch {
                                return false;
                            }
                        };
                        
                        if (!isValidJSON(originalArgs)) {
                            if (this.verbose) {
                                console.warn('⚠️ 检测到不完整的 JSON，尝试智能修复...');
                            }
                            
                            // 🔥 智能修复策略
                            let fixedArgs = originalArgs.trim();
                            let fixed = false;
                            
                            // 策略1: 补全缺失的结尾花括号
                            if (fixedArgs.startsWith('{') && !fixedArgs.endsWith('}')) {
                                const openBraces = (fixedArgs.match(/{/g) || []).length;
                                const closeBraces = (fixedArgs.match(/}/g) || []).length;
                                const missing = openBraces - closeBraces;
                                
                                if (missing > 0) {
                                    fixedArgs += '}'.repeat(missing);
                                    if (isValidJSON(fixedArgs)) {
                                        functionCall.arguments = fixedArgs;
                                        fixed = true;
                                        if (this.verbose) {
                                            console.log(`✅ JSON修复成功：添加了 ${missing} 个结尾 }`);
                                        }
                                    }
                                }
                            }
                            
                            // 策略2: 补全未闭合的字符串
                            if (!fixed && fixedArgs.includes('"')) {
                                // 统计非转义的引号数量（简化处理）
                                const quotes = (fixedArgs.split('"').length - 1);
                                if (quotes % 2 !== 0) {
                                    fixedArgs += '"';
                                    // 再次尝试补全花括号
                                    if (fixedArgs.startsWith('{') && !fixedArgs.endsWith('}')) {
                                        const openBraces = (fixedArgs.match(/{/g) || []).length;
                                        const closeBraces = (fixedArgs.match(/}/g) || []).length;
                                        fixedArgs += '}'.repeat(Math.max(0, openBraces - closeBraces));
                                    }
                                    
                                    if (isValidJSON(fixedArgs)) {
                                        functionCall.arguments = fixedArgs;
                                        fixed = true;
                                        if (this.verbose) {
                                            console.log('✅ JSON修复成功：补全了未闭合的引号');
                                        }
                                    }
                                }
                            }
                            
                            // 策略3: 处理重复的JSON对象（提取第一个完整的）
                            if (!fixed && fixedArgs.startsWith('{')) {
                                // 查找第一个完整的JSON对象
                                let braceCount = 0;
                                let firstCompleteIndex = -1;
                                
                                for (let i = 0; i < fixedArgs.length; i++) {
                                    if (fixedArgs[i] === '{') {
                                        braceCount++;
                                    } else if (fixedArgs[i] === '}') {
                                        braceCount--;
                                        if (braceCount === 0) {
                                            firstCompleteIndex = i;
                                            break;
                                        }
                                    }
                                }
                                
                                if (firstCompleteIndex > 0) {
                                    const extracted = fixedArgs.substring(0, firstCompleteIndex + 1);
                                    if (isValidJSON(extracted)) {
                                        functionCall.arguments = extracted;
                                        fixed = true;
                                        if (this.verbose) {
                                            console.log('✅ JSON修复成功：提取了第一个完整的JSON对象');
                                        }
                                    }
                                }
                            }
                            
                            // 策略4: 尝试提取最后一个完整的对象（作为备选）
                            if (!fixed) {
                                const lastBraceIndex = fixedArgs.lastIndexOf('}');
                                if (lastBraceIndex > 0) {
                                    const extracted = fixedArgs.substring(0, lastBraceIndex + 1);
                                    if (isValidJSON(extracted)) {
                                        functionCall.arguments = extracted;
                                        fixed = true;
                                        if (this.verbose) {
                                            console.log('✅ JSON修复成功：提取了完整部分');
                                        }
                                    }
                                }
                            }
                            
                            if (!fixed && this.verbose) {
                                console.error('❌ 无法自动修复 JSON，将在后续处理中尝试');
                            }
                        } else if (this.verbose) {
                            console.log('✅ JSON 格式完整有效');
                        }
                    }
                    
                    // 从最后一个chunk获取function_call（如果还没有）
                    if (!functionCall && chunks.length > 0) {
                        const lastChunk = chunks[chunks.length - 1];
                        if (lastChunk.tool_calls && lastChunk.tool_calls.length > 0) {
                            const toolCall = lastChunk.tool_calls[0];
                            functionCall = {
                                name: toolCall.name,
                                arguments: toolCall.args 
                                    ? (typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args))
                                    : '{}'
                            };
                        } else if (lastChunk.additional_kwargs?.function_call) {
                            functionCall = lastChunk.additional_kwargs.function_call;
                        }
                    }
                } else {
                    const response = await llmWithFunctions.invoke(conversationHistory);
                    fullResponse = response.content || '';
                    
                    if (response.tool_calls && response.tool_calls.length > 0) {
                        const toolCall = response.tool_calls[0];
                        functionCall = {
                            name: toolCall.name,
                            arguments: typeof toolCall.args === 'string' 
                                ? toolCall.args 
                                : JSON.stringify(toolCall.args)
                        };
                    } else if (response.additional_kwargs?.function_call) {
                        functionCall = response.additional_kwargs.function_call;
                    }
                }
                
                if (this.verbose) {
                    console.log(`🧠 LLM响应 (第${iterations}轮):`);
                    console.log(fullResponse.substring(0, 200) || '(调用函数)');
                    if (functionCall) {
                        console.log(`📞 函数调用: ${functionCall.name}`);
                    }
                }
                
                // 如果没有函数调用，检查是否真的是最终答案
                if (!functionCall) {
                    // 如果回复内容为空或太短，可能是错误，继续循环
                    if (!fullResponse || fullResponse.trim().length < 10) {
                        if (this.verbose) {
                            console.log(`⚠️ AI 回复为空或太短，继续下一轮...`);
                        }
                        conversationHistory.push({
                            role: "system",
                            content: "请继续完成任务，使用相应的工具。"
                        });
                        continue;
                    }
                    
                    if (this.verbose) {
                        console.log(`✅ 找到最终答案！`);
                    }
                    
                    return {
                        success: true,
                        answer: fullResponse,
                        iterations: iterations,
                        conversationHistory: conversationHistory
                    };
                }
                
                // 有函数调用，执行工具
                const toolName = functionCall.name;
                let toolInput;
                
                if (!functionCall.arguments || functionCall.arguments === '') {
                    toolInput = {};
                } else if (typeof functionCall.arguments === 'string') {
                    try {
                        toolInput = JSON.parse(functionCall.arguments);
                    } catch (error) {
                        // 🔥 JSON 解析失败，记录详细信息
                        if (this.verbose) {
                            console.error('❌ 工具参数 JSON 解析失败');
                            console.error('工具名称:', toolName);
                            console.error('错误信息:', error.message);
                            console.error('参数前300字符:', functionCall.arguments.substring(0, 300));
                            console.error('参数后100字符:', functionCall.arguments.substring(Math.max(0, functionCall.arguments.length - 100)));
                        }
                        
                        // 尝试修复常见的 JSON 格式问题
                        try {
                            // 如果参数看起来像是被截断的 JSON，尝试补全
                            let fixedArgs = functionCall.arguments.trim();
                            
                            // 如果缺少结尾的 }，尝试添加
                            if (!fixedArgs.endsWith('}') && fixedArgs.includes('{')) {
                                fixedArgs = fixedArgs + '}';
                                toolInput = JSON.parse(fixedArgs);
                                if (this.verbose) {
                                    console.log('✅ 通过添加结尾 } 修复了 JSON');
                                }
                            } else {
                                // 无法修复，使用原始字符串
                                toolInput = functionCall.arguments;
                            }
                        } catch (fixError) {
                            // 修复也失败了，使用原始字符串
                            toolInput = functionCall.arguments;
                        }
                    }
                } else {
                    toolInput = functionCall.arguments;
                }
                
                // 🔥 清理工具名称中的尖括号（某些模型会添加XML风格的标签）
                const cleanToolName = toolName.replace(/^<|>$/g, '');
                
                if (this.verbose) {
                    if (cleanToolName !== toolName) {
                        console.log(`🔧 执行工具: ${toolName} → ${cleanToolName} (已清理)`);
                    } else {
                        console.log(`🔧 执行工具: ${cleanToolName}`);
                    }
                    console.log(`📥 参数类型: ${typeof toolInput}`);
                    if (typeof toolInput === 'object') {
                        console.log(`📥 参数键: ${Object.keys(toolInput).join(', ')}`);
                    }
                }
                
                // 发送进度：执行动作
                this.safeOnProgress(onProgress, {
                    type: 'action',
                    action: cleanToolName,
                    input: toolInput,
                    message: `🔧 执行: ${cleanToolName}`
                });
                
                // 执行工具
                const observation = await this.executeTool(cleanToolName, toolInput);
                
                if (this.verbose) {
                    console.log(`👀 观察结果: ${observation.substring(0, 200)}...\n`);
                }
                
                // 发送进度：观察结果
                const obsPreview = observation.length > 100 ? observation.substring(0, 100) + '...' : observation;
                this.safeOnProgress(onProgress, {
                    type: 'observation',
                    message: `✅ 结果: ${obsPreview}`
                });
                
                // 将函数调用和结果添加到对话历史
                let parsedArgs = toolInput;
                if (typeof functionCall.arguments === 'string' && typeof toolInput === 'string') {
                    try {
                        parsedArgs = JSON.parse(functionCall.arguments);
                    } catch (e) {
                        parsedArgs = { raw: functionCall.arguments };
                    }
                }
                
                const aiMessage = new AIMessage({
                    content: fullResponse || '',
                    tool_calls: functionCall ? [{
                        id: `call_${Date.now()}`,
                        name: functionCall.name,
                        args: parsedArgs
                    }] : []
                });
                conversationHistory.push(aiMessage);
                
                const toolMessage = new ToolMessage({
                    content: observation,
                    tool_call_id: `call_${Date.now()}`,
                    name: toolName
                });
                conversationHistory.push(toolMessage);
                
            } catch (error) {
                console.error(`❌ 第 ${iterations} 轮出错:`, error);
                
                if (error.message === 'Task stopped by user') {
                    throw error;
                }
                
                conversationHistory.push({
                    role: "system",
                    content: `执行出错: ${error.message}. 请尝试其他方法。`
                });
            }
        }
        
        // 🔥 达到最大推理次数，这不是错误，而是一个限制
        return {
            success: false,
            reachedMaxIterations: true,  // 标记为达到最大次数
            message: `已达到最大思考限制 (${this.maxIterations} 轮推理)。如需继续，请发送新的消息，我会接着为您创作。`,
            iterations: iterations,
            conversationHistory: conversationHistory
        };
    }

    /**
     * ReAct模式执行（简化版，可根据需要扩展）
     */
    async runReAct(input, onProgress = null) {
        // TODO: 实现ReAct模式
        throw new Error('ReAct模式暂未实现，请使用 function-calling 模式');
    }

    /**
     * 安全调用进度回调
     */
    safeOnProgress(onProgress, data) {
        if (!onProgress) return;
        try {
            onProgress(data);
        } catch (error) {
            if (this.verbose) {
                console.log(`⚠️ onProgress 抛出错误: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * 获取Agent统计信息
     */
    getStats() {
        return {
            configName: this.configName,
            agentType: this.agentType,
            modelName: this.modelName,
            temperature: this.temperature,
            maxIterations: this.maxIterations,
            tools: this.toolRegistry.getStats(),
            initialized: this.initialized
        };
    }
}

