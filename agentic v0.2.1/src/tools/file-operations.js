import fs from 'fs';
import path from 'path';

/**
 * 辅助函数：获取文件路径，支持项目根目录
 */
function getFilePath(novelsDir, projectName, type, filename = '') {
    if (type === '项目根目录') {
        return filename 
            ? path.join(novelsDir, projectName, filename)
            : path.join(novelsDir, projectName);
    } else {
        return filename
            ? path.join(novelsDir, projectName, type, filename)
            : path.join(novelsDir, projectName, type);
    }
}

/**
 * 文件操作工具集
 * 提供保存、移动、列出、读取文件的能力
 */

/**
 * 保存内容到文件
 */
export const saveFileTool = {
    name: "save_file",
    description: "保存内容到指定类型的文件夹。文件名格式：[标题].md（如果重复会自动添加编号，如：标题(1).md）。⚠️ 重要限制：content 单次最多 600 字符（约 300 汉字），超过会导致 JSON 解析失败。长内容必须分段：1) 先用 save_file 保存前 600 字；2) 再用 append_to_file 多次追加，每次不超过 600 字。",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹。可选值：人物设定、世界观设定、章节内容、大纲、灵感记录、设定资料、创作笔记、项目根目录"
            },
            title: {
                type: "string",
                description: "文件标题"
            },
            content: {
                type: "string",
                description: "文件内容（Markdown格式）。注意：单次最多 600 字，长内容需分段"
            }
        },
        required: ["type", "title", "content"]
    },
    
    func: async (input) => {
        try {
            const params = typeof input === 'string' ? JSON.parse(input) : input;
            const { type, title, content } = params;
            
            if (!type || !title || !content) {
                return '错误：缺少必需参数。需要提供 type（类型）、title（标题）、content（内容）';
            }
            
            // 验证类型
            const validTypes = ['人物设定', '世界观设定', '章节内容', '大纲', '灵感记录', '设定资料', '创作笔记'];
            if (!validTypes.includes(type)) {
                return `错误：无效的类型 "${type}"。有效类型：${validTypes.join('、')}`;
            }
            
            // 🔥 验证内容长度（单次最多 600 字）
            const contentLength = content.length;
            if (contentLength > 600) {
                return `❌ 错误：内容太长（${contentLength} 字），超过单次最多 600 字的限制。\n\n解决方案：\n1. 先调用 save_file 保存前 600 字\n2. 然后多次调用 append_to_file 追加后续内容，每次不超过 600 字\n\n示例：\n- save_file: 保存第 1-600 字\n- append_to_file: 追加第 601-1200 字\n- append_to_file: 追加第 1201-1800 字\n以此类推...`;
            }
            
            // 构建文件路径
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            // 🔥 优先使用环境变量中的项目名称（由 server.js 注入）
            let projectName = process.env.CURRENT_PROJECT;
            
            // 如果没有环境变量，查找第一个项目目录
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '错误：未找到项目目录';
            }
            
            const typeDir = path.join(novelsDir, projectName, type);
            
            // 确保目录存在
            if (!fs.existsSync(typeDir)) {
                fs.mkdirSync(typeDir, { recursive: true });
            }
            
            // 生成文件名（不带时间戳）
            const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
            let filename = `${safeTitle}.md`;
            let filePath = path.join(typeDir, filename);
            
            // 如果文件已存在，添加编号避免覆盖
            let counter = 1;
            while (fs.existsSync(filePath)) {
                filename = `${safeTitle}(${counter}).md`;
                filePath = path.join(typeDir, filename);
                counter++;
            }
            
            // 构建完整的Markdown内容
            const fullContent = `# ${title}

## 元数据

- **类型**: ${type}
- **创建时间**: ${new Date().toLocaleString('zh-CN')}

---

## 内容

${content}
`;
            
            // 保存文件
            fs.writeFileSync(filePath, fullContent, 'utf8');
            
            return `✅ 已保存到：${type}/${filename}`;
            
        } catch (error) {
            return `保存文件失败：${error.message}`;
        }
    }
};

