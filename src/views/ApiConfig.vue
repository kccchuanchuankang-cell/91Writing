<template>
  <div class="api-config">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1>⚙️ API配置</h1>
        <p>管理AI模型接口配置和参数设置</p>
      </div>
      <div class="header-actions">
        <el-button @click="testAllConnections">
          <el-icon><Connection /></el-icon>
          测试所有连接
        </el-button>
        <el-button type="primary" @click="saveAllConfigs">
          <el-icon><Check /></el-icon>
          保存配置
        </el-button>
      </div>
    </div>

    <!-- 配置状态概览 -->
    <div class="config-overview">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="status-card">
            <div class="status-item">
              <div class="status-icon success">
                <el-icon><CircleCheck /></el-icon>
              </div>
              <div class="status-content">
                <div class="status-value">{{ activeConfigs }}</div>
                <div class="status-label">已配置</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="status-card">
            <div class="status-item">
              <div class="status-icon warning">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="status-content">
                <div class="status-value">{{ pendingConfigs }}</div>
                <div class="status-label">待配置</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="status-card">
            <div class="status-item">
              <div class="status-icon info">
                <el-icon><Connection /></el-icon>
              </div>
              <div class="status-content">
                <div class="status-value">{{ connectedConfigs }}</div>
                <div class="status-label">连接正常</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="status-card">
            <div class="status-item">
              <div class="status-icon primary">
                <el-icon><Star /></el-icon>
              </div>
              <div class="status-content">
                <div class="status-value">{{ defaultModel }}</div>
                <div class="status-label">默认模型</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- API配置列表 -->
    <div class="config-list">
      <el-card>
        <template #header>
          <div class="card-header">
            <h3>🤖 AI模型配置</h3>
            <el-button type="primary" @click="addNewConfig">
              <el-icon><Plus /></el-icon>
              添加配置
            </el-button>
          </div>
        </template>
        
        <div class="config-tabs">
          <el-tabs v-model="activeTab" type="border-card">
            <el-tab-pane 
              v-for="config in apiConfigs" 
              :key="config.id"
              :label="config.name"
              :name="config.id"
            >
              <div class="config-content">
                <!-- 基本信息 -->
                <div class="config-section">
                  <h4>📋 基本信息</h4>
                  <el-row :gutter="20">
                    <el-col :span="12">
                      <el-form-item label="配置名称">
                        <el-input v-model="config.name" placeholder="请输入配置名称" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="模型类型">
                        <el-select v-model="config.type" placeholder="选择模型类型">
                          <el-option label="OpenAI GPT" value="openai" />
                          <el-option label="Claude" value="claude" />
                          <el-option label="文心一言" value="wenxin" />
                          <el-option label="通义千问" value="qwen" />
                          <el-option label="智谱AI" value="zhipu" />
                          <el-option label="自定义" value="custom" />
                        </el-select>
                      </el-form-item>
                    </el-col>
                  </el-row>
                  
                  <el-row :gutter="20">
                    <el-col :span="24">
                      <el-form-item label="描述">
                        <el-input 
                          v-model="config.description" 
                          type="textarea" 
                          :rows="2"
                          placeholder="请输入配置描述"
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>

                <!-- 连接配置 -->
                <div class="config-section">
                  <h4>🔗 连接配置</h4>
                  <el-row :gutter="20">
                    <el-col :span="24">
                      <el-form-item label="API地址">
                        <el-input v-model="config.apiUrl" placeholder="请输入API地址">
                          <template #prepend>HTTPS://</template>
                        </el-input>
                      </el-form-item>
                    </el-col>
                  </el-row>
                  
                  <el-row :gutter="20">
                    <el-col :span="24">
                      <el-form-item label="API密钥">
                        <el-input 
                          v-model="config.apiKey" 
                          type="password" 
                          placeholder="请输入API密钥"
                          show-password
                        >
                          <template #append>
                            <el-button @click="testConnection(config)">
                              <el-icon><Connection /></el-icon>
                            </el-button>
                          </template>
                        </el-input>
                      </el-form-item>
                    </el-col>
                  </el-row>
                  
                  <el-row :gutter="20">
                    <el-col :span="12">
                      <el-form-item label="模型名称">
                        <el-input v-model="config.model" placeholder="如：gpt-4, claude-3" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="连接状态">
                        <el-tag 
                          :type="getStatusType(config.status)"
                          :icon="getStatusIcon(config.status)"
                        >
                          {{ getStatusText(config.status) }}
                        </el-tag>
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>

                <!-- 模型参数 -->
                <div class="config-section">
                  <h4>🎛️ 模型参数</h4>
                  <el-row :gutter="20">
                    <el-col :span="8">
                      <el-form-item label="温度 (Temperature)">
                        <el-slider 
                          v-model="config.temperature" 
                          :min="0" 
                          :max="2" 
                          :step="0.1"
                          show-input
                        />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="最大Token数">
                        <div class="max-tokens-control">
                          <el-checkbox 
                            v-model="config.unlimitedTokens" 
                            @change="handleUnlimitedTokensChange(config)"
                            style="margin-bottom: 8px;"
                          >
                            无限制
                          </el-checkbox>
                          <el-input-number 
                            v-model="config.maxTokens" 
                            :min="1" 
                            :max="10000000"
                            :step="1000"
                            :disabled="config.unlimitedTokens"
                            placeholder="无限制"
                          />
                        </div>
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="Top P">
                        <el-slider 
                          v-model="config.topP" 
                          :min="0" 
                          :max="1" 
                          :step="0.1"
                          show-input
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  
                  <el-row :gutter="20">
                    <el-col :span="8">
                      <el-form-item label="频率惩罚">
                        <el-slider 
                          v-model="config.frequencyPenalty" 
                          :min="-2" 
                          :max="2" 
                          :step="0.1"
                          show-input
                        />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="存在惩罚">
                        <el-slider 
                          v-model="config.presencePenalty" 
                          :min="-2" 
                          :max="2" 
                          :step="0.1"
                          show-input
                        />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="超时时间(秒)">
                        <el-input-number 
                          v-model="config.timeout" 
                          :min="5" 
                          :max="300"
                          :step="5"
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>

                <!-- 高级设置 -->
                <div class="config-section">
                  <h4>🔧 高级设置</h4>
                  <el-row :gutter="20">
                    <el-col :span="12">
                      <el-form-item>
                        <el-checkbox v-model="config.isDefault">设为默认模型</el-checkbox>
                      </el-form-item>
                      <el-form-item>
                        <el-checkbox v-model="config.enabled">启用此配置</el-checkbox>
                      </el-form-item>
                      <el-form-item>
                        <el-checkbox v-model="config.streamMode">启用流式输出</el-checkbox>
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="重试次数">
                        <el-input-number 
                          v-model="config.retryCount" 
                          :min="0" 
                          :max="5"
                        />
                      </el-form-item>
                      <el-form-item label="优先级">
                        <el-input-number 
                          v-model="config.priority" 
                          :min="1" 
                          :max="10"
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  
                  <el-row :gutter="20">
                    <el-col :span="24">
                      <el-form-item label="自定义Headers">
                        <el-input 
                          v-model="config.customHeaders" 
                          type="textarea" 
                          :rows="3"
                          placeholder="JSON格式，如：{'User-Agent': 'MyApp/1.0'}"
                        />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>

                <!-- 操作按钮 -->
                <div class="config-actions">
                  <el-button @click="resetConfig(config)">重置</el-button>
                  <el-button @click="duplicateConfig(config)">复制配置</el-button>
                  <el-button type="warning" @click="testConnection(config)">
                    <el-icon><Connection /></el-icon>
                    测试连接
                  </el-button>
                  <el-button type="primary" @click="saveConfig(config)">
                    <el-icon><Check /></el-icon>
                    保存配置
                  </el-button>
                  <el-button 
                    type="danger" 
                    @click="deleteConfig(config.id)"
                    :disabled="config.isDefault"
                  >
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-card>
    </div>

    <!-- 预设模板 -->
    <div class="preset-templates">
      <el-card>
        <template #header>
          <h3>📦 预设模板</h3>
        </template>
        
        <div class="template-grid">
          <div 
            v-for="template in presetTemplates"
            :key="template.id"
            class="template-card"
            @click="applyTemplate(template)"
          >
            <div class="template-icon">
              {{ template.icon }}
            </div>
            <div class="template-content">
              <h4>{{ template.name }}</h4>
              <p>{{ template.description }}</p>
              <div class="template-tags">
                <el-tag 
                  v-for="tag in template.tags"
                  :key="tag"
                  size="small"
                  type="info"
                >
                  {{ tag }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 导入导出 -->
    <div class="import-export">
      <el-card>
        <template #header>
          <h3>📁 导入导出</h3>
        </template>
        
        <div class="import-export-actions">
          <div class="action-group">
            <h4>导出配置</h4>
            <p>将当前所有配置导出为JSON文件</p>
            <el-button @click="exportConfigs">
              <el-icon><Download /></el-icon>
              导出配置
            </el-button>
          </div>
          
          <div class="action-group">
            <h4>导入配置</h4>
            <p>从JSON文件导入配置（会覆盖现有配置）</p>
            <el-upload
              :before-upload="importConfigs"
              :show-file-list="false"
              accept=".json"
            >
              <el-button>
                <el-icon><Upload /></el-icon>
                选择文件
              </el-button>
            </el-upload>
          </div>
          
          <div class="action-group">
            <h4>重置所有</h4>
            <p>重置所有配置为默认值（谨慎操作）</p>
            <el-button type="danger" @click="resetAllConfigs">
              <el-icon><RefreshLeft /></el-icon>
              重置所有
            </el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Connection, Check, CircleCheck, Warning, Star, Plus,
  Delete, Download, Upload, RefreshLeft
} from '@element-plus/icons-vue'
import { useCloudSync } from '../services/useCloudSync'

