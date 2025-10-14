import fs from 'fs';
import path from 'path';

/**
 * 项目上下文注入器
 * 像 Cursor 一样，在 AI 开始工作前自动注入项目结构信息
 */
export class ProjectContextInjector {
    constructor(projectName, baseDir = './product') {
        this.projectName = projectName;
        this.projectDir = path.join(baseDir, projectName);
        this.cache = null;
        this.cacheTimestamp = null;
        this.cacheDuration = 30000; // 缓存30秒
    }

    /**
     * 获取项目结构（带缓存）
     */
    getProjectStructure(forceRefresh = false) {
        const now = Date.now();
        
        // 如果缓存有效，直接返回
        if (!forceRefresh && this.cache && this.cacheTimestamp && (now - this.cacheTimestamp < this.cacheDuration)) {
            return this.cache;
        }
        
        // 重新扫描项目结构
        const structure = this._scanProjectStructure();
        
        // 更新缓存
        this.cache = structure;
        this.cacheTimestamp = now;
        
        return structure;
    }

    /**
     * 扫描项目结构
     */
    _scanProjectStructure() {
        if (!fs.existsSync(this.projectDir)) {
            console.warn(`⚠️ 项目目录不存在: ${this.projectDir}`);
            return {
                rootFiles: [],
                folders: {},
                totalFiles: 0
            };
        }

        const structure = {
            rootFiles: [],
            folders: {},
            totalFiles: 0
        };

        // 读取根目录文件
        const rootItems = fs.readdirSync(this.projectDir);
        console.log(`📂 扫描项目: ${this.projectName} → 发现 ${rootItems.length} 个项目`);
        
        for (const item of rootItems) {
            const itemPath = path.join(this.projectDir, item);
            
            try {
                const stat = fs.statSync(itemPath);
                
                if (stat.isFile()) {
                    structure.rootFiles.push(item);
                    structure.totalFiles++;
                } else if (stat.isDirectory()) {
                    // 跳过隐藏文件夹和 node_modules
                    if (item.startsWith('.') || item === 'node_modules') {
                        continue;
                    }
                    
                    // 读取子文件夹内容
                    try {
                        const files = fs.readdirSync(itemPath)
                            .filter(f => {
                                const fPath = path.join(itemPath, f);
                                try {
                                    const fStat = fs.statSync(fPath);
                                    return fStat.isFile();
                                } catch (e) {
                                    return false;
                                }
                            })
                            .sort(); // 按名称排序
                        
                        structure.folders[item] = files;
                        structure.totalFiles += files.length;
                        
                        console.log(`  📁 ${item}/ → ${files.length} 个文件`);
                    } catch (error) {
                        console.warn(`⚠️ 无法读取文件夹 ${item}:`, error.message);
                        structure.folders[item] = [];
                    }
                }
            } catch (error) {
                console.warn(`⚠️ 无法访问 ${item}:`, error.message);
            }
        }

        console.log(`✅ 扫描完成：共 ${structure.totalFiles} 个文件，${Object.keys(structure.folders).length} 个文件夹`);
        
        return structure;
    }