/**
 * 移动文件到另一个文件夹
 */
export const moveFileTool = {
    name: "move_file",
    description: "移动文件到另一个类型文件夹",
    parameters: {
        type: "object",
        properties: {
            filename: {
                type: "string",
                description: "要移动的文件名（完整文件名，包含扩展名）"
            },
            from_type: {
                type: "string",
                enum: ["人物设定", "世界观设定", "章节内容", "大纲", "灵感记录", "设定资料", "创作笔记"],
                description: "源文件夹类型"
            },
            to_type: {
                type: "string",
                enum: ["人物设定", "世界观设定", "章节内容", "大纲", "灵感记录", "设定资料", "创作笔记"],
                description: "目标文件夹类型"
            }
        },
        required: ["filename", "from_type", "to_type"]
    },
    
    func: async (input) => {
        try {
            const params = typeof input === 'string' ? JSON.parse(input) : input;
            const { filename, from_type, to_type } = params;
            
            if (!filename || !from_type || !to_type) {
                return '错误：缺少必需参数。需要提供 filename、from_type、to_type';
            }
            
            // 查找项目目录
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            // 🔥 优先使用环境变量中的项目名称（由 server.js 注入）
            let projectName = process.env.CURRENT_PROJECT;
            
            // 如果没有环境变量，查找第一个项目目录
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '错误：未找到项目目录';
            }
            
            const fromDir = path.join(novelsDir, projectName, from_type);
            const toDir = path.join(novelsDir, projectName, to_type);
            const fromPath = path.join(fromDir, filename);
            const toPath = path.join(toDir, filename);
            
            // 验证源文件存在
            if (!fs.existsSync(fromPath)) {
                // 尝试查找类似的文件
                if (fs.existsSync(fromDir)) {
                    const files = fs.readdirSync(fromDir);
                    const similar = files.filter(f => f.includes(filename.replace('.md', '')));
                    if (similar.length > 0) {
                        return `错误：未找到文件 "${filename}"。可能的文件：${similar.join('、')}`;
                    }
                }
                return `错误：未找到文件 "${filename}" 在 "${from_type}" 文件夹中`;
            }
            
            // 确保目标目录存在
            if (!fs.existsSync(toDir)) {
                fs.mkdirSync(toDir, { recursive: true });
            }
            
            // 移动文件
            fs.renameSync(fromPath, toPath);
            
            return `✅ 已将文件从 "${from_type}" 移动到 "${to_type}"`;
            
        } catch (error) {
            return `移动文件失败：${error.message}`;
        }
    }
};

/**
 * 列出指定类型文件夹的所有文件
 */