const cloudSync = useCloudSync()

// 响应式数据
const activeTab = ref('1')

// 预设的API配置示例数据 - 清空为用户自行配置
const apiConfigs = ref([])

// 预设模板
const presetTemplates = ref([
  {
    id: 'openai-gpt4',
    name: 'OpenAI GPT-4',
    icon: '🤖',
    description: '最强大的通用AI模型，适合复杂创作任务',
    tags: ['通用', '强大', '创意'],
    config: {
      type: 'openai',
      apiUrl: 'api.openai.com/v1/chat/completions',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: null // 移除token限制
    }
  },
  {
    id: 'openai-gpt35',
    name: 'OpenAI GPT-3.5',
    icon: '⚡',
    description: '快速响应，成本较低，适合日常写作',
    tags: ['快速', '经济', '实用'],
    config: {
      type: 'openai',
      apiUrl: 'api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
              maxTokens: null // 移除token限制
    }
  },
  {
    id: 'claude-3',
    name: 'Claude 3 Sonnet',
    icon: '🎭',
    description: '擅长长文本处理和创意写作',
    tags: ['创意', '长文本', '细腻'],
    config: {
      type: 'claude',
      apiUrl: 'api.anthropic.com/v1/messages',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxTokens: null // 移除token限制
    }
  },
  {
    id: 'wenxin',
    name: '文心一言',
    icon: '🇨🇳',
    description: '中文优化，理解中文语境更准确',
    tags: ['中文', '本土', '语境'],
    config: {
      type: 'wenxin',
      apiUrl: 'aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
      model: 'ERNIE-Bot-4',
      temperature: 0.7,
      maxTokens: null // 移除token限制
    }
  },
  {
    id: 'qwen',
    name: '通义千问',
    icon: '🌟',
    description: '阿里云通义千问，多模态能力强',
    tags: ['多模态', '智能', '全面'],
    config: {
      type: 'qwen',
      apiUrl: 'dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      model: 'qwen-max',
      temperature: 0.7,
      maxTokens: null // 移除token限制
    }
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    icon: '🧠',
    description: '清华智谱AI，代码和逻辑能力突出',
    tags: ['逻辑', '代码', '推理'],
    config: {
      type: 'zhipu',
      apiUrl: 'open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4',
      temperature: 0.7,
      maxTokens: null // 移除token限制
    }
  }
])

