# 提示词模板修复说明

## 问题描述

在使用 ReAct Agent 时遇到错误：

```
❌ 错误: (f-string) Missing value for input "type": "人物设定", ...
```

## 原因分析

LangChain 的 `PromptTemplate` 使用类似 f-string 的模板语法，会将 `{变量名}` 识别为需要替换的模板变量。

当提示词文件中包含 JSON 格式的示例时，JSON 中的大括号 `{}` 被误认为是模板变量标记，导致解析错误。

例如：
```json
{
  "type": "人物设定",
  "title": "主角李明"
}
```

在这个 JSON 中，`{type}` 和 `{title}` 会被识别为模板变量，导致系统寻找这些变量的值，找不到时报错。

## 解决方案

### 方案 1：使用双大括号转义（不推荐）

在模板中使用 `{{` 和 `}}` 来输出字面的大括号：
```
{{"type": "人物设定"}}
```

**缺点**：AI 在输出时也会输出双大括号，导致 JSON 格式错误。

### 方案 2：移除 JSON 示例，改用文字描述（✅ 已采用）

在提示词中不直接展示 JSON 格式，而是用文字描述参数格式：

**修改前：**
```markdown
Action Input: {"type": "人物设定", "title": "主角", "content": "..."}
```

**修改后：**
```markdown
Action Input: [提供完整的JSON，包含 type 字段设为"人物设定"，title 字段设为角色名称，content 字段包含完整内容]
```

## 修改的文件

### 1. `prompts/novel-writing-clean.md`

- **第214-218行**：详细的工具使用示例
  - 移除了完整的 JSON 示例
  - 改为文字描述所需参数

- **第175-197行**：文件操作工具说明
  - 移除了 JSON 格式示例
  - 添加了参数说明和要求

- **第378行**：项目结构使用说明
  - 简化为纯文字描述

### 2. `prompts/react-prompt.md`

- **第85和91行**：示例中的工具参数
  - 将 `{"path": "."}` 改为 `当前目录路径 "."`
  - 将 `{"filename": "README.md"}` 改为 `文件名 "README.md"`

## 验证测试

修改后使用 Node.js 测试模板加载：

```bash
# 测试 novel-writing-clean.md
node --input-type=module -e "import fs from 'fs'; import { PromptTemplate } from '@langchain/core/prompts'; const content = fs.readFileSync('prompts/novel-writing-clean.md', 'utf8'); const template = PromptTemplate.fromTemplate(content); console.log('✅ 成功');"

# 测试 react-prompt.md
node --input-type=module -e "import fs from 'fs'; import { PromptTemplate } from '@langchain/core/prompts'; const content = fs.readFileSync('prompts/react-prompt.md', 'utf8'); const template = PromptTemplate.fromTemplate(content); console.log('✅ 成功');"
```

结果：两个模板都成功加载，无错误。

## 影响

### 对 AI 行为的影响

- ✅ AI 仍然能理解需要输出 JSON 格式
- ✅ 工具描述（在 `src/tools/file-operations.js` 中）明确说明了 JSON 格式要求
- ✅ 提示词通过文字描述清楚地说明了参数要求
- ✅ AI 会自然地输出正确的 JSON 格式（不带双大括号）

### 向后兼容性

- ✅ 完全兼容现有功能
- ✅ 不影响工具的实际执行
- ✅ 只是改变了提示词中的示例展示方式

## 最佳实践

### 编写提示词时应注意

1. **避免在提示词中直接展示 JSON 示例**
   - 使用文字描述代替
   - 或者在代码块中展示（但仍可能有问题）

2. **模板变量的正确使用**
   - 只在真正需要替换的地方使用 `{variable}`
   - 例如：`{input}`, `{tools}`, `{agent_scratchpad}`

3. **转义特殊字符**
   - 如果必须在提示词中使用大括号，考虑用其他符号代替
   - 或者使用双大括号 `{{` 和 `}}`（但需要注意 AI 的输出）

4. **工具描述的位置**
   - 工具的具体使用格式应该在工具定义中说明
   - 提示词中只需要概括性的说明

## 相关链接

- [LangChain PromptTemplate 文档](https://js.langchain.com/docs/modules/model_io/prompts/prompt_templates/)
- [错误排查指南](https://js.langchain.com/docs/troubleshooting/errors/INVALID_PROMPT_INPUT/)
- [工具定义文件](../src/tools/file-operations.js)

## 总结

这次修复通过移除提示词中的 JSON 格式示例，改用文字描述的方式，成功解决了模板解析错误。这是一个在使用模板系统时常见的问题，解决方案是避免在模板中使用会被误解析的特殊字符。