export const listFilesTool = {
    name: "list_files",
    description: "列出指定类型文件夹中的所有文件",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件夹类型名称，或'全部'查看所有文件夹"
            }
        },
        required: ["type"]
    },
    
    func: async (input) => {
        try {
            // 处理输入：提取 type 字段
            let type;
            if (typeof input === 'string') {
                type = input.trim();
            } else if (input && typeof input === 'object') {
                type = input.type;
            } else {
                return '❌ 错误：无效的输入格式';
            }
            
            // 如果输入被引号包裹，去掉引号
            if (typeof type === 'string') {
                if (type.startsWith('"') && type.endsWith('"')) {
                    type = type.slice(1, -1);
                } else if (type.startsWith("'") && type.endsWith("'")) {
                    type = type.slice(1, -1);
                }
            } else {
                return '❌ 错误：type 参数必须是字符串';
            }
            
            // 查找项目目录
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            // 🔥 优先使用环境变量中的项目名称（由 server.js 注入）
            let projectName = process.env.CURRENT_PROJECT;
            
            // 如果没有环境变量，查找第一个项目目录
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '错误：未找到项目目录';
            }
            
            const projectPath = path.join(novelsDir, projectName);
            
            // 如果是"全部"，列出所有类型
            if (type === '全部' || type === 'all') {
                const types = ['项目根目录', '人物设定', '世界观设定', '章节内容', '大纲', '灵感记录', '设定资料', '创作笔记'];
                let result = '📂 项目文件列表：\n\n';
                
                for (const t of types) {
                    const typeDir = t === '项目根目录' 
                        ? projectPath 
                        : path.join(projectPath, t);
                    if (fs.existsSync(typeDir)) {
                        const files = fs.readdirSync(typeDir)
                            .filter(f => {
                                // 项目根目录只显示 .md 文件
                                if (t === '项目根目录') {
                                    return f.endsWith('.md') && !fs.statSync(path.join(typeDir, f)).isDirectory();
                                }
                                return f.endsWith('.md') && f !== 'index.md';
                            })
                            .map(f => `  - ${f}`)
                            .join('\n');
                        
                        if (files) {
                            result += `${t}/\n${files}\n\n`;
                        }
                    }
                }
                
                return result || '项目中还没有任何文件';
            }
            
            // 列出指定类型
            const typeDir = type === '项目根目录' 
                ? projectPath 
                : path.join(projectPath, type);
            
            // 🔥 自动创建文件夹（如果不存在）
            if (!fs.existsSync(typeDir)) {
                try {
                    fs.mkdirSync(typeDir, { recursive: true });
                    return `"${type}" 文件夹刚刚创建，目前还没有文件`;
                } catch (error) {
                    return `❌ 错误：无法创建 "${type}" 文件夹：${error.message}`;
                }
            }
            
            const files = fs.readdirSync(typeDir)
                .filter(f => {
                    // 项目根目录只显示 .md 文件
                    if (type === '项目根目录') {
                        return f.endsWith('.md') && !fs.statSync(path.join(typeDir, f)).isDirectory();
                    }
                    return f.endsWith('.md') && f !== 'index.md';
                });
            
            if (files.length === 0) {
                return `"${type}" 文件夹中还没有文件`;
            }
            
            return `📂 ${type}/\n${files.map(f => `  - ${f}`).join('\n')}`;
            
        } catch (error) {
            return `列出文件失败：${error.message}`;
        }
    }
};

/**
 * 读取文件内容
 */
export const readFileTool = {
    name: "read_file",
    description: "读取指定文件的内容",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹。可选值：人物设定、世界观设定、章节内容、大纲、灵感记录、设定资料、创作笔记、项目根目录"
            },
            filename: {
                type: "string",
                description: "文件名（完整文件名，包含扩展名）"
            }
        },
        required: ["type", "filename"]
    },
    
    func: async (input) => {
        try {
            const params = typeof input === 'string' ? JSON.parse(input) : input;
            const { type, filename } = params;
            
            if (!type || !filename) {
                return '错误：缺少必需参数。需要提供 type（类型）、filename（文件名）';
            }
            
            // 查找项目目录
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            // 🔥 优先使用环境变量中的项目名称（由 server.js 注入）
            let projectName = process.env.CURRENT_PROJECT;
            
            // 如果没有环境变量，查找第一个项目目录
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '错误：未找到项目目录';
            }
            
            // 🔥 处理项目根目录文件（如创作提示词知识库.md）
            let filePath;
            if (type === '项目根目录') {
                filePath = path.join(novelsDir, projectName, filename);
            } else {
                filePath = path.join(novelsDir, projectName, type, filename);
            }
            
            if (!fs.existsSync(filePath)) {
                // 尝试查找类似的文件
                const typeDir = type === '项目根目录' 
                    ? path.join(novelsDir, projectName)
                    : path.join(novelsDir, projectName, type);
                if (fs.existsSync(typeDir)) {
                    const files = fs.readdirSync(typeDir).filter(f => f.endsWith('.md') && f !== 'index.md');
                    const similar = files.filter(f => f.includes(filename.replace('.md', '')));
                    if (similar.length > 0) {
                        return `❌ 错误：文件 "${filename}" 不存在。\n\n该文件夹中实际存在的文件：\n${files.map(f => `  - ${f}`).join('\n')}\n\n建议：请使用上面列出的实际文件名。`;
                    }
                    if (files.length > 0) {
                        return `❌ 错误：文件 "${filename}" 不存在。\n\n该文件夹中实际存在的文件：\n${files.map(f => `  - ${f}`).join('\n')}\n\n建议：请使用上面列出的实际文件名，不要假想文件内容。`;
                    }
                    return `❌ 错误：文件 "${filename}" 不存在。"${type}" 文件夹中没有任何文件。`;
                }
                return `❌ 错误：文件 "${filename}" 不存在，且 "${type}" 文件夹不存在。`;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            return content;
            
        } catch (error) {
            return `读取文件失败：${error.message}`;
        }
    }
};

