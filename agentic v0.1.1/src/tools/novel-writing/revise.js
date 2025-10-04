/**
 * 局部修改工具
 * 支持对章节、段落进行局部改写
 */
export const revisionTool = {
    name: 'revision',
    description: '局部修改已有内容，支持段落级别的精细改写',
    
    /**
     * 执行局部修改
     * @param {Object} options - 修改选项
     * @param {string} options.filePath - 要修改的文件路径
     * @param {string} options.targetText - 要修改的目标文本片段（用于定位）
     * @param {string} options.revisedText - 修改后的文本
     * @param {string} options.revisionNote - 修改说明
     */
    async execute({ filePath, targetText, revisedText, revisionNote = '' }) {
        const fs = await import('fs');
        const path = await import('path');
        
        try {
            // 读取原文件
            if (!fs.existsSync(filePath)) {
                throw new Error(`文件不存在: ${filePath}`);
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 查找目标文本
            const targetIndex = content.indexOf(targetText);
            if (targetIndex === -1) {
                throw new Error('未找到指定的文本片段，请确认要修改的内容是否准确');
            }
            
            // 执行替换
            const newContent = content.replace(targetText, revisedText);
            
            // 创建备份
            const backupPath = filePath.replace('.md', '.backup.md');
            fs.writeFileSync(backupPath, content, 'utf8');
            
            // 保存修改后的内容
            fs.writeFileSync(filePath, newContent, 'utf8');
            
            // 记录修改历史
            const historyPath = filePath.replace('.md', '.revision-history.json');
            const history = fs.existsSync(historyPath) 
                ? JSON.parse(fs.readFileSync(historyPath, 'utf8'))
                : [];
            
            history.push({
                timestamp: new Date().toISOString(),
                originalText: targetText.substring(0, 100) + '...',
                revisedText: revisedText.substring(0, 100) + '...',
                note: revisionNote,
                backupPath
            });
            
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
            
            return {
                success: true,
                message: `✅ 局部修改完成\n📄 文件: ${filePath}\n💾 备份: ${backupPath}\n📝 修改说明: ${revisionNote}`,
                filePath,
                backupPath,
                revisionCount: history.length
            };
            
        } catch (error) {
            return {
                success: false,
                message: `❌ 修改失败: ${error.message}`,
                error: error.message
            };
        }
    },
    
    /**
     * 查看修改历史
     */
    async getHistory(filePath) {
        const fs = await import('fs');
        const historyPath = filePath.replace('.md', '.revision-history.json');
        
        if (!fs.existsSync(historyPath)) {
            return { success: true, history: [], message: '暂无修改历史' };
        }
        
        const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        return { success: true, history, message: `找到 ${history.length} 条修改记录` };
    },
    
    /**
     * 回滚到备份版本
     */
    async rollback(filePath) {
        const fs = await import('fs');
        const backupPath = filePath.replace('.md', '.backup.md');
        
        if (!fs.existsSync(backupPath)) {
            return { success: false, message: '未找到备份文件' };
        }
        
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(filePath, backupContent, 'utf8');
        
        return { success: true, message: '✅ 已回滚到备份版本' };
    }
};

export default revisionTool;

