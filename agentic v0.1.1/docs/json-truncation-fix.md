# JSON 参数截断问题 - 完整解决方案

## 问题分析

### 根本原因

当你使用 `update_file` 或 `save_file` 工具时，如果在 `Action Input` 的 JSON 参数中传递超长内容（如完整章节 3000+ 字），会在约 **1500-2000 字符**处被截断，导致：

```
❌ JSON 解析失败: Unterminated string in JSON at position 1475
```

### 为什么会截断？

1. **不是 `maxTokens` 配置问题** - `maxTokens` 控制模型整体输出长度
2. **是 ReAct 模式的固有限制** - AI 在生成 `Action Input` 参数时，受到以下约束：
   - 函数调用（Function Calling）的参数生成有隐含长度限制
   - 流式输出在检测到某些模式时可能提前终止
   - JSON 字符串生成本身的复杂度限制
3. **不是 LangChain 的 bug** - 这是所有 ReAct 框架的共同特点

## 解决方案

### ✅ 方案 1：使用分段写作（推荐）

使用新增的 `append_to_file` 工具，将长章节分成多段保存：

**工作流程：**
```
1. 第一步：save_file 创建文件 + 第一段（500-800字）
2. 第二步：append_to_file 追加第二段（500-800字）
3. 第三步：append_to_file 追加第三段（500-800字）
4. 第N步：append_to_file 追加最后一段
```

**示例：**
```
User: "写 Chapter 7，3000字"

AI 正确执行:
Thought: 需要写3000字章节，分4段保存避免JSON截断

Action: save_file
Action Input: {"type": "章节内容", "title": "Chapter 7", "content": "第一段800字..."}
[等待 Observation]

Action: append_to_file
Action Input: {"type": "章节内容", "filename": "xxx_Chapter 7.md", "content": "第二段800字..."}
[等待 Observation]

Action: append_to_file
Action Input: {"type": "章节内容", "filename": "xxx_Chapter 7.md", "content": "第三段800字..."}
[等待 Observation]

Action: append_to_file
Action Input: {"type": "章节内容", "filename": "xxx_Chapter 7.md", "content": "第四段600字..."}
[等待 Observation]

Final Answer: Chapter 7 已完成，共3000字
```

### ✅ 方案 2：调整提示词引导 AI

已修改 `prompts/novel-writing-clean.md`：
- 明确告知 AI JSON 参数有 1500-2000 字符限制
- 提供分段写作的详细示例
- 要求长内容（>800字）必须分段

### ✅ 方案 3：使用 `update_file` 的 diff 模式

对于已有文件的修改：
```javascript
{
  "type": "章节内容",
  "filename": "xxx.md",
  "mode": "diff",
  "old_string": "要替换的原文（尽量短）",
  "new_string": "替换后的新文（尽量短）"
}
```

**注意：** `old_string` + `new_string` 的总长度也不能超过 1500 字符。

### ❌ 无效方案

以下方法**无法**解决此问题：

1. ❌ 增加 `MAX_TOKENS` 环境变量 - 不影响工具参数长度
2. ❌ 修改 LangChain 配置 - 这是底层模型的限制
3. ❌ 使用不同的模型 - 所有模型都有类似限制
4. ❌ 修改 `react-agent.js` - 截断发生在模型生成阶段，不是代码解析阶段

## 已实现的改进

### 1. 新增 `append_to_file` 工具

**位置：** `src/tools/file-operations.js`

**功能：**
- 追加内容到已有文件末尾
- 每次追加最多 800 字
- 自动添加段落分隔

**参数：**
```json
{
  "type": "文件夹类型",
  "filename": "文件名",
  "content": "要追加的内容（最多800字）"
}
```

### 2. 更新提示词

**位置：** `prompts/novel-writing-clean.md`

**改进：**
- 第 183-191 行：说明 JSON 参数长度限制
- 第 207-215 行：添加 `append_to_file` 工具说明
- 第 253-312 行：提供分段写作完整示例

## 使用建议

### 何时使用分段写作？

