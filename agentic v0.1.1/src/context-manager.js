import fs from 'fs';
import path from 'path';

/**
 * 上下文管理系统
 * 负责自动保存、索引和检索各类创作内容
 */
export class ContextManager {
    constructor(projectManager) {
        this.projectManager = projectManager;
        this.projectDir = projectManager.projectDir;
        
        // 内容类型映射（全部使用中文目录名）
        this.contentTypes = {
            '灵感': '灵感记录',
            '人物': '人物设定',
            '世界观': '世界观设定', 
            '章节': '章节内容',
            '大纲': '大纲',
            '设定': '设定资料',
            '笔记': '创作笔记'
        };
    }

    /**
     * 保存内容到指定类型的文件
     */
    async saveContent(type, title, content, metadata = {}) {
        try {
            const typeDir = this.getTypeDirectory(type);
            
            // 确保目录存在
            if (!fs.existsSync(typeDir)) {
                fs.mkdirSync(typeDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}_${this.sanitizeFilename(title)}.md`;
            const filePath = path.join(typeDir, filename);

            // 构建文件内容
            const fileContent = this.buildFileContent(title, content, metadata);
            
            // 保存文件
            fs.writeFileSync(filePath, fileContent, 'utf8');
            
            // 更新索引
            await this.updateIndex(type, title, filename, metadata);
            
            console.log(`✅ 已保存 ${type}: ${title}`);
            return filePath;
        } catch (error) {
            console.error(`❌ 保存 ${type} 失败:`, error);
            throw error;
        }
    }

    /**
     * 构建文件内容
     */
    buildFileContent(title, content, metadata) {
        const timestamp = new Date().toLocaleString('zh-CN');
        let fileContent = `# ${title}\n\n`;
        
        // 添加元数据
        if (Object.keys(metadata).length > 0) {
            fileContent += `## 元数据\n\n`;
            for (const [key, value] of Object.entries(metadata)) {
                fileContent += `- **${key}**: ${value}\n`;
            }
            fileContent += `\n`;
        }
        
        fileContent += `**创建时间**: ${timestamp}\n\n`;
        fileContent += `## 内容\n\n${content}\n`;
        
        return fileContent;
    }

    /**
     * 更新索引文件
     */
    async updateIndex(type, title, filename, metadata) {
        const typeDir = this.getTypeDirectory(type);
        const indexPath = path.join(typeDir, 'index.md');
        
        if (fs.existsSync(indexPath)) {
            let indexContent = fs.readFileSync(indexPath, 'utf8');
            
            // 添加新条目
            const timestamp = new Date().toLocaleString('zh-CN');
            let entry = `- [${title}](./${filename}) - ${timestamp}`;
            
            if (Object.keys(metadata).length > 0) {
                const tags = Object.entries(metadata)
                    .map(([key, value]) => `${key}:${value}`)
                    .join(', ');
                entry += ` (${tags})`;
            }
            
            indexContent += `${entry}\n`;
            fs.writeFileSync(indexPath, indexContent, 'utf8');
        }
    }

    /**
     * 获取类型目录
     */
    getTypeDirectory(type) {
        const englishType = this.contentTypes[type] || type;
        return path.join(this.projectDir, englishType);
    }

    /**
     * 清理文件名
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
    }

    /**
     * 搜索相关内容
     */
    async searchContent(query, types = null) {
        const results = [];
        const searchTypes = types || Object.keys(this.contentTypes);
        
        for (const type of searchTypes) {
            const typeDir = this.getTypeDirectory(type);
            if (!fs.existsSync(typeDir)) continue;
            
            const files = fs.readdirSync(typeDir)
                .filter(file => file.endsWith('.md') && file !== 'index.md');
            
            for (const file of files) {
                const filePath = path.join(typeDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                
                if (content.toLowerCase().includes(query.toLowerCase())) {
                    const title = this.extractTitle(content);
                    results.push({
                        type,
                        title,
                        file,
                        path: filePath,
                        snippet: this.extractSnippet(content, query)
                    });
                }
            }
        }
        
        return results;
    }

    /**
     * 提取标题
     */
    extractTitle(content) {
        const match = content.match(/^# (.+)$/m);
        return match ? match[1] : '未知标题';
    }

    /**
     * 提取相关片段
     */
    extractSnippet(content, query) {
        const lines = content.split('\n');
        const queryLower = query.toLowerCase();
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
                const start = Math.max(0, i - 1);
                const end = Math.min(lines.length, i + 2);
                return lines.slice(start, end).join('\n');
            }
        }
        
        return content.substring(0, 200) + '...';
    }

    /**
     * 获取所有内容概览
     */
    async getContentOverview() {
        const overview = {};
        
        // 使用完整的中文目录名作为键，与前端保持一致
        for (const [chineseType, fullChineseName] of Object.entries(this.contentTypes)) {
            const typeDir = path.join(this.projectDir, fullChineseName);
            if (!fs.existsSync(typeDir)) continue;
            
            const files = fs.readdirSync(typeDir)
                .filter(file => file.endsWith('.md') && file !== 'index.md');
            
            // 使用完整的中文名称作为键
            overview[fullChineseName] = {
                count: files.length,
                files: files.map(file => {
                    const filePath = path.join(typeDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    return {
                        filename: file,
                        title: this.extractTitle(content),
                        path: filePath
                    };
                })
            };
        }
        
        return overview;
    }

    /**
     * 读取指定文件内容
     */
    readContent(type, filename) {
        const typeDir = this.getTypeDirectory(type);
        const filePath = path.join(typeDir, filename);
        
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        }
        
        return null;
    }

    /**
     * 获取最近的内容
     */
    getRecentContent(type, limit = 5) {
        const typeDir = this.getTypeDirectory(type);
        if (!fs.existsSync(typeDir)) return [];
        
        const files = fs.readdirSync(typeDir)
            .filter(file => file.endsWith('.md') && file !== 'index.md')
            .map(file => ({
                filename: file,
                path: path.join(typeDir, file),
                mtime: fs.statSync(path.join(typeDir, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, limit);
        
        return files.map(file => ({
            filename: file.filename,
            title: this.extractTitle(fs.readFileSync(file.path, 'utf8')),
            path: file.path,
            mtime: file.mtime
        }));
    }
}