/**
 * 更新文件工具 - 支持 diff 格式的精确替换
 */
export const updateFileTool = {
    name: "update_file",
    description: "更新已有文件的内容。支持 diff 模式（精确替换某段文字）或 full 模式（替换整个文件）。每次更新会自动创建备份文件。",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹。可选值：人物设定、世界观设定、章节内容、大纲、灵感记录、设定资料、创作笔记、项目根目录"
            },
            filename: {
                type: "string",
                description: "要更新的文件名（完整文件名，包含扩展名）"
            },
            mode: {
                type: "string",
                enum: ["diff", "full"],
                description: "更新模式：diff=精确替换某段文字，full=替换整个文件"
            },
            old_string: {
                type: "string",
                description: "仅 diff 模式需要，要替换的原文，必须完全匹配（包括空格、换行）"
            },
            new_string: {
                type: "string",
                description: "diff模式=替换后的新文，full模式=完整的新内容"
            },
            revision_note: {
                type: "string",
                description: "修改说明（可选）"
            }
        },
        required: ["type", "filename", "mode", "new_string"]
    },
    
    func: async (input) => {
        try {
            let params;
            if (typeof input === 'string') {
                try {
                    params = JSON.parse(input);
                } catch (parseError) {
                    console.error('❌ JSON 解析失败，输入内容:', input.substring(0, 500));
                    return `❌ 参数格式错误：JSON 解析失败。错误: ${parseError.message}\n提示：如果要替换包含引号或换行的内容，请确保正确转义。`;
                }
            } else {
                params = input;
            }
            const { type, filename, mode = 'diff', old_string, new_string, revision_note = '' } = params;
            
            // 参数验证
            if (!type || !filename || !new_string) {
                return '❌ 错误：缺少必需参数。需要提供 type、filename、new_string';
            }
            
            if (mode === 'diff' && !old_string) {
                return '❌ 错误：diff 模式需要提供 old_string（要替换的原文）';
            }
            
            // 查找项目目录
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            let projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '❌ 错误：未找到项目目录';
            }
            
            const filePath = getFilePath(novelsDir, projectName, type, filename);
            
            // 验证文件存在
            if (!fs.existsSync(filePath)) {
                return `❌ 错误：文件不存在 "${filename}" 在 "${type}" 文件夹中`;
            }
            
            // 读取原文件
            const originalContent = fs.readFileSync(filePath, 'utf8');
            
            // 创建备份
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').replace('Z', 'Z');
            const backupPath = filePath.replace('.md', `.backup-${timestamp}.md`);
            fs.writeFileSync(backupPath, originalContent, 'utf8');
            
            let newContent;
            let changesSummary = '';
            let actualOldString = old_string; // 实际匹配到的字符串（可能经过智能匹配）
            
            if (mode === 'diff') {
                // diff 模式：智能替换（支持空格差异容错）
                let matchFound = false;
                
                // 1. 先尝试精确匹配
                if (originalContent.includes(old_string)) {
                    matchFound = true;
                } else {
                    // 2. 智能匹配：标准化后再匹配（处理空格差异）
                    const normalizeForMatch = (str) => {
                        return str
                            .replace(/　/g, '')  // 移除全角空格
                            .replace(/\s+/g, '')  // 移除所有空格
                            .trim();
                    };
                    
                    const normalizedOld = normalizeForMatch(old_string);
                    
                    // 逐行查找
                    const lines = originalContent.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const normalizedLine = normalizeForMatch(line);
                        
                        if (normalizedLine.includes(normalizedOld) || normalizedOld.includes(normalizedLine)) {
                            // 找到匹配行！
                            actualOldString = line;
                            matchFound = true;
                            console.log(`✅ 智能匹配成功：第 ${i + 1} 行`);
                            console.log(`AI 提供: "${old_string}"`);
                            console.log(`文件实际: "${actualOldString}"`);
                            console.log(`标准化后都是: "${normalizedOld}"`);
                            break;
                        }
                    }
                }
                
                if (!matchFound) {
                    return `❌ 错误：未找到要替换的内容。

请确认 old_string 与原文匹配（已自动处理空格差异）。

💡 建议：
1. 先使用 read_file 工具读取文件内容
2. 复制要修改的段落作为 old_string
3. 如果只改一行，old_string 可以是那一行的主要内容

📄 当前文件前 500 字符：
${originalContent.substring(0, 500)}...`;
                }
                
                // 检查是否有多处匹配
                const occurrences = (originalContent.match(new RegExp(actualOldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                
                if (occurrences > 1) {
                    return `⚠️ 警告：找到 ${occurrences} 处匹配的内容。

为避免误替换，请提供更长的 old_string 以唯一定位要修改的段落。

💡 建议：在 old_string 前后多包含几行上下文，确保唯一匹配。`;
                }
                
                // 使用实际匹配到的字符串进行替换
                newContent = originalContent.replace(actualOldString, new_string);
                
                // 生成 diff 摘要
                const oldLines = actualOldString.split('\n').length;
                const newLines = new_string.split('\n').length;
                const matchType = actualOldString === old_string ? '精确匹配' : '智能匹配（已处理空格差异）';
                changesSummary = `
📝 修改摘要：
- 匹配方式：${matchType}
- 替换位置：第 ${originalContent.substring(0, originalContent.indexOf(actualOldString)).split('\n').length} 行附近
- 原文行数：${oldLines} 行
- 新文行数：${newLines} 行
- 字数变化：${actualOldString.length} → ${new_string.length} 字（${new_string.length - actualOldString.length > 0 ? '+' : ''}${new_string.length - actualOldString.length}）

🔍 Diff 预览：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 删除的内容（前 200 字）：
${actualOldString.substring(0, 200)}${actualOldString.length > 200 ? '...' : ''}

+ 添加的内容（前 200 字）：
${new_string.substring(0, 200)}${new_string.length > 200 ? '...' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                
            } else if (mode === 'full') {
                // full 模式：全量替换
                const metadataMatch = originalContent.match(/^# .+?\n\n## 元数据\n[\s\S]*?---\n\n/);
                
                if (metadataMatch) {
                    // 如果新内容没有元数据，保留原有元数据
                    if (!new_string.includes('## 元数据')) {
                        const contentSection = originalContent.split('## 内容\n\n')[0];
                        newContent = contentSection + '## 内容\n\n' + new_string;
                    } else {
                        newContent = new_string;
                    }
                } else {
                    newContent = new_string;
                }
                
                changesSummary = `
📝 修改摘要：
- 更新模式：全量替换
- 原文字数：${originalContent.length} 字
- 新文字数：${newContent.length} 字
- 字数变化：${newContent.length - originalContent.length > 0 ? '+' : ''}${newContent.length - originalContent.length} 字`;
                
            } else {
                return `❌ 错误：无效的更新模式 "${mode}"。有效模式：diff、full`;
            }
            
            // 保存新内容
            fs.writeFileSync(filePath, newContent, 'utf8');
            
            // 记录修改历史
            const historyPath = filePath.replace('.md', '.revision-history.json');
            let history = [];
            
            if (fs.existsSync(historyPath)) {
                try {
                    history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                } catch (e) {
                    history = [];
                }
            }
            
            history.push({
                timestamp: new Date().toISOString(),
                mode,
                revision_note,
                old_length: originalContent.length,
                new_length: newContent.length,
                backup_file: path.basename(backupPath),
                changes_preview: mode === 'diff' ? {
                    old_preview: actualOldString?.substring(0, 100),
                    new_preview: new_string.substring(0, 100),
                    smart_match: actualOldString !== old_string // 标记是否使用了智能匹配
                } : null
            });
            
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
            
            return `✅ 文件更新成功！

📄 文件：${type}/${filename}
🔄 更新模式：${mode === 'diff' ? 'Diff 替换' : '全量替换'}
💾 备份文件：${path.basename(backupPath)}
📊 修改次数：第 ${history.length} 次修改
${revision_note ? `📝 修改说明：${revision_note}` : ''}
${changesSummary}

💡 提示：
- 备份文件已保存，可用于回滚
- 修改历史已记录到 ${path.basename(historyPath)}
- 如需撤销，可以手动恢复备份文件`;
            
        } catch (error) {
            return `❌ 更新文件失败：${error.message}\n\n堆栈：${error.stack}`;
        }
    }
};

/**
 * 查看文件修改历史工具
 */
export const viewRevisionHistoryTool = {
    name: "view_revision_history",
    description: "查看文件的修改历史记录",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹。可选值：人物设定、世界观设定、章节内容、大纲、灵感记录、设定资料、创作笔记、项目根目录"
            },
            filename: {
                type: "string",
                description: "文件名（完整文件名，包含扩展名）"
            }
        },
        required: ["type", "filename"]
    },
    
    func: async (input) => {
        try {
            const params = typeof input === 'string' ? JSON.parse(input) : input;
            const { type, filename } = params;
            
            if (!type || !filename) {
                return '❌ 错误：缺少必需参数。需要提供 type、filename';
            }
            
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            let projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '❌ 错误：未找到项目目录';
            }
            
            const filePath = getFilePath(novelsDir, projectName, type, filename);
            const historyPath = filePath.replace('.md', '.revision-history.json');
            
            if (!fs.existsSync(historyPath)) {
                return `📝 "${filename}" 暂无修改历史`;
            }
            
            const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            
            if (history.length === 0) {
                return `📝 "${filename}" 暂无修改历史`;
            }
            
            let result = `📊 文件修改历史：${type}/${filename}\n`;
            result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            result += `共 ${history.length} 次修改\n\n`;
            
            history.reverse().forEach((record, index) => {
                const date = new Date(record.timestamp).toLocaleString('zh-CN');
                result += `第 ${history.length - index} 次修改 - ${date}\n`;
                result += `  模式：${record.mode === 'diff' ? 'Diff 替换' : '全量替换'}\n`;
                result += `  字数：${record.old_length} → ${record.new_length} (${record.new_length - record.old_length > 0 ? '+' : ''}${record.new_length - record.old_length})\n`;
                if (record.revision_note) {
                    result += `  说明：${record.revision_note}\n`;
                }
                result += `  备份：${record.backup_file}\n`;
                result += `\n`;
            });
            
            return result;
            
        } catch (error) {
            return `❌ 查看历史失败：${error.message}`;
        }
    }
};

/**
 * 流式聚合生成长内容 - 革命性方案！
 * 工具接收创作指令（prompt），内部调用 LLM stream API 生成纯文本，自动聚合并分段保存
 * 彻底解决 JSON 参数长度限制问题
 */
export const generateLongContentTool = {
    name: "generate_long_content",  
    description: "🚀 革命性工具！用于生成长章节（3000+ 字）。文件名格式：[标题].md（如果重复会自动添加编号，如：第三章(1).md）。参数是创作指令（prompt），不是完整内容。⚠️ prompt应简洁（100-300字符），避免包含复杂的换行、引号等特殊字符，否则可能导致JSON解析失败。工具内部自动调用 LLM 生成纯文本，实时聚合，自动分段保存。一次调用完成整章创作！",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹。可选值：人物设定、世界观设定、章节内容、大纲、灵感记录、设定资料、创作笔记、项目根目录"
            },
            title: {
                type: "string",
                description: "文件标题（如：第三章-临时工）"
            },
            prompt: {
                type: "string",
                description: "创作指令（如：基于第二章续写第三章，描写邹婉琳在驿站的第一天工作，约3000字，包含与程远、周凯的互动）"
            },
            target_length: {
                type: "number",
                description: "目标字数（可选，默认 3000）",
                default: 3000
            }
        },
        required: ["type", "title", "prompt"]
    },
    
    func: async (input) => {
        try {
            let params;
            
            // 🔥 改进的参数解析，添加详细日志
            if (typeof input === 'string') {
                try {
                    params = JSON.parse(input);
                } catch (parseError) {
                    console.error('❌ generate_long_content JSON解析失败');
                    console.error('错误位置:', parseError.message);
                    console.error('接收到的input前500字符:', input.substring(0, 500));
                    console.error('接收到的input后100字符:', input.substring(Math.max(0, input.length - 100)));
                    
                    return `❌ 参数格式错误：JSON解析失败

错误：${parseError.message}

💡 提示：prompt 参数可能包含未转义的特殊字符。
请确保 prompt 中的引号、换行符等都正确转义。

接收到的参数（前200字符）：
${input.substring(0, 200)}...`;
                }
            } else {
                params = input;
            }
            
            const { type, title, prompt, target_length = 3000 } = params;
            
            if (!type || !title || !prompt) {
                return '❌ 错误：缺少必需参数。需要提供 type、title、prompt';
            }
            
            // 动态导入（避免循环依赖）
            const { ChatOpenAI } = await import('@langchain/openai');
            
            // 创建 LLM 实例（用于内部生成）
            const llm = new ChatOpenAI({
                modelName: process.env.MODEL_NAME || "gpt-3.5-turbo",
                temperature: 0.8,
                openAIApiKey: process.env.API_KEY,
                configuration: {
                    baseURL: process.env.API_BASE_URL,
                },
                streaming: true,
                maxTokens: Math.ceil(target_length * 2), // 预估 token 数
            });
            
            console.log(`🚀 [流式聚合] 开始生成: ${title}`);
            console.log(`📝 创作指令: ${prompt.substring(0, 100)}...`);
            console.log(`🎯 目标字数: ${target_length}`);
            
            // 流式生成纯文本
            let fullText = "";
            const stream = await llm.stream(prompt);
            
            for await (const chunk of stream) {
                const content = chunk.content || '';
                fullText += content;
                // 实时反馈进度
                if (fullText.length % 500 === 0) {
                    process.stdout.write(`\r📊 已生成: ${fullText.length} 字符...`);
                }
            }
            
            console.log(`\n✅ 生成完成，共 ${fullText.length} 字符`);
            
            // 自动分段保存（每段 500 字符）
            const segmentSize = 500;
            const segments = [];
            for (let i = 0; i < fullText.length; i += segmentSize) {
                segments.push(fullText.substring(i, i + segmentSize));
            }
            
            console.log(`📦 自动分段: ${segments.length} 段`);
            
            // 构建文件路径
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            let projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '❌ 错误：未找到当前项目';
            }
            
            const targetDir = path.join(novelsDir, projectName, type);
            
            if (!fs.existsSync(targetDir)) {
                return `❌ 错误："${type}" 文件夹不存在`;
            }
            
            // 第1段：创建文件（不带时间戳）
            const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
            let filename = `${safeTitle}.md`;
            let filePath = path.join(targetDir, filename);
            
            // 如果文件已存在，添加编号避免覆盖
            let counter = 1;
            while (fs.existsSync(filePath)) {
                filename = `${safeTitle}(${counter}).md`;
                filePath = path.join(targetDir, filename);
                counter++;
            }
            
            fs.writeFileSync(filePath, segments[0], 'utf8');
            console.log(`✅ 创建文件: ${filename}`);
            
            // 第2-N段：追加内容
            for (let i = 1; i < segments.length; i++) {
                fs.appendFileSync(filePath, segments[i], 'utf8');
                console.log(`📝 追加第 ${i + 1} 段`);
            }
            
            return `✅ 成功！《${title}》已生成并保存
📊 统计：
- 总字数：${fullText.length} 字符
- 分段数：${segments.length} 段
- 文件名：${filename}

内容已自动分段保存，无需手动操作！`;
            
        } catch (error) {
            console.error('❌ 生成长内容失败:', error);
            return `❌ 生成失败：${error.message}`;
        }
    }
};

/**
 * 追加内容到文件末尾（用于分段写作长章节）
 */
export const appendToFileTool = {
    name: "append_to_file",
    description: "追加内容到已有文件的末尾。⚠️ 重要限制：content 单次最多 600 字符（约 300 汉字），超过会导致 JSON 解析失败。长章节必须分多次追加，每次不超过 600 字。",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹。可选值：人物设定、世界观设定、章节内容、大纲、灵感记录、设定资料、创作笔记、项目根目录"
            },
            filename: {
                type: "string",
                description: "文件名（完整文件名，包含扩展名）"
            },
            content: {
                type: "string",
                description: "要追加的内容（单次最多 600 字）"
            }
        },
        required: ["type", "filename", "content"]
    },
    
    func: async (input) => {
        try {
            const params = typeof input === 'string' ? JSON.parse(input) : input;
            const { type, filename, content } = params;
            
            if (!type || !filename || !content) {
                return '❌ 错误：缺少必需参数。需要提供 type、filename、content';
            }
            
            // 🔥 验证内容长度（单次最多 600 字）
            const contentLength = content.length;
            if (contentLength > 600) {
                return `❌ 错误：内容太长（${contentLength} 字），超过单次最多 600 字的限制。\n\n解决方案：\n将内容分成多段，每段不超过 600 字，然后多次调用 append_to_file\n\n示例：\n- append_to_file: 追加第 1-600 字\n- append_to_file: 追加第 601-1200 字\n- append_to_file: 追加第 1201-1800 字\n以此类推...`;
            }
            
            // 查找项目目录
            const projectDir = process.cwd();
            const novelsDir = path.join(projectDir, 'product');
            
            let projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName && fs.existsSync(novelsDir)) {
                const projects = fs.readdirSync(novelsDir).filter(name => {
                    const fullPath = path.join(novelsDir, name);
                    return fs.statSync(fullPath).isDirectory();
                });
                projectName = projects[0];
            }
            
            if (!projectName) {
                return '❌ 错误：未找到项目目录';
            }
            
            const filePath = getFilePath(novelsDir, projectName, type, filename);
            
            // 验证文件存在
            if (!fs.existsSync(filePath)) {
                return `❌ 错误：文件不存在 "${filename}" 在 "${type}" 文件夹中。请先使用 save_file 创建文件，或使用 list_files 查看已有文件。`;
            }
            
            // 读取原文件
            const originalContent = fs.readFileSync(filePath, 'utf8');
            
            // 追加内容（添加两个换行符作为段落分隔）
            const newContent = originalContent + '\n\n' + content;
            
            // 保存文件
            fs.writeFileSync(filePath, newContent, 'utf8');
            
            return `✅ 已追加内容到文件末尾！

📄 文件：${type}/${filename}
➕ 追加字数：${content.length} 字
📊 文件总字数：${originalContent.length} → ${newContent.length} 字

💡 提示：如需继续追加，再次调用本工具即可。`;
            
        } catch (error) {
            return `❌ 追加内容失败：${error.message}`;
        }
    }
};

/**
 * 获取所有文件操作工具
 */
export function getAllFileOperationTools() {
    return [
        generateLongContentTool,  // 🚀 流式聚合：革命性方案，放在第一位！
        saveFileTool,
        moveFileTool,
        listFilesTool,
        readFileTool,
        updateFileTool,
        viewRevisionHistoryTool,
        appendToFileTool
    ];
}

