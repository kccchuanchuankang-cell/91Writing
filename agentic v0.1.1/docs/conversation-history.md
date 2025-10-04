# 对话历史功能说明

## 功能概述

ReAct Agent 现在支持持久化对话历史，每个项目的对话记录会自动保存到文件中，下次打开项目时会自动加载历史对话。

## 主要特性

### 1. 自动保存
- ✅ 每次对话后自动保存到项目目录
- ✅ 保存位置：`novels/[项目名]/conversation-history.json`
- ✅ 包含用户消息和 AI 回复
- ✅ 记录时间戳

### 2. 自动加载
- ✅ 切换项目时自动加载历史对话
- ✅ 显示最近 10 条对话用于上下文理解
- ✅ 最多保存 20 条对话记录（自动清理旧记录）

### 3. 上下文连续性
- ✅ AI 能够理解之前的对话内容
- ✅ 支持"继续"、"改一下"等指代性指令
- ✅ 保持创作的连贯性

### 4. 手动管理
- ✅ 清空历史按钮：清除当前项目的所有对话历史
- ✅ API 接口：可通过 API 查询历史统计信息

## 文件结构

对话历史文件保存为 JSON 格式：

```json
{
  "projectName": "未来神战",
  "lastUpdated": "2025-10-02T10:30:00.000Z",
  "totalMessages": 15,
  "history": [
    {
      "role": "user",
      "content": "写第一章",
      "timestamp": "2025-10-02T10:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "好的，我来创作第一章...",
      "timestamp": "2025-10-02T10:01:00.000Z"
    }
  ]
}
```

## 使用示例

### 场景 1：连续创作

```
第一次对话：
用户: "写第一章"
AI: [创作第一章内容]

第二次对话（关闭后重新打开）：
用户: "继续写第二章"
AI: [理解上下文，继续第二章] ✅ AI 知道第一章的内容
```

### 场景 2：修改内容

```
第一次对话：
用户: "创建主角人物设定"
AI: [创建主角设定]

第二次对话：
用户: "把主角的年龄改成 30 岁"
AI: [理解要修改刚才创建的主角] ✅ AI 记得刚才创建的角色
```

### 场景 3：询问历史

```
用户: "我之前设定的主角叫什么名字？"
AI: [查询对话历史，回答问题] ✅ AI 能回顾之前的对话
```

## API 接口

### 获取对话历史
```
GET /api/projects/:name/conversation-history
```

响应：
```json
{
  "success": true,
  "history": [...],
  "stats": {
    "total": 15,
    "userMessages": 8,
    "assistantMessages": 7,
    "lastUpdated": "2025-10-02T10:30:00.000Z"
  }
}
```

### 清空对话历史
```
POST /api/projects/:name/clear-history
```

响应：
```json
{
  "success": true,
  "message": "对话历史已清空"
}
```

## 配置参数

可在 `src/conversation-manager.js` 中修改：

```javascript
this.maxHistoryLength = 20;  // 最多保存 20 条对话
this.contextLength = 10;     // 加载最新 10 条作为上下文
```

## 注意事项

1. **隐私保护**：对话历史保存在本地项目目录中，不会上传到云端

2. **存储空间**：每个项目的对话历史文件通常不超过 100KB

3. **性能影响**：加载历史对话时会读取文件，但影响很小（毫秒级）

4. **自动清理**：超过 `maxHistoryLength` 的旧对话会自动删除

5. **备份建议**：如果需要保留完整对话历史，建议定期备份项目目录

## 技术实现

### ConversationManager 类

负责对话历史的管理：

```javascript
const conversationManager = new ConversationManager(projectName);

// 加载历史
const history = conversationManager.loadHistory();

// 添加消息
conversationManager.addMessage('user', '写第一章');

// 获取上下文
const context = conversationManager.getContext(10);

// 构建增强提示
const enhancedPrompt = conversationManager.buildEnhancedPrompt(userInput);

// 清空历史
conversationManager.clearHistory();
```

### 工作流程

1. **用户发送消息**
   - 前端发送请求到 `/api/projects/:name/generate`
   - 后端创建 ConversationManager 实例

2. **加载历史上下文**
   - ConversationManager 读取 `conversation-history.json`
   - 提取最近 10 条对话
   - 构建增强提示（包含历史上下文）

3. **AI 处理请求**
   - ReAct Agent 接收增强提示
   - AI 理解完整上下文
   - 生成回复

4. **保存对话**
   - ConversationManager 保存用户消息
   - ConversationManager 保存 AI 回复
   - 更新 `conversation-history.json`

5. **前端显示**
   - 切换项目时自动加载历史
   - 显示最近 10 条对话
   - 保持界面连贯性

## 升级说明

### 从旧版本升级

如果你从没有对话历史功能的版本升级：

1. 不需要迁移数据（旧版本没有保存历史）
2. 新的对话会自动开始保存
3. 每个项目会自动创建 `conversation-history.json`

### 兼容性

- ✅ 向后兼容：旧项目自动支持新功能
- ✅ 可选功能：不影响其他功能使用
- ✅ 降级支持：删除历史文件不影响系统运行

## 未来改进

计划中的功能：

- [ ] 导出对话历史为 Markdown
- [ ] 搜索历史对话
- [ ] 对话历史标签和分类
- [ ] 更灵活的上下文长度设置
- [ ] 对话历史压缩和归档

