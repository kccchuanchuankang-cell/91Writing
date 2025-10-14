import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 通用工具注册器
 * 支持从配置文件动态加载和管理工具
 */
export class ToolRegistry {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(process.cwd(), 'config', 'tools.json');
        this.tools = new Map();
        this.toolsByCategory = new Map();
        this.config = null;
    }

    /**
     * 加载工具配置
     */
    async loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                throw new Error(`工具配置文件不存在: ${this.configPath}`);
            }

            const configContent = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configContent);

            console.log(`✅ 已加载工具配置: ${this.config.tools.length} 个工具`);
            return this.config;
        } catch (error) {
            console.error('❌ 加载工具配置失败:', error.message);
            throw error;
        }
    }

    /**
     * 注册工具实现
     * @param {string} name - 工具名称
     * @param {function} func - 工具实现函数
     * @param {object} metadata - 工具元数据（描述、参数等）
     */
    registerTool(name, func, metadata = {}) {
        const tool = {
            name,
            func,
            description: metadata.description || '',
            parameters: metadata.parameters || {},
            category: metadata.category || 'general',
            enabled: metadata.enabled !== false
        };

        this.tools.set(name, tool);

        // 按类别分组
        if (!this.toolsByCategory.has(tool.category)) {
            this.toolsByCategory.set(tool.category, []);
        }
        this.toolsByCategory.get(tool.category).push(tool);

        console.log(`✅ 已注册工具: ${name} (${tool.category})`);
        return tool;
    }

    /**
     * 从配置文件和实现文件自动注册所有工具
     */
    async registerAllTools() {
        if (!this.config) {
            await this.loadConfig();
        }

        // 动态导入工具实现
        const fileOperationsModule = await import('./tools/file-operations.js');
        const taskPlanningModule = await import('./tools/task-planning.js');
        const fileSearchModule = await import('./tools/file-search.js');

        // 工具实现映射
        const toolImplementations = {
            'generate_long_content': fileOperationsModule.generateLongContentTool,
            'save_file': fileOperationsModule.saveFileTool,
            'read_file': fileOperationsModule.readFileTool,
            'list_files': fileOperationsModule.listFilesTool,
            'update_file': fileOperationsModule.updateFileTool,
            'append_to_file': fileOperationsModule.appendToFileTool,
            'move_file': fileOperationsModule.moveFileTool,
            'view_revision_history': fileOperationsModule.viewRevisionHistoryTool,
            // 任务规划工具
            'create_task_list': taskPlanningModule.createTaskList,
            'update_task_status': taskPlanningModule.updateTaskStatus,
            'get_current_tasks': taskPlanningModule.getCurrentTasks,
            'clear_task_list': taskPlanningModule.clearTaskList,
            // 文件搜索工具
            'search_files': fileSearchModule.searchFiles,
            'search_file_content': fileSearchModule.searchFileContent,
            'read_file_by_keyword': fileSearchModule.readFileByKeyword,
            'read_file_lines': fileSearchModule.readFileLines
        };

        // 注册配置文件中定义的工具
        for (const toolConfig of this.config.tools) {
            if (!toolConfig.enabled) {
                console.log(`⏭️  跳过禁用的工具: ${toolConfig.name}`);
                continue;
            }

            const implementation = toolImplementations[toolConfig.name];
            if (!implementation) {
                console.warn(`⚠️  未找到工具实现: ${toolConfig.name}`);
                continue;
            }

            this.registerTool(
                toolConfig.name,
                implementation.func,
                {
                    description: toolConfig.description,
                    parameters: toolConfig.parameters,
                    category: toolConfig.category,
                    enabled: toolConfig.enabled
                }
            );
        }

        console.log(`✅ 已注册 ${this.tools.size} 个工具`);
        return Array.from(this.tools.values());
    }

    /**
     * 获取工具
     */
    getTool(name) {
        return this.tools.get(name);
    }

    /**
     * 获取所有工具
     */
    getAllTools() {
        return Array.from(this.tools.values()).filter(tool => tool.enabled);
    }

    /**
     * 根据类别获取工具
     */
    getToolsByCategory(category) {
        return this.toolsByCategory.get(category) || [];
    }

    /**
     * 获取工具名称列表
     */
    getToolNames() {
        return Array.from(this.tools.keys());
    }

    /**
     * 启用/禁用工具
     */
    setToolEnabled(name, enabled) {
        const tool = this.tools.get(name);
        if (tool) {
            tool.enabled = enabled;
            console.log(`${enabled ? '✅ 启用' : '⏸️  禁用'}工具: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * 移除工具
     */
    unregisterTool(name) {
        const tool = this.tools.get(name);
        if (tool) {
            this.tools.delete(name);
            
            // 从类别中移除
            const categoryTools = this.toolsByCategory.get(tool.category);
            if (categoryTools) {
                const index = categoryTools.findIndex(t => t.name === name);
                if (index !== -1) {
                    categoryTools.splice(index, 1);
                }
            }
            
            console.log(`🗑️  已移除工具: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * 获取工具统计信息
     */
    getStats() {
        const stats = {
            total: this.tools.size,
            enabled: 0,
            disabled: 0,
            byCategory: {}
        };

        for (const tool of this.tools.values()) {
            if (tool.enabled) {
                stats.enabled++;
            } else {
                stats.disabled++;
            }

            if (!stats.byCategory[tool.category]) {
                stats.byCategory[tool.category] = 0;
            }
            stats.byCategory[tool.category]++;
        }

        return stats;
    }

    /**
     * 清空所有工具
     */
    clear() {
        this.tools.clear();
        this.toolsByCategory.clear();
        console.log('🗑️  已清空所有工具');
    }

    /**
     * 将工具转换为LangChain格式
     */
    toLangChainFormat(toolNames = null) {
        const tools = toolNames 
            ? toolNames.map(name => this.getTool(name)).filter(Boolean)
            : this.getAllTools();

        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            func: tool.func
        }));
    }

    /**
     * 将工具转换为OpenAI Function Calling格式
     */
    toOpenAIFormat(toolNames = null) {
        const tools = toolNames 
            ? toolNames.map(name => this.getTool(name)).filter(Boolean)
            : this.getAllTools();

        return tools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }

    /**
     * 动态添加自定义工具
     */
    addCustomTool(config) {
        const { name, func, description, parameters, category = 'custom' } = config;
        
        if (!name || !func) {
            throw new Error('工具必须包含 name 和 func 属性');
        }

        if (this.tools.has(name)) {
            console.warn(`⚠️  工具 ${name} 已存在，将被覆盖`);
        }

        return this.registerTool(name, func, {
            description,
            parameters,
            category,
            enabled: true
        });
    }
}

/**
 * 全局工具注册器实例
 */
export const globalToolRegistry = new ToolRegistry();

