import fs from 'fs';
import path from 'path';

/**
 * 文件搜索工具
 * 提供类似 Cursor 的文件搜索功能
 */

/**
 * 搜索文件（按文件名）
 * 支持模糊匹配和通配符
 */
export const searchFiles = {
    name: "search_files",
    description: `按文件名搜索项目中的文件，支持模糊匹配。类似 Cursor 的文件搜索功能。

使用场景：
- 不确定文件的确切位置时
- 需要查找包含特定关键词的文件
- 需要查找某类文件（如：所有章节、所有设定）

搜索模式：
- 精确匹配：使用完整文件名（如："第一章.md"）
- 模糊匹配：使用关键词（如："章" 会找到所有包含"章"的文件）
- 通配符：使用 * （如："第*章.md" 会找到所有章节）

结果排序：
- 优先显示完全匹配
- 其次显示包含关键词的文件
- 按文件夹分类显示`,
    parameters: {
        type: "object",
        properties: {
            pattern: {
                type: "string",
                description: "搜索模式，可以是完整文件名、关键词或通配符（如：'章'、'设定'、'第*章'）"
            },
            folder: {
                type: "string",
                description: "限制搜索范围的文件夹（可选）。如：'章节内容'、'人物设定'。不指定则搜索整个项目"
            },
            maxResults: {
                type: "number",
                description: "最多返回的结果数量（默认 20）"
            }
        },
        required: ["pattern"]
    },
    func: async (input) => {
        try {
            const { pattern, folder, maxResults = 20 } = input;
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            const projectDir = path.join('./product', projectName);
            
            if (!fs.existsSync(projectDir)) {
                return "错误：项目目录不存在";
            }

            // 转换搜索模式为正则表达式
            const searchRegex = patternToRegex(pattern);
            
            // 收集所有匹配的文件
            const results = [];
            
            // 如果指定了文件夹，只搜索该文件夹
            if (folder) {
                const folderPath = path.join(projectDir, folder);
                if (fs.existsSync(folderPath)) {
                    searchInDirectory(folderPath, folder, searchRegex, results, maxResults);
                } else {
                    return `错误：文件夹 "${folder}" 不存在`;
                }
            } else {
                // 搜索整个项目
                searchInProject(projectDir, searchRegex, results, maxResults);
            }

            // 格式化结果
            if (results.length === 0) {
                return `未找到匹配 "${pattern}" 的文件\n\n💡 提示：\n- 尝试使用更短的关键词\n- 检查拼写是否正确\n- 使用 list_files 查看所有文件`;
            }

            let output = `🔍 搜索结果：找到 ${results.length} 个匹配 "${pattern}" 的文件\n\n`;
            
            // 按文件夹分组
            const grouped = groupByFolder(results);
            
            for (const [folderName, files] of Object.entries(grouped)) {
                output += `📁 ${folderName} (${files.length} 个文件)\n`;
                files.forEach(file => {
                    output += `  - ${file.name}`;
                    if (file.isExactMatch) {
                        output += ` ⭐`; // 精确匹配标记
                    }
                    output += `\n`;
                });
                output += `\n`;
            }

            if (results.length >= maxResults) {
                output += `💡 显示前 ${maxResults} 个结果，使用更具体的搜索词以缩小范围`;
            }

            console.log(`🔍 搜索文件: "${pattern}" → 找到 ${results.length} 个结果`);

            return output;
        } catch (error) {
            console.error('搜索文件失败:', error);
            return `搜索文件失败: ${error.message}`;
        }
    }
};

/**
 * 在整个项目中搜索
 */
function searchInProject(projectDir, searchRegex, results, maxResults) {
    const items = fs.readdirSync(projectDir);
    
    for (const item of items) {
        if (results.length >= maxResults) break;
        
        const itemPath = path.join(projectDir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            // 跳过隐藏目录和备份目录
            if (item.startsWith('.') || item.includes('backup')) {
                continue;
            }
            
            // 递归搜索子目录
            searchInDirectory(itemPath, item, searchRegex, results, maxResults);
        } else if (stat.isFile()) {
            // 根目录文件
            if (matchesPattern(item, searchRegex)) {
                results.push({
                    name: item,
                    folder: '项目根目录',
                    path: itemPath,
                    isExactMatch: isExactMatch(item, searchRegex)
                });
            }
        }
    }
}

/**
 * 在指定目录中搜索
 */
function searchInDirectory(dirPath, folderName, searchRegex, results, maxResults) {
    try {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            if (results.length >= maxResults) break;
            
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            
            // 只处理文件，跳过子目录
            if (stat.isFile()) {
                // 跳过备份文件和历史文件
                if (file.includes('.backup-') || file.includes('.revision-history')) {
                    continue;
                }
                
                if (matchesPattern(file, searchRegex)) {
                    results.push({
                        name: file,
                        folder: folderName,
                        path: filePath,
                        isExactMatch: isExactMatch(file, searchRegex)
                    });
                }
            }
        }
    } catch (error) {
        console.warn(`搜索目录失败 ${dirPath}:`, error.message);
    }
}

