<template>
  <div class="template-manager">
    <!-- 添加模板区域 -->
    <div class="add-template-section">
      <h3 class="section-title">创建新模板</h3>
      <el-form 
        ref="templateFormRef" 
        :model="newTemplate" 
        :rules="templateRules"
        label-width="80px"
        class="template-form"
      >
        <el-form-item label="模板名称" prop="name">
          <el-input 
            v-model="newTemplate.name" 
            placeholder="请输入模板名称"
            maxlength="20"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="模板描述" prop="description">
          <el-input 
            v-model="newTemplate.description" 
            placeholder="请输入模板描述"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="写作风格" prop="style">
          <el-select v-model="newTemplate.style" placeholder="请选择写作风格" style="width: 100%">
            <el-option label="正式" value="formal" />
            <el-option label="轻松" value="casual" />
            <el-option label="幽默" value="humorous" />
            <el-option label="严肃" value="serious" />
            <el-option label="诗意" value="poetic" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="目标受众" prop="audience">
          <el-select v-model="newTemplate.audience" placeholder="请选择目标受众" style="width: 100%">
            <el-option label="青少年" value="teen" />
            <el-option label="成年人" value="adult" />
            <el-option label="儿童" value="children" />
            <el-option label="专业人士" value="professional" />
            <el-option label="通用" value="general" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="常用词汇" prop="keywords">
          <el-input 
            v-model="newTemplate.keywords" 
            type="textarea"
            :rows="3"
            placeholder="请输入常用词汇，用逗号分隔"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="写作提示" prop="prompt">
          <el-input 
            v-model="newTemplate.prompt" 
            type="textarea"
            :rows="4"
            placeholder="请输入写作提示和指导"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="addTemplate">
            <el-icon class="mr-2"><Plus /></el-icon>
            创建模板
          </el-button>
          <el-button @click="resetForm">
            <el-icon class="mr-2"><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 模板列表 -->
    <div class="template-list-section">
      <div class="list-header">
        <h3 class="section-title">模板列表 ({{ templates.length }})</h3>
        <div class="list-actions">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索模板..."
            style="width: 200px"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <div v-if="filteredTemplates.length === 0" class="empty-templates">
        <el-icon class="empty-icon"><Document /></el-icon>
        <p v-if="templates.length === 0">暂无自定义模板</p>
        <p v-else>没有找到匹配的模板</p>
        <p class="empty-tip">创建模板可以快速生成特定风格的内容</p>
      </div>

      <div v-else class="template-grid">
        <div 
          v-for="template in filteredTemplates" 
          :key="template.id" 
          class="template-card"
          :class="{ 'system-template': template.isSystem }"
        >
          <div class="template-header">
            <div class="template-title">
              <span class="template-name">{{ template.name }}</span>
              <el-tag 
                v-if="template.isSystem" 
                type="info" 
                size="small"
              >
                系统
              </el-tag>
              <el-tag 
                v-else 
                type="success" 
                size="small"
              >
                自定义
              </el-tag>
            </div>
            <div class="template-actions">
              <el-button 
                type="text" 
                size="small" 
                @click="useTemplate(template)"
              >
                <el-icon><Check /></el-icon>
              </el-button>
              <el-button 
                v-if="!template.isSystem" 
                type="text" 
                size="small" 
                @click="editTemplate(template)"
              >
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button 
                v-if="!template.isSystem" 
                type="text" 
                size="small" 
                @click="deleteTemplate(template.id)"
                class="delete-btn"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          
          <div class="template-description">
            {{ template.description }}
          </div>
          
          <div class="template-details">
            <div class="detail-item">
              <span class="detail-label">风格:</span>
              <span class="detail-value">{{ getStyleLabel(template.style) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">受众:</span>
              <span class="detail-value">{{ getAudienceLabel(template.audience) }}</span>
            </div>
          </div>
          
          <div v-if="template.keywords" class="template-keywords">
            <div class="keywords-label">常用词汇:</div>
            <div class="keywords-list">
              <el-tag 
                v-for="keyword in getKeywordList(template.keywords)" 
                :key="keyword"
                size="small"
                class="keyword-tag"
              >
                {{ keyword }}
              </el-tag>
            </div>
          </div>
          
          <div v-if="template.prompt" class="template-prompt">
            <div class="prompt-label">写作提示:</div>
            <div class="prompt-content">
              {{ getPromptPreview(template.prompt) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑模板对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      title="编辑模板" 
      width="600px"
      :before-close="cancelEdit"
    >
      <el-form 
        ref="editFormRef" 
        :model="editingTemplate" 
        :rules="templateRules"
        label-width="80px"
      >
        <el-form-item label="模板名称" prop="name">
          <el-input 
            v-model="editingTemplate.name" 
            placeholder="请输入模板名称"
            maxlength="20"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="模板描述" prop="description">
          <el-input 
            v-model="editingTemplate.description" 
            placeholder="请输入模板描述"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="写作风格" prop="style">
          <el-select v-model="editingTemplate.style" placeholder="请选择写作风格" style="width: 100%">
            <el-option label="正式" value="formal" />
            <el-option label="轻松" value="casual" />
            <el-option label="幽默" value="humorous" />
            <el-option label="严肃" value="serious" />
            <el-option label="诗意" value="poetic" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="目标受众" prop="audience">
          <el-select v-model="editingTemplate.audience" placeholder="请选择目标受众" style="width: 100%">
            <el-option label="青少年" value="teen" />
            <el-option label="成年人" value="adult" />
            <el-option label="儿童" value="children" />
            <el-option label="专业人士" value="professional" />
            <el-option label="通用" value="general" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="常用词汇" prop="keywords">
          <el-input 
            v-model="editingTemplate.keywords" 
            type="textarea"
            :rows="3"
            placeholder="请输入常用词汇，用逗号分隔"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="写作提示" prop="prompt">
          <el-input 
            v-model="editingTemplate.prompt" 
            type="textarea"
            :rows="4"
            placeholder="请输入写作提示和指导"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelEdit">取消</el-button>
          <el-button type="primary" @click="saveEdit">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useNovelStore } from '@/stores/novel'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCloudSync } from '../services/useCloudSync'

const novelStore = useNovelStore()
const cloudSync = useCloudSync()

// 响应式数据
const templateFormRef = ref()
const editFormRef = ref()
const searchKeyword = ref('')
const showEditDialog = ref(false)

const newTemplate = reactive({
  name: '',
  description: '',
  style: '',
  audience: '',
  keywords: '',
  prompt: ''
})

const editingTemplate = reactive({
  id: null,
  name: '',
  description: '',
  style: '',
  audience: '',
  keywords: '',
  prompt: ''
})

// 表单验证规则
const templateRules = {
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入模板描述', trigger: 'blur' },
    { min: 5, max: 50, message: '长度在 5 到 50 个字符', trigger: 'blur' }
  ],
  style: [
    { required: true, message: '请选择写作风格', trigger: 'change' }
  ],
  audience: [
    { required: true, message: '请选择目标受众', trigger: 'change' }
  ]
}

// 计算属性
const templates = computed(() => {
  // 合并系统模板和自定义模板
  const systemTemplates = novelStore.templates.map(t => ({ ...t, isSystem: true }))
  const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]')
    .map(t => ({ ...t, isSystem: false }))
  
  return [...systemTemplates, ...customTemplates]
})

