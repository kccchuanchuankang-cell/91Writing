# 🔧 Tool Calls API 格式修复

## 问题诊断

### 症状
AI 只输出一句话就结束，不调用任何工具。

### 根本原因
**OpenAI API 格式升级**：从旧版 `function_call` 迁移到新版 `tool_calls`

### 日志证据
```javascript
Chunk keys: [
  'tool_calls',        // ← 新版格式
  'tool_call_chunks',  // ← 流式专用
  'additional_kwargs', // ← 旧版 function_call 在这里
  ...
]
additional_kwargs: {}  // ← 旧版字段为空！
```

---

## API 格式对比

### 旧版格式（function_call）

```javascript
// 响应结构
{
  role: "assistant",
  content: null,
  additional_kwargs: {
    function_call: {
      name: "save_file",
      arguments: "{\"type\": \"章节内容\", ...}"
    }
  }
}
```

### 新版格式（tool_calls）

```javascript
// 响应结构
{
  role: "assistant",
  content: null,
  tool_calls: [
    {
      id: "call_abc123",
      type: "function",
      name: "save_file",  // ← 直接在 tool_calls 里
      args: {             // ← 可能已经是对象，不是字符串
        type: "章节内容",
        title: "第一章",
        content: "..."
      }
    }
  ]
}
```

---

## 修复方案

### 1. 检测新版 `tool_calls` 字段

```javascript
// 流式模式
if (chunk.tool_calls && chunk.tool_calls.length > 0) {
  const toolCall = chunk.tool_calls[0];
  functionCall = {
    name: toolCall.name,
    arguments: typeof toolCall.args === 'string' 
      ? toolCall.args 
      : JSON.stringify(toolCall.args)
  };
}
```

### 2. 检测流式专用 `tool_call_chunks`

```javascript
// 流式模式下的增量更新
if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
  const toolChunk = chunk.tool_call_chunks[0];
  if (!functionCall) {
    functionCall = { name: '', arguments: '' };
  }
  if (toolChunk.name) {
    functionCall.name = toolChunk.name;
  }
  if (toolChunk.args) {
    functionCall.arguments += typeof toolChunk.args === 'string'
      ? toolChunk.args
      : JSON.stringify(toolChunk.args);
  }
}
```

### 3. 向后兼容旧版 `function_call`

```javascript
// 兼容旧版 API
if (chunk.additional_kwargs?.function_call) {
  functionCall = {
    name: chunk.additional_kwargs.function_call.name,
    arguments: chunk.additional_kwargs.function_call.arguments
  };
}
```

---

## 测试验证

### 测试步骤

1. 刷新浏览器页面
2. 输入：`编写一下事件线设定`
3. 观察服务器日志，应该看到：
   ```
   📞 函数调用: save_file
   📥 参数: {"type": "设定资料", "title": "事件线设定", ...}
   ```

### 预期结果

- ✅ AI 正确调用 `save_file` 工具
- ✅ 参数完整传递（不截断）
- ✅ 文件成功创建
- ✅ 返回确认消息

---

## 技术要点

### 1. 参数类型处理

新版 `tool_calls` 的 `args` 可能是：
- **对象**（已解析的 JSON）
- **字符串**（未解析的 JSON）

需要统一转换为字符串：

```javascript
functionCall.arguments = typeof toolCall.args === 'string' 
  ? toolCall.args 
  : JSON.stringify(toolCall.args);
```

### 2. 流式模式的增量更新

`tool_call_chunks` 可能分散在多个 chunk 中：

```javascript
// 第一个 chunk
{ tool_call_chunks: [{ name: "save_file" }] }

// 第二个 chunk
{ tool_call_chunks: [{ args: "{\"type\":" }] }

// 第三个 chunk
{ tool_call_chunks: [{ args: "\"章节内容\"}" }] }
```

需要累加 `arguments`：

```javascript
functionCall.arguments += toolChunk.args;
```

### 3. 多工具调用支持

新版 `tool_calls` 是数组，支持同时调用多个工具：

```javascript
tool_calls: [
  { name: "list_files", args: {...} },
  { name: "read_file", args: {...} }
]
```

当前实现只取第一个 `tool_calls[0]`，未来可扩展为并行调用。

---

## 相关文件

- **`src/function-calling-agent.js`**：核心修复位置
  - 第 177-220 行：流式模式 tool_calls 检测
  - 第 228-240 行：最后一个 chunk 的 fallback
  - 第 273-285 行：非流式模式 tool_calls 检测

---

## 更新时间

2025-10-02 19:50

## 状态

✅ 已修复，等待用户测试验证