/**
 * 将搜索模式转换为正则表达式
 */
function patternToRegex(pattern) {
    // 转义特殊字符，但保留 * 作为通配符
    let regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
        .replace(/\*/g, '.*'); // * 转换为 .*
    
    return new RegExp(regexPattern, 'i'); // 不区分大小写
}

/**
 * 检查文件名是否匹配搜索模式
 */
function matchesPattern(filename, searchRegex) {
    return searchRegex.test(filename);
}

/**
 * 检查是否完全匹配（不含通配符的情况下）
 */
function isExactMatch(filename, searchRegex) {
    const pattern = searchRegex.source;
    // 如果不包含通配符，且完全匹配，则为精确匹配
    if (!pattern.includes('.*')) {
        return searchRegex.test(filename);
    }
    return false;
}

/**
 * 按文件夹分组
 */
function groupByFolder(results) {
    const grouped = {};
    
    // 先按精确匹配排序
    results.sort((a, b) => {
        if (a.isExactMatch && !b.isExactMatch) return -1;
        if (!a.isExactMatch && b.isExactMatch) return 1;
        return a.name.localeCompare(b.name);
    });
    
    for (const result of results) {
        if (!grouped[result.folder]) {
            grouped[result.folder] = [];
        }
        grouped[result.folder].push(result);
    }
    
    return grouped;
}

/**
 * 搜索文件内容
 * 在文件内容中搜索关键词
 */
export const searchFileContent = {
    name: "search_file_content",
    description: `在文件内容中搜索关键词。适用于需要查找包含特定内容的文件。

使用场景：
- 查找提到某个人物的所有章节
- 查找包含某个情节的文件
- 查找某个设定的引用位置

注意：
- 搜索可能较慢（取决于文件数量）
- 只搜索 .md 文件
- 跳过备份和历史文件`,
    parameters: {
        type: "object",
        properties: {
            keyword: {
                type: "string",
                description: "要搜索的关键词或短语"
            },
            folder: {
                type: "string",
                description: "限制搜索范围的文件夹（可选）"
            },
            maxResults: {
                type: "number",
                description: "最多返回的结果数量（默认 10）"
            }
        },
        required: ["keyword"]
    },
    func: async (input) => {
        try {
            const { keyword, folder, maxResults = 10 } = input;
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            const projectDir = path.join('./product', projectName);
            
            if (!fs.existsSync(projectDir)) {
                return "错误：项目目录不存在";
            }

            const results = [];
            const searchKeyword = keyword.toLowerCase();
            
            // 搜索文件内容
            if (folder) {
                const folderPath = path.join(projectDir, folder);
                if (fs.existsSync(folderPath)) {
                    searchContentInDirectory(folderPath, folder, searchKeyword, results, maxResults);
                } else {
                    return `错误：文件夹 "${folder}" 不存在`;
                }
            } else {
                searchContentInProject(projectDir, searchKeyword, results, maxResults);
            }

            // 格式化结果
            if (results.length === 0) {
                return `未找到包含 "${keyword}" 的文件\n\n💡 提示：\n- 尝试使用更通用的关键词\n- 检查拼写是否正确`;
            }

            let output = `🔍 内容搜索结果：找到 ${results.length} 个包含 "${keyword}" 的文件\n\n`;
            
            for (const result of results) {
                output += `📄 ${result.folder}/${result.name}\n`;
                output += `   匹配 ${result.matches} 次\n`;
                if (result.preview) {
                    output += `   预览：${result.preview}...\n`;
                }
                output += `\n`;
            }

            if (results.length >= maxResults) {
                output += `💡 显示前 ${maxResults} 个结果`;
            }

            console.log(`🔍 搜索内容: "${keyword}" → 找到 ${results.length} 个结果`);

            return output;
        } catch (error) {
            console.error('搜索文件内容失败:', error);
            return `搜索文件内容失败: ${error.message}`;
        }
    }
};

/**
 * 在整个项目中搜索内容
 */
function searchContentInProject(projectDir, keyword, results, maxResults) {
    const items = fs.readdirSync(projectDir);
    
    for (const item of items) {
        if (results.length >= maxResults) break;
        
        const itemPath = path.join(projectDir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            if (item.startsWith('.') || item.includes('backup')) {
                continue;
            }
            searchContentInDirectory(itemPath, item, keyword, results, maxResults);
        } else if (stat.isFile() && item.endsWith('.md')) {
            searchInFile(itemPath, item, '项目根目录', keyword, results);
        }
    }
}

