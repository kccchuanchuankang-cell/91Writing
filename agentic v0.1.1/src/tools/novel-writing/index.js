/**
 * 网文创作工具集合
 * 
 * 注意：所有硬编码的模板工具已被移除，改为让 AI 自由创作。
 * 创作指导和示例已移到 prompts/novel-writing-clean.md 和 prompts/novel-writing-templates.md
 */

// 获取所有网文创作工具
export function getAllNovelWritingTools() {
  // 目前没有硬编码的创作工具，AI 直接使用 file-operations 工具和自身能力
  // 如果将来需要特殊工具（如调用外部API），可以在这里添加
  return [];
}

// 获取网文创作工具名称列表
export function getNovelWritingToolNames() {
  return getAllNovelWritingTools().map(tool => tool.name);
}

// 根据名称获取网文创作工具
export function getNovelWritingToolByName(name) {
  return getAllNovelWritingTools().find(tool => tool.name === name);
}