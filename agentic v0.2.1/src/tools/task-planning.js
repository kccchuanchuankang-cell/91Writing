import fs from 'fs';
import path from 'path';

/**
 * 任务规划工具
 * 用于复杂任务的分解和跟踪
 */

/**
 * 创建任务列表
 * 用于将复杂任务分解为多个子任务
 */
export const createTaskList = {
    name: "create_task_list",
    description: `创建任务分解清单。当用户要求执行复杂任务时（如：创建完整小说、重构项目、批量操作等），使用此工具将任务分解为多个可执行的子任务。

适用场景：
- 需要多步骤完成的复杂任务
- 需要创建多个相关文件
- 需要按顺序执行的多个操作
- 用户明确要求看到任务清单

格式要求：
- 每个任务应该清晰、可执行
- 任务之间应该有逻辑顺序
- 包含具体的操作和预期结果`,
    parameters: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "任务清单的标题，概括整体任务"
            },
            description: {
                type: "string",
                description: "任务的整体描述，说明要实现什么"
            },
            tasks: {
                type: "array",
                description: "子任务列表，按执行顺序排列",
                items: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            description: "任务ID，使用数字（1, 2, 3...）"
                        },
                        title: {
                            type: "string",
                            description: "任务标题，简短描述"
                        },
                        description: {
                            type: "string",
                            description: "任务详细描述，包含具体操作"
                        },
                        dependencies: {
                            type: "array",
                            description: "依赖的任务ID列表（可选）",
                            items: {
                                type: "string"
                            }
                        }
                    },
                    required: ["id", "title", "description"]
                }
            }
        },
        required: ["title", "tasks"]
    },
    func: async (input) => {
        try {
            // 🔧 处理输入参数（可能是字符串或对象）
            let parsedInput = input;
            if (typeof input === 'string') {
                try {
                    parsedInput = JSON.parse(input);
                } catch (parseError) {
                    return `❌ 参数格式错误：无法解析 JSON\n\n${parseError.message}\n\n💡 提示：请确保 tasks 数组格式正确`;
                }
            }

            const { title, description, tasks } = parsedInput;
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            // 🔧 验证必需参数
            if (!title) {
                return "❌ 错误：缺少必需参数 'title'（任务清单标题）";
            }
            
            if (!tasks || !Array.isArray(tasks)) {
                return "❌ 错误：缺少必需参数 'tasks' 或格式不正确（应为数组）\n\n💡 提示：tasks 应该是一个数组，包含多个任务对象";
            }
            
            if (tasks.length === 0) {
                return "❌ 错误：任务列表不能为空，至少需要一个任务";
            }

            // 🔧 验证每个任务的格式
            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];
                if (!task.id) {
                    return `❌ 错误：任务 ${i + 1} 缺少 'id' 字段`;
                }
                if (!task.title) {
                    return `❌ 错误：任务 ${i + 1} 缺少 'title' 字段`;
                }
                if (!task.description) {
                    return `❌ 错误：任务 ${i + 1} 缺少 'description' 字段`;
                }
            }

            // 创建任务数据结构
            const taskList = {
                id: `task_${Date.now()}`,
                title,
                description: description || "",
                createdAt: new Date().toISOString(),
                status: "in_progress",
                tasks: tasks.map(task => ({
                    ...task,
                    status: "pending",  // pending, in_progress, completed, failed
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }))
            };

            // 保存到项目目录
            const projectDir = path.join('./product', projectName);
            const taskFile = path.join(projectDir, '.current-tasks.json');

            // 确保目录存在
            if (!fs.existsSync(projectDir)) {
                fs.mkdirSync(projectDir, { recursive: true });
            }

            // 保存任务列表
            fs.writeFileSync(taskFile, JSON.stringify(taskList, null, 2), 'utf8');

            console.log(`\n📋 任务列表已创建: ${title}`);
            console.log(`📊 共 ${tasks.length} 个子任务\n`);

            // 返回任务清单的文本表示
            let result = `✅ 已创建任务清单：${title}\n\n`;
            if (description) {
                result += `📝 ${description}\n\n`;
            }
            result += `📋 任务分解（共 ${tasks.length} 项）：\n\n`;
            
            tasks.forEach((task, index) => {
                result += `${index + 1}. ${task.title}\n`;
                result += `   ${task.description}\n`;
                if (task.dependencies && task.dependencies.length > 0) {
                    result += `   依赖：任务 ${task.dependencies.join(', ')}\n`;
                }
                result += `   状态：⏳ 待执行\n\n`;
            });

            result += `💡 提示：我会按照这个清单逐步执行，完成一项后自动进入下一项。`;

            return result;
        } catch (error) {
            console.error('创建任务列表失败:', error);
            return `创建任务列表失败: ${error.message}`;
        }
    }
};

