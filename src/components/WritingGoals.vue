<template>
  <div class="writing-goals">
    <div class="goals-header">
      <h3>🎯 写作目标</h3>
      <el-button type="primary" size="small" @click="showAddGoalDialog = true">
        <el-icon><Plus /></el-icon>
        新增目标
      </el-button>
    </div>

    <!-- 目标统计概览 -->
    <div class="goals-overview">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="overview-card">
            <div class="card-icon daily">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="card-content">
              <div class="card-title">今日目标</div>
              <div class="card-value">{{ todayProgress.current }}/{{ todayProgress.target }}</div>
              <div class="card-subtitle">{{ todayProgress.unit }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-card">
            <div class="card-icon weekly">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="card-content">
              <div class="card-title">本周目标</div>
              <div class="card-value">{{ weeklyProgress.current }}/{{ weeklyProgress.target }}</div>
              <div class="card-subtitle">{{ weeklyProgress.unit }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-card">
            <div class="card-icon monthly">
              <el-icon><TrendCharts /></el-icon>
            </div>
            <div class="card-content">
              <div class="card-title">本月目标</div>
              <div class="card-value">{{ monthlyProgress.current }}/{{ monthlyProgress.target }}</div>
              <div class="card-subtitle">{{ monthlyProgress.unit }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="overview-card">
            <div class="card-icon streak">
              <el-icon><Trophy /></el-icon>
            </div>
            <div class="card-content">
              <div class="card-title">连续天数</div>
              <div class="card-value">{{ currentStreak }}</div>
              <div class="card-subtitle">天</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 活跃目标列表 -->
    <div class="active-goals">
      <div class="active-goals-header">
        <h4>📋 活跃目标</h4>
        <div class="goals-controls">
          <el-button 
            type="text" 
            size="small" 
            @click="toggleSortMode"
            :class="{ 'sort-active': sortMode }"
          >
            <el-icon><Rank /></el-icon>
            {{ sortMode ? '完成排序' : '调整排序' }}
          </el-button>
        </div>
      </div>
      
      <div v-if="activeGoals.length === 0" class="empty-state">
        <el-empty description="暂无活跃目标，创建一个开始吧！" />
      </div>
      <div v-else class="goals-list">
        <div v-if="sortMode" class="sort-tip">
          <el-alert
            title="拖拽目标卡片可以调整在首页的显示顺序"
            type="info"
            :closable="false"
            show-icon
          />
        </div>
        
        <transition-group 
          name="list" 
          tag="div" 
          class="sortable-goals"
        >
          <div 
            v-for="(goal, index) in activeGoals" 
            :key="goal.id" 
            class="goal-item"
            :class="{ 'sortable': sortMode }"
            :draggable="sortMode"
            @dragstart="onDragStart($event, index)"
            @dragover="onDragOver"
            @drop="onDrop($event, index)"
          >
            <div class="goal-header">
              <div class="goal-info">
                <span class="goal-title">{{ goal.title }}</span>
                <el-tag :type="getGoalTypeColor(goal.type)" size="small">{{ getGoalTypeText(goal.type) }}</el-tag>
              </div>
              <div class="goal-actions">
                <el-button type="text" size="small" @click="updateProgress(goal)">
                  <el-icon><Edit /></el-icon>
                  更新进度
                </el-button>
                <el-dropdown trigger="click">
                  <el-button type="text" size="small">
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="editGoal(goal)">
                        <el-icon><Edit /></el-icon>
                        编辑目标
                      </el-dropdown-item>
                      <el-dropdown-item @click="pauseGoal(goal)">
                        <el-icon><VideoPause /></el-icon>
                        暂停目标
                      </el-dropdown-item>
                      <el-dropdown-item divided @click="deleteGoal(goal.id)">
                        <el-icon><Delete /></el-icon>
                        删除目标
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            
            <div class="goal-description">{{ goal.description }}</div>
            
            <div class="goal-progress">
              <div class="progress-info">
                <span>{{ goal.currentValue }}/{{ goal.targetValue }} {{ goal.unit }}</span>
                <span class="progress-percentage">{{ Math.round((goal.currentValue / goal.targetValue) * 100) }}%</span>
              </div>
              <el-progress 
                :percentage="Math.round((goal.currentValue / goal.targetValue) * 100)"
                :status="goal.currentValue >= goal.targetValue ? 'success' : undefined"
              />
            </div>
            
            <div class="goal-meta">
              <div class="meta-item">
                <el-icon><Calendar /></el-icon>
                <span>{{ formatDateRange(goal.startDate, goal.endDate) }}</span>
              </div>
              <div class="meta-item">
                <el-icon><Clock /></el-icon>
                <span>剩余 {{ getRemainingDays(goal.endDate) }} 天</span>
              </div>
            </div>
          </div>
        </transition-group>
      </div>
    </div>

    <!-- 历史目标 -->
    <div class="historical-goals">
      <el-collapse>
        <el-collapse-item title="📈 历史目标" name="history">
          <div v-if="completedGoals.length === 0" class="empty-state">
            <p>暂无已完成的目标</p>
          </div>
          <div v-else class="goals-list">
            <div v-for="goal in completedGoals" :key="goal.id" class="goal-item completed">
              <div class="goal-header">
                <div class="goal-info">
                  <span class="goal-title">{{ goal.title }}</span>
                  <el-tag type="success" size="small">已完成</el-tag>
                </div>
                <div class="completion-date">
                  完成于 {{ formatDate(goal.completedAt) }}
                </div>
              </div>
              <div class="goal-description">{{ goal.description }}</div>
              <div class="goal-result">
                最终完成：{{ goal.currentValue }}/{{ goal.targetValue }} {{ goal.unit }}
                ({{ Math.round((goal.currentValue / goal.targetValue) * 100) }}%)
              </div>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 新增/编辑目标对话框 -->
    <el-dialog 
      v-model="showAddGoalDialog" 
      :title="editingGoal ? '编辑目标' : '新增写作目标'"
      width="500px"
    >
      <el-form :model="goalForm" :rules="goalRules" ref="goalFormRef" label-width="80px">
        <el-form-item label="目标标题" prop="title">
          <el-input v-model="goalForm.title" placeholder="例如：每日写作1000字" />
        </el-form-item>
        
        <el-form-item label="目标类型" prop="type">
          <el-select v-model="goalForm.type" placeholder="选择目标类型">
            <el-option label="每日目标" value="daily" />
            <el-option label="每周目标" value="weekly" />
            <el-option label="每月目标" value="monthly" />
            <el-option label="自定义期间" value="custom" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="目标描述">
          <el-input 
            v-model="goalForm.description" 
            type="textarea" 
            :rows="2"
            placeholder="描述你的写作目标"
          />
        </el-form-item>
        
        <el-form-item label="目标数值" prop="targetValue">
          <el-input-number 
            v-model="goalForm.targetValue" 
            :min="1" 
            :max="100000"
            placeholder="目标数值"
          />
        </el-form-item>
        
        <el-form-item label="计量单位" prop="unit">
          <el-select v-model="goalForm.unit" placeholder="选择单位">
            <el-option label="字" value="字" />
            <el-option label="页" value="页" />
            <el-option label="章节" value="章节" />
            <el-option label="小时" value="小时" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="goalForm.type === 'custom'" label="时间范围" prop="dateRange">
          <el-date-picker
            v-model="goalForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showAddGoalDialog = false">取消</el-button>
          <el-button type="primary" @click="saveGoal">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 更新进度对话框 -->
    <el-dialog v-model="showProgressDialog" title="更新进度" width="400px">
      <el-form :model="progressForm" label-width="80px">
        <el-form-item label="当前进度">
          <el-input-number 
            v-model="progressForm.value" 
            :min="0" 
            :max="progressForm.maxValue"
          />
          <span class="ml-2">{{ progressForm.unit }}</span>
        </el-form-item>
        
        <el-form-item label="进度说明">
          <el-input 
            v-model="progressForm.note" 
            type="textarea" 
            :rows="2"
            placeholder="记录今天的写作情况"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showProgressDialog = false">取消</el-button>
          <el-button type="primary" @click="saveProgress">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  VideoPause, Delete, Rank
} from '@element-plus/icons-vue'
import { useCloudSync } from '../services/useCloudSync.js'

const cloudSync = useCloudSync()

// 响应式数据
const goals = ref([])
const showAddGoalDialog = ref(false)
const showProgressDialog = ref(false)
const editingGoal = ref(null)
const updatingGoal = ref(null)
const goalFormRef = ref()

// 排序相关
const sortMode = ref(false)
const draggedIndex = ref(null)

const goalForm = ref({
  title: '',
  type: 'daily',
  description: '',
  targetValue: 1000,
  unit: '字',
  dateRange: null
})

const progressForm = ref({
  value: 0,
  maxValue: 0,
  unit: '',
  note: ''
})

const goalRules = {
  title: [
    { required: true, message: '请输入目标标题', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择目标类型', trigger: 'change' }
  ],
  targetValue: [
    { required: true, message: '请输入目标数值', trigger: 'blur' }
  ],
  unit: [
    { required: true, message: '请选择计量单位', trigger: 'change' }
  ]
}

// 计算属性
const activeGoals = computed(() => {
  const active = goals.value.filter(goal => goal.status === 'active')
  // 按优先级排序（priority字段，数字越小优先级越高），如果没有priority则按创建时间排序
  return active.sort((a, b) => {
    if (a.priority !== undefined && b.priority !== undefined) {
      return a.priority - b.priority
    }
    if (a.priority !== undefined) return -1
    if (b.priority !== undefined) return 1
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  })
})

const completedGoals = computed(() => {
  return goals.value.filter(goal => goal.status === 'completed')
})

const todayProgress = computed(() => {
  const dailyGoals = activeGoals.value.filter(goal => goal.type === 'daily')
  if (dailyGoals.length === 0) return { current: 0, target: 0, unit: '字' }
  
  const goal = dailyGoals[0]
  return {
    current: goal.currentValue,
    target: goal.targetValue,
    unit: goal.unit
  }
})

const weeklyProgress = computed(() => {
  const weeklyGoals = activeGoals.value.filter(goal => goal.type === 'weekly')
  if (weeklyGoals.length === 0) return { current: 0, target: 0, unit: '字' }
  
  const goal = weeklyGoals[0]
  return {
    current: goal.currentValue,
    target: goal.targetValue,
    unit: goal.unit
  }
})

const monthlyProgress = computed(() => {
  const monthlyGoals = activeGoals.value.filter(goal => goal.type === 'monthly')
  if (monthlyGoals.length === 0) return { current: 0, target: 0, unit: '字' }
  
  const goal = monthlyGoals[0]
  return {
    current: goal.currentValue,
    target: goal.targetValue,
    unit: goal.unit
  }
})

const currentStreak = computed(() => {
  // 计算连续完成目标的天数
  return 7 // 示例数据
})

// 方法
const editGoal = (goal) => {
  editingGoal.value = goal
  goalForm.value = {
    title: goal.title,
    type: goal.type,
    description: goal.description,
    targetValue: goal.targetValue,
    unit: goal.unit,
    dateRange: goal.type === 'custom' ? [goal.startDate, goal.endDate] : null
  }
  showAddGoalDialog.value = true
}

const updateProgress = (goal) => {
  updatingGoal.value = goal
  progressForm.value = {
    value: goal.currentValue,
    maxValue: goal.targetValue,
    unit: goal.unit,
    note: ''
  }
  showProgressDialog.value = true
}

const pauseGoal = async (goal) => {
  try {
    await ElMessageBox.confirm('确定要暂停这个目标吗？', '确认暂停', {
      type: 'warning'
    })
    
    const index = goals.value.findIndex(g => g.id === goal.id)
    if (index !== -1) {
      goals.value[index].status = 'paused'
      saveGoals()
      ElMessage.success('目标已暂停')
    }
  } catch {
    // 用户取消
  }
}

const deleteGoal = async (goalId) => {
  try {
    await ElMessageBox.confirm('确定要删除这个目标吗？', '确认删除', {
      type: 'warning'
    })
    
    goals.value = goals.value.filter(goal => goal.id !== goalId)
    saveGoals()
    ElMessage.success('目标删除成功')
  } catch {
    // 用户取消
  }
}

const saveGoal = async () => {
  try {
    await goalFormRef.value.validate()
    
    const goalData = { ...goalForm.value }
    
    // 设置日期范围
    if (goalData.type === 'daily') {
      goalData.startDate = new Date().toISOString().split('T')[0]
      goalData.endDate = new Date().toISOString().split('T')[0]
    } else if (goalData.type === 'weekly') {
      const now = new Date()
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
      const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6))
      goalData.startDate = startOfWeek.toISOString().split('T')[0]
      goalData.endDate = endOfWeek.toISOString().split('T')[0]
    } else if (goalData.type === 'monthly') {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      goalData.startDate = startOfMonth.toISOString().split('T')[0]
      goalData.endDate = endOfMonth.toISOString().split('T')[0]
    } else if (goalData.type === 'custom' && goalData.dateRange) {
      goalData.startDate = goalData.dateRange[0]
      goalData.endDate = goalData.dateRange[1]
    }
    
    delete goalData.dateRange
    
    if (editingGoal.value) {
      // 编辑现有目标
      const index = goals.value.findIndex(g => g.id === editingGoal.value.id)
      if (index !== -1) {
        goals.value[index] = {
          ...goals.value[index],
          ...goalData,
          updatedAt: new Date()
        }
      }
    } else {
      // 新增目标
      const newGoal = {
        id: Date.now(),
        ...goalData,
        currentValue: 0,
        status: 'active',
        priority: goals.value.filter(g => g.status === 'active').length, // 设置为最低优先级
        createdAt: new Date(),
        updatedAt: new Date()
      }
      goals.value.push(newGoal)
    }
    
    saveGoals()
    showAddGoalDialog.value = false
    editingGoal.value = null
    resetGoalForm()
    ElMessage.success(editingGoal.value ? '目标更新成功' : '目标创建成功')
  } catch (error) {
    console.error('保存目标失败:', error)
  }
}

const saveProgress = () => {
  if (updatingGoal.value) {
    const index = goals.value.findIndex(g => g.id === updatingGoal.value.id)
    if (index !== -1) {
      goals.value[index].currentValue = progressForm.value.value
      goals.value[index].updatedAt = new Date()
      
      // 检查是否完成目标
      if (progressForm.value.value >= goals.value[index].targetValue) {
        goals.value[index].status = 'completed'
        goals.value[index].completedAt = new Date()
        ElMessage.success('🎉 恭喜！目标已完成！')
      } else {
        ElMessage.success('进度更新成功')
      }
      
      saveGoals()
    }
  }
  
  showProgressDialog.value = false
  updatingGoal.value = null
}

const resetGoalForm = () => {
  goalForm.value = {
    title: '',
    type: 'daily',
    description: '',
    targetValue: 1000,
    unit: '字',
    dateRange: null
  }
}

// 排序相关方法
const toggleSortMode = () => {
  sortMode.value = !sortMode.value
  if (!sortMode.value) {
    // 退出排序模式时保存排序结果
    saveGoals()
  }
}

const onDragStart = (event, index) => {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
}

const onDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

const onDrop = (event, targetIndex) => {
  event.preventDefault()
  
  if (draggedIndex.value !== null && draggedIndex.value !== targetIndex) {
    const activeGoalsList = activeGoals.value
    
    // 重新安排优先级
    const draggedGoal = activeGoalsList[draggedIndex.value]
    activeGoalsList.splice(draggedIndex.value, 1)
    activeGoalsList.splice(targetIndex, 0, draggedGoal)
    
    // 更新所有活跃目标的优先级
    activeGoalsList.forEach((goal, index) => {
      const goalInStore = goals.value.find(g => g.id === goal.id)
      if (goalInStore) {
        goalInStore.priority = index
      }
    })
    
    ElMessage.success('排序已更新')
  }
  
  draggedIndex.value = null
}

const saveGoals = () => {
  localStorage.setItem('writingGoals', JSON.stringify(goals.value))
  // Sync to cloud
  cloudSync.saveConfig('writingGoals', goals.value)
  console.log('目标数据已保存:', goals.value)
  
  // 触发storage事件，通知其他页面数据已更新
  const event = new StorageEvent('storage', {
    key: 'writingGoals',
    newValue: JSON.stringify(goals.value),
    oldValue: null,
    storageArea: localStorage
  })
  window.dispatchEvent(event)
  
  // 如果首页的刷新函数存在，直接调用
  if (window.refreshHomeData) {
    window.refreshHomeData()
  }
}

const loadGoals = () => {
  try {
    const saved = localStorage.getItem('writingGoals')
    if (saved) {
      goals.value = JSON.parse(saved)
      
      // 兼容性处理：为没有priority字段的目标添加priority
      let needsSave = false
      goals.value.forEach((goal, index) => {
        if (goal.priority === undefined) {
          goal.priority = index
          needsSave = true
        }
      })
      
      if (needsSave) {
        saveGoals()
      }
    }
  } catch (error) {
    console.error('加载目标失败:', error)
  }
}

const getGoalTypeText = (type) => {
  const typeMap = {
    daily: '每日',
    weekly: '每周',
    monthly: '每月',
    custom: '自定义'
  }
  return typeMap[type] || '未知'
}

const getGoalTypeColor = (type) => {
  const colorMap = {
    daily: 'primary',
    weekly: 'success',
    monthly: 'warning',
    custom: 'info'
  }
  return colorMap[type] || 'info'
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString()
}

const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return ''
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

const getRemainingDays = (endDate) => {
  if (!endDate) return 0
  const end = new Date(endDate)
  const now = new Date()
  const diffTime = end - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// 生命周期
onMounted(() => {
  loadGoals()
})
</script>

<style scoped>
.writing-goals {
  padding: 20px;
}

.goals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.goals-overview {
  margin-bottom: 30px;
}

.overview-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.overview-card:hover {
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  font-size: 20px;
  color: white;
}

.card-icon.daily {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.card-icon.weekly {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.card-icon.monthly {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.card-icon.streak {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 4px;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin-bottom: 2px;
}

.card-subtitle {
  font-size: 12px;
  color: #999;
}

.active-goals {
  margin-bottom: 30px;
}

.goals-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.goal-item {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
}

.goal-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.goal-item.completed {
  background: #f0f9ff;
  border-color: #67c23a;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.goal-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.goal-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.goal-actions {
  display: flex;
  gap: 8px;
}

.goal-description {
  color: #606266;
  margin-bottom: 16px;
  line-height: 1.5;
}

.goal-progress {
  margin-bottom: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.progress-percentage {
  font-weight: bold;
  color: #409eff;
}

.goal-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #909399;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.completion-date {
  font-size: 12px;
  color: #67c23a;
}

.goal-result {
  font-size: 14px;
  color: #606266;
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.ml-2 {
  margin-left: 8px;
}

/* 排序相关样式 */
.active-goals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.goals-controls {
  display: flex;
  gap: 8px;
}

.sort-active {
  background: #409eff !important;
  color: white !important;
}

.sort-tip {
  margin-bottom: 16px;
}

.sortable-goals {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.goal-item.sortable {
  cursor: move;
  border: 2px dashed transparent;
  transition: all 0.3s ease;
}

.goal-item.sortable:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

.goal-item.sortable[draggable="true"]:active {
  opacity: 0.8;
  transform: rotate(2deg);
}

/* 拖拽动画 */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>