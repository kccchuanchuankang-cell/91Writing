import fs from 'fs';
import path from 'path';

/**
 * 对话历史管理器
 * 负责保存和加载项目的对话历史
 */
export class ConversationManager {
    constructor(projectName, baseDir = './novels') {
        this.projectName = projectName;
        this.baseDir = baseDir;
        this.projectDir = path.join(baseDir, projectName);
        this.historyFile = path.join(this.projectDir, 'conversation-history.json');
        this.maxHistoryLength = 20; // 最多保存20条对话
        this.contextLength = 10; // 加载最新10条作为上下文
    }

    /**
     * 加载对话历史
     * @returns {Array} 对话历史数组
     */
    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const content = fs.readFileSync(this.historyFile, 'utf8');
                const data = JSON.parse(content);
                return data.history || [];
            }
        } catch (error) {
            console.warn(`⚠️ 加载对话历史失败 (${this.projectName}):`, error.message);
        }
        return [];
    }

    /**
     * 保存对话历史
     * @param {Array} history - 对话历史数组
     */
    saveHistory(history) {
        try {
            // 确保项目目录存在
            if (!fs.existsSync(this.projectDir)) {
                fs.mkdirSync(this.projectDir, { recursive: true });
            }

            // 限制历史长度
            const trimmedHistory = history.slice(-this.maxHistoryLength);

            const data = {
                projectName: this.projectName,
                lastUpdated: new Date().toISOString(),
                totalMessages: trimmedHistory.length,
                history: trimmedHistory
            };

            fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2), 'utf8');
            
            if (process.env.VERBOSE === 'true') {
                console.log(`✅ 对话历史已保存 (${this.projectName}): ${trimmedHistory.length} 条消息`);
            }
        } catch (error) {
            console.error(`❌ 保存对话历史失败 (${this.projectName}):`, error.message);
        }
    }

    /**
     * 添加一条消息到历史
     * @param {string} role - 角色 ('user' 或 'assistant')
     * @param {string} content - 消息内容
     * @param {object} metadata - 可选的元数据（如推理过程）
     */
    addMessage(role, content, metadata = null) {
        const history = this.loadHistory();
        const message = {
            role,
            content,
            timestamp: new Date().toISOString()
        };
        
        // 如果有元数据，添加到消息中
        if (metadata) {
            message.metadata = metadata;
        }
        
        history.push(message);
        this.saveHistory(history);
        return history;
    }

    /**
     * 获取上下文消息（最新N条）
     * @param {number} count - 获取的消息数量，默认使用 contextLength
     * @returns {Array} 上下文消息数组
     */
    getContext(count = null) {
        const history = this.loadHistory();
        const contextCount = count || this.contextLength;
        return history.slice(-contextCount);
    }

    /**
     * 清空对话历史
     */
    clearHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                fs.unlinkSync(this.historyFile);
                console.log(`✅ 对话历史已清空 (${this.projectName})`);
            }
            return true;
        } catch (error) {
            console.error(`❌ 清空对话历史失败 (${this.projectName}):`, error.message);
            return false;
        }
    }

    /**
     * 删除指定索引的消息
     * @param {number} index - 消息索引（0-based）
     * @returns {boolean} 是否成功
     */
    deleteMessage(index) {
        try {
            const history = this.loadHistory();
            if (index < 0 || index >= history.length) {
                console.error(`❌ 无效的消息索引: ${index}`);
                return false;
            }
            history.splice(index, 1);
            this.saveHistory(history);
            console.log(`✅ 已删除消息 ${index} (${this.projectName})`);
            return true;
        } catch (error) {
            console.error(`❌ 删除消息失败 (${this.projectName}):`, error.message);
            return false;
        }
    }

    /**
     * 获取对话统计信息
     */
    getStats() {
        const history = this.loadHistory();
        const userMessages = history.filter(m => m.role === 'user').length;
        const assistantMessages = history.filter(m => m.role === 'assistant').length;
        
        return {
            total: history.length,
            userMessages,
            assistantMessages,
            lastUpdated: history.length > 0 ? history[history.length - 1].timestamp : null
        };
    }

    /**
     * 构建增强提示（包含对话历史上下文）
     * @param {string} currentPrompt - 当前用户输入
     * @param {number} contextCount - 使用的上下文数量
     * @returns {string} 增强后的提示
     */
    buildEnhancedPrompt(currentPrompt, contextCount = null) {
        const context = this.getContext(contextCount);
        
        if (context.length === 0) {
            return currentPrompt;
        }

        let enhancedPrompt = '以下是我们的对话历史：\n\n';
        
        for (const msg of context) {
            const speaker = msg.role === 'user' ? '用户' : 'AI';
            enhancedPrompt += `${speaker}: ${msg.content}\n\n`;
        }
        
        enhancedPrompt += `当前用户请求：${currentPrompt}`;
        
        return enhancedPrompt;
    }
}