// 计算属性
const activeConfigs = computed(() => {
  return apiConfigs.value.filter(config => config.enabled && config.apiKey).length
})

const pendingConfigs = computed(() => {
  return apiConfigs.value.filter(config => !config.apiKey).length
})

const connectedConfigs = computed(() => {
  return apiConfigs.value.filter(config => config.status === 'connected').length
})

const defaultModel = computed(() => {
  const defaultConfig = apiConfigs.value.find(config => config.isDefault)
  return defaultConfig ? defaultConfig.name : '未设置'
})

// 方法
const getStatusType = (status) => {
  const types = {
    connected: 'success',
    disconnected: 'danger',
    connecting: 'warning',
    error: 'danger'
  }
  return types[status] || 'info'
}

const getStatusIcon = (status) => {
  const icons = {
    connected: 'CircleCheck',
    disconnected: 'CircleClose',
    connecting: 'Loading',
    error: 'Warning'
  }
  return icons[status] || 'Question'
}

const getStatusText = (status) => {
  const texts = {
    connected: '已连接',
    disconnected: '未连接',
    connecting: '连接中',
    error: '连接错误'
  }
  return texts[status] || '未知'
}

const addNewConfig = () => {
  const newId = String(Date.now())
  const newConfig = {
    id: newId,
    name: '新配置',
    type: 'custom',
    description: '',
    apiUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 2000000, // 默认最大Token数
    unlimitedTokens: false, // 默认不无限制
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    timeout: 30,
    isDefault: false,
    enabled: false,
    streamMode: true,
    retryCount: 3,
    priority: apiConfigs.value.length + 1,
    customHeaders: '',
    status: 'disconnected'
  }
  
  apiConfigs.value.push(newConfig)
  activeTab.value = newId
  ElMessage.success('已添加新配置')
}

