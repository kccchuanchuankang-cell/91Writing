/**
 * 通用Agent系统演示
 * 展示如何使用新的配置驱动的Agent系统
 */

import dotenv from 'dotenv';
import { UniversalAgent } from '../src/universal-agent.js';
import { ToolRegistry } from '../src/tool-registry.js';

dotenv.config();

/**
 * 示例1: 使用配置文件创建Agent
 */
async function example1_configBased() {
    console.log('\n📌 示例1: 使用配置文件创建Agent\n');
    
    const agent = new UniversalAgent({
        configName: 'novel-writing',  // 使用小说创作配置
        verbose: true
    });
    
    // 从配置文件初始化
    await agent.initializeFromConfig();
    await agent.registerTools();
    
    // 查看Agent信息
    const stats = agent.getStats();
    console.log('Agent统计信息:', JSON.stringify(stats, null, 2));
    
    // 运行Agent
    // const result = await agent.run('帮我创建一个修仙小说项目', (progress) => {
    //     console.log(`[进度] ${progress.type}: ${progress.message || ''}`);
    // });
    
    // console.log('\n结果:', result.answer);
}

/**
 * 示例2: 手动配置Agent
 */
async function example2_manualConfig() {
    console.log('\n📌 示例2: 手动配置Agent\n');
    
    const toolRegistry = new ToolRegistry();
    await toolRegistry.registerAllTools();
    
    const agent = new UniversalAgent({
        toolRegistry: toolRegistry,
        apiKey: process.env.API_KEY,
        baseURL: process.env.API_BASE_URL,
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxIterations: 10,
        verbose: true,
        agentType: 'function-calling',
        systemPrompt: `你是一个AI助手，帮助用户完成任务。

可用工具：
- generate_long_content: 生成长文本
- save_file: 保存文件
- read_file: 读取文件
- list_files: 列出文件

请根据用户要求选择合适的工具。`
    });
    
    await agent.registerTools(['generate_long_content', 'save_file', 'read_file', 'list_files']);
    
    console.log('已初始化手动配置的Agent');
    console.log('工具数量:', agent.toolRegistry.getAllTools().length);
}

/**
 * 示例3: 动态添加自定义工具
 */
async function example3_customTool() {
    console.log('\n📌 示例3: 动态添加自定义工具\n');
    
    const toolRegistry = new ToolRegistry();
    
    // 添加自定义工具
    toolRegistry.addCustomTool({
        name: 'calculate',
        func: async (input) => {
            const { expression } = typeof input === 'string' ? JSON.parse(input) : input;
            try {
                // 注意：生产环境不要用eval，这里仅作演示
                const result = eval(expression);
                return `计算结果: ${expression} = ${result}`;
            } catch (error) {
                return `计算错误: ${error.message}`;
            }
        },
        description: '计算数学表达式',
        parameters: {
            type: 'object',
            properties: {
                expression: {
                    type: 'string',
                    description: '要计算的数学表达式，如 "2 + 2"'
                }
            },
            required: ['expression']
        },
        category: 'utility'
    });
    
    console.log('已添加自定义工具: calculate');
    
    const agent = new UniversalAgent({
        toolRegistry: toolRegistry,
        apiKey: process.env.API_KEY,
        baseURL: process.env.API_BASE_URL,
        model: 'gpt-3.5-turbo',
        agentType: 'function-calling',
        systemPrompt: '你是一个AI助手。可用工具：calculate - 计算数学表达式。',
        verbose: true
    });
    
    // const result = await agent.run('计算 123 + 456');
    // console.log('结果:', result.answer);
}

/**
 * 示例4: 工具管理
 */
async function example4_toolManagement() {
    console.log('\n📌 示例4: 工具管理\n');
    
    const toolRegistry = new ToolRegistry();
    await toolRegistry.registerAllTools();
    
    // 获取统计信息
    console.log('工具统计:', toolRegistry.getStats());
    
    // 按类别获取工具
    const fileTools = toolRegistry.getToolsByCategory('file_operations');
    console.log('\n文件操作工具:', fileTools.map(t => t.name));
    
    const contentTools = toolRegistry.getToolsByCategory('content_generation');
    console.log('内容生成工具:', contentTools.map(t => t.name));
    
    // 禁用某个工具
    toolRegistry.setToolEnabled('move_file', false);
    console.log('\n已禁用 move_file 工具');
    console.log('更新后的统计:', toolRegistry.getStats());
    
    // 重新启用
    toolRegistry.setToolEnabled('move_file', true);
    console.log('\n已重新启用 move_file 工具');
}

/**
 * 示例5: 多Agent配置切换
 */
async function example5_multipleAgents() {
    console.log('\n📌 示例5: 多Agent配置切换\n');
    
    // Agent 1: 小说创作
    const novelAgent = new UniversalAgent({
        configName: 'novel-writing'
    });
    await novelAgent.initializeFromConfig();
    await novelAgent.registerTools();
    console.log('小说创作Agent:', novelAgent.getStats());
    
    // Agent 2: 默认通用Agent
    const defaultAgent = new UniversalAgent({
        configName: 'default'
    });
    await defaultAgent.initializeFromConfig();
    await defaultAgent.registerTools();
    console.log('\n默认Agent:', defaultAgent.getStats());
}

/**
 * 示例6: 错误处理和重试
 */
async function example6_errorHandling() {
    console.log('\n📌 示例6: 错误处理演示\n');
    
    const agent = new UniversalAgent({
        configName: 'novel-writing',
        verbose: true
    });
    
    await agent.initializeFromConfig();
    await agent.registerTools();
    
    try {
        // 尝试执行一个不存在的工具
        const result = await agent.executeTool('non_existent_tool', {});
        console.log('结果:', result);  // 会返回错误消息
    } catch (error) {
        console.error('捕获错误:', error.message);
    }
}

// 运行示例
async function main() {
    console.log('🚀 通用Agent系统演示\n');
    console.log('====================================');
    
    try {
        await example1_configBased();
        await example2_manualConfig();
        await example3_customTool();
        await example4_toolManagement();
        await example5_multipleAgents();
        await example6_errorHandling();
        
        console.log('\n====================================');
        console.log('✅ 所有示例执行完毕');
    } catch (error) {
        console.error('\n❌ 示例执行失败:', error);
        console.error(error.stack);
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    example1_configBased,
    example2_manualConfig,
    example3_customTool,
    example4_toolManagement,
    example5_multipleAgents,
    example6_errorHandling
};