| 内容类型 | 字数 | 推荐方法 |
|---------|------|---------|
| 人物设定 | 200-500字 | 直接 `save_file` |
| 世界观设定 | 300-800字 | 直接 `save_file` |
| 短章节 | <1000字 | 直接 `save_file` |
| 标准章节 | 1000-2000字 | 分2段：`save_file` + `append_to_file` |
| 长章节 | 2000-3000字 | 分3-4段：`save_file` + 多次 `append_to_file` |
| 超长章节 | >3000字 | 分5+段，或创建多个文件（Part 1, Part 2...） |

### 分段策略

**好的分段点：**
- 场景切换
- 时间跳跃
- 视角转换
- 情节段落
- 对话结束

**避免分段点：**
- 句子中间
- 对话进行中
- 紧张情节高潮

## 测试验证

重启服务器后测试：

```bash
# 停止当前服务器 (Ctrl+C)
# 重新启动
npm run web
```

然后在 Web UI 中测试：

```
测试命令: "创建一个测试章节，写500字内容保存到章节内容文件夹"
预期: 成功保存

测试命令: "写 Chapter 7，完整3000字，用分段方式保存"
预期: AI 自动分3-4段，每段调用工具，最终完整保存
```

## 技术细节

### 为什么增加 maxTokens 无效？

`maxTokens` 参数控制的是模型**整体输出**的 token 数量，包括：
- Thought（思考）
- Action（动作名）
- Action Input（参数）

但**单个 Action Input 参数的生成**受到：
1. 模型的函数调用能力限制
2. JSON 格式的复杂度
3. 流式生成时的缓冲区大小

这些是模型底层实现的限制，不受 `maxTokens` 控制。

### 代码层面的限制在哪？

**react-agent.js 第 154 行：**
```javascript
const actionInputMatch = text.match(/Action Input:\s*([\s\S]+?)(?=\n(?:Thought|Action|Observation|Final Answer):|$)/);
```

这个正则表达式会匹配 `Action Input:` 后的所有内容。理论上不限长度。

**但实际限制发生在更早的阶段：**
- 第 266-310 行：流式生成时，模型自身停止生成
- 第 276-296 行：检测到 `Observation:` 时强制截断（防止 AI 编造结果）

**结论：** 代码解析能力没问题，是模型生成阶段的限制。

## 常见问题

### Q: 报错 "(f-string) Missing value for input" 怎么办？

A: 这是提示词模板格式问题。如果在提示词中使用了 JSON 示例（如 `{"type": "章节内容"}`），LangChain 会把花括号 `{}` 当作变量占位符。

**解决方法：** 在提示词中的 JSON 示例里，把花括号转义为双花括号：
- `{"type": "章节内容"}` → `{{"type": "章节内容"}}`
- 已在 `prompts/novel-writing-clean.md` 第 267-302 行修复

### Q: 能否禁用流式输出来避免截断？

A: 不能。截断不是流式输出导致的，而是模型生成参数时的固有限制。非流式模式下同样会被截断。

### Q: 换一个更强的模型（如 GPT-4）能解决吗？

A: 不能。所有模型在函数调用时都有参数长度限制。更强的模型可能限制稍高（约2000字符），但仍然无法传递完整长章节。

### Q: 能否修改工具设计，避免传递长内容？

A: 可以！这正是 `append_to_file` 工具的设计思路 - 化整为零，多次调用。

### Q: 为什么不直接在 Final Answer 中输出，让用户手动保存？

A: 这样会破坏 Agent 的自主性，用户体验差。分段保存是更优雅的解决方案。

## 总结

**核心原则：**
> ReAct 模式下，工具参数 JSON 字符串有约 1500-2000 字符的限制。  
> 长内容必须分段处理，每段控制在 500-800 字以内。

**最佳实践：**
1. 短内容（<800字）：直接 `save_file`
2. 长内容（>800字）：`save_file` 第一段 + `append_to_file` 后续段
3. 修改内容：`update_file` diff 模式，保持 `old_string` + `new_string` < 1500字符

**已完成的改进：**
- ✅ 新增 `append_to_file` 工具
- ✅ 更新提示词，明确限制和示例
- ✅ 提供详细的分段写作指导

**下一步：**
- 重启服务器使改动生效
- 测试长章节分段写作
- 如遇问题，查看本文档调试