/**
 * 在指定目录中搜索内容
 */
function searchContentInDirectory(dirPath, folderName, keyword, results, maxResults) {
    try {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            if (results.length >= maxResults) break;
            
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile() && file.endsWith('.md')) {
                if (file.includes('.backup-') || file.includes('.revision-history')) {
                    continue;
                }
                searchInFile(filePath, file, folderName, keyword, results);
            }
        }
    } catch (error) {
        console.warn(`搜索目录内容失败 ${dirPath}:`, error.message);
    }
}

/**
 * 在单个文件中搜索
 */
function searchInFile(filePath, filename, folder, keyword, results) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const contentLower = content.toLowerCase();
        
        // 计算匹配次数
        const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
        
        if (matches > 0) {
            // 提取预览（第一次出现的位置）
            const index = contentLower.indexOf(keyword);
            const start = Math.max(0, index - 30);
            const end = Math.min(content.length, index + keyword.length + 30);
            const preview = content.substring(start, end).replace(/\n/g, ' ').trim();
            
            results.push({
                name: filename,
                folder: folder,
                path: filePath,
                matches: matches,
                preview: preview
            });
        }
    } catch (error) {
        // 忽略读取失败的文件
    }
}

/**
 * 智能读取文件（按关键词）
 * 只返回包含关键词的相关片段，节省上下文
 */
export const readFileByKeyword = {
    name: "read_file_by_keyword",
    description: `智能读取文件内容，只返回包含指定关键词的相关片段。适用于长文档，可大幅节省上下文空间。

使用场景：
- 文档很长（3000+ 字），不需要全部内容
- 只关心包含某个关键词的部分
- 需要快速定位文档中的特定内容
- 节省 token 成本

优势：
- 只返回相关片段（每个片段约 300-600 字）
- 自动提取关键词周围的上下文
- 比读取整个文档节省 80-90% 的 token
- 支持多个关键词匹配

示例：
用户："主角在第三章做了什么？"
你：read_file_by_keyword({ 
    type: "章节内容",
    filename: "第三章-修炼.md",
    keyword: "主角"
})
→ 只返回包含"主角"的相关段落，而不是整个章节`,
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹"
            },
            filename: {
                type: "string",
                description: "文件名（完整文件名，包含扩展名）"
            },
            keyword: {
                type: "string",
                description: "要搜索的关键词（区分大小写）"
            },
            contextLength: {
                type: "number",
                description: "每个片段的上下文长度（字符数，默认 300）"
            },
            maxSegments: {
                type: "number",
                description: "最多返回的片段数量（默认 5）"
            }
        },
        required: ["type", "filename", "keyword"]
    },
    func: async (input) => {
        try {
            const { 
                type, 
                filename, 
                keyword, 
                contextLength = 300, 
                maxSegments = 5 
            } = input;
            
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            // 构建文件路径
            const projectDir = path.join('./product', projectName);
            let filePath;
            
            if (type === '项目根目录') {
                filePath = path.join(projectDir, filename);
            } else {
                filePath = path.join(projectDir, type, filename);
            }

            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                return `错误：文件 "${filename}" 不存在于 "${type}" 中`;
            }

            // 读取文件内容
            const content = fs.readFileSync(filePath, 'utf8');
            const contentLength = content.length;
            
            // 如果文件很短（< 1000 字符），直接返回全部
            if (contentLength < 1000) {
                console.log(`📄 文件较短 (${contentLength} 字符)，返回全部内容`);
                return `📄 ${type}/${filename}\n字数：${contentLength} 字符（文件较短，返回全部内容）\n\n${content}`;
            }

            // 查找所有关键词出现的位置
            const keywordLower = keyword.toLowerCase();
            const contentLower = content.toLowerCase();
            const positions = [];
            
            let index = contentLower.indexOf(keywordLower);
            while (index !== -1 && positions.length < maxSegments * 2) {
                positions.push(index);
                index = contentLower.indexOf(keywordLower, index + 1);
            }

            if (positions.length === 0) {
                return `❌ 未在文件中找到关键词 "${keyword}"\n\n💡 提示：\n- 检查拼写是否正确\n- 尝试使用更通用的关键词\n- 或使用 read_file 读取完整内容`;
            }

            // 提取片段（避免重叠）
            const segments = [];
            const usedRanges = [];
            
            for (const pos of positions) {
                if (segments.length >= maxSegments) break;
                
                // 计算片段范围
                const start = Math.max(0, pos - contextLength);
                const end = Math.min(content.length, pos + keyword.length + contextLength);
                
                // 检查是否与已有片段重叠
                const overlaps = usedRanges.some(range => 
                    (start >= range[0] && start <= range[1]) ||
                    (end >= range[0] && end <= range[1])
                );
                
                if (!overlaps) {
                    // 智能边界调整：尽量在句子边界处截断
                    let adjustedStart = start;
                    let adjustedEnd = end;
                    
                    // 向前找句子开始（。、！、？、\n）
                    for (let i = start; i > Math.max(0, start - 50); i--) {
                        if (['。', '！', '？', '\n'].includes(content[i])) {
                            adjustedStart = i + 1;
                            break;
                        }
                    }
                    
                    // 向后找句子结束
                    for (let i = end; i < Math.min(content.length, end + 50); i++) {
                        if (['。', '！', '？', '\n'].includes(content[i])) {
                            adjustedEnd = i + 1;
                            break;
                        }
                    }
                    
                    const segment = content.substring(adjustedStart, adjustedEnd).trim();
                    segments.push({
                        position: pos,
                        text: segment,
                        startLine: content.substring(0, adjustedStart).split('\n').length
                    });
                    
                    usedRanges.push([adjustedStart, adjustedEnd]);
                }
            }

            // 格式化输出
            let output = `📄 ${type}/${filename}\n`;
            output += `文件大小：${contentLength} 字符\n`;
            output += `关键词：${keyword}\n`;
            output += `匹配次数：${positions.length} 次\n`;
            output += `返回片段：${segments.length} 个（节省约 ${Math.round((1 - (segments.length * contextLength * 2) / contentLength) * 100)}% 的上下文空间）\n`;
            output += `\n${'='.repeat(50)}\n\n`;
            
            segments.forEach((segment, index) => {
                output += `【片段 ${index + 1}】（第 ${segment.startLine} 行附近）\n`;
                output += `${segment.text}\n`;
                output += `\n${'-'.repeat(50)}\n\n`;
            });

            output += `💡 提示：\n`;
            output += `- 如需查看完整内容，使用 read_file\n`;
            output += `- 如需查看其他关键词，可再次使用本工具\n`;
            output += `- 已省略 ${positions.length - segments.length} 个重复或相近的匹配`;

            console.log(`🔍 智能读取: ${filename} → 找到 ${positions.length} 处匹配，返回 ${segments.length} 个片段`);

            return output;
        } catch (error) {
            console.error('智能读取文件失败:', error);
            return `智能读取文件失败: ${error.message}`;
        }
    }
};