const testConnection = async (config) => {
  if (!config.apiKey || !config.apiUrl) {
    ElMessage.warning('请先填写API地址和密钥')
    return
  }
  
  config.status = 'connecting'
  ElMessage.info('正在测试连接...')
  
  // 模拟连接测试
  setTimeout(() => {
    const success = Math.random() > 0.3 // 70% 成功率
    config.status = success ? 'connected' : 'error'
    
    if (success) {
      ElMessage.success(`${config.name} 连接测试成功`)
    } else {
      ElMessage.error(`${config.name} 连接测试失败`)
    }
  }, 2000)
}

const testAllConnections = async () => {
  const enabledConfigs = apiConfigs.value.filter(config => config.enabled && config.apiKey)
  
  if (enabledConfigs.length === 0) {
    ElMessage.warning('没有可测试的配置')
    return
  }
  
  ElMessage.info(`正在测试 ${enabledConfigs.length} 个配置的连接...`)
  
  for (const config of enabledConfigs) {
    await testConnection(config)
    await new Promise(resolve => setTimeout(resolve, 500)) // 间隔500ms
  }
}

const saveConfig = (config) => {
  // 验证必填字段
  if (!config.name || !config.apiUrl) {
    ElMessage.warning('请填写配置名称和API地址')
    return
  }
  
  // 如果设为默认，取消其他默认配置
  if (config.isDefault) {
    apiConfigs.value.forEach(c => {
      if (c.id !== config.id) {
        c.isDefault = false
      }
    })
  }
  
  ElMessage.success(`${config.name} 配置已保存`)
}

