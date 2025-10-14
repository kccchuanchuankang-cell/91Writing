import fs from 'fs';
import path from 'path';

/**
 * 通用项目管理器
 * 负责创建和管理 AI Agent 项目的目录结构
 */
export class ProjectManager {
    constructor(projectName, baseDir = './product') {
        this.projectName = projectName;
        this.baseDir = baseDir;
        this.projectDir = path.join(baseDir, projectName);
    }

    /**
     * 初始化项目目录结构
     * 创建空项目，不包含任何预设文件夹
     */
    async initProject() {
        try {
            // 创建基础目录
            if (!fs.existsSync(this.baseDir)) {
                fs.mkdirSync(this.baseDir, { recursive: true });
            }
            
            // 创建项目根目录（空文件夹）
            if (!fs.existsSync(this.projectDir)) {
                fs.mkdirSync(this.projectDir, { recursive: true });
            }

            // 创建项目配置文件
            const configPath = path.join(this.projectDir, 'project-config.json');
            if (!fs.existsSync(configPath)) {
                const config = {
                    projectName: this.projectName,
                    createdAt: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    type: 'generic',  // 通用项目
                    metadata: {
                        description: '',
                        tags: [],
                        customData: {}  // 用户可自定义的元数据
                    }
                };
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
            }

            // 创建 README 文件
            const readmePath = path.join(this.projectDir, 'README.md');
            if (!fs.existsSync(readmePath)) {
                const readmeContent = `# ${this.projectName}

> AI Agent 项目工作区

## 📋 项目信息

- 创建时间：${new Date().toLocaleString('zh-CN')}
- 项目类型：通用 Agent 项目

## 📝 使用说明

这是一个空白项目，你可以：

1. 通过 AI 对话让系统自动创建文件和文件夹
2. 在 Web 界面手动创建文件和文件夹
3. 根据你的需求自由组织项目结构
4. 在 **项目知识库.md** 中设置项目规则和指导

系统提示词会控制 Agent 的行为和能力。

---

**开始使用**：在对话框中告诉 AI 你想做什么！
`;
                fs.writeFileSync(readmePath, readmeContent, 'utf8');
            }

            // 创建项目知识库文件（用户可编辑的规则和预设）
            const knowledgeBasePath = path.join(this.projectDir, '项目知识库.md');
            if (!fs.existsSync(knowledgeBasePath)) {
                const knowledgeBaseContent = `# 项目知识库

> 📚 这是你的项目知识库，可以在这里定义 AI Agent 在处理此项目时应该遵循的规则、风格和约定。
> 
> AI Agent 会自动读取这个文件，并根据这里的内容来调整工作方式。

---

## 🎯 项目目标

<!-- 描述这个项目的主要目标和用途 -->

*示例：这是一个小说创作项目，目标是创作一部现代都市题材的网络小说。*

---

## 📋 项目规则

<!-- 定义 AI 在处理此项目时必须遵循的规则 -->

### 文件命名规则

- 文件名使用中文，简洁明了
- 避免使用特殊字符
- 同类文件放在同一文件夹

### 内容创作规则

*示例：*
- 每章字数控制在 3000-5000 字
- 使用第三人称叙述
- 保持人物性格一致性

---

## 🎨 创作风格

<!-- 描述期望的创作风格或输出风格 -->

*示例：*
- 文风：轻松幽默，贴近生活
- 节奏：快节奏，不拖沓
- 对话：自然流畅，符合人物性格

---

## 📝 参考资料

<!-- 列出相关的参考资料、链接或说明 -->

*示例：*
- 参考作品：《都市修仙》
- 世界观设定：参见 世界观设定.md
- 人物关系：参见 人物设定.md

---

## 🔧 自定义指令

<!-- 添加任何你希望 AI 遵循的自定义指令 -->

*示例：*
- 在创建新文件时，自动添加创建时间
- 章节结尾留下悬念
- 每次对话前先阅读相关设定文件

---

## 💡 使用提示

1. **这个文件会被 AI 自动读取**：AI 会根据这里的内容调整工作方式
2. **随时修改**：你可以随时更新这个文件，AI 会在下次对话时应用新规则
3. **明确具体**：规则越明确，AI 执行得越准确
4. **使用示例**：提供具体示例能帮助 AI 更好地理解你的需求

---

**开始编辑这个文件，定制你的 AI Agent！**
`;
                fs.writeFileSync(knowledgeBasePath, knowledgeBaseContent, 'utf8');
            }

            console.log(`✅ 项目 "${this.projectName}" 创建完成（空项目）`);
            console.log(`📁 项目路径: ${this.projectDir}`);
            
            return this.projectDir;
        } catch (error) {
            console.error('❌ 项目创建失败:', error);
            throw error;
        }
    }

    /**
     * 创建文件夹
     */
    createFolder(folderPath) {
        const fullPath = path.join(this.projectDir, folderPath);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            return true;
        }
        return false;
    }

    /**
     * 删除文件夹
     */
    deleteFolder(folderPath) {
        const fullPath = path.join(this.projectDir, folderPath);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            return true;
        }
        return false;
    }

    /**
     * 重命名文件夹
     */
    renameFolder(oldPath, newPath) {
        const fullOldPath = path.join(this.projectDir, oldPath);
        const fullNewPath = path.join(this.projectDir, newPath);
        if (fs.existsSync(fullOldPath)) {
            fs.renameSync(fullOldPath, fullNewPath);
            return true;
        }
        return false;
    }

    /**
     * 获取项目信息
     */
    getProjectInfo() {
        const configPath = path.join(this.projectDir, 'project-config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        return null;
    }

    /**
     * 更新项目配置
     */
    updateProjectConfig(updates) {
        const configPath = path.join(this.projectDir, 'project-config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            Object.assign(config, updates);
            config.lastModified = new Date().toISOString();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        }
    }

    /**
     * 递归获取项目文件树结构
     */
    getFileTree(relativePath = '') {
        const fullPath = relativePath 
            ? path.join(this.projectDir, relativePath)
            : this.projectDir;

        if (!fs.existsSync(fullPath)) {
            return null;
        }

        const stats = fs.statSync(fullPath);
        const name = path.basename(fullPath);

        if (stats.isFile()) {
            return {
                name,
                type: 'file',
                path: relativePath,
                size: stats.size,
                modified: stats.mtime
            };
        }

        if (stats.isDirectory()) {
            const children = fs.readdirSync(fullPath)
                .filter(child => !child.startsWith('.') && child !== 'node_modules')
                .map(child => {
                    const childRelPath = relativePath ? path.join(relativePath, child) : child;
                    return this.getFileTree(childRelPath);
                })
                .filter(child => child !== null)
                .sort((a, b) => {
                    // 文件夹排在前面
                    if (a.type === 'directory' && b.type === 'file') return -1;
                    if (a.type === 'file' && b.type === 'directory') return 1;
                    // 同类型按名称排序
                    return a.name.localeCompare(b.name);
                });

            return {
                name,
                type: 'directory',
                path: relativePath,
                children,
                modified: stats.mtime
            };
        }

        return null;
    }
}