/**
 * 更新任务状态
 */
export const updateTaskStatus = {
    name: "update_task_status",
    description: `更新任务清单中某个子任务的状态。在完成或开始一个子任务时调用。

状态说明：
- pending: 待执行
- in_progress: 执行中
- completed: 已完成
- failed: 失败

使用时机：
- 开始执行某个任务时，设为 in_progress
- 完成某个任务后，设为 completed
- 任务执行失败时，设为 failed`,
    parameters: {
        type: "object",
        properties: {
            taskId: {
                type: "string",
                description: "要更新的任务ID"
            },
            status: {
                type: "string",
                enum: ["pending", "in_progress", "completed", "failed"],
                description: "新的任务状态"
            },
            note: {
                type: "string",
                description: "状态更新说明（可选），如完成情况、失败原因等"
            }
        },
        required: ["taskId", "status"]
    },
    func: async (input) => {
        try {
            const { taskId, status, note } = input;
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            const taskFile = path.join('./product', projectName, '.current-tasks.json');

            // 检查任务文件是否存在
            if (!fs.existsSync(taskFile)) {
                return "错误：未找到任务清单，请先创建任务清单";
            }

            // 读取任务列表
            const content = fs.readFileSync(taskFile, 'utf8');
            const taskList = JSON.parse(content);

            // 查找并更新任务
            const task = taskList.tasks.find(t => t.id === taskId);
            if (!task) {
                return `错误：未找到任务 ID: ${taskId}`;
            }

            const oldStatus = task.status;
            task.status = status;
            task.updatedAt = new Date().toISOString();
            if (note) {
                task.note = note;
            }

            // 检查是否所有任务都完成
            const allCompleted = taskList.tasks.every(t => t.status === 'completed');
            if (allCompleted) {
                taskList.status = 'completed';
                taskList.completedAt = new Date().toISOString();
            }

            // 保存更新后的任务列表
            fs.writeFileSync(taskFile, JSON.stringify(taskList, null, 2), 'utf8');

            // 生成状态表情
            const statusEmoji = {
                pending: '⏳',
                in_progress: '🔄',
                completed: '✅',
                failed: '❌'
            };

            let result = `${statusEmoji[status]} 任务状态已更新\n\n`;
            result += `任务：${task.title}\n`;
            result += `状态：${oldStatus} → ${status}\n`;
            if (note) {
                result += `说明：${note}\n`;
            }

            // 显示进度
            const completed = taskList.tasks.filter(t => t.status === 'completed').length;
            const total = taskList.tasks.length;
            result += `\n📊 整体进度：${completed}/${total} (${Math.round(completed/total*100)}%)`;

            if (allCompleted) {
                result += `\n\n🎉 所有任务已完成！`;
            } else if (status === 'completed') {
                // 找到下一个待执行的任务
                const nextTask = taskList.tasks.find(t => t.status === 'pending');
                if (nextTask) {
                    result += `\n\n⏭️  下一个任务：${nextTask.title}`;
                }
            }

            console.log(`\n${statusEmoji[status]} 任务 ${taskId} 状态: ${status}\n`);

            return result;
        } catch (error) {
            console.error('更新任务状态失败:', error);
            return `更新任务状态失败: ${error.message}`;
        }
    }
};

/**
 * 获取当前任务列表
 */
