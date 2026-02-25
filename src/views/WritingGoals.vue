<template>
  <div class="writing-goals">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1>🎯 写作目标</h1>
        <p>设定目标，追踪进度，保持创作动力</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          设定新目标
        </el-button>
      </div>
    </div>

    <!-- 目标概览 -->
    <div class="goals-overview">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="overview-card">
            <div class="overview-item">
              <div class="overview-icon active">
                <el-icon><Trophy /></el-icon>
              </div>
              <div class="overview-content">
                <div class="overview-value">{{ activeGoals }}</div>
                <div class="overview-label">进行中目标</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="overview-card">
            <div class="overview-item">
              <div class="overview-icon completed">
                <el-icon><Medal /></el-icon>
              </div>
              <div class="overview-content">
                <div class="overview-value">{{ completedGoals }}</div>
                <div class="overview-label">已完成目标</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="overview-card">
            <div class="overview-item">
              <div class="overview-icon words">
                <el-icon><EditPen /></el-icon>
              </div>
              <div class="overview-content">
                <div class="overview-value">{{ todayWords }}</div>
                <div class="overview-label">今日字数</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="overview-card">
            <div class="overview-item">
              <div class="overview-icon streak">
                <el-icon><Calendar /></el-icon>
              </div>
              <div class="overview-content">
                <div class="overview-value">{{ writingStreak }}</div>
                <div class="overview-label">连续天数</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 当前活跃目标 -->
    <div class="active-goals-section">
      <h2>🔥 当前目标</h2>
      <div class="goals-grid">
        <div 
          v-for="goal in currentGoals" 
          :key="goal.id"
          class="goal-card"
        >
          <el-card shadow="hover">
            <div class="goal-header">
              <div class="goal-title">
                <span class="goal-icon">{{ getGoalIcon(goal.type) }}</span>
                <h3>{{ goal.title }}</h3>
              </div>
              <div class="goal-actions">
                <el-dropdown trigger="click">
                  <el-button type="text" size="small">
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="editGoal(goal)">
                        <el-icon><Edit /></el-icon>
                        编辑
                      </el-dropdown-item>
                      <el-dropdown-item @click="pauseGoal(goal)">
                        <el-icon><VideoPause /></el-icon>
                        暂停
                      </el-dropdown-item>
                      <el-dropdown-item divided @click="deleteGoal(goal)">
                        <el-icon><Delete /></el-icon>
                        删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            
            <div class="goal-description">
              <p>{{ goal.description }}</p>
            </div>
            
            <div class="goal-progress">
              <div class="progress-info">
                <span class="progress-text">
                  {{ goal.currentValue }} / {{ goal.targetValue }} {{ goal.unit }}
                </span>
                <span class="progress-percentage">
                  {{ Math.round((goal.currentValue / goal.targetValue) * 100) }}%
                </span>
              </div>
              <el-progress 
                :percentage="Math.round((goal.currentValue / goal.targetValue) * 100)"
                :color="getProgressColor(goal.currentValue / goal.targetValue)"
                :stroke-width="8"
              />
            </div>
            
            <div class="goal-timeline">
              <div class="timeline-item">
                <span class="timeline-label">开始时间：</span>
                <span>{{ formatDate(goal.startDate) }}</span>
              </div>
              <div class="timeline-item">
                <span class="timeline-label">截止时间：</span>
                <span :class="{ 'text-danger': isOverdue(goal.endDate) }">
                  {{ formatDate(goal.endDate) }}
                </span>
              </div>
              <div class="timeline-item">
                <span class="timeline-label">剩余时间：</span>
                <span :class="{ 'text-danger': isOverdue(goal.endDate) }">
                  {{ getRemainingTime(goal.endDate) }}
                </span>
              </div>
            </div>
            
            <div class="goal-footer">
              <el-button 
                type="primary" 
                size="small" 
                @click="updateProgress(goal)"
              >
                更新进度
              </el-button>
              <el-button 
                size="small" 
                @click="viewGoalDetails(goal)"
              >
                查看详情
              </el-button>
            </div>
          </el-card>
        </div>
      </div>
    </div>

    <!-- 历史目标 -->
    <div class="history-section">
      <div class="section-header">
        <h2>📈 历史目标</h2>
        <div class="filter-tabs">
          <el-button 
            v-for="status in ['all', 'completed', 'failed', 'paused']"
            :key="status"
            :type="historyFilter === status ? 'primary' : 'default'"
            size="small"
            @click="historyFilter = status"
          >
            {{ getStatusText(status) }}
          </el-button>
        </div>
      </div>
      
      <div class="history-list">
        <div 
          v-for="goal in filteredHistoryGoals" 
          :key="goal.id"
          class="history-item"
        >
          <el-card shadow="never">
            <div class="history-content">
              <div class="history-info">
                <div class="history-title">
                  <span class="goal-icon">{{ getGoalIcon(goal.type) }}</span>
                  <h4>{{ goal.title }}</h4>
                  <el-tag 
                    :type="getStatusType(goal.status)"
                    size="small"
                  >
                    {{ getStatusText(goal.status) }}
                  </el-tag>
                </div>
                <p class="history-description">{{ goal.description }}</p>
                <div class="history-meta">
                  <span>{{ formatDate(goal.startDate) }} - {{ formatDate(goal.endDate) }}</span>
                  <span>{{ goal.currentValue }} / {{ goal.targetValue }} {{ goal.unit }}</span>
                </div>
              </div>
              <div class="history-progress">
                <el-progress 
                  :percentage="Math.round((goal.currentValue / goal.targetValue) * 100)"
                  :color="getProgressColor(goal.currentValue / goal.targetValue)"
                  :stroke-width="6"
                />
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </div>

    <!-- 创建目标对话框 -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingGoal ? '编辑目标' : '创建新目标'" 
      width="600px"
      @close="resetForm"
    >
      <el-form 
        ref="formRef" 
        :model="goalForm" 
        :rules="formRules" 
        label-width="100px"
      >
        <el-form-item label="目标标题" prop="title">
          <el-input v-model="goalForm.title" placeholder="请输入目标标题" />
        </el-form-item>
        
        <el-form-item label="目标类型" prop="type">
          <el-select v-model="goalForm.type" placeholder="请选择目标类型">
            <el-option label="每日字数" value="daily" />
            <el-option label="每周字数" value="weekly" />
            <el-option label="每月字数" value="monthly" />
            <el-option label="总字数" value="total" />
            <el-option label="章节数" value="custom" />
            <el-option label="连续天数" value="streak_days" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="目标数值" prop="targetValue">
          <el-input-number 
            v-model="goalForm.targetValue" 
            :min="1" 
            :max="1000000"
            style="width: 100%;"
          />
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input 
            v-model="goalForm.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入目标描述（可选）"
          />
        </el-form-item>
        
        <el-form-item label="时间范围" prop="dateRange">
          <el-date-picker
            v-model="goalForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%;"
          />
        </el-form-item>
        
        <el-form-item label="提醒设置">
          <el-checkbox v-model="goalForm.reminder">开启提醒</el-checkbox>
          <el-time-picker
            v-if="goalForm.reminder"
            v-model="goalForm.reminderTime"
            placeholder="提醒时间"
            style="margin-left: 10px;"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveGoal">保存</el-button>
      </template>
    </el-dialog>

    <!-- 更新进度对话框 -->
    <el-dialog 
      v-model="showProgressDialog" 
      title="更新进度" 
      width="400px"
    >
      <div v-if="selectedGoal">
        <p>目标：{{ selectedGoal.title }}</p>
        <p>当前进度：{{ selectedGoal.currentValue }} / {{ selectedGoal.targetValue }} {{ selectedGoal.unit }}</p>
        
        <el-form label-width="80px">
          <el-form-item label="新增数值">
            <el-input-number 
              v-model="progressIncrement" 
              :min="0" 
              style="width: 100%;"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input 
              v-model="progressNote"
              type="textarea"
              :rows="2"
              placeholder="记录今天的创作心得（可选）"
            />
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <el-button @click="showProgressDialog = false">取消</el-button>
        <el-button type="primary" @click="saveProgress">保存</el-button>
      </template>
    </el-dialog>

    <!-- 目标详情对话框 -->
    <el-dialog 
      v-model="showDetailsDialog" 
      title="目标详情" 
      width="700px"
    >
      <div v-if="selectedGoal" class="goal-details">
        <div class="details-header">
          <h3>{{ selectedGoal.title }}</h3>
          <el-tag :type="getStatusType(selectedGoal.status)">
            {{ getStatusText(selectedGoal.status) }}
          </el-tag>
        </div>
        
        <div class="details-content">
          <el-row :gutter="20">
            <el-col :span="12">
              <div class="detail-item">
                <label>目标类型：</label>
                <span>{{ getGoalTypeText(selectedGoal.type) }}</span>
              </div>
              <div class="detail-item">
                <label>目标数值：</label>
                <span>{{ selectedGoal.targetValue }} {{ selectedGoal.unit }}</span>
              </div>
              <div class="detail-item">
                <label>当前进度：</label>
                <span>{{ selectedGoal.currentValue }} {{ selectedGoal.unit }}</span>
              </div>
              <div class="detail-item">
                <label>完成率：</label>
                <span>{{ Math.round((selectedGoal.currentValue / selectedGoal.targetValue) * 100) }}%</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <label>开始时间：</label>
                <span>{{ formatDate(selectedGoal.startDate) }}</span>
              </div>
              <div class="detail-item">
                <label>结束时间：</label>
                <span>{{ formatDate(selectedGoal.endDate) }}</span>
              </div>
              <div class="detail-item">
                <label>剩余时间：</label>
                <span>{{ getRemainingTime(selectedGoal.endDate) }}</span>
              </div>
              <div class="detail-item">
                <label>平均进度：</label>
                <span>{{ getAverageProgress(selectedGoal) }}</span>
              </div>
            </el-col>
          </el-row>
          
          <div class="progress-chart">
            <h4>进度趋势</h4>
            <div class="chart-placeholder">
              <p>进度图表（可集成 ECharts）</p>
            </div>
          </div>
          
          <div class="progress-history">
            <h4>更新记录</h4>
            <div class="history-timeline">
              <div 
                v-for="record in selectedGoal.progressHistory" 
                :key="record.id"
                class="timeline-item"
              >
                <div class="timeline-date">{{ formatDate(record.date) }}</div>
                <div class="timeline-content">
                  <div class="timeline-progress">+{{ record.increment }} {{ selectedGoal.unit }}</div>
                  <div class="timeline-note" v-if="record.note">{{ record.note }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { 
  Plus, Trophy, Medal, EditPen, Calendar, Clock, TrendCharts, Rank,
  MoreFilled, Edit, VideoPause, Delete
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCloudSync } from '../services/useCloudSync'

// 响应式数据
const cloudSync = useCloudSync()
const goals = ref([])
const showCreateDialog = ref(false)
const showProgressDialog = ref(false)
const showDetailsDialog = ref(false)
const historyFilter = ref('all')
const editingGoal = ref(null)
const selectedGoal = ref(null)
const progressIncrement = ref(0)
const progressNote = ref('')
const formRef = ref(null)

// 表单数据
const goalForm = ref({
  title: '',
  type: '',
  targetValue: 1000,
  description: '',
  dateRange: [],
  reminder: false,
  reminderTime: null
})

// 表单验证规则
const formRules = {
  title: [{ required: true, message: '请输入目标标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择目标类型', trigger: 'change' }],
  targetValue: [{ required: true, message: '请输入目标数值', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择时间范围', trigger: 'change' }]
}

// 从localStorage加载数据
const loadGoals = () => {
  const savedGoals = localStorage.getItem('writingGoals')
  if (savedGoals) {
    try {
      const parsedGoals = JSON.parse(savedGoals)
      goals.value = parsedGoals.map(goal => ({
        ...goal,
        startDate: new Date(goal.startDate),
        endDate: new Date(goal.endDate),
        progressHistory: goal.progressHistory || []
      }))
    } catch (error) {
      console.error('加载写作目标数据失败:', error)
      initializeDefaultGoals()
    }
  } else {
    initializeDefaultGoals()
  }
}

// 初始化默认目标数据
const initializeDefaultGoals = () => {
  // 不设置任何默认目标，让用户自己创建
  goals.value = []
  saveGoalsToStorage()
}

const saveGoalsToStorage = () => {
  try {
    localStorage.setItem('writingGoals', JSON.stringify(goals.value))
    // Sync to cloud
    cloudSync.saveConfig('writingGoals', goals.value)
    // 通知其他页面数据已更新
    if (window.refreshHomeData) {
      window.refreshHomeData()
    }
  } catch (error) {
    console.error('保存写作目标数据失败:', error)
    ElMessage.error('保存数据失败')
  }
}

// 计算属性
const activeGoals = computed(() => {
  return goals.value.filter(goal => goal.status === 'active').length
})

const completedGoals = computed(() => {
  return goals.value.filter(goal => goal.status === 'completed').length
})

const todayWords = computed(() => {
  // 从当前活跃的每日目标获取今日字数
  const dailyGoal = goals.value.find(goal => 
    goal.type === 'daily' && goal.status === 'active'
  )
  return dailyGoal ? dailyGoal.currentValue : 0
})

const writingStreak = computed(() => {
  // 从连续天数目标获取数据
  const streakGoal = goals.value.find(goal => 
    goal.type === 'streak_days' && goal.status === 'active'
  )
  return streakGoal ? streakGoal.currentValue : 0
})

const currentGoals = computed(() => {
  return goals.value.filter(goal => goal.status === 'active')
})

const filteredHistoryGoals = computed(() => {
  let result = goals.value.filter(goal => goal.status !== 'active')
  
  if (historyFilter.value !== 'all') {
    result = result.filter(goal => goal.status === historyFilter.value)
  }
  
  return result
})

// 方法
const getGoalIcon = (type) => {
  const icons = {
    daily: '📝',
    weekly: '📊',
    monthly: '📈',
    total: '📚',
    custom: '📖',
    streak_days: '🔥'
  }
  return icons[type] || '🎯'
}

const getGoalTypeText = (type) => {
  const texts = {
    daily: '每日字数',
    weekly: '每周字数',
    monthly: '每月字数',
    total: '总字数',
    custom: '章节数',
    streak_days: '连续天数'
  }
  return texts[type] || '未知类型'
}

const getProgressColor = (ratio) => {
  if (ratio >= 1) return '#67c23a'
  if (ratio >= 0.8) return '#e6a23c'
  if (ratio >= 0.5) return '#409eff'
  return '#f56c6c'
}

const getStatusType = (status) => {
  const types = {
    active: 'success',
    completed: 'success',
    failed: 'danger',
    paused: 'warning'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    all: '全部',
    active: '进行中',
    completed: '已完成',
    failed: '已失败',
    paused: '已暂停'
  }
  return texts[status] || '未知'
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-CN')
}

const isOverdue = (endDate) => {
  return new Date() > new Date(endDate)
}

const getRemainingTime = (endDate) => {
  const now = new Date()
  const end = new Date(endDate)
  const diff = end - now
  
  if (diff <= 0) return '已过期'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days > 0) return `${days}天`
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  return `${hours}小时`
}

const getAverageProgress = (goal) => {
  const totalDays = Math.ceil((new Date(goal.endDate) - new Date(goal.startDate)) / (1000 * 60 * 60 * 24))
  const passedDays = Math.ceil((new Date() - new Date(goal.startDate)) / (1000 * 60 * 60 * 24))
  const expectedProgress = (goal.targetValue / totalDays) * passedDays
  const actualProgress = goal.currentValue
  
  if (actualProgress >= expectedProgress) {
    return '超前进度'
  } else {
    return '需要加油'
  }
}

const editGoal = (goal) => {
  editingGoal.value = goal
  goalForm.value = {
    title: goal.title,
    type: goal.type,
    targetValue: goal.targetValue,
    description: goal.description,
    dateRange: [goal.startDate, goal.endDate],
    reminder: goal.reminder,
    reminderTime: goal.reminderTime
  }
  showCreateDialog.value = true
}

const pauseGoal = (goal) => {
  goal.status = 'paused'
  saveGoalsToStorage()
  ElMessage.success('目标已暂停')
}

const deleteGoal = async (goal) => {
  try {
    await ElMessageBox.confirm('确定要删除这个目标吗？', '确认删除', {
      type: 'warning'
    })
    
    const index = goals.value.findIndex(g => g.id === goal.id)
    if (index > -1) {
      goals.value.splice(index, 1)
      saveGoalsToStorage()
      ElMessage.success('删除成功')
    }
  } catch (error) {
    // 用户取消删除
  }
}

const updateProgress = (goal) => {
  selectedGoal.value = goal
  progressIncrement.value = 0
  progressNote.value = ''
  showProgressDialog.value = true
}

const viewGoalDetails = (goal) => {
  selectedGoal.value = goal
  showDetailsDialog.value = true
}

const saveGoal = async () => {
  try {
    await formRef.value.validate()
    
    const goalData = {
      ...goalForm.value,
      startDate: goalForm.value.dateRange[0],
      endDate: goalForm.value.dateRange[1],
      currentValue: 0,
      status: 'active',
      progressHistory: []
    }
    
    if (editingGoal.value) {
      // 编辑模式
      const index = goals.value.findIndex(g => g.id === editingGoal.value.id)
      if (index > -1) {
        goals.value[index] = { ...goals.value[index], ...goalData }
      }
      ElMessage.success('目标更新成功')
    } else {
      // 新增模式
      const newGoal = {
        ...goalData,
        id: Date.now()
      }
      goals.value.push(newGoal)
      ElMessage.success('目标创建成功')
    }
    
    saveGoalsToStorage()
    showCreateDialog.value = false
    resetForm()
  } catch (error) {
    // 验证失败
  }
}

const saveProgress = () => {
  if (progressIncrement.value > 0) {
    selectedGoal.value.currentValue += progressIncrement.value
    
    // 添加进度记录
    selectedGoal.value.progressHistory.unshift({
      id: Date.now(),
      date: new Date(),
      increment: progressIncrement.value,
      note: progressNote.value
    })
    
    // 检查是否完成目标
    if (selectedGoal.value.currentValue >= selectedGoal.value.targetValue) {
      selectedGoal.value.status = 'completed'
      ElMessage.success('🎉 恭喜！目标已完成！')
    } else {
      ElMessage.success('进度更新成功')
    }
    
    saveGoalsToStorage()
  }
  
  showProgressDialog.value = false
}

const resetForm = () => {
  goalForm.value = {
    title: '',
    type: '',
    targetValue: 1000,
    description: '',
    dateRange: [],
    reminder: false,
    reminderTime: null
  }
  editingGoal.value = null
}

// 生命周期
onMounted(() => {
  loadGoals()
  
  // 监听localStorage变化
  window.addEventListener('storage', (e) => {
    if (e.key === 'writingGoals') {
      loadGoals()
    }
  })
})
</script>

<style scoped>
.writing-goals {
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

.goals-overview {
  margin-bottom: 30px;
}

.overview-card {
  height: 100%;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: 15px;
}

.overview-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.overview-icon.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.overview-icon.completed {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.overview-icon.words {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.overview-icon.streak {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.overview-content {
  flex: 1;
}

.overview-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 5px;
}

.overview-label {
  font-size: 14px;
  color: #606266;
}

.active-goals-section {
  margin-bottom: 30px;
}

.active-goals-section h2 {
  margin: 0 0 20px 0;
  color: #303133;
}

.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.goal-card {
  height: 100%;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.goal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.goal-icon {
  font-size: 20px;
}

.goal-title h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.goal-description {
  margin-bottom: 20px;
}

.goal-description p {
  margin: 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.5;
}

.goal-progress {
  margin-bottom: 20px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-text {
  font-size: 14px;
  color: #303133;
}

.progress-percentage {
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
}

.goal-timeline {
  margin-bottom: 20px;
}

.timeline-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 13px;
}

.timeline-label {
  color: #909399;
}

.text-danger {
  color: #f56c6c;
}

.goal-footer {
  display: flex;
  gap: 10px;
}

.history-section {
  margin-bottom: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  margin: 0;
  color: #303133;
}

.filter-tabs {
  display: flex;
  gap: 10px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.history-item {
  width: 100%;
}

.history-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.history-info {
  flex: 1;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.history-title h4 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.history-description {
  margin: 0 0 8px 0;
  color: #606266;
  font-size: 14px;
}

.history-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #909399;
}

.history-progress {
  width: 200px;
}

.goal-details {
  max-height: 600px;
  overflow-y: auto;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #ebeef5;
}

.details-header h3 {
  margin: 0;
  color: #303133;
}

.details-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-item {
  display: flex;
  margin-bottom: 10px;
}

.detail-item label {
  font-weight: 500;
  color: #303133;
  min-width: 80px;
}

.progress-chart {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.progress-chart h4 {
  margin: 0 0 15px 0;
  color: #303133;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 6px;
  color: #909399;
}

.progress-history h4 {
  margin: 0 0 15px 0;
  color: #303133;
}

.history-timeline {
  max-height: 200px;
  overflow-y: auto;
}

.timeline-item {
  display: flex;
  gap: 15px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.timeline-date {
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
  min-width: 80px;
}

.timeline-content {
  flex: 1;
}

.timeline-progress {
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
  margin-bottom: 3px;
}

.timeline-note {
  font-size: 12px;
  color: #606266;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .goals-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
  
  .filter-tabs {
    flex-wrap: wrap;
  }
  
  .history-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .history-progress {
    width: 100%;
  }
}
</style>