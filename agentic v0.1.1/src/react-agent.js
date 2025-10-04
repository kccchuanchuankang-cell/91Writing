import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * ReAct (Reasoning and Acting) Agent
 * 实现了ReAct范式：思考(Thought) -> 行动(Action) -> 观察(Observation) -> 思考...
 */
export class ReActAgent {
  
  /**
   * 从Markdown文件中读取提示词模板
   */
  static loadPromptFromFile(promptPath = null) {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      // 默认提示词文件路径
      const defaultPromptPath = path.join(__dirname, '..', 'prompts', 'react-prompt.md');
      const filePath = promptPath || defaultPromptPath;
      
      if (!fs.existsSync(filePath)) {
        console.warn(`提示词文件不存在: ${filePath}，使用默认提示词`);
        return null;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 提取基础提示词部分（在第一个 ## 之前的内容）
      const lines = content.split('\n');
      let promptLines = [];
      let inPromptSection = false;
      
      for (const line of lines) {
        if (line.startsWith('# ReAct Agent 提示词模板')) {
          continue;
        }
        if (line.startsWith('## 基础提示词')) {
          inPromptSection = true;
          continue;
        }
        if (line.startsWith('## ') && inPromptSection) {
          break;
        }
        if (inPromptSection && line.trim()) {
          promptLines.push(line);
        }
      }
      
      return promptLines.join('\n').trim();
    } catch (error) {
      console.warn(`读取提示词文件失败: ${error.message}，使用默认提示词`);
      return null;
    }
  }
  constructor(options = {}) {
    // 支持自定义API配置
    const apiKey = options.apiKey || process.env.API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = options.baseURL || process.env.API_BASE_URL;
    const modelName = options.model || process.env.MODEL_NAME || "gpt-3.5-turbo";
    
    if (!apiKey) {
      throw new Error('API密钥未设置。请在环境变量中设置 API_KEY 或通过构造函数传入 apiKey 参数。');
    }
    
    if (!baseURL) {
      throw new Error('API基础URL未设置。请在环境变量中设置 API_BASE_URL 或通过构造函数传入 baseURL 参数。');
    }
    
    this.llm = new ChatOpenAI({
      modelName: modelName,
      temperature: options.temperature || parseFloat(process.env.TEMPERATURE) || 0.1,
      maxTokens: options.maxTokens !== undefined ? options.maxTokens : (process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : undefined),  // 🔥 不限制则使用模型默认最大值
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseURL,
      },
    });
    
    this.tools = options.tools || [];
    this.maxIterations = options.maxIterations || parseInt(process.env.MAX_ITERATIONS) || 10;
    this.verbose = options.verbose !== undefined ? options.verbose : (process.env.VERBOSE === 'true') || false;
    
    // 优先使用传入的systemPrompt，然后是文件中的提示词
    const systemPrompt = options.systemPrompt;
    const filePrompt = ReActAgent.loadPromptFromFile(options.promptPath);
    
    // 按优先级选择提示词：systemPrompt > filePrompt
    const finalPrompt = systemPrompt || filePrompt;
    
    if (!finalPrompt) {
      throw new Error(
        '未提供提示词！请通过以下方式之一提供：\n' +
        '  1. 传入 options.systemPrompt\n' +
        '  2. 传入 options.promptPath 指向自定义提示词文件\n' +
        '  3. 确保 prompts/react-prompt.md 文件存在（默认提示词）'
      );
    }
    