const filteredTemplates = computed(() => {
  if (!searchKeyword.value.trim()) {
    return templates.value
  }
  return templates.value.filter(template => 
    template.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    template.description.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 方法
const addTemplate = async () => {
  try {
    await templateFormRef.value.validate()
    
    const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]')
    const newId = Date.now()
    
    const template = {
      id: newId,
      name: newTemplate.name,
      description: newTemplate.description,
      style: newTemplate.style,
      audience: newTemplate.audience,
      keywords: newTemplate.keywords,
      prompt: newTemplate.prompt,
      createdAt: new Date().toISOString()
    }
    
    customTemplates.push(template)
    localStorage.setItem('customTemplates', JSON.stringify(customTemplates))
    cloudSync.saveConfig('customTemplates', customTemplates)
    
    ElMessage.success('模板创建成功')
    resetForm()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

const resetForm = () => {
  Object.assign(newTemplate, {
    name: '',
    description: '',
    style: '',
    audience: '',
    keywords: '',
    prompt: ''
  })
  templateFormRef.value?.clearValidate()
}

const useTemplate = (template) => {
  novelStore.setTemplate(template)
  ElMessage.success(`已选择模板: ${template.name}`)
}

const editTemplate = (template) => {
  Object.assign(editingTemplate, {
    id: template.id,
    name: template.name,
    description: template.description,
    style: template.style,
    audience: template.audience,
    keywords: template.keywords,
    prompt: template.prompt
  })
  showEditDialog.value = true
}

const cancelEdit = () => {
  showEditDialog.value = false
  Object.assign(editingTemplate, {
    id: null,
    name: '',
    description: '',
    style: '',
    audience: '',
    keywords: '',
    prompt: ''
  })
}

const saveEdit = async () => {
  try {
    await editFormRef.value.validate()
    
    const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]')
    const index = customTemplates.findIndex(t => t.id === editingTemplate.id)
    
    if (index > -1) {
      customTemplates[index] = {
        ...customTemplates[index],
        name: editingTemplate.name,
        description: editingTemplate.description,
        style: editingTemplate.style,
        audience: editingTemplate.audience,
        keywords: editingTemplate.keywords,
        prompt: editingTemplate.prompt,
        updatedAt: new Date().toISOString()
      }
      
      localStorage.setItem('customTemplates', JSON.stringify(customTemplates))
      cloudSync.saveConfig('customTemplates', customTemplates)
      ElMessage.success('模板更新成功')
      showEditDialog.value = false
    }
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

const deleteTemplate = async (id) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个模板吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]')
    const filteredTemplates = customTemplates.filter(t => t.id !== id)
    localStorage.setItem('customTemplates', JSON.stringify(filteredTemplates))
    cloudSync.saveConfig('customTemplates', filteredTemplates)
    
    ElMessage.success('删除成功')
  } catch {
    // 用户取消删除
  }
}

const getStyleLabel = (style) => {
  const styleMap = {
    formal: '正式',
    casual: '轻松',
    humorous: '幽默',
    serious: '严肃',
    poetic: '诗意'
  }
  return styleMap[style] || style
}

const getAudienceLabel = (audience) => {
  const audienceMap = {
    teen: '青少年',
    adult: '成年人',
    children: '儿童',
    professional: '专业人士',
    general: '通用'
  }
  return audienceMap[audience] || audience
}

const getKeywordList = (keywords) => {
  if (!keywords) return []
  // 如果是数组，直接返回前5个元素
  if (Array.isArray(keywords)) {
    return keywords.slice(0, 5)
  }
  // 如果是字符串，按逗号分割
  return keywords.split(',').map(k => k.trim()).filter(k => k).slice(0, 5)
}

const getPromptPreview = (prompt) => {
  if (!prompt) return ''
  return prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt
}
</script>

<style scoped>
.template-manager {
  max-height: 70vh;
  overflow-y: auto;
}

.add-template-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.template-form {
  max-width: 600px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.list-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.empty-templates {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-tip {
  font-size: 12px;
  margin-top: 8px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.template-card {
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.template-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.system-template {
  background: #f8f9fa;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.template-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-name {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
}

.template-actions {
  display: flex;
  gap: 4px;
}

.delete-btn {
  color: #f56c6c;
}

.delete-btn:hover {
  color: #f56c6c;
}

.template-description {
  color: #606266;
  margin-bottom: 12px;
  line-height: 1.5;
}

.template-details {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.detail-item {
  font-size: 12px;
}

.detail-label {
  color: #909399;
  margin-right: 4px;
}

.detail-value {
  color: #303133;
  font-weight: 500;
}

.template-keywords {
  margin-bottom: 12px;
}

.keywords-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.keyword-tag {
  margin: 0;
}

.template-prompt {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.prompt-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.prompt-content {
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
}

:deep(.el-form-item) {
  margin-bottom: 18px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}
</style>