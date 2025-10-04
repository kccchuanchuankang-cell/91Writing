# Function Calling 调试指南

## 问题现象

用户测试时发现：AI 只输出了一句话"我来为《云边有个菜鸟驿站》梳理一条温暖治愈系的事件线。先列出文件，看看已有设定，再写新的时间轴。"就结束了，**没有实际调用工具**。

## 可能的原因

### 1. LangChain 流式模式的 Function Calling 兼容性问题

LangChain 的 `.bind({ functions: ... })` 在流式模式下可能无法正确传递 `function_call` 信息。

**解决方案**：
- 在流式模式中累积所有 chunks
- 检查最后一个 chunk 的完整信息
- 如果仍然没有，回退到非流式模式重试

### 2. Kimi K2 的 Function Calling 实现差异

虽然 Kimi K2 声称支持 OpenAI 格式，但可能在以下方面有差异：
- `function_call` 字段的位置（可能不在 `additional_kwargs` 中）
- 流式输出的格式
- 需要特定的提示词引导

**解决方案**：
- 添加调试日志，打印实际收到的 chunk 结构
- 检查 `response_metadata` 等其他字段
- 必要时调整提示词

### 3. 提示词问题

Function Calling 模式的提示词可能需要：
- 更明确地告诉 AI 它有哪些工具
- 强调何时应该调用工具而不是直接回答
- 提供工具调用的示例

**解决方案**：
- 优化 `prompts/novel-writing-function-calling.md`
- 添加工具使用的明确指引
- 提供少样本学习（few-shot）示例

## 调试步骤

### 步骤 1：查看服务器日志

在用户发起请求后，查看控制台输出，寻找：

```
⚠️ 流式模式未捕获到 function_call，检查最后一个 chunk:
Chunk keys: [...]
additional_kwargs: {...}
response_metadata: {...}
```

这会告诉我们 chunk 的实际结构。

### 步骤 2：测试非流式模式

临时禁用流式输出，看看非流式模式是否能正确获取 `function_call`：

```javascript
// 在 server.js 中临时修改
const result = await agent.run(enhancedPrompt, null); // null 禁用流式
```

### 步骤 3：检查 LangChain 版本

确认 LangChain 版本是否支持流式 Function Calling：

```bash
npm list @langchain/openai
```

### 步骤 4：直接测试 Kimi K2 API

绕过 LangChain，直接调用 Kimi K2 的 API，验证其 Function Calling 实现：

```javascript
const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    model: 'moonshot-v1-8k',
    messages: [{ role: 'user', content: '测试' }],
    functions: [
      { name: 'test_tool', description: 'Test', parameters: {...} }
    ]
  })
});
```

## 临时解决方案

### 方案 1：强制使用非流式模式

修改 `src/function-calling-agent.js`：

```javascript
// 临时禁用流式模式，直到找到问题根源
if (onProgress) {
  // 先用非流式获取结果
  const response = await llmWithFunctions.invoke(conversationHistory);
  fullResponse = response.content || '';
  functionCall = response.additional_kwargs?.function_call;
  
  // 然后模拟流式输出（提升用户体验）
  if (fullResponse) {
    this.safeOnProgress(onProgress, {
      type: 'llm_stream',
      message: fullResponse
    });
  }
}
```

### 方案 2：回退到 ReAct 模式

如果 Function Calling 短期内无法解决，可以：
1. 保留当前代码
2. 在 `server.js` 中切换回 `ReActAgent`
3. 使用分段写作策略缓解 JSON 截断问题

```javascript
// server.js
import { ReActAgent } from './src/react-agent.js'; // 改回 ReAct
const agent = new ReActAgent({ ... });
```

### 方案 3：混合模式

同时保留两种 Agent，让用户选择：

```javascript
const agentType = process.env.AGENT_TYPE || 'react'; // 'react' or 'function-calling'
const AgentClass = agentType === 'function-calling' ? FunctionCallingAgent : ReActAgent;
const agent = new AgentClass({ ... });
```

## 预期下一步

1. **等待用户再次测试**，查看服务器日志中的调试信息
2. **根据 chunk 结构**调整代码
3. **如果 Kimi K2 确实不支持流式 Function Calling**，改用非流式模式
4. **如果非流式也不行**，可能需要回退到 ReAct 或使用其他模型

---

**更新时间**：2025-10-02
**状态**：等待调试信息


