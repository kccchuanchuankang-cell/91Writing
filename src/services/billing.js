import backendApi from './backend';

class BillingService {
  constructor() {
    this.initializeStorage()
  }

  // 初始化本地存储
  initializeStorage() {
    if (!localStorage.getItem('account_balance')) {
      localStorage.setItem('account_balance', '0.00') // 初始余额为0
    }
    if (!localStorage.getItem('billing_records')) {
      localStorage.setItem('billing_records', JSON.stringify([]))
    }
    if (!localStorage.getItem('token_usage_stats')) {
      localStorage.setItem('token_usage_stats', JSON.stringify({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        lastResetDate: new Date().toISOString()
      }))
    }
  }

  // 模型价格配置（每1000个token的价格，单位：人民币）
  getModelPricing() {
    return {
      'gpt-4': {
        input: 0.21,   // $0.03 * 7 (汇率)
        output: 0.42   // $0.06 * 7
      },
      'gpt-4-turbo': {
        input: 0.07,   // $0.01 * 7
        output: 0.21   // $0.03 * 7
      },
      'gpt-3.5-turbo': {
        input: 0.0035, // $0.0005 * 7
        output: 0.0105 // $0.0015 * 7
      },
      'claude-3-opus': {
        input: 0.105,  // $0.015 * 7
        output: 0.525  // $0.075 * 7
      },
      'claude-3-sonnet': {
        input: 0.021,  // $0.003 * 7
        output: 0.105  // $0.015 * 7
      },
      'claude-3-haiku': {
        input: 0.0014, // $0.00025 * 7
        output: 0.007  // $0.00125 * 7
      },
      'default': {
        input: 0.007,  // 默认价格
        output: 0.014
      }
    }
  }

  // 计算token使用费用
  calculateCost(model, inputTokens, outputTokens) {
    const pricing = this.getModelPricing()
    const modelPricing = pricing[model] || pricing['default']

    const inputCost = (inputTokens / 1000) * modelPricing.input
    const outputCost = (outputTokens / 1000) * modelPricing.output

    return inputCost + outputCost
  }