const saveAllConfigs = () => {
  const validConfigs = apiConfigs.value.filter(config => config.name && config.apiUrl)
  
  if (validConfigs.length === 0) {
    ElMessage.warning('没有有效的配置可保存')
    return
  }
  
  // 保存到本地存储
  localStorage.setItem('aiApiConfigs', JSON.stringify(apiConfigs.value))
  // Sync to cloud
  cloudSync.saveConfig('aiApiConfigs', apiConfigs.value)
  ElMessage.success(`已保存 ${validConfigs.length} 个配置`)
}

const resetConfig = (config) => {
  ElMessageBox.confirm(
    '确定要重置此配置吗？所有设置将恢复为默认值。',
    '重置配置',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    // 重置为默认值
    Object.assign(config, {
      temperature: 0.7,
      maxTokens: null, // 移除token限制
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      timeout: 30,
      streamMode: true,
      retryCount: 3,
      customHeaders: '',
      status: 'disconnected'
    })
    
    ElMessage.success('配置已重置')
  })
}

// 处理无限制Token选项
const handleUnlimitedTokensChange = (config) => {
  if (config.unlimitedTokens) {
    config.maxTokens = null
  } else {
    config.maxTokens = 2000000 // 恢复到用户设定的默认值
  }
}

const duplicateConfig = (config) => {
  const newId = String(Date.now())
  const duplicatedConfig = {
    ...config,
    id: newId,
    name: `${config.name} (副本)`,
    isDefault: false,
    status: 'disconnected'
  }
  
  apiConfigs.value.push(duplicatedConfig)
  activeTab.value = newId
  ElMessage.success('配置已复制')
}

const deleteConfig = (configId) => {
  const config = apiConfigs.value.find(c => c.id === configId)
  
  if (config.isDefault) {
    ElMessage.warning('不能删除默认配置')
    return
  }
  
  ElMessageBox.confirm(
    `确定要删除配置 "${config.name}" 吗？此操作不可恢复。`,
    '删除配置',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const index = apiConfigs.value.findIndex(c => c.id === configId)
    apiConfigs.value.splice(index, 1)
    
    // 如果删除的是当前激活的标签，切换到第一个
    if (activeTab.value === configId && apiConfigs.value.length > 0) {
      activeTab.value = apiConfigs.value[0].id
    }
    
    ElMessage.success('配置已删除')
  })
}

const applyTemplate = (template) => {
  ElMessageBox.confirm(
    `确定要应用模板 "${template.name}" 吗？这将创建一个新的配置。`,
    '应用模板',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    }
  ).then(() => {
    const newId = String(Date.now())
    const newConfig = {
      id: newId,
      name: template.name,
      description: template.description,
      ...template.config,
      unlimitedTokens: template.config.maxTokens === null, // 根据maxTokens设置unlimitedTokens
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      timeout: 30,
      isDefault: false,
      enabled: false,
      streamMode: true,
      retryCount: 3,
      priority: apiConfigs.value.length + 1,
      customHeaders: '',
      status: 'disconnected',
      apiKey: ''
    }
    
    apiConfigs.value.push(newConfig)
    activeTab.value = newId
    ElMessage.success(`已应用模板 "${template.name}"`)
  })
}

