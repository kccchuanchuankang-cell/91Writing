import { ChatOpenAI } from "@langchain/openai";

/**
 * Function Calling Agent
 * 使用 OpenAI 原生 Function Calling API，性能更好，参数容量更大
 */
export class FunctionCallingAgent {
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
      temperature: options.temperature || parseFloat(process.env.TEMPERATURE) || 0.8,
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseURL,
      },
      streaming: true,
    });
    
    this.tools = options.tools || [];
    this.maxIterations = options.maxIterations || parseInt(process.env.MAX_ITERATIONS) || 10;
    this.verbose = options.verbose !== undefined ? options.verbose : (process.env.VERBOSE === 'true') || false;
    this.systemPrompt = options.systemPrompt || "You are a helpful assistant.";
  }

  /**
   * 注册工具
   */
  addTool(tool) {
    this.tools.push(tool);
  }

  /**
   * 将工具转换为 LangChain Tool 格式（用于 bindTools）
   */
  convertToolsToLangChainFormat() {
    return this.tools.map(tool => {
      // 使用 LangChain 的 StructuredTool 格式
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || {
            type: "object",
            properties: {},
            required: []
          }
        }
      };
    });
  }
  
  /**
   * 将工具转换为 OpenAI Function 格式（旧版兼容）
   */
  convertToolsToFunctions() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || {
        type: "object",
        properties: this.inferParameters(tool),
        required: []
      }
    }));
  }

  /**
   * 从工具描述中推断参数（简化版）
   * 实际应该在工具定义时就提供 parameters
   */
  inferParameters(tool) {
    // 这里需要根据实际工具定义来设置
    // 暂时返回一个通用的对象类型
    return {
      input: {
        type: "string",
        description: "Input for the tool"
      }
    };
  }

  /**
   * 根据名称查找工具
   */
  getTool(name) {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * 安全调用 onProgress，捕获客户端断开等错误
   */
  safeOnProgress(onProgress, data) {
    if (!onProgress) return;
    try {
      onProgress(data);
    } catch (error) {
      if (this.verbose) {
        console.log(`⚠️ onProgress 抛出错误: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 执行工具
   */
  async executeTool(toolName, input) {
    const tool = this.getTool(toolName);
    if (!tool) {
      return `错误：未找到工具 "${toolName}"`;
    }
    
    try {
      const result = await tool.func(input);
      return result;
    } catch (error) {
      return `执行工具 "${toolName}" 时出错：${error.message}`;
    }
  }

  /**
   * 运行 Function Calling Agent
   * @param {string} input - 用户输入
   * @param {function} onProgress - 进度回调函数 (optional)
   */
  async run(input, onProgress = null) {
    let iterations = 0;
    let conversationHistory = [
      {
        role: "system",
        content: this.systemPrompt
      },
      {
        role: "user",
        content: input
      }
    ];
    
    if (this.verbose) {
      console.log(`\n🤖 开始 Function Calling 推理循环...`);
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
      
      try {
        // 🔥 尝试使用新版 bindTools（可能更兼容 Kimi K2）
        let llmWithFunctions;
        const tools = this.convertToolsToLangChainFormat();
        
        if (this.verbose) {
          console.log('🔧 绑定工具数量:', tools.length);
          console.log('🔧 第一个工具示例:', JSON.stringify(tools[0], null, 2));
        }
        
        try {
          // 尝试新版 bindTools
          llmWithFunctions = this.llm.bindTools(tools);
          if (this.verbose) {
            console.log('✅ 使用 bindTools 绑定成功');
          }
        } catch (bindToolsError) {
          // 回退到旧版 bind({ functions })
          if (this.verbose) {
            console.log('⚠️ bindTools 失败，回退到旧版 bind:', bindToolsError.message);
          }
          const functions = this.convertToolsToFunctions();
          llmWithFunctions = this.llm.bind({
            functions: functions,
            function_call: "auto"
          });
        }
        
        // 调用 LLM（流式输出）
        let fullResponse = '';
        let functionCall = null;
        
        if (onProgress) {
          // 流式输出
          const stream = await llmWithFunctions.stream(conversationHistory);
          let chunks = [];
          
          for await (const chunk of stream) {
            chunks.push(chunk); // 收集所有 chunks
            
            // 收集文本内容
            if (chunk.content) {
              fullResponse += chunk.content;
              this.safeOnProgress(onProgress, {
                type: 'llm_stream',
                message: fullResponse
              });
            }
            
            // 🔥 检查新版 tool_calls 格式（OpenAI 新 API）
            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
              const toolCall = chunk.tool_calls[0];
              if (this.verbose) {
                console.log('🔍 Chunk 中的 tool_call:', JSON.stringify(toolCall, null, 2));
              }
              if (!functionCall) {
                functionCall = { name: '', arguments: '' };
              }
              if (toolCall.name) {
                functionCall.name = toolCall.name;
              }
              if (toolCall.args) {
                const argsStr = typeof toolCall.args === 'string' 
                  ? toolCall.args 
                  : JSON.stringify(toolCall.args);
                
                // 跳过空对象
                if (argsStr !== '{}' && argsStr.trim() !== '') {
                  functionCall.arguments = argsStr;
                }
              }
            }
            
            // 🔥 检查流式 tool_call_chunks 格式
            if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
              const toolChunk = chunk.tool_call_chunks[0];
              
              // 初始化或更新工具调用
              if (!functionCall) {
                functionCall = { name: '', arguments: '' };
              }
              
              // 设置函数名
              if (toolChunk.name) {
                functionCall.name = toolChunk.name;
                if (this.verbose) {
                  console.log('🔍 工具名称:', toolChunk.name);
                }
              }
              
              // 🔥 累加参数片段，但跳过空对象 {}
              if (toolChunk.args !== undefined) {
                const argsStr = typeof toolChunk.args === 'string' 
                  ? toolChunk.args 
                  : JSON.stringify(toolChunk.args);
                
                // 跳过空对象（第一个 chunk 通常是 {}）
                if (argsStr !== '{}' && argsStr.trim() !== '') {
                  functionCall.arguments += argsStr;
                }
              }
            }
            
            // 兼容旧版 additional_kwargs.function_call 格式
            if (chunk.additional_kwargs?.function_call) {
              if (!functionCall) {
                functionCall = { name: '', arguments: '' };
              }
              if (chunk.additional_kwargs.function_call.name) {
                functionCall.name = chunk.additional_kwargs.function_call.name;
              }
              if (chunk.additional_kwargs.function_call.arguments) {
                functionCall.arguments += chunk.additional_kwargs.function_call.arguments;
              }
            }
          }
          
          // 🔥 如果流式模式没有捕获到 function_call，尝试从最后一个 chunk 中获取
          if (!functionCall && chunks.length > 0) {
            const lastChunk = chunks[chunks.length - 1];
            
            // 检查新版 tool_calls
            if (lastChunk.tool_calls && lastChunk.tool_calls.length > 0) {
              const toolCall = lastChunk.tool_calls[0];
              if (this.verbose) {
                console.log('🔍 最后一个 chunk 的 tool_call:', JSON.stringify(toolCall, null, 2));
              }
              functionCall = {
                name: toolCall.name,
                arguments: toolCall.args 
                  ? (typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args))
                  : '{}'
              };
            }
            // 检查旧版 function_call
            else if (lastChunk.additional_kwargs?.function_call) {
              functionCall = lastChunk.additional_kwargs.function_call;
            }
          }
          
          // 🔥 调试：打印 chunk 结构（仅在 verbose 模式）
          if (this.verbose && !functionCall && chunks.length > 0) {
            console.log('⚠️ 流式模式未捕获到 function_call，检查最后一个 chunk:');
            const lastChunk = chunks[chunks.length - 1];
            console.log('Chunk keys:', Object.keys(lastChunk));
            console.log('tool_calls:', lastChunk.tool_calls);
            console.log('tool_call_chunks:', lastChunk.tool_call_chunks);
            console.log('additional_kwargs:', lastChunk.additional_kwargs);
            console.log('response_metadata:', lastChunk.response_metadata);
          }
          
          // 🔥 如果流式模式真的没有函数调用，但也没有文本内容，可能是 API 返回异常
          if (!functionCall && !fullResponse && chunks.length > 0) {
            if (this.verbose) {
              console.log('⚠️ 检测到异常：既无函数调用也无文本输出，尝试非流式重试...');
            }
            // 回退到非流式模式
            const response = await llmWithFunctions.invoke(conversationHistory);
            fullResponse = response.content || '';
            functionCall = response.additional_kwargs?.function_call;
            if (this.verbose) {
              console.log('✅ 非流式重试结果:', { fullResponse: fullResponse.substring(0, 100), hasFunctionCall: !!functionCall });
            }
          }
        } else {
          // 非流式
          const response = await llmWithFunctions.invoke(conversationHistory);
          fullResponse = response.content || '';
          
          // 检查新版 tool_calls
          if (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            functionCall = {
              name: toolCall.name,
              arguments: typeof toolCall.args === 'string' 
                ? toolCall.args 
                : JSON.stringify(toolCall.args)
            };
          }
          // 兼容旧版 function_call
          else if (response.additional_kwargs?.function_call) {
            functionCall = response.additional_kwargs.function_call;
          }
        }
        
        if (this.verbose) {
          console.log(`🧠 LLM响应 (第${iterations}轮):`);
          console.log(fullResponse || '(调用函数)');
          if (functionCall) {
            console.log(`📞 函数调用: ${functionCall.name}`);
            console.log(`📥 参数: ${functionCall.arguments}`);
            console.log(`🔍 完整 functionCall 对象:`, JSON.stringify(functionCall, null, 2));
          } else {
            console.log('⚠️ 警告：没有检测到函数调用');
          }
          console.log('---');
        }
        
        // 如果没有函数调用，说明 AI 给出了最终答案
        if (!functionCall) {
          if (this.verbose) {
            console.log(`✅ 找到最终答案！`);
            console.log(`🎯 答案: ${fullResponse}\n`);
          }
          
          return {
            success: true,
            answer: fullResponse,
            iterations: iterations,
            conversationHistory: conversationHistory
          };
        }
        
        // 有函数调用，执行工具
        const toolName = functionCall.name;
        let toolInput;
        
        // 🔥 处理参数：可能是字符串、对象或空
        if (!functionCall.arguments || functionCall.arguments === '') {
          toolInput = {};
        } else if (typeof functionCall.arguments === 'string') {
          try {
            toolInput = JSON.parse(functionCall.arguments);
          } catch (error) {
            if (this.verbose) {
              console.log(`⚠️ 参数解析失败，使用原始字符串:`, functionCall.arguments);
            }
            toolInput = functionCall.arguments;
          }
        } else {
          // 已经是对象
          toolInput = functionCall.arguments;
        }
        
        if (this.verbose) {
          console.log(`🔧 执行工具: ${toolName}`);
          console.log(`📥 输入: ${JSON.stringify(toolInput).substring(0, 200)}...`);
        }
        
        // 发送进度：执行动作
        this.safeOnProgress(onProgress, {
          type: 'action',
          action: toolName,
          input: toolInput,
          message: `🔧 执行: ${toolName}`
        });
        
        // 执行工具
        const observation = await this.executeTool(toolName, toolInput);
        
        if (this.verbose) {
          console.log(`👀 观察结果: ${observation.substring(0, 200)}...\n`);
        }
        
        // 发送进度：观察结果
        const obsPreview = observation.length > 100 ? observation.substring(0, 100) + '...' : observation;
        this.safeOnProgress(onProgress, {
          type: 'observation',
          message: `✅ 结果: ${obsPreview}`
        });
        
        // 🔥 将函数调用和结果添加到对话历史（使用 LangChain 消息类）
        // 导入消息类
        const { AIMessage, ToolMessage } = await import('@langchain/core/messages');
        
        // 添加 AI 的工具调用消息
        let parsedArgs = toolInput; // 使用之前已经解析好的参数
        if (typeof functionCall.arguments === 'string' && typeof toolInput === 'string') {
          // 如果 toolInput 还是字符串，说明之前解析失败了，再尝试一次
          try {
            parsedArgs = JSON.parse(functionCall.arguments);
          } catch (e) {
            // 解析失败，使用空对象或原始字符串
            parsedArgs = { raw: functionCall.arguments };
          }
        }
        
        const aiMessage = new AIMessage({
          content: fullResponse || '',
          tool_calls: functionCall ? [{
            id: `call_${Date.now()}`,
            name: functionCall.name,
            args: parsedArgs
          }] : []
        });
        conversationHistory.push(aiMessage);
        
        // 添加工具执行结果消息
        const toolMessage = new ToolMessage({
          content: observation,
          tool_call_id: `call_${Date.now()}`,
          name: toolName
        });
        conversationHistory.push(toolMessage);
        
      } catch (error) {
        console.error(`❌ 第 ${iterations} 轮出错:`, error);
        
        // 如果是用户停止
        if (error.message === 'Task stopped by user') {
          throw error;
        }
        
        // 其他错误，继续下一轮
        conversationHistory.push({
          role: "system",
          content: `执行出错: ${error.message}. 请尝试其他方法。`
        });
      }
    }
    
    return {
      success: false,
      error: `达到最大迭代次数 (${this.maxIterations})，未找到最终答案`,
      iterations: iterations,
      conversationHistory: conversationHistory
    };
  }
}