    /**
     * 生成上下文注入文本（格式化为 AI 可读的格式）
     * 显示完整的树形结构
     */
    generateContextText() {
        const structure = this.getProjectStructure();
        
        if (structure.totalFiles === 0) {
            return `\n\n📁 项目状态：空白项目（尚无任何文件）\n`;
        }

        let contextText = `\n\n📁 当前项目完整结构（树形视图）：\n\n`;
        contextText += `${this.projectName}/\n`;
        
        // 根目录文件
        if (structure.rootFiles.length > 0) {
            // 过滤掉隐藏文件，但保留重要的配置文件
            const visibleRootFiles = structure.rootFiles.filter(f => 
                (!f.startsWith('.') && !f.endsWith('-history.json')) || 
                f === 'project-config.json'
            ).sort();
            
            for (const file of visibleRootFiles) {
                contextText += `├── ${file}\n`;
            }
        }

        // 文件夹内容（按名称排序）
        const folderNames = Object.keys(structure.folders).sort();
        const lastFolderIndex = folderNames.length - 1;
        
        for (let i = 0; i < folderNames.length; i++) {
            const folderName = folderNames[i];
            const files = structure.folders[folderName];
            const isLastFolder = i === lastFolderIndex;
            const prefix = isLastFolder ? '└──' : '├──';
            const childPrefix = isLastFolder ? '    ' : '│   ';
            
            // 跳过隐藏文件夹
            if (folderName.startsWith('.')) {
                continue;
            }
            
            contextText += `${prefix} 📁 ${folderName}/ (${files.length} 个文件)\n`;
            
            if (files.length > 0) {
                // 过滤掉备份文件
                const visibleFiles = files.filter(f => 
                    !f.includes('.backup-') && 
                    !f.includes('.revision-history')
                );
                
                const lastFileIndex = visibleFiles.length - 1;
                for (let j = 0; j < visibleFiles.length; j++) {
                    const file = visibleFiles[j];
                    const filePrefix = j === lastFileIndex ? '└──' : '├──';
                    contextText += `${childPrefix}${filePrefix} ${file}\n`;
                }
            } else {
                contextText += `${childPrefix}└── (空文件夹)\n`;
            }
        }

        contextText += `\n📊 统计：共 ${structure.totalFiles} 个文件，${folderNames.length} 个文件夹\n`;
        
        return contextText;
    }

    /**
     * 生成简洁的上下文提示（用于系统提示词）
     */
    generateCompactContext() {
        const structure = this.getProjectStructure();
        
        if (structure.totalFiles === 0) {
            return {
                hasFiles: false,
                message: '当前是空白项目，尚无任何文件。'
            };
        }

        // 构建简洁的文件列表
        const fileList = [];
        
        // 根目录文件
        for (const file of structure.rootFiles) {
            fileList.push(`项目根目录/${file}`);
        }

        // 文件夹文件
        for (const [folder, files] of Object.entries(structure.folders)) {
            for (const file of files) {
                fileList.push(`${folder}/${file}`);
            }
        }

        return {
            hasFiles: true,
            totalFiles: structure.totalFiles,
            folders: Object.keys(structure.folders),
            rootFiles: structure.rootFiles,
            fileList: fileList,
            message: `项目包含 ${structure.totalFiles} 个文件，分布在 ${Object.keys(structure.folders).length} 个文件夹中。`
        };
    }

    /**
     * 增强用户提示（注入项目结构）
     */
    enhancePrompt(userPrompt) {
        const contextText = this.generateContextText();
        
        return `${contextText}\n用户请求：${userPrompt}`;
    }

    /**
     * 生成智能提示（给AI的建议）
     */
    generateSmartHints() {
        const structure = this.getProjectStructure();
        
        if (structure.totalFiles === 0) {
            return {
                isEmpty: true,
                hints: [
                    '这是一个空白项目，你可能需要创建基础文件',
                    '建议先读取"项目知识库.md"了解项目要求',
                    '创建文件时使用 generate_long_content 或 save_file 工具'
                ]
            };
        }

        const hints = [];
        
        // 检查是否有项目知识库
        if (structure.rootFiles.includes('项目知识库.md')) {
            hints.push('项目包含"项目知识库.md"，创作前应该先读取它了解风格要求');
        }

        // 检查文件夹情况
        const folderCount = Object.keys(structure.folders).length;
        if (folderCount > 0) {
            hints.push(`项目有 ${folderCount} 个文件夹，你已经知道所有文件的确切位置`);
        }

        // 检查章节数量
        if (structure.folders['章节内容']) {
            const chapterCount = structure.folders['章节内容'].length;
            hints.push(`当前有 ${chapterCount} 个章节，续写时使用 update_file 而不是创建新文件`);
        }

        hints.push('你已经知道所有文件的确切名称，可以直接使用它们，无需调用 list_files');

        return {
            isEmpty: false,
            hints: hints
        };
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache = null;
        this.cacheTimestamp = null;
    }
}