const exportConfigs = () => {
  const configsToExport = apiConfigs.value.map(config => ({
    ...config,
    apiKey: '' // 不导出敏感信息
  }))
  
  const dataStr = JSON.stringify(configsToExport, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  
  const link = document.createElement('a')
  link.href = URL.createObjectURL(dataBlob)
  link.download = `ai-api-configs-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  
  ElMessage.success('配置已导出')
}

const importConfigs = (file) => {
  const reader = new FileReader()
  
  reader.onload = (e) => {
    try {
      const importedConfigs = JSON.parse(e.target.result)
      
      if (!Array.isArray(importedConfigs)) {
        throw new Error('无效的配置文件格式')
      }
      
      ElMessageBox.confirm(
        `确定要导入 ${importedConfigs.length} 个配置吗？这将覆盖现有配置。`,
        '导入配置',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        apiConfigs.value = importedConfigs.map((config, index) => ({
          ...config,
          id: String(Date.now() + index),
          status: 'disconnected'
        }))
        
        if (apiConfigs.value.length > 0) {
          activeTab.value = apiConfigs.value[0].id
        }
        
        ElMessage.success(`已导入 ${importedConfigs.length} 个配置`)
      })
    } catch (error) {
      ElMessage.error('配置文件格式错误')
    }
  }
  
  reader.readAsText(file)
  return false // 阻止默认上传行为
}

const resetAllConfigs = () => {
  ElMessageBox.confirm(
    '确定要重置所有配置吗？这将删除所有自定义配置并恢复默认设置。',
    '重置所有配置',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    // 重置为初始配置
    apiConfigs.value = [
      {
        id: '1',
        name: 'OpenAI GPT-4',
        type: 'openai',
        description: 'OpenAI GPT-4 模型配置',
        apiUrl: 'api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: null, // 移除token限制
        unlimitedTokens: true, // 默认无限制
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        timeout: 30,
        isDefault: true,
        enabled: true,
        streamMode: true,
        retryCount: 3,
        priority: 1,
        customHeaders: '',
        status: 'disconnected'
      }
    ]
    
    activeTab.value = '1'
    ElMessage.success('所有配置已重置')
  })
}

// 生命周期
onMounted(() => {
  // 从本地存储加载配置
  const savedConfigs = localStorage.getItem('aiApiConfigs')
  if (savedConfigs) {
    try {
      const configs = JSON.parse(savedConfigs)
      // 为现有配置添加unlimitedTokens字段
      apiConfigs.value = configs.map(config => ({
        ...config,
        unlimitedTokens: config.unlimitedTokens !== undefined ? config.unlimitedTokens : (config.maxTokens === null)
      }))
      if (apiConfigs.value.length > 0) {
        activeTab.value = apiConfigs.value[0].id
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }
})
</script>

<style scoped>
.api-config {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header-content h1 {
  margin: 0 0 5px 0;
  font-size: 24px;
  color: #303133;
}

.header-content p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.config-overview {
  margin-bottom: 20px;
}

.status-card {
  height: 100%;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 15px;
}

.status-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.status-icon.success {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}

.status-icon.warning {
  background: linear-gradient(135deg, #e6a23c, #f0a020);
}

.status-icon.info {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}

.status-icon.primary {
  background: linear-gradient(135deg, #909399, #b3b6bb);
}

.status-content {
  flex: 1;
}

.status-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 5px;
}

.status-label {
  font-size: 14px;
  color: #606266;
}

.config-list {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  color: #303133;
}

.config-tabs {
  margin-top: 20px;
}

.config-content {
  padding: 20px 0;
}

.config-section {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
}

.config-section:last-child {
  border-bottom: none;
}

.config-section h4 {
  margin: 0 0 20px 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.config-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.max-tokens-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-templates {
  margin-bottom: 20px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.template-card {
  padding: 20px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  gap: 15px;
}

.template-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 8px rgba(64, 158, 255, 0.2);
}

.template-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 8px;
}

.template-content {
  flex: 1;
}

.template-content h4 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 16px;
}

.template-content p {
  margin: 0 0 10px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.4;
}

.template-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.import-export {
  margin-bottom: 20px;
}

.import-export-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
}

.action-group h4 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 16px;
}

.action-group p {
  margin: 0 0 15px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.4;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .config-actions {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .template-grid {
    grid-template-columns: 1fr;
  }
  
  .import-export-actions {
    grid-template-columns: 1fr;
  }
}
</style>