  // 估算prompt的token数量（粗略估算，1个中文字符约等于1.5个token）
  estimateTokens(text) {
    if (!text) return 0

    // 简单的token估算逻辑
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const otherChars = text.length - chineseChars - englishWords

    // 中文字符 * 1.5 + 英文单词 * 1.3 + 其他字符 * 0.5
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5)
  }

  // 获取账户余额
  getAccountBalance() {
    return parseFloat(localStorage.getItem('account_balance') || '0')
  }

  // 检查余额是否足够
  checkBalance(estimatedCost) {
    const balance = this.getAccountBalance()
    return balance >= estimatedCost
  }

  // 扣除费用
  deductBalance(amount) {
    const currentBalance = this.getAccountBalance()
    const newBalance = Math.max(0, currentBalance - amount)
    localStorage.setItem('account_balance', newBalance.toString())
    // Sync to cloud
    backendApi.post('/configs', { key: 'account_balance', value: newBalance.toString() }).catch(err => {
      console.error('Failed to sync balance to cloud:', err)
    })
    return newBalance
  }

  // 充值余额
  addBalance(amount) {
    const currentBalance = this.getAccountBalance()
    const newBalance = currentBalance + amount
    localStorage.setItem('account_balance', newBalance.toString())
    // Sync to cloud
    backendApi.post('/configs', { key: 'account_balance', value: newBalance.toString() }).catch(err => {
      console.error('Failed to sync balance to cloud:', err)
    })
    return newBalance
  }

  // 记录API调用
  recordAPICall(params) {
    try {
      const records = this.getBillingRecords()
      const cost = this.calculateCost(params.model, params.inputTokens, params.outputTokens)

      const record = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type: params.type || 'generation',
        model: params.model,
        content: params.content || '', // 保存完整的请求内容
        response: params.response || '', // 保存完整的响应内容
        inputTokens: params.inputTokens || 0,
        outputTokens: params.outputTokens || 0,
        totalTokens: (params.inputTokens || 0) + (params.outputTokens || 0),
        cost: cost,
        status: params.status || 'success'
      }

      records.unshift(record) // 最新记录放在前面

      // 只保留最近1000条记录
      if (records.length > 1000) {
        records.splice(1000)
      }

      localStorage.setItem('billing_records', JSON.stringify(records))
      // Sync to cloud
      backendApi.post('/configs', { key: 'billing_records', value: JSON.stringify(records) }).catch(err => {
        console.error('Failed to sync billing records to cloud:', err)
      })

      // 扣除费用
      this.deductBalance(cost)

      // 更新统计信息
      this.updateUsageStats(params.inputTokens || 0, params.outputTokens || 0, cost)

      console.log(`API调用记录：模型=${params.model}, 输入=${params.inputTokens}tokens, 输出=${params.outputTokens}tokens, 费用=¥${cost.toFixed(4)}`)

      return record
    } catch (error) {
      console.error('记录API调用失败:', error)
      return null
    }
  }

  // 获取计费记录
  getBillingRecords() {
    try {
      const records = localStorage.getItem('billing_records')
      return records ? JSON.parse(records) : []
    } catch (error) {
      console.error('获取计费记录失败:', error)
      return []
    }
  }

  // 更新使用统计
  updateUsageStats(inputTokens, outputTokens, cost) {
    try {
      const stats = JSON.parse(localStorage.getItem('token_usage_stats') || '{}')

      stats.totalInputTokens = (stats.totalInputTokens || 0) + inputTokens
      stats.totalOutputTokens = (stats.totalOutputTokens || 0) + outputTokens
      stats.totalCost = (stats.totalCost || 0) + cost
      stats.lastUpdateDate = new Date().toISOString()

      localStorage.setItem('token_usage_stats', JSON.stringify(stats))
      // Sync to cloud
      backendApi.post('/configs', { key: 'token_usage_stats', value: JSON.stringify(stats) }).catch(err => {
        console.error('Failed to sync token stats to cloud:', err)
      })
    } catch (error) {
      console.error('更新使用统计失败:', error)
    }
  }

  // 获取使用统计
  getUsageStats() {
    try {
      const stats = localStorage.getItem('token_usage_stats')
      return stats ? JSON.parse(stats) : {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        lastResetDate: new Date().toISOString()
      }
    } catch (error) {
      console.error('获取使用统计失败:', error)
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        lastResetDate: new Date().toISOString()
      }
    }
  }

  // 获取今日使用统计
  getTodayStats() {
    const records = this.getBillingRecords()
    const today = new Date().toDateString()

    const todayRecords = records.filter(record =>
      new Date(record.timestamp).toDateString() === today
    )

    return {
      tokenCount: todayRecords.reduce((sum, record) => sum + record.totalTokens, 0),
      cost: todayRecords.reduce((sum, record) => sum + record.cost, 0),
      requestCount: todayRecords.length
    }
  }

  // 获取最近N天的使用趋势
  getUsageTrend(days = 7) {
    const records = this.getBillingRecords()
    const trend = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateString = date.toDateString()

      const dayRecords = records.filter(record =>
        new Date(record.timestamp).toDateString() === dateString
      )

      trend.push({
        date: dateString,
        tokenCount: dayRecords.reduce((sum, record) => sum + record.totalTokens, 0),
        cost: dayRecords.reduce((sum, record) => sum + record.cost, 0),
        requestCount: dayRecords.length
      })
    }

    return trend
  }

  // 清除过期记录（保留最近30天）
  cleanOldRecords() {
    try {
      const records = this.getBillingRecords()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const filteredRecords = records.filter(record =>
        new Date(record.timestamp) > thirtyDaysAgo
      )

      localStorage.setItem('billing_records', JSON.stringify(filteredRecords))
      // Sync to cloud
      backendApi.post('/api/configs', { key: 'billing_records', value: JSON.stringify(filteredRecords) }).catch(err => {
        console.error('Failed to sync cleaned billing records to cloud:', err)
      })

      console.log(`清理了 ${records.length - filteredRecords.length} 条过期记录`)
    } catch (error) {
      console.error('清理过期记录失败:', error)
    }
  }

  // 导出计费数据
  exportBillingData(format = 'json') {
    const records = this.getBillingRecords()
    const stats = this.getUsageStats()

    const exportData = {
      exportTime: new Date().toISOString(),
      accountBalance: this.getAccountBalance(),
      usageStats: stats,
      records: records
    }

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2)
    } else if (format === 'csv') {
      // 简单的CSV格式
      let csv = 'timestamp,type,model,inputTokens,outputTokens,totalTokens,cost,status\n'
      records.forEach(record => {
        csv += `${record.timestamp},${record.type},${record.model},${record.inputTokens},${record.outputTokens},${record.totalTokens},${record.cost},${record.status}\n`
      })
      return csv
    }

    return exportData
  }
}

export default new BillingService() 