/**
 * 读取文件的指定行范围
 * 适用于大文件的精确定位读取
 */
export const readFileLines = {
    name: "read_file_lines",
    description: `读取文件的指定行范围。适用于已知需要读取的具体位置。

使用场景：
- 配合 read_file_by_keyword 使用（先定位，再精确读取）
- 需要读取文件的特定部分
- 修改文件前查看具体内容

示例：
read_file_lines({
    type: "章节内容",
    filename: "第三章.md",
    startLine: 50,
    endLine: 100
})
→ 只返回第 50-100 行`,
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                description: "文件所在的文件夹"
            },
            filename: {
                type: "string",
                description: "文件名（完整文件名，包含扩展名）"
            },
            startLine: {
                type: "number",
                description: "起始行号（从 1 开始）"
            },
            endLine: {
                type: "number",
                description: "结束行号"
            }
        },
        required: ["type", "filename", "startLine", "endLine"]
    },
    func: async (input) => {
        try {
            const { type, filename, startLine, endLine } = input;
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            // 构建文件路径
            const projectDir = path.join('./product', projectName);
            let filePath;
            
            if (type === '项目根目录') {
                filePath = path.join(projectDir, filename);
            } else {
                filePath = path.join(projectDir, type, filename);
            }

            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                return `错误：文件 "${filename}" 不存在于 "${type}" 中`;
            }

            // 读取文件并分割为行
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const totalLines = lines.length;

            // 验证行号
            if (startLine < 1 || startLine > totalLines) {
                return `错误：起始行号 ${startLine} 超出范围（文件共 ${totalLines} 行）`;
            }
            if (endLine < startLine || endLine > totalLines) {
                return `错误：结束行号 ${endLine} 无效（起始行：${startLine}，文件共 ${totalLines} 行）`;
            }

            // 提取指定范围的行（注意：数组索引从 0 开始）
            const selectedLines = lines.slice(startLine - 1, endLine);
            const selectedContent = selectedLines.join('\n');

            let output = `📄 ${type}/${filename}（第 ${startLine}-${endLine} 行）\n`;
            output += `文件总行数：${totalLines}\n`;
            output += `读取行数：${endLine - startLine + 1}\n\n`;
            output += `${'='.repeat(50)}\n\n`;
            output += selectedContent;
            output += `\n\n${'='.repeat(50)}`;

            console.log(`📄 读取行范围: ${filename} → 第 ${startLine}-${endLine} 行`);

            return output;
        } catch (error) {
            console.error('读取文件行范围失败:', error);
            return `读取文件行范围失败: ${error.message}`;
        }
    }
};