    this.promptTemplate = PromptTemplate.fromTemplate(finalPrompt);
  }

  /**
   * 注册工具
   */
  addTool(tool) {
    this.tools.push(tool);
  }

  /**
   * 格式化工具描述
   */
  formatTools() {
    return this.tools.map(tool => 
      `${tool.name}: ${tool.description}`
    ).join('\n');
  }

  /**
   * 获取工具名称列表
   */
  getToolNames() {
    return this.tools.map(tool => tool.name);
  }

  /**
   * 根据名称查找工具
   */
  getTool(name) {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * 解析LLM的响应
   */
  parseResponse(response) {
    const text = response.trim();
    
    // 检查是否包含Final Answer
    if (text.includes('Final Answer:')) {
      const finalAnswer = text.split('Final Answer:')[1].trim();
      return {
        type: 'final_answer',
        content: finalAnswer
      };
    }
    
    // 解析Action和Action Input（支持多行）
    const actionMatch = text.match(/Action:\s*(.+)/);
    // 🔥 使用 [\s\S] 匹配包括换行符在内的所有字符，直到遇到下一个关键字或结尾
    const actionInputMatch = text.match(/Action Input:\s*([\s\S]+?)(?=\n(?:Thought|Action|Observation|Final Answer):|$)/);
    
    if (actionMatch && actionInputMatch) {
      return {
        type: 'action',
        action: actionMatch[1].trim(),
        actionInput: actionInputMatch[1].trim(),
        thought: this.extractThought(text)
      };
    }
    
    // 🔥 如果只有 Thought，返回 thought 类型
    if (text.includes('Thought:')) {
      return {
        type: 'thought',
        content: text
      };
    }
    
    // 🔥 如果既没有 Action 也没有 Final Answer，也没有 Thought
    // 直接当作最终答案，防止死循环
    if (this.verbose) {
      console.log('⚠️ AI 输出格式不规范，没有 Action/Final Answer/Thought，将内容作为最终答案');
    }
    
    return {
      type: 'final_answer',
      content: text
    };
  }

  /**
   * 提取思考内容
   */
  extractThought(text) {
    const thoughtMatch = text.match(/Thought:\s*(.+?)(?=Action:|$)/s);
    return thoughtMatch ? thoughtMatch[1].trim() : '';
  }

  /**
   * 执行工具
   */
  async executeTool(toolName, input) {
    const tool = this.getTool(toolName);
    if (!tool) {
      return `错误：未找到工具 "${toolName}"。可用工具：${this.getToolNames().join(', ')}`;
    }
    
    try {
      const result = await tool.func(input);
      return result;
    } catch (error) {
      return `执行工具 "${toolName}" 时出错：${error.message}`;
    }
  }

  /**
   * 安全调用 onProgress，捕获客户端断开等错误
   */
  safeOnProgress(onProgress, data) {
    if (!onProgress) return;
    try {
      onProgress(data);
    } catch (error) {
      // 🔥 客户端断开连接或其他错误
      if (this.verbose) {
        console.log(`⚠️ onProgress 抛出错误: ${error.message}`);
      }
      throw error; // 重新抛出，让 run() 方法处理
    }
  }

  /**
   * 运行ReAct循环
   * @param {string} input - 用户输入
   * @param {function} onProgress - 进度回调函数 (optional)
   */
  async run(input, onProgress = null) {
    let agentScratchpad = '';
    let iterations = 0;
    let lastResponse = '';  // 🔥 记录上一次的响应，防止死循环
    let sameResponseCount = 0;  // 🔥 记录相同响应的次数
    
    if (this.verbose) {
      console.log(`\n🤖 开始ReAct推理循环...`);
      console.log(`📝 问题: ${input}\n`);
    }
    
    while (iterations < this.maxIterations) {
      iterations++;
      
      // 发送进度：开始思考
      this.safeOnProgress(onProgress, {
        type: 'iteration',
        iteration: iterations,
        message: `🔄 第 ${iterations} 轮推理...`
      });
      
      // 构建提示
      const prompt = await this.promptTemplate.format({
        tools: this.formatTools(),
        tool_names: this.getToolNames().join(', '),
        input: input,
        agent_scratchpad: agentScratchpad
      });
      
      // 获取LLM响应（流式或非流式）
      let responseText = '';
      
      if (onProgress) {
        // 🔥 使用流式输出，实时发送 LLM 的思考过程
        try {
          const stream = await this.llm.stream(prompt);
          let shouldStopStream = false;
          
          for await (const chunk of stream) {
            const content = chunk.content || '';
            if (content) {
              responseText += content;
              
              // 🔥 检测到 "Observation:" 立即停止流式输出
              // 因为 Observation 必须由系统工具真实返回，AI 不能编造
              if (responseText.includes('Observation:')) {
                shouldStopStream = true;
                // 截断到 Action Input 之后，移除 AI 编造的 Observation 部分
                const lastActionInput = responseText.lastIndexOf('Action Input:');
                if (lastActionInput !== -1) {
                  const afterInput = responseText.substring(lastActionInput);
                  const lines = afterInput.split('\n');
                  // 保留 Action Input 这一行和它的值，去掉 Observation 及之后的内容
                  let cleanLines = [];
                  for (const line of lines) {
                    if (line.trim().startsWith('Observation:')) {
                      break;
                    }
                    cleanLines.push(line);
                  }
                  responseText = responseText.substring(0, lastActionInput) + cleanLines.join('\n');
                }
                if (this.verbose) {
                  console.log(`⚠️ 检测到AI尝试编造Observation，已截断流式输出`);
                }
                break;
              }
              
              // 实时发送 LLM 输出片段
              this.safeOnProgress(onProgress, {
                type: 'llm_stream',
                message: responseText  // 发送累积的完整文本
              });
            }
          }
          
          if (this.verbose) {
            console.log(`✅ 流式输出完成${shouldStopStream ? '（提前截断）' : ''}`);
          }
        } catch (error) {
          // 🔥 如果是用户主动停止，直接抛出，不回退
          if (error.message === 'Task stopped by user') {
            throw error;
          }
          
          // 其他错误：流式失败，回退到非流式
          if (this.verbose) {
            console.log(`⚠️ 流式失败，回退到非流式: ${error.message}`);
          }
          const response = await this.llm.invoke(prompt);
          responseText = response.content;
        }
      } else {
        // 没有回调，使用非流式
        const response = await this.llm.invoke(prompt);
        responseText = response.content;
      }
      
      if (this.verbose) {
        console.log(`🧠 LLM响应 (第${iterations}轮):`);
        console.log(responseText);
        console.log('---');
      }
      
      // 🔥 检测是否连续输出相同内容（死循环检测）
      if (responseText === lastResponse) {
        sameResponseCount++;
        if (sameResponseCount >= 3) {
          if (this.verbose) {
            console.log(`⚠️ 检测到死循环：AI 连续 ${sameResponseCount} 次输出相同内容，强制停止`);
          }
          return {
            success: false,
            error: `AI 陷入死循环，连续 ${sameResponseCount} 次输出相同内容`,
            answer: responseText,  // 将重复的内容作为答案返回
            iterations: iterations,
            scratchpad: agentScratchpad
          };
        }
      } else {
        lastResponse = responseText;
        sameResponseCount = 0;
      }
      
      // 解析响应
      const parsed = this.parseResponse(responseText);
      
      // 发送进度：思考内容
      if (parsed.thought) {
        this.safeOnProgress(onProgress, {
          type: 'thought',
          message: `💭 ${parsed.thought}`
        });
      }
      
      if (parsed.type === 'final_answer') {
        if (this.verbose) {
          console.log(`✅ 找到最终答案！`);
          console.log(`🎯 答案: ${parsed.content}\n`);
        }
        return {
          success: true,
          answer: parsed.content,
          iterations: iterations,
          scratchpad: agentScratchpad
        };
      }
      
      if (parsed.type === 'action') {
        if (this.verbose) {
          console.log(`🔧 执行动作: ${parsed.action}`);
          console.log(`📥 输入: ${parsed.actionInput}`);
        }
        
        // 发送进度：执行动作
        this.safeOnProgress(onProgress, {
          type: 'action',
          action: parsed.action,
          input: parsed.actionInput,
          message: `🔧 执行: ${parsed.action}`
        });
        
        // 执行工具
        const observation = await this.executeTool(parsed.action, parsed.actionInput);
        
        if (this.verbose) {
          console.log(`👀 观察结果: ${observation}\n`);
        }
        
        // 发送进度：观察结果
        const obsPreview = observation.length > 100 ? observation.substring(0, 100) + '...' : observation;
        this.safeOnProgress(onProgress, {
          type: 'observation',
          message: `✅ 结果: ${obsPreview}`
        });
        
        // 更新scratchpad
        agentScratchpad += `Thought: ${parsed.thought}\n`;
        agentScratchpad += `Action: ${parsed.action}\n`;
        agentScratchpad += `Action Input: ${parsed.actionInput}\n`;
        agentScratchpad += `Observation: ${observation}\n`;
      } else {
        // 如果只是思考，继续下一轮
        agentScratchpad += `Thought: ${parsed.content}\n`;
      }
    }
    
    return {
      success: false,
      error: `达到最大迭代次数 (${this.maxIterations})，未找到最终答案`,
      iterations: iterations,
      scratchpad: agentScratchpad
    };
  }
}