export const getCurrentTasks = {
    name: "get_current_tasks",
    description: `获取当前项目的任务清单，查看所有任务的状态和进度。

适用场景：
- 用户询问当前有哪些任务
- 需要查看任务进度
- 继续未完成的任务前查看状态`,
    parameters: {
        type: "object",
        properties: {}
    },
    func: async (input) => {
        try {
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            const taskFile = path.join('./product', projectName, '.current-tasks.json');

            // 检查任务文件是否存在
            if (!fs.existsSync(taskFile)) {
                return "当前没有进行中的任务清单。\n\n💡 提示：对于复杂任务，我可以先创建任务清单，然后逐步执行。";
            }

            // 读取任务列表
            const content = fs.readFileSync(taskFile, 'utf8');
            const taskList = JSON.parse(content);

            // 生成任务报告
            let result = `📋 当前任务清单：${taskList.title}\n\n`;
            if (taskList.description) {
                result += `${taskList.description}\n\n`;
            }

            // 统计信息
            const stats = {
                total: taskList.tasks.length,
                pending: taskList.tasks.filter(t => t.status === 'pending').length,
                inProgress: taskList.tasks.filter(t => t.status === 'in_progress').length,
                completed: taskList.tasks.filter(t => t.status === 'completed').length,
                failed: taskList.tasks.filter(t => t.status === 'failed').length
            };

            result += `📊 进度统计：\n`;
            result += `✅ 已完成：${stats.completed}/${stats.total}\n`;
            if (stats.inProgress > 0) result += `🔄 进行中：${stats.inProgress}\n`;
            if (stats.pending > 0) result += `⏳ 待执行：${stats.pending}\n`;
            if (stats.failed > 0) result += `❌ 失败：${stats.failed}\n`;
            result += `\n`;

            // 任务列表
            result += `📝 任务详情：\n\n`;
            const statusEmoji = {
                pending: '⏳',
                in_progress: '🔄',
                completed: '✅',
                failed: '❌'
            };

            taskList.tasks.forEach((task, index) => {
                result += `${index + 1}. ${statusEmoji[task.status]} ${task.title}\n`;
                result += `   ${task.description}\n`;
                result += `   状态：${task.status}`;
                if (task.note) {
                    result += ` | ${task.note}`;
                }
                result += `\n\n`;
            });

            // 下一步建议
            if (stats.pending > 0 || stats.inProgress > 0) {
                const nextTask = taskList.tasks.find(t => t.status === 'pending' || t.status === 'in_progress');
                if (nextTask) {
                    result += `💡 建议：继续执行「${nextTask.title}」`;
                }
            } else if (stats.completed === stats.total) {
                result += `🎉 所有任务已完成！`;
            }

            return result;
        } catch (error) {
            console.error('获取任务列表失败:', error);
            return `获取任务列表失败: ${error.message}`;
        }
    }
};

/**
 * 清除任务列表
 */
export const clearTaskList = {
    name: "clear_task_list",
    description: `清除当前的任务清单。通常在所有任务完成后，或需要开始新的任务时使用。`,
    parameters: {
        type: "object",
        properties: {}
    },
    func: async (input) => {
        try {
            const projectName = process.env.CURRENT_PROJECT;
            
            if (!projectName) {
                return "错误：未设置当前项目";
            }

            const taskFile = path.join('./product', projectName, '.current-tasks.json');

            // 检查任务文件是否存在
            if (!fs.existsSync(taskFile)) {
                return "当前没有任务清单。";
            }

            // 备份后删除
            const backupFile = path.join('./product', projectName, `.tasks-backup-${Date.now()}.json`);
            fs.copyFileSync(taskFile, backupFile);
            fs.unlinkSync(taskFile);

            console.log(`\n🗑️  任务清单已清除（已备份）\n`);

            return `✅ 任务清单已清除\n\n备份文件：${path.basename(backupFile)}\n\n现在可以开始新的任务了！`;
        } catch (error) {
            console.error('清除任务列表失败:', error);
            return `清除任务列表失败: ${error.message}`;
        }
